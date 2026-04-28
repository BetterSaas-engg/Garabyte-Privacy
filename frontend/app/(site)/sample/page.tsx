/**
 * Public sample report — what a finished assessment looks like for
 * a fictional customer ("Acme Corp v2026.04"). Linked to from the
 * landing page so prospects can evaluate the output before committing
 * to an engagement.
 *
 * Hardcoded data on purpose: a real published report would reach the
 * authenticated /share/{token} surface with rate-limiting and audit
 * logging. /sample is a marketing artifact; keeping it static avoids
 * the operational overhead of seeding a permanent demo tenant and
 * share token.
 */

import Link from "next/link";

const TENANT_NAME = "Acme Corp";
const REPORT_VERSION = "v2026.04";
const OVERALL_SCORE = 58;
const OVERALL_MATURITY = "Developing";

const DIMENSIONS: { id: string; name: string; score: number; maturity: string }[] = [
  { id: "d1", name: "Governance",                score: 82, maturity: "Optimized" },
  { id: "d2", name: "Data inventory & mapping",  score: 64, maturity: "Defined" },
  { id: "d3", name: "Consent & notice",          score: 71, maturity: "Managed" },
  { id: "d4", name: "Individual rights",         score: 58, maturity: "Developing" },
  { id: "d5", name: "Vendor management",         score: 41, maturity: "Developing" },
  { id: "d6", name: "Breach response",           score: 76, maturity: "Managed" },
  { id: "d7", name: "Training & awareness",      score: 53, maturity: "Developing" },
  { id: "d8", name: "Privacy by design / AI",    score: 18, maturity: "Ad hoc" },
];

type Severity = "critical" | "high" | "moderate" | "low";

const FINDINGS: {
  dim: string;
  severity: Severity;
  title: string;
  body: string;
  recommendation: string;
  regulatory?: string;
  hours?: number;
}[] = [
  {
    dim: "d8",
    severity: "critical",
    title: "AI deployment without privacy review",
    body: "Acme is deploying customer-facing models (support triage, lead scoring) without a documented privacy-impact assessment or human-in-the-loop oversight. No formal record of training data lineage.",
    recommendation: "Stand up a privacy-by-design checklist gated to model rollout. Backfill DPIAs for the two existing production models in the next 60 days. Block further AI rollouts until the gate is in place.",
    regulatory: "Anticipates AIDA s.7 obligations on high-impact systems. PIPEDA Principle 4 (limiting collection) is engaged once training data is sourced from production records.",
    hours: 32,
  },
  {
    dim: "d5",
    severity: "high",
    title: "Third-party agreements lack data-processing terms",
    body: "38 of 142 vendors with access to personal data don't have a current Data Processing Agreement on file. Of those, 9 are critical infrastructure vendors (payments, email, CRM).",
    recommendation: "Prioritize the 9 critical vendors for DPA execution within 30 days. The remaining 29 are eligible for a templated bulk amendment Garabyte can ship in the next quarter.",
    regulatory: "PIPEDA Principle 1 (accountability) and GDPR Art. 28 both require a written processor agreement. CASL §6 implications for any vendor handling marketing identifiers.",
    hours: 24,
  },
  {
    dim: "d7",
    severity: "high",
    title: "Privacy training is annual but not role-targeted",
    body: "All staff complete the same 30-minute module annually. Engineering, customer support, and recruiting see disproportionate access to PII but receive no role-specific training.",
    recommendation: "Introduce three role-specific tracks (engineering, support, recruiting) layered on top of the baseline. Quarterly cadence for the highest-access roles.",
    hours: 16,
  },
  {
    dim: "d4",
    severity: "moderate",
    title: "DSAR fulfillment has manual gaps",
    body: "Access and deletion requests are met within the 30-day window, but 4 of 11 systems still require manual SQL exports. Median DSAR turnaround is 22 days, with a 90th percentile of 28 days.",
    recommendation: "Build a unified export endpoint over the top 4 systems. Reduces median to ~3 days and removes the engineering bottleneck during heavy request months.",
    regulatory: "PIPEDA Principle 9, GDPR Art. 15 + 17, Quebec Law 25 s.27.",
    hours: 40,
  },
  {
    dim: "d3",
    severity: "moderate",
    title: "Consent withdrawal doesn't always propagate downstream",
    body: "Consent is captured cleanly at point of collection, but withdrawal events don't reach the data warehouse or the marketing automation platform within 24 hours.",
    recommendation: "Implement a consent-event webhook to the warehouse and Mailchimp. Add a daily reconciliation job for the first 90 days to catch any dropped events.",
    hours: 12,
  },
  {
    dim: "d1",
    severity: "low",
    title: "Privacy governance is mature — maintain it",
    body: "Documented privacy officer, clear escalation paths, board reporting on a quarterly cadence, published privacy policy with a meaningful changelog.",
    recommendation: "Maintain current cadence. Consider adding an annual external review (Garabyte or peer firm) to keep the program calibrated as the regulatory landscape shifts.",
  },
];

function scoreColor(score: number): string {
  if (score >= 70) return "bg-garabyte-status-good";
  if (score >= 55) return "bg-garabyte-status-moderate";
  if (score >= 35) return "bg-garabyte-status-high";
  return "bg-garabyte-status-critical";
}

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-garabyte-status-critical/10 text-garabyte-status-critical border-garabyte-status-critical/30",
  high:     "bg-garabyte-accent-100 text-garabyte-accent-700 border-garabyte-accent-200",
  moderate: "bg-garabyte-primary-100 text-garabyte-primary-700 border-garabyte-primary-200",
  low:      "bg-garabyte-status-good/10 text-garabyte-status-good border-garabyte-status-good/30",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high:     "High",
  moderate: "Moderate",
  low:      "Strength",
};

export const metadata = {
  title: "Sample report",
  description:
    "An example Garabyte Privacy Health Check report — Acme Corp, scored across the eight privacy dimensions and mapped to PIPEDA, Law 25, GDPR, CCPA, and the anticipated AIDA framework.",
};

export default function SamplePage() {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Sample banner */}
        <div className="rounded-md bg-garabyte-cream-200/60 border border-garabyte-ink-100 px-4 py-2.5 text-xs text-garabyte-ink-700 mb-8 flex items-center justify-between flex-wrap gap-2">
          <span>
            <span className="font-medium text-garabyte-primary-800">Sample report.</span>{" "}
            Acme Corp is fictional — your own report would replace these numbers.
          </span>
          <Link href="/" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
            ← Back to overview
          </Link>
        </div>

        {/* Header */}
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          Privacy Health Check report
        </p>
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
          <h1 className="text-h1 text-garabyte-primary-800 leading-tight">{TENANT_NAME}</h1>
          <span className="font-mono text-xs text-garabyte-ink-500">{REPORT_VERSION}</span>
        </div>
        <p className="text-sm text-garabyte-ink-500 mb-8">
          Reviewed by a Garabyte consultant · Published April 2026
        </p>

        {/* Overall score */}
        <section className="rounded-xl bg-white border border-garabyte-ink-100 shadow-soft p-6 mb-6">
          <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="flex items-baseline gap-3">
              <span className="text-[56px] leading-none font-medium tabular-nums text-garabyte-primary-800">
                {OVERALL_SCORE}
              </span>
              <span className="text-sm text-garabyte-ink-500">/ 100</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-1.5">
                Overall maturity
              </p>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-garabyte-accent-100 text-garabyte-accent-700 border border-garabyte-accent-200">
                  {OVERALL_MATURITY}
                </span>
                <span className="text-xs text-garabyte-ink-500">8 dimensions · 40 questions</span>
              </div>
              <p className="text-sm text-garabyte-ink-700 leading-relaxed">
                Acme has a strong governance and breach-response foundation, but
                AI oversight and vendor management are dragging the overall score
                into the Developing tier.
              </p>
            </div>
          </div>
        </section>

        {/* Dimension breakdown */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-medium text-garabyte-primary-800">
              Dimension breakdown
            </h2>
            <span className="text-xs text-garabyte-ink-500">8 of 8 scored</span>
          </div>
          <div className="rounded-xl bg-white border border-garabyte-ink-100 divide-y divide-garabyte-ink-100">
            {DIMENSIONS.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[24px_1fr_140px_60px_90px] items-center gap-4 px-5 py-3 text-sm"
              >
                <span className="text-[11px] font-mono text-garabyte-ink-500">{d.id}</span>
                <span className="text-garabyte-primary-800 font-medium truncate">{d.name}</span>
                <span className="h-2 rounded-full bg-garabyte-ink-100 overflow-hidden">
                  <span
                    className={`block h-full ${scoreColor(d.score)}`}
                    style={{ width: `${d.score}%` }}
                  />
                </span>
                <span className="text-right tabular-nums font-medium text-garabyte-primary-800">
                  {d.score}
                </span>
                <span className="text-right text-xs text-garabyte-ink-500">{d.maturity}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Findings */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-medium text-garabyte-primary-800">
              Prioritized findings
            </h2>
            <span className="text-xs text-garabyte-ink-500">
              {FINDINGS.filter((f) => f.severity !== "low").length} gaps · 1 strength
            </span>
          </div>
          <div className="space-y-3">
            {FINDINGS.map((f, i) => (
              <article
                key={i}
                className="rounded-xl bg-white border border-garabyte-ink-100 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[11px] font-mono text-garabyte-ink-500">{f.dim}</span>
                    <h3 className="text-base font-medium text-garabyte-primary-800 leading-snug">
                      {f.title}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center h-5 px-2 rounded text-[11px] font-medium border tabular-nums whitespace-nowrap ${SEVERITY_PILL[f.severity]}`}>
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                </div>
                <p className="text-[13.5px] text-garabyte-ink-700 leading-relaxed mb-3">
                  {f.body}
                </p>
                <div className="rounded-md bg-garabyte-cream-100/60 border border-garabyte-ink-100 px-3 py-2.5 mb-3">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1">
                    Recommended next step
                  </p>
                  <p className="text-[13px] text-garabyte-ink-900 leading-relaxed">
                    {f.recommendation}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-garabyte-ink-500">
                  {f.regulatory && (
                    <span>
                      <span className="text-garabyte-ink-700 font-medium">Regulatory: </span>
                      {f.regulatory}
                    </span>
                  )}
                  {f.hours !== undefined && (
                    <span>
                      <span className="text-garabyte-ink-700 font-medium">Typical hours: </span>
                      {f.hours}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Vendor stat callout */}
        <section className="mb-10">
          <div className="rounded-xl bg-garabyte-cream-100/60 border border-garabyte-ink-100 p-5 grid sm:grid-cols-[auto_1fr] gap-5 items-center">
            <span className="text-3xl font-medium tabular-nums text-garabyte-primary-800">
              38<span className="text-base text-garabyte-ink-500"> / 142</span>
            </span>
            <div>
              <p className="text-sm font-medium text-garabyte-primary-800 mb-1">
                vendors flagged for follow-up
              </p>
              <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">
                Filtered by missing DPA, expired DPA, or sub-processor disclosure
                gaps. 9 are critical infrastructure and prioritized in the
                vendor-management finding above.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="rounded-xl bg-white border border-garabyte-ink-100 p-6 grid md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-1.5">
              Want one of these for your org?
            </p>
            <p className="text-base text-garabyte-primary-800 leading-snug">
              The real assessment takes about 40 minutes and ends with a report
              shaped exactly like this one — scored against your own program.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 rounded-md bg-garabyte-primary-500 text-white text-sm font-medium hover:bg-garabyte-primary-600 transition-colors"
            >
              Sign in
            </Link>
            <a
              href="mailto:hello@garabyte.com"
              className="inline-flex items-center px-4 py-2 rounded-md border border-garabyte-ink-100 text-garabyte-primary-700 text-sm font-medium hover:bg-garabyte-cream-100 transition-colors"
            >
              Talk to Garabyte
            </a>
          </div>
        </section>

        <p className="text-[11px] text-garabyte-ink-300 mt-8 text-center">
          Acme Corp data is fictional. The structure of this report mirrors the real
          output of the Garabyte Privacy Health Check.
        </p>
      </div>
    </main>
  );
}
