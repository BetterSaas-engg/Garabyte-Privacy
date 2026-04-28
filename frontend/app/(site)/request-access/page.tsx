"use client";

import { useState } from "react";
import Link from "next/link";
import { submitAccessRequest } from "@/lib/api";

const SECTORS = [
  { value: "saas",                label: "SaaS / software" },
  { value: "healthcare",          label: "Healthcare" },
  { value: "financial_services",  label: "Financial services" },
  { value: "utility",             label: "Utility" },
  { value: "telecom",             label: "Telecom" },
  { value: "retail",              label: "Retail" },
  { value: "non_profit",          label: "Non-profit" },
  { value: "government",          label: "Government" },
  { value: "other",               label: "Other" },
] as const;

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [sector, setSector] = useState("");
  const [employees, setEmployees] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitAccessRequest({
        name: name.trim(),
        email: email.trim(),
        org_name: org.trim(),
        sector: sector || undefined,
        employee_count: employees ? Number(employees) : undefined,
        message: message.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <article className="max-w-xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          Request access
        </p>
        <h1 className="text-h1 text-garabyte-primary-800 mb-3">
          Get in touch about an engagement
        </h1>
        <p className="text-[14.5px] text-garabyte-ink-700 leading-relaxed mb-8">
          The Privacy Health Check is invitation-only — every customer
          starts with a conversation about scope, regulatory exposure, and
          fit. Tell us about your organization and we&apos;ll be in touch
          within two business days.
        </p>

        {done ? (
          <div className="rounded-xl border border-garabyte-status-good/30 bg-garabyte-status-good/5 px-5 py-6">
            <h2 className="text-h3 text-garabyte-primary-800 mb-2">Got it.</h2>
            <p className="text-[14px] text-garabyte-ink-700 leading-relaxed">
              We&apos;ve received your request and will be in touch within
              two business days. In the meantime, the{" "}
              <Link href="/sample" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
                sample report
              </Link>{" "}
              shows what the deliverable looks like.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-3 py-2 text-sm text-garabyte-status-critical">
                {error}
              </div>
            )}

            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoComplete="name" />
            </Field>

            <Field label="Work email">
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required maxLength={255} autoComplete="email"
              />
            </Field>

            <Field label="Organization name">
              <Input value={org} onChange={(e) => setOrg(e.target.value)} required maxLength={255} autoComplete="organization" />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Sector" sub="Optional">
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full h-9 px-3 pr-9 rounded-md text-sm bg-white border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none appearance-none transition-colors"
                >
                  <option value="">— Select —</option>
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Approx. employees" sub="Optional">
                <Input
                  type="number" value={employees} onChange={(e) => setEmployees(e.target.value)}
                  min={1} max={10000000}
                />
              </Field>
            </div>

            <Field label="Anything else?" sub="What's driving the assessment? (optional)">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Upcoming Law 25 audit, new EU expansion, board ask, etc."
                className="w-full px-3 py-2 rounded-md text-sm bg-white text-garabyte-ink-900 placeholder:text-garabyte-ink-300 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none transition-colors resize-y"
              />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim() || !org.trim()}
                className="text-sm px-5 py-2.5 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 disabled:bg-garabyte-primary-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              <Link href="/" className="text-sm text-garabyte-ink-500 hover:text-garabyte-ink-700">
                Cancel
              </Link>
            </div>

            <p className="text-[11.5px] text-garabyte-ink-500 pt-2">
              We&apos;ll only use this information to evaluate fit and follow up.
              See the <Link href="/privacy" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">privacy notice</Link> for details.
            </p>
          </form>
        )}
      </article>
    </main>
  );
}

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">
        {label}
        {sub && <span className="ml-2 normal-case tracking-normal text-garabyte-ink-300">— {sub}</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 px-3 rounded-md text-sm bg-white text-garabyte-ink-900 placeholder:text-garabyte-ink-300 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none transition-colors"
    />
  );
}
