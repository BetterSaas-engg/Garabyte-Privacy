"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTenant, isUnauthorized, whoami } from "@/lib/api";
import { JURISDICTION_CODES } from "@/lib/types";

// Sector list — kept in sync with backend/app/schemas/tenant.py
// TenantCreate.sector regex and rules_loader KNOWN_SECTORS. Order
// matters for the dropdown UI (most-common first, "Other" last).
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

type Sector = typeof SECTORS[number]["value"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function NewTenantPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<"checking" | "yes" | "no">("checking");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sector, setSector] = useState<Sector>("other");
  const [jurisdiction, setJurisdiction] = useState("Canada");
  const [jurisdictionCodes, setJurisdictionCodes] = useState<string[]>(["CA"]);
  const [employees, setEmployees] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleCode(code: string) {
    setJurisdictionCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  // Garabyte admin only — see if the user qualifies before showing the form.
  useEffect(() => {
    whoami()
      .then((w) => {
        const ok = w.memberships.some((m) => m.role === "garabyte_admin");
        setAllowed(ok ? "yes" : "no");
      })
      .catch((e) => {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
        } else {
          setAllowed("no");
        }
      });
  }, [router]);

  // Auto-derive slug from name unless the user types one explicitly.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tenant = await createTenant({
        name: name.trim(),
        slug,
        sector,
        jurisdiction: jurisdiction.trim() || undefined,
        jurisdiction_codes: jurisdictionCodes.length > 0 ? jurisdictionCodes : undefined,
        employee_count: employees ? Number(employees) : undefined,
      });
      router.push(`/tenants/${tenant.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization");
      setSubmitting(false);
    }
  }

  if (allowed === "checking") {
    return <Layout><p className="text-sm text-garabyte-ink-500">Checking permissions…</p></Layout>;
  }

  if (allowed === "no") {
    return (
      <Layout>
        <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-4 py-3 text-sm text-garabyte-status-critical">
          You don&apos;t have permission to add organizations. Only Garabyte admins can create new client organizations.
        </div>
        <div className="mt-4">
          <Link href="/" className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700">
            ← Back to dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-3">
        Add a new client organization
      </p>
      <h1 className="text-h2 text-garabyte-primary-800 mb-2">New organization</h1>
      <p className="text-sm text-garabyte-ink-700 mb-6 max-w-prose">
        Create a tenant for a new client. After creation, you can invite their org admin to start the assessment.
      </p>

      {error && (
        <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-3 py-2 text-sm text-garabyte-status-critical mb-4">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 max-w-md">
        <Field label="Organization name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
        </Field>

        <Field label="Slug" sub="URL identifier — auto-derived from name, edit if needed">
          <Input
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            required
            pattern="[a-z0-9-]+"
            maxLength={64}
          />
        </Field>

        <Field label="Sector">
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as Sector)}
            className={selectClass}
          >
            {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>

        <Field label="Jurisdiction" sub="Free-text label shown on the report">
          <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} maxLength={128} />
        </Field>

        <Field label="Jurisdiction codes" sub="Filters which regulations are cited in findings">
          <div className="flex flex-wrap gap-2">
            {JURISDICTION_CODES.map((j) => {
              const active = jurisdictionCodes.includes(j.code);
              return (
                <button
                  key={j.code}
                  type="button"
                  onClick={() => toggleCode(j.code)}
                  className={
                    "text-xs px-2.5 py-1 rounded-md border transition-colors " +
                    (active
                      ? "bg-garabyte-primary-500 text-white border-garabyte-primary-500"
                      : "bg-white text-garabyte-ink-700 border-garabyte-ink-100 hover:border-garabyte-ink-300")
                  }
                >
                  {j.code} <span className={active ? "opacity-80" : "text-garabyte-ink-300"}>· {j.label}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Employee count" sub="Optional">
          <Input
            type="number"
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            min={1}
            max={10000000}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name || !slug}
            className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 disabled:bg-garabyte-primary-300 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create organization"}
          </button>
          <Link href="/" className="text-sm text-garabyte-ink-500 hover:text-garabyte-ink-700">
            Cancel
          </Link>
        </div>
      </form>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-3xl mx-auto">{children}</div>
    </main>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
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

const selectClass =
  "w-full h-9 px-3 pr-9 rounded-md text-sm bg-white text-garabyte-ink-900 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none appearance-none transition-colors";
