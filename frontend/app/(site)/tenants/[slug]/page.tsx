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
  // Compound findings live under the sentinel dimension_id "compound";
  // they have no real Dimension to resolve. Render a plain label so the
  // GapFindingCard header reads "Cross-cutting" instead of literal
  // "compound" or a hash.
  const dimName =
    f.dimension_id === "compound"
      ? "Cross-cutting"
      : dimensionsByid.get(f.dimension_id)?.name ?? f.dimension_id;
  return {
    dimension_id: f.dimension_id,
    dimension_name: dimName,
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
  // Prior published assessment's findings + completed-at, for the
  // "what's changed since last quarter" diff panel. Null when there's
  // no prior published assessment yet (first-published case).
  const [priorFindings, setPriorFindings] = useState<FindingFromApi[] | null>(null);
  const [priorDate, setPriorDate] = useState<string | null>(null);
  const [priorRulesVersion, setPriorRulesVersion] = useState<string | null>(null);
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
        const publishedDescending = [...h].reverse().filter((x) => x.published_at);
        const published = publishedDescending[0];
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

        // If there's a *prior* published assessment, fetch its findings
        // for the "what's changed since" diff panel. Only the most recent
        // prior is compared — successive comparisons across many history
        // points belong on a separate report-history view.
        const prior = publishedDescending[1];
        if (prior) {
          const [priorResult, priorFs] = await Promise.all([
            getAssessmentResult(prior.assessment_id),
            getAssessmentFindings(prior.assessment_id),
          ]);
          setPriorFindings(
            priorFs.filter((f) => f.annotation_status !== "dismissed"),
          );
          setPriorDate(prior.published_at ?? prior.completed_at ?? null);
          setPriorRulesVersion(
            (priorResult.result as { rules_version?: string }).rules_version ?? null,
          );
        }
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

            {/* What's changed since the prior assessment. Only renders when
                there's a prior published assessment to compare against;
                first-published case shows nothing. Diff is by
                finding_template_id (stable across re-scorings under the
                same rules_version). */}
            {priorFindings && findings && (
              <ChangesSincePanel
                current={findings}
                prior={priorFindings}
                priorDate={priorDate}
                priorRulesVersion={priorRulesVersion}
                currentRulesVersion={
                  (publishedResult.result as { rules_version?: string }).rules_version ?? null
                }
                dimensionsByid={dimensionsByid}
              />
            )}

            {(() => {
              const compoundFindings = (findings ?? []).filter((f) => f.dimension_id === "compound");
              const dimFindings = (findings ?? []).filter((f) => f.dimension_id !== "compound");
              return (
                <>
                  {/* Cross-cutting (compound) findings sit above the per-dimension
                      list because they describe pathologies a single dimension
                      can't capture — most-impactful framing for a customer
                      reading the report top-to-bottom. */}
                  {compoundFindings.length > 0 && (
                    <section>
                      <div className="flex items-baseline justify-between mb-3">
                        <h2 className="text-h2 text-garabyte-primary-800">Cross-cutting findings</h2>
                        <p className="text-sm text-garabyte-ink-500">
                          {compoundFindings.length} compound{" "}
                          {compoundFindings.length === 1 ? "finding" : "findings"}
                        </p>
                      </div>
                      <p className="text-sm text-garabyte-ink-700 max-w-prose mb-5">
                        These findings come from a combination of dimensions —
                        weak data inventory plus weak rights handling means
                        deletion can&apos;t complete, even if either dimension
                        looks acceptable on its own.
                      </p>
                      <div className="space-y-3">
                        {compoundFindings.map((f) => (
                          <GapFindingCard
                            key={f.id}
                            gap={findingToGap(f, dimensionsByid)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex items-baseline justify-between mb-5">
                      <h2 className="text-h2 text-garabyte-primary-800">Prioritized gaps</h2>
                      <p className="text-sm text-garabyte-ink-500">
                        {dimFindings.length} findings · sorted by severity
                      </p>
                    </div>
                    <div className="space-y-3">
                      {dimFindings.map((f) => (
                        <GapFindingCard
                          key={f.id}
                          gap={findingToGap(f, dimensionsByid)}
                        />
                      ))}
                    </div>
                  </section>
                </>
              );
            })()}

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


// ---------------------------------------------------------------------------
// "What's changed since" diff panel.
// Diff semantics:
//   - "Visible" finding = annotation_status != "dismissed". Matches what the
//     customer would see at the time. A dismissed finding counts as absent
//     for diff purposes — engine fired but the consultant chose to suppress.
//   - Match key = finding_template_id (stable hash of dimension+severity+
//     finding_text under a single rules_version). Reworded findings get a
//     new template_id, which surfaces as "resolved + new" — that's accurate;
//     a reworded finding is operationally a different recommendation.
//   - rules_version mismatch between assessments adds a discontinuity note
//     (audit H11) so customers can interpret the diff with the right caveat.
// ---------------------------------------------------------------------------

function ChangesSincePanel({
  current,
  prior,
  priorDate,
  priorRulesVersion,
  currentRulesVersion,
  dimensionsByid,
}: {
  current: FindingFromApi[];
  prior: FindingFromApi[];
  priorDate: string | null;
  priorRulesVersion: string | null;
  currentRulesVersion: string | null;
  dimensionsByid: Map<string, Dimension>;
}) {
  // Build template_id sets for set-difference math.
  const currentByTemplate = new Map<string, FindingFromApi>();
  current.forEach((f) => {
    if (f.finding_template_id) currentByTemplate.set(f.finding_template_id, f);
  });
  const priorByTemplate = new Map<string, FindingFromApi>();
  prior.forEach((f) => {
    if (f.finding_template_id) priorByTemplate.set(f.finding_template_id, f);
  });

  const newFindings: FindingFromApi[] = [];
  const persistingFindings: FindingFromApi[] = [];
  const resolvedFindings: FindingFromApi[] = [];

  currentByTemplate.forEach((f, tid) => {
    if (priorByTemplate.has(tid)) persistingFindings.push(f);
    else newFindings.push(f);
  });
  priorByTemplate.forEach((f, tid) => {
    if (!currentByTemplate.has(tid)) resolvedFindings.push(f);
  });

  // First-real-comparison sanity: if every finding looks "new" because the
  // prior assessment had a totally different set, we still render — that
  // IS the diff. The discontinuity note below covers the edge case.
  const totalChanges = newFindings.length + resolvedFindings.length;
  if (totalChanges === 0 && persistingFindings.length === 0) {
    // Both assessments empty — nothing useful to show.
    return null;
  }

  const priorLabel = priorDate
    ? new Date(priorDate).toLocaleDateString("en-CA")
    : "the prior assessment";
  const rulesShifted =
    priorRulesVersion && currentRulesVersion && priorRulesVersion !== currentRulesVersion;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-h2 text-garabyte-primary-800">Changes since {priorLabel}</h2>
        <p className="text-sm text-garabyte-ink-500">
          {resolvedFindings.length} resolved · {newFindings.length} new ·{" "}
          {persistingFindings.length} persisting
        </p>
      </div>
      {rulesShifted && (
        <p className="rounded-md border border-garabyte-accent-200 bg-garabyte-accent-100/40 px-3 py-2 text-[12.5px] text-garabyte-accent-700 mb-5">
          The rules library was updated between these assessments
          ({priorRulesVersion} → {currentRulesVersion}). Some changes here may
          reflect rule updates rather than program changes; ask your consultant
          to flag any that surprise you.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <DiffColumn
          tone="good"
          title="Resolved"
          subtitle="Fired before, gone now"
          findings={resolvedFindings}
          dimensionsByid={dimensionsByid}
        />
        <DiffColumn
          tone="critical"
          title="New"
          subtitle="Wasn't here last quarter"
          findings={newFindings}
          dimensionsByid={dimensionsByid}
        />
        <DiffColumn
          tone="moderate"
          title="Persisting"
          subtitle="Still on the to-do list"
          findings={persistingFindings}
          dimensionsByid={dimensionsByid}
        />
      </div>
    </section>
  );
}

function DiffColumn({
  tone,
  title,
  subtitle,
  findings,
  dimensionsByid,
}: {
  tone: "good" | "critical" | "moderate";
  title: string;
  subtitle: string;
  findings: FindingFromApi[];
  dimensionsByid: Map<string, Dimension>;
}) {
  const accent =
    tone === "good"
      ? "border-garabyte-status-good/40 bg-garabyte-status-good/5"
      : tone === "critical"
        ? "border-garabyte-status-critical/40 bg-garabyte-status-critical/5"
        : "border-garabyte-ink-100 bg-garabyte-cream-100/40";
  const titleColor =
    tone === "good"
      ? "text-garabyte-status-good"
      : tone === "critical"
        ? "text-garabyte-status-critical"
        : "text-garabyte-ink-700";
  return (
    <article className={`rounded-xl border p-4 ${accent}`}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className={`text-sm font-medium ${titleColor}`}>{title}</h3>
        <span className="text-[11px] tabular-nums text-garabyte-ink-500">
          {findings.length}
        </span>
      </div>
      <p className="text-[11.5px] text-garabyte-ink-500 mb-3">{subtitle}</p>
      {findings.length === 0 ? (
        <p className="text-[12.5px] text-garabyte-ink-300">—</p>
      ) : (
        <ul className="space-y-2 text-[12.5px]">
          {findings.map((f) => {
            const dimName =
              f.dimension_id === "compound"
                ? "Cross-cutting"
                : dimensionsByid.get(f.dimension_id)?.name ?? f.dimension_id;
            return (
              <li key={f.id}>
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-garabyte-ink-500 mr-1.5">
                  {dimName}
                </span>
                <span className="text-garabyte-ink-700 leading-snug">
                  {f.finding_text.length > 120
                    ? f.finding_text.slice(0, 120) + "…"
                    : f.finding_text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
