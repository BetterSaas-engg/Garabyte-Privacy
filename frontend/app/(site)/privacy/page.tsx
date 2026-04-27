/**
 * Public privacy notice. Drawn from docs/privacy.md but stripped of
 * the working-doc TODO markers — this is the customer-facing version.
 *
 * Anywhere the working doc deferred to Garabyte ops/legal, this page
 * reflects the current commitment. Items marked "Pending" here are
 * those Garabyte still needs to finalize before first customer; the
 * page is honest about that rather than papering over it.
 */

import Link from "next/link";

export const metadata = {
  title: "Privacy notice",
  description:
    "How the Garabyte Privacy Health Check handles its own customer data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-10">
      <article className="max-w-3xl mx-auto prose prose-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          Privacy notice
        </p>
        <h1 className="text-h1 text-garabyte-primary-800 mb-3">
          How we handle your data
        </h1>
        <p className="text-sm text-garabyte-ink-500 mb-8">
          Last reviewed April 2026. Material changes are versioned in git
          and announced by email to customers under active engagement.
        </p>

        <Section title="Who this applies to">
          <p>
            This notice covers the data the Garabyte Privacy Health Check
            platform itself collects and stores about your organization.
            It is the privacy posture of the product — distinct from
            Garabyte Consulting&apos;s broader practice, which has its
            own retention and handling rules described in your engagement
            contract.
          </p>
        </Section>

        <Section title="What we collect">
          <Table
            rows={[
              ["Tenant metadata", "name, slug, sector, jurisdiction codes, employee count", "Postgres (Railway managed)"],
              ["Assessment responses", "question id, value 0–4, free-text notes, evidence links", "Postgres"],
              ["Evidence files", "files you upload to support your answers (PDF, Office, images, ≤10 MB)", "Application file storage"],
              ["Account data", "name, email, password hash (Argon2id), session metadata", "Postgres"],
              ["Audit log", "every privileged action — read, edit, publish, delete — with actor user, IP, timestamp", "Postgres (append-only)"],
              ["Server access logs", "IP, path, HTTP status — no request bodies", "Railway log retention"],
            ]}
            head={["Data", "Detail", "Where it lives"]}
          />
          <p className="mt-4">
            We do <strong>not</strong> use cookies for tracking, embed
            third-party analytics SDKs, or fingerprint browsers. Session
            cookies are httpOnly, SameSite=Lax, and used only to
            authenticate you to your own organization&apos;s data.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Active engagement plus <strong>12 months</strong> by default.
            We delete a tenant and all dependent data (assessments,
            responses, findings, evidence files, share links) on a Garabyte
            admin&apos;s instruction or when the retention period elapses.
            See <Link href="#dsar" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">your rights</Link> for how
            to ask for earlier deletion.
          </p>
          <p className="mt-3">
            Audit-log rows survive tenant deletion (FK is{" "}
            <code className="text-[12px]">SET NULL</code>) so we can answer
            a regulator&apos;s &quot;what happened to org X&quot; question after the
            data itself is gone. The audit log itself is retained for{" "}
            <strong>seven years</strong>.
          </p>
        </Section>

        <Section title="How we protect it">
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>
              <strong>In transit:</strong> HTTPS terminated at Vercel
              (frontend) and Railway (backend). TLS between backend and
              Postgres is enforced by Railway&apos;s managed database service.
            </li>
            <li>
              <strong>At rest:</strong> Postgres on Railway is encrypted at
              rest by the underlying storage layer. Evidence files are
              stored on application volumes with restricted ACLs.
            </li>
            <li>
              <strong>Access control:</strong> session-cookie auth with
              role-based access, per-tenant isolation, and dimension-level
              scoping for section contributors. Every read of a customer
              record is gated by an explicit membership check; every check
              is audit-logged.
            </li>
            <li>
              <strong>Passwords:</strong> hashed with Argon2id
              (memory-hard). We never store plaintext.
            </li>
            <li>
              <strong>File uploads:</strong> magic-byte verified against
              the reported MIME, capped at 10 MB, served as{" "}
              <code className="text-[12px]">Content-Disposition: attachment</code>
              {" "}with{" "}
              <code className="text-[12px]">X-Content-Type-Options: nosniff</code>
              {" "}so a malicious file can&apos;t render in-browser to leak
              cookies.
            </li>
          </ul>
        </Section>

        <Section title="Subprocessors">
          <Table
            rows={[
              ["Vercel", "Frontend hosting", "Page requests only — no API payloads"],
              ["Railway", "Backend hosting + Postgres + log retention", "Full database, server logs"],
              ["GitHub", "Source code + CI", "No customer data — only code + commit metadata"],
              ["Email provider", "Transactional email for invitations, magic links, notifications", "Recipient address + email body"],
            ]}
            head={["Vendor", "Role", "Data they see"]}
          />
          <p className="mt-3 text-[13px] text-garabyte-ink-500">
            Email-provider selection and DPA links are pending finalization.
            Until they ship, transactional emails route through a logging
            stub in development environments only.
          </p>
        </Section>

        <Section title="Your rights" anchor="dsar">
          <p>
            Within 30 days of a verified request — the strictest applicable
            window across PIPEDA, Quebec Law 25, and GDPR — you can:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5 mt-3">
            <li><strong>Access</strong> the data we hold for your organization, via the dashboard or by request.</li>
            <li><strong>Correct</strong> any inaccurate response by updating it directly in the assessment.</li>
            <li><strong>Delete</strong> your tenant and all related data (cascades through assessments, responses, findings, evidence, share links, memberships).</li>
            <li><strong>Export</strong> a JSON copy of your scored result via the API. PDF export is on the roadmap.</li>
            <li><strong>Object</strong> to processing — though the only processing we do is the maturity scoring you commissioned.</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact{" "}
            <a
              href="mailto:privacy@garabyte.com"
              className="text-garabyte-primary-500 hover:text-garabyte-primary-700"
            >
              privacy@garabyte.com
            </a>
            . The full operational runbook (intake, identity verification,
            re-deletion policy if a backup restores deleted data, signed
            artifact) is available to customers on request.
          </p>
        </Section>

        <Section title="Breach notification">
          <p>
            If we become aware of a confirmed breach affecting your data,
            we will notify your designated privacy lead within{" "}
            <strong>72 hours</strong> of confirmation. The notification will
            cover what happened, what data was affected, what we&apos;re
            doing about it, and what you should do. This commitment is
            stricter than what GDPR Article 33 mandates to the supervisory
            authority and matches what a defensible incident-response
            program looks like in practice.
          </p>
        </Section>

        <Section title="Changes to this notice">
          <p>
            Material changes — new subprocessor, new data category, changes
            to retention or deletion — are versioned in git, dated above,
            and announced to active-engagement customers by email. The full
            change history is available on request.
          </p>
        </Section>

        <Section title="Eating our own dog food">
          <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">
            This product scores eight privacy dimensions. We hold ourselves
            to the same. The most honest gut-check on whether the platform
            is ready to be sold is to score the platform&apos;s own program
            against d1–d8. Garabyte runs that exercise quarterly; the
            findings inform this notice.
          </p>
        </Section>

        <p className="text-[11px] text-garabyte-ink-300 mt-12 text-center">
          Garabyte Privacy Health Check · co-designed with Garabyte Consulting
        </p>
      </article>
    </main>
  );
}

function Section({
  title,
  anchor,
  children,
}: {
  title: string;
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={anchor} className="mb-10">
      <h2 className="text-h3 text-garabyte-primary-800 mb-3 mt-8">{title}</h2>
      <div className="text-[14px] text-garabyte-ink-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="rounded-md border border-garabyte-ink-100 overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-garabyte-cream-100/60 text-[10.5px] uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-garabyte-ink-100 align-top text-garabyte-ink-700"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
