"use client";

/**
 * Public marketing landing page — shown at "/" when the visitor isn't
 * authenticated. Styled to match the rest of the app (navy-teal +
 * cream + editorial type), so it reads as continuous with the product
 * rather than as a separate marketing site.
 *
 * The CTAs deliberately don't include "Begin assessment" — the platform
 * is invitation-only, and an anonymous self-start path doesn't exist.
 * Instead the hero offers "Sign in" (for invited customers) and
 * "See sample report" (for prospective customers evaluating the tool).
 */

import Link from "next/link";

const DIMENSIONS = [
  { id: "d1", name: "Governance", body: "Roles, policies, and oversight that make decisions defensible." },
  { id: "d2", name: "Data inventory", body: "What personal data you hold, where it lives, and why." },
  { id: "d3", name: "Consent", body: "How consent is captured, recorded, and withdrawn across systems." },
  { id: "d4", name: "Individual rights", body: "Access, correction, deletion, and portability requests at scale." },
  { id: "d5", name: "Vendor management", body: "Third parties with access to personal data and their agreements." },
  { id: "d6", name: "Breach response", body: "Detection, notification timelines, and post-incident review." },
  { id: "d7", name: "Training", body: "Role-appropriate education for staff and leadership." },
  { id: "d8", name: "Privacy by design / AI", body: "Privacy in product decisions and oversight of automated systems." },
];

const REGULATIONS = [
  { name: "PIPEDA", body: "Office of the Privacy Commissioner of Canada" },
  { name: "Quebec Law 25", body: "Commission d’accès à l’information du Québec" },
  { name: "CASL", body: "Canadian Radio-television and Telecommunications Commission" },
  { name: "GDPR", body: "European Data Protection Board" },
  { name: "CCPA", body: "California Privacy Protection Agency" },
  { name: "AIDA", body: "Artificial Intelligence and Data Act (Canada)" },
];

const SAMPLE_DIMENSIONS = [
  { name: "Governance",          score: 82 },
  { name: "Data inventory",      score: 64 },
  { name: "Consent",             score: 71 },
  { name: "Individual rights",   score: 58 },
  { name: "Vendor management",   score: 41 },
  { name: "Breach response",     score: 76 },
  { name: "Training",            score: 53 },
  { name: "Privacy by design",   score: 18 },
];

function scoreColor(score: number): string {
  if (score >= 70) return "bg-garabyte-status-good";
  if (score >= 55) return "bg-garabyte-status-moderate";
  if (score >= 35) return "bg-garabyte-status-high";
  return "bg-garabyte-status-critical";
}

export function LandingPage() {
  return (
    <main className="min-h-[calc(100vh-73px)]">
      {/* Hero */}
      <section className="px-6 pt-16 pb-20">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-4">
              Privacy maturity assessment
              <span className="text-garabyte-ink-300 mx-2">·</span>
              <span className="text-garabyte-ink-500 normal-case tracking-normal">
                Co-designed with Garabyte Consulting
              </span>
            </p>
            <h1 className="text-display text-garabyte-primary-800 mb-5 leading-[1.05]">
              Know where your<br />privacy program<br />stands. Know<br />where to go next.
            </h1>
            <p className="text-base text-garabyte-ink-700 leading-relaxed max-w-xl mb-8">
              A scored, defensible read on your program against PIPEDA, Quebec Law 25,
              CASL, GDPR, CCPA, and AIDA — in about 40 minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center px-5 py-2.5 rounded-md bg-garabyte-primary-500 text-white text-sm font-medium hover:bg-garabyte-primary-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sample"
                className="inline-flex items-center px-5 py-2.5 rounded-md border border-garabyte-ink-100 text-garabyte-primary-700 text-sm font-medium hover:bg-garabyte-cream-100 transition-colors"
              >
                See sample report
              </Link>
            </div>
            <p className="text-xs text-garabyte-ink-500">
              Already invited? Sign in. New here? Talk to your privacy lead, or{" "}
              <a
                href="mailto:hello@garabyte.com"
                className="text-garabyte-primary-500 hover:text-garabyte-primary-700"
              >
                contact Garabyte
              </a>
              .
            </p>
          </div>

          {/* Sample report card — visual hint of what the product produces. */}
          <aside className="lg:col-span-5">
            <div className="rounded-xl bg-white border border-garabyte-ink-100 shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-garabyte-ink-100 bg-garabyte-cream-50/60 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-garabyte-ink-700">
                  <span className="w-2 h-2 rounded-full bg-garabyte-status-good" />
                  Sample report
                  <span className="text-garabyte-ink-300">·</span>
                  <span className="text-garabyte-ink-500">Acme Corp</span>
                </span>
                <span className="text-garabyte-ink-300 tabular-nums">v2026.04</span>
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium">
                    Overall maturity
                  </span>
                  <span className="text-[11px] text-garabyte-ink-500">8 dimensions</span>
                </div>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-[40px] leading-none font-medium tabular-nums text-garabyte-primary-800">
                    58
                  </span>
                  <span className="text-sm text-garabyte-ink-500">/ 100</span>
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-garabyte-accent-100 text-garabyte-accent-700 border border-garabyte-accent-200">
                    Developing
                  </span>
                </div>
                <ul className="space-y-1.5 text-[12px]">
                  {SAMPLE_DIMENSIONS.map((d) => (
                    <li key={d.name} className="grid grid-cols-[1fr_120px_28px] items-center gap-3">
                      <span className="text-garabyte-ink-700 truncate">{d.name}</span>
                      <span className="h-1.5 rounded-full bg-garabyte-ink-100 overflow-hidden">
                        <span
                          className={`block h-full ${scoreColor(d.score)}`}
                          style={{ width: `${d.score}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-garabyte-ink-700">{d.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-5 py-3 border-t border-garabyte-ink-100 bg-garabyte-cream-50/60 flex items-center justify-between text-[11.5px]">
                <span className="text-garabyte-ink-500">38 of 142 vendors flagged for follow-up</span>
                <Link href="/sample" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
                  View sample report →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Eight dimensions */}
      <section id="dimensions" className="px-6 py-16 border-t border-garabyte-ink-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between mb-8 gap-6 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-2">
                Eight dimensions
              </p>
              <h2 className="text-h2 text-garabyte-primary-800">What the assessment measures</h2>
            </div>
            <p className="text-sm text-garabyte-ink-500">
              Each dimension is scored 0–100 with a confidence level
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DIMENSIONS.map((d) => (
              <article
                key={d.id}
                className="rounded-xl bg-white border border-garabyte-ink-100 p-5 hover:border-garabyte-primary-300 transition-colors"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-[0.06em] text-garabyte-ink-500 font-mono">
                    {d.id}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-garabyte-ink-100" />
                </div>
                <h3 className="text-base font-medium text-garabyte-primary-800 mb-2">{d.name}</h3>
                <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">{d.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Regulatory coverage */}
      <section id="coverage" className="px-6 py-16 bg-garabyte-cream-100/60 border-y border-garabyte-ink-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between mb-8 gap-6 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-2">
                Regulatory coverage
              </p>
              <h2 className="text-h2 text-garabyte-primary-800">
                Findings map to the regulations that apply to you
              </h2>
            </div>
            <p className="text-sm text-garabyte-ink-500">Six frameworks · updated quarterly</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {REGULATIONS.map((r) => (
              <article key={r.name} className="rounded-xl bg-white border border-garabyte-ink-100 p-5">
                <h3 className="text-base font-medium text-garabyte-primary-800 mb-1.5">{r.name}</h3>
                <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-2">
              How it works
            </p>
            <h2 className="text-h2 text-garabyte-primary-800">Three steps from question to plan</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Step
              number="01"
              meta="About 40 minutes"
              title="Take the assessment"
              body="Answer 86 structured questions. Attach supporting documents where you have them. Skip what doesn’t apply — the engine records that as a gap, not an error."
            />
            <Step
              number="02"
              meta="Generated in minutes"
              title="Receive your scored gap report"
              body="A score per dimension with a confidence level, mapped findings against six regulations, and a prioritized list of gaps with recommended next actions."
            />
            <Step
              number="03"
              meta="Optional, 60 minutes"
              title="Review with a consultant"
              body="A Garabyte privacy consultant walks you through findings and helps you build a remediation plan you can defend under regulator scrutiny."
            />
          </div>
        </div>
      </section>

      {/* Co-designed callout */}
      <section className="px-6 py-14 bg-garabyte-cream-100/60 border-y border-garabyte-ink-100">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[200px_1fr] gap-6 items-start">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-7 h-7 rounded-md bg-garabyte-primary-800 text-white flex items-center justify-center text-sm font-medium">
                g
              </span>
              <span className="text-sm font-medium text-garabyte-primary-800">Garabyte Consulting</span>
            </div>
            <p className="text-xs text-garabyte-ink-500">Co-designed with</p>
          </div>
          <p className="text-base text-garabyte-ink-700 leading-relaxed max-w-2xl">
            The scoring rubric, the question set, and the regulatory mappings were built with
            Garabyte Consulting’s privacy practice. Their team works with Canadian and EU
            organizations on PIPEDA, Law 25, and GDPR programs. The findings this product
            produces are the ones their consultants would write by hand — structured, scored,
            and ready to defend.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto rounded-xl border border-garabyte-ink-100 bg-white p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-2">
              Get started
            </p>
            <h2 className="text-h2 text-garabyte-primary-800 leading-tight">
              The assessment ends with a scored report you can share with your board.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center px-5 py-2.5 rounded-md bg-garabyte-primary-500 text-white text-sm font-medium hover:bg-garabyte-primary-600 transition-colors"
            >
              Sign in
            </Link>
            <a
              href="mailto:hello@garabyte.com"
              className="inline-flex items-center px-5 py-2.5 rounded-md border border-garabyte-ink-100 text-garabyte-primary-700 text-sm font-medium hover:bg-garabyte-cream-100 transition-colors"
            >
              Talk to Garabyte
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Step({
  number,
  meta,
  title,
  body,
}: {
  number: string;
  meta: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-xl bg-white border border-garabyte-ink-100 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-sm font-mono text-garabyte-ink-500">{number}</span>
        <span className="text-[11px] text-garabyte-ink-500">{meta}</span>
      </div>
      <h3 className="text-base font-medium text-garabyte-primary-800 mb-2">{title}</h3>
      <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">{body}</p>
    </article>
  );
}
