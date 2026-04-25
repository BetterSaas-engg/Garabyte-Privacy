"""
Auth package — phase 3 of the audit.

See docs/auth-design.md for design rationale and docs/roles-and-permissions.md
for the behavioral contract.

Module layout:
- service.py — pure helpers: hash/verify password, mint/consume tokens,
               create/read/revoke sessions, log_access
- email.py   — email sender; stub in dev (prints to stdout)
- schemas.py — Pydantic request/response shapes for the auth endpoints
- deps.py    — FastAPI dependencies: get_current_user, require_membership
- routes.py  — POST /auth/signup, /verify-email, /login, /logout
"""
