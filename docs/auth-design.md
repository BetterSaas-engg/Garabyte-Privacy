# Phase 3 — Auth implementation design

This document is the **how** for Phase 3 of the audit (closing C1 and C2). The **what** — the behavioral contract for who can see and do what — lives in [roles-and-permissions.md](roles-and-permissions.md). That document defines roles, the permission matrix, and 22 numbered conditional rules (C1–C22) cited throughout this design.

---

## Decisions, made up front

These are the defaults. Each has a reason; flip with care.

| Decision | Pick | Reason |
|---|---|---|
| Session model | **httpOnly secure cookie + server-side `sessions` table** | No JWT-in-localStorage XSS surface. Sessions are revocable on logout / password reset / role change. Postgres is already there; Redis would be premature. |
| Cookie attributes | `Secure; HttpOnly; SameSite=Lax; Path=/` | Lax (not Strict) so navigation from email links works. Secure forces HTTPS in prod (set by env). |
| Session lifetime | 14 days idle, 30 days absolute | Refreshes on each authenticated request up to absolute. After absolute, re-login. |
| Password hashing | **argon2id** via `argon2-cffi` | OWASP-recommended over bcrypt. Library is stable and pinned. |
| One-time tokens (verify, magic, reset, invite) | One unified `verification_tokens` table, one row per token, single-use | One pattern, one query path, one expiry policy. |
| CSRF | Double-submit cookie pattern | Adequate for SameSite=Lax + httpOnly. No third-party iframe embeds, so this isn't elaborate. |
| Frontend → backend auth flow | Frontend `POST /auth/login` returns `Set-Cookie`; subsequent requests carry the cookie automatically | No bearer-token plumbing in `lib/api.ts`. Just `credentials: "include"` on `fetch`. |
| Password complexity | length ≥ 12, no other requirements (NIST SP 800-63B) | The bundle's design uses length-based strength, not Character Class Theatre. |

---

## Data model

### New tables

```
users
  id              SERIAL PRIMARY KEY
  email           TEXT UNIQUE NOT NULL  -- normalize lowercase, trim
  password_hash   TEXT  -- nullable; null while email-only signup is pending
  email_verified  TIMESTAMPTZ  -- null = unverified
  name            TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No "role" column. Roles live on org_memberships per the spec
  -- (a single user can be admin in one org and contributor in another).

organizations
  -- Renamed conceptually from `tenants` but we keep the table name to
  -- avoid a costly migration. Code refers to it as Tenant; product
  -- copy says "organization." The spec says "organization." Pick one
  -- canonical word in code over the next refactor pass.
  -- (Existing fields unchanged: id, slug, name, sector, jurisdiction,
  -- employee_count, is_demo, created_at)

org_memberships
  id              SERIAL PRIMARY KEY
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  org_id          INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  role            TEXT NOT NULL CHECK (role IN (
                    'org_admin', 'section_contributor', 'org_viewer',
                    'consultant', 'rules_editor', 'garabyte_admin'
                  ))
  -- For section_contributor only: which dimensions they can see/edit.
  -- NULL means "not applicable" (admins, viewers, consultants).
  -- Empty array means "contributor with no assignments yet."
  dimension_ids   TEXT[]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  UNIQUE (user_id, org_id)

sessions
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  expires_at      TIMESTAMPTZ NOT NULL  -- absolute expiry
  ip              INET
  user_agent      TEXT
  -- The cookie holds the id. The id is the session identity.
  -- No JWT, no signing — DB lookup is the source of truth.

verification_tokens
  id              SERIAL PRIMARY KEY
  token_hash      TEXT NOT NULL UNIQUE  -- sha256(plaintext); plaintext only in email
  user_id         INT REFERENCES users(id) ON DELETE CASCADE  -- null for invitations to non-existent users
  email           TEXT NOT NULL  -- intended recipient; must match user.email when consumed
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'email_verify', 'magic_link', 'password_reset',
                    'invitation'
                  ))
  payload         JSONB  -- {role, dimension_ids, org_id} for invitations; null otherwise
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  expires_at      TIMESTAMPTZ NOT NULL  -- 24h for verify/magic/reset; 7d for invitations
  consumed_at     TIMESTAMPTZ  -- null until used; single-use enforced

-- Audit log: every privileged read and every write.
-- Required by R&P spec (C8 evidence download watermark, C22 historical
-- access logged not browsable) and audit M23.
access_log
  id              BIGSERIAL PRIMARY KEY
  at              TIMESTAMPTZ NOT NULL DEFAULT now()
  user_id         INT REFERENCES users(id) ON DELETE SET NULL
  org_id          INT REFERENCES tenants(id) ON DELETE SET NULL
  action          TEXT NOT NULL  -- 'tenant.read', 'assessment.score', 'finding.edit', etc.
  resource_kind   TEXT  -- 'assessment' | 'response' | 'evidence' | 'finding'
  resource_id     INT
  ip              INET
  context         JSONB  -- variable shape per action
```

### Relationship to existing models

- `Tenant` is unchanged. The conceptual rename to "organization" is documentation-only for this phase.
- `Assessment` and `Response` keep their existing FKs to `Tenant`. Ownership is enforced via the `org_membership` join (a user can read an assessment iff they have a non-revoked membership in its tenant with a role that grants read).
- The audit's H12 (`FindingAnnotation`) and H11 (`Finding` as first-class) are **out of scope for Phase 3**. They're Phase 5 work that depends on this auth model being in place first.

---

## Library choices

```diff
# backend/requirements.txt — additions
+ argon2-cffi>=23.1.0       # password hashing
+ itsdangerous>=2.2.0       # token signing for cookies + verification tokens
+ email-validator>=2.2.0    # RFC-correct email parsing for signup
+ slowapi>=0.1.9            # rate limiting (H2 — small, lands in this phase)
```

No `fastapi-users`, no `python-jose`, no JWT lib. The session model is simple enough that hand-rolled is more readable than pulling a framework. (`itsdangerous` is for signing the verification token's plaintext, not for sessions — sessions use a random UUID stored DB-side.)

---

## Code organization

```
backend/app/
├── auth/
│   ├── __init__.py
│   ├── models.py        # User, OrgMembership, Session, VerificationToken, AccessLog
│   ├── schemas.py       # SignupIn, LoginIn, etc. (Pydantic)
│   ├── service.py       # hash_password, create_session, send_email_token (stub for now)
│   ├── deps.py          # get_current_user, require_role, require_org_membership
│   └── routes.py        # POST /auth/signup, /login, /logout, /verify-email, etc.
├── routes/
│   ├── tenants.py       # existing — gain auth + ownership checks
│   ├── assessments.py   # existing — gain auth + ownership checks
│   └── ...
└── main.py              # mount auth router; include_router(auth_routes.router)
```

---

## Dependency injection — the ownership check

The single most important pattern. Every route that touches tenant-scoped data takes `current_user: User = Depends(get_current_user)` and validates the tenant_id against `current_user`'s memberships.

```python
# backend/app/auth/deps.py

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from .models import User, OrgMembership

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    sid = request.cookies.get("gp_session")
    if not sid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    sess = db.query(SessionRow).filter(SessionRow.id == sid).first()
    if not sess or sess.expires_at < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    sess.last_seen_at = utcnow()  # rolling refresh; commit handled by middleware
    return sess.user

def require_membership(
    org_id: int,
    *,
    roles: tuple[str, ...] = ("org_admin",),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrgMembership:
    """
    Returns the membership row if (user, org_id, role∈roles) exists.
    Raises 403 otherwise. Always logs the attempt to access_log.
    """
    m = db.query(OrgMembership).filter(
        OrgMembership.user_id == user.id,
        OrgMembership.org_id == org_id,
    ).first()
    log_access(db, user.id, org_id, action="membership.check",
               context={"required": list(roles), "got": m.role if m else None})
    if not m or m.role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized for this org")
    return m
```

Routes wire it through `Depends`:

```python
# backend/app/routes/assessments.py

@assessments_router.get("/{assessment_id}/result")
def get_result(
    assessment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    # IDOR prevention (audit C2)
    require_membership(a.tenant_id, roles=("org_admin", "org_viewer", "consultant"),
                       user=user, db=db)
    if a.status != "completed":
        raise HTTPException(400, "Not yet scored")
    log_access(db, user.id, a.tenant_id, action="assessment.read",
               resource_kind="assessment", resource_id=a.id)
    return AssessmentResultOut(assessment=a, result=a.result_json)
```

The `require_membership` call IS the C2 fix — every read filters by ownership.

---

## Sub-sequencing within Phase 3

Each step is small enough to land independently. CI passes after each one.

1. **Schema migration** — Alembic migration adding `users`, `org_memberships`, `sessions`, `verification_tokens`, `access_log`. Empty tables; no behavior change yet.
2. **Auth service module** — `hash_password`, `verify_password`, `create_session`, token mint/consume helpers. Pure functions, unit-testable in isolation.
3. **Email sender stub** — A no-op for now that prints the link to stdout in dev and writes it to a `pending_emails` log in test. Real SMTP wiring is not Phase 3.
4. **Signup + verify + login + logout endpoints** — `/auth/signup`, `/auth/verify-email`, `/auth/login`, `/auth/logout`. Magic link, password reset, and invitation acceptance can ship in this same step or as a fast-follow.
5. **`get_current_user` + middleware** — session cookie reading, rolling refresh.
6. **`require_membership` dependency** — wraps every route. Wired in *the same PR* that adds the auth check, so there's never a window where some routes are protected and others aren't.
7. **Bootstrap** — for fresh dev environments, a CLI command `python -m app.bootstrap` creates a default Garabyte admin user. For prod, the same command takes args.
8. **Frontend auth flow** — port the bundle's `Auth.html` screens (signup/login/magic/reset/invite) into Next.js pages under `app/(site)/auth/`. The existing `lib/api.ts` gains `credentials: "include"` on every fetch.
9. **Existing route migration** — every protected route gets `Depends(get_current_user)` and `require_membership`. Tests update to log in first.
10. **Rate limiting** (H2) lands here as a small slowapi middleware. `100/minute` global, `10/minute` on `/auth/login` and `/auth/signup`.

The cumulative effect: after step 6 lands, the API is locked down. Step 8 onwards is making the existing UI work against a locked API. Step 9 catches anything missed. Step 10 hardens against brute-force.

---

## What this design does NOT cover (yet)

These come after Phase 3 lands, in the order they affect the consultant console UI:

- **Multi-stakeholder delegation** — per-question `answered_by`, dimension assignment UI, escalation flow. R&P sections 4a, 4b. Audit Phase 5 #22.
- **Consultant override layer** — `Finding` and `FindingAnnotation` tables. R&P C13/C14. Audit H12 + Phase 5 #23.
- **Read-only signed share links** — for board members without accounts. R&P C21. Token-bound, expires, rate-limited, access-logged.
- **Garabyte admin "support access" elevation** — explicit logged elevation when a Garabyte admin reads into a customer they're not assigned to. R&P C4.

Each of these has a place in the audit's Phase 5 strategic list and depends on this Phase 3 model existing first.

---

## Verification

Per-PR check at each sub-step. After step 6:

- `pytest test_auth.py -v` — happy path, expired session, wrong tenant ID, missing cookie, wrong role
- `curl -i http://localhost:8001/tenants` returns 401 (was 200)
- `curl -i -H "Cookie: gp_session=$(login_as_user_a)" http://localhost:8001/assessments/1/result` returns 200 if user A owns it, 403 otherwise
- `alembic check` confirms migrations match models
- All existing test files (`test_scoring.py`, `test_rules_loader.py`, etc.) still pass — they don't go through auth, they instantiate the engine directly. That's correct; auth is a layer above the engine.
