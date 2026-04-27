"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAssessmentFindings,
  getAssessmentResult,
  getRules,
  getTenant,
  getTenantConsultants,
  getTenantHistory,
  isUnauthorized,
  whoami,
} from "@/lib/api";
import type { TenantConsultant } from "@/lib/api";
import type {
  AssessmentResultOut,
  Dimension,
  FindingFromApi,
  GapFinding,
  Tenant,
  TenantHistoryItem,
} from "@/lib/types";
import { ScoreSummary } from "@/components/ScoreSummary";
import { DimensionGrid } from "@/components/DimensionGrid";
import { GapFindingCard } from "@/components/GapFinding";
import { AssessmentHistory } from "@/components/AssessmentHistory";

// Map a (post-annotation) FindingFromApi onto the existing GapFinding
// shape so we can keep using GapFindingCard. Dismissed findings should
// already be filtered out by the caller before this is called.
function findingToGap(f: FindingFromApi, dimensionsByid: Map<string, Dimension>): GapFinding {
  return {
    dimension_id: f.dimension_id,
    dimension_name: dimensionsByid.get(f.dimension_id)?.name ?? f.dimension_id,
    severity: (f.severity as GapFinding["severity"]) ?? "moderate",
    finding: f.finding_text,
    recommendation: f.recommendation ?? "",
    regulatory_risk: f.regulatory_risk,
    typical_consulting_hours: f.typical_consulting_hours,
    upsell_hook: f.upsell_hook,
    score: f.score ?? 0,
  };
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

export default function TenantDashboard({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<TenantHistoryItem[] | null>(null);
  // The most recent assessment (may or may not be published). Drives the
  // "Awaiting consultant review" banner.
  const [latestItem, setLatestItem] = useState<TenantHistoryItem | null>(null);
  // The latest *published* assessment's full result. We show this report
  // even if a newer unpublished assessment exists.
  const [publishedResult, setPublishedResult] = useState<AssessmentResultOut | null>(null);
  // Findings for the published assessment (post-annotation, dismissed filtered).
  const [findings, setFindings] = useState<FindingFromApi[] | null>(null);
  const [dimensionsByid, setDimensionsByid] = useState<Map<string, Dimension>>(new Map());
  const [canStart, setCanStart] = useState(false);
  const [consultants, setConsultants] = useState<TenantConsultant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [t, h, w, rules, cs] = await Promise.all([
          getTenant(slug),
          getTenantHistory(slug),
          whoami(),
          getRules(),
          getTenantConsultants(slug),
        ]);
        setTenant(t);
        document.title = `${t.name} — Garabyte Privacy Health Check`;
        setHistory(h);
        setConsultants(cs);

        const dMap = new Map<string, Dimension>();
        rules.dimensions.forEach((d) => dMap.set(d.id, d));
        setDimensionsByid(dMap);

        const isGarabyteAdmin = w.memberships.some((m) => m.role === "garabyte_admin");
        const isOrgAdmin = w.memberships.some(
          (m) => m.org_id === t.id && m.role === "org_admin",
        );
        setCanStart(isGarabyteAdmin || isOrgAdmin);

        if (h.length === 0) return;
        // Latest by completed_at (history is already ordered oldest-first).
        const latest = h[h.length - 1];
        setLatestItem(latest);

        // Find the most recent *published* item. If none yet, no report
        // gets rendered — only the "awaiting review" empty state.
        const published = [...h].reverse().find((x) => x.published_at);
        if (!published) return;

        const [result, fs] = await Promise.all([
          getAssessmentResult(published.assessment_id),
          getAssessmentFindings(published.assessment_id),
        ]);
        setPublishedResult(result);
        setFindings(
          fs
            .filter((f) => f.annotation_status !== "dismissed")
            .sort(
              (a, b) =>
                (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99) ||
                (a.score ?? 0) - (b.score ?? 0),
            ),
        );
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
  }, [slug, router]);

  if (error) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6"
          >
            ← All organizations
          </Link>
          <div className="p-4 rounded-xl bg-garabyte-status-critical/10 border border-garabyte-status-critical/20">
            <p className="text-garabyte-status-critical font-medium">
              Error loading dashboard: {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!tenant || !history) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6"
          >
            ← All organizations
          </Link>
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-white rounded-xl shadow-card" />
            <div className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-32 bg-white rounded-xl shadow-soft" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const previousScore =
    history.length >= 2 ? history[history.length - 2].overall_score : null;

  // Awaiting-review state: a completed assessment exists but isn't published.
  // If there's already a published earlier assessment, the banner appears
  // above the older report. If there's no published assessment yet, only
  // the awaiting-review state shows.
  const awaitingReview =
    latestItem !== null && latestItem.published_at === null;

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Breadcrumb + actions */}
        <div>
          <Link
            href="/"
            className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-4"
          >
            ← All organizations
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
                {tenant.sector} · {tenant.jurisdiction}
                {tenant.employee_count && ` · ${tenant.employee_count.toLocaleString()} employees`}
              </p>
              <h1 className="text-h1 text-garabyte-primary-800">
                {tenant.name}
              </h1>
            </div>
            {canStart && (
              <Link
                href={`/tenants/${slug}/assessments/new`}
                className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 transition-colors flex-shrink-0"
              >
                Start new assessment
              </Link>
            )}
          </div>
        </div>

        {/* Assigned consultant attribution. Shown whether or not there's
            anything in flight — gives the customer a person to contact
            instead of an opaque "Garabyte Consulting" handle. */}
        {consultants.length > 0 && (
          <div className="rounded-md border border-garabyte-ink-100 bg-white px-4 py-3 flex items-center gap-3">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium">
              {consultants.length === 1 ? "Your consultant" : "Your consultants"}
            </span>
            <span className="text-sm text-garabyte-ink-900">
              {consultants
                .map((c) => c.name || c.email)
                .join(", ")}
            </span>
          </div>
        )}

        {/* Awaiting consultant review banner */}
        {awaitingReview && (
          <div className="rounded-xl border border-garabyte-accent-300 bg-garabyte-accent-100/40 p-5">
            <p className="text-h3 text-garabyte-primary-800 mb-1">
              Awaiting consultant review
            </p>
            <p className="text-sm text-garabyte-ink-700">
              {latestItem?.label ? `${latestItem.label} — ` : ""}submitted on{" "}
              {latestItem?.completed_at
                ? new Date(latestItem.completed_at).toLocaleDateString("en-CA")
                : "—"}
              .{" "}
              {consultants.length > 0
                ? `${consultants[0].name || consultants[0].email} is reviewing the engine's findings and will publish the report shortly.`
                : "Your consultant is reviewing the engine's findings and will publish the report shortly."}{" "}
              You&apos;ll be notified by email when it&apos;s ready.
            </p>
          </div>
        )}

        {/* No published assessments at all yet — empty state */}
        {!publishedResult && !awaitingReview && (
          <div className="rounded-xl bg-white shadow-soft border border-garabyte-ink-100 p-8 text-center">
            <p className="text-h3 text-garabyte-primary-800 mb-2">
              No completed assessments yet
            </p>
            <p className="text-sm text-garabyte-ink-700 max-w-md mx-auto mb-5">
              Start the first one to score this organization across the eight privacy dimensions and produce a prioritized gap report.
            </p>
            {canStart ? (
              <Link
                href={`/tenants/${slug}/assessments/new`}
                className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 transition-colors inline-block"
              >
                Start the first assessment
              </Link>
            ) : (
              <p className="text-xs text-garabyte-ink-500">
                Ask your org admin to start the first assessment.
              </p>
            )}
          </div>
        )}

        {/* Published report (latest published, even if a newer draft exists) */}
        {publishedResult && (
          <>
            <ScoreSummary
              assessmentLabel={publishedResult.assessment.label}
              overallScore={publishedResult.result.overall_score}
              maturityLabel={publishedResult.result.overall_maturity_label}
              previousScore={previousScore}
              coverage={publishedResult.result.coverage}
              assessedAt={publishedResult.result.assessed_at}
              rulesVersion={publishedResult.result.rules_version}
            />

            <section>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-h2 text-garabyte-primary-800">Dimension breakdown</h2>
                <p className="text-sm text-garabyte-ink-500">
                  {publishedResult.result.dimension_scores.length} dimensions scored
                </p>
              </div>
              <DimensionGrid dimensionScores={publishedResult.result.dimension_scores} />
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-h2 text-garabyte-primary-800">Prioritized gaps</h2>
                <p className="text-sm text-garabyte-ink-500">
                  {findings?.length ?? 0} findings · sorted by severity
                </p>
              </div>
              <div className="space-y-3">
                {findings?.map((f) => (
                  <GapFindingCard
                    key={f.id}
                    gap={findingToGap(f, dimensionsByid)}
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-h2 text-garabyte-primary-800 mb-5">Assessment history</h2>
              <AssessmentHistory history={history} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
