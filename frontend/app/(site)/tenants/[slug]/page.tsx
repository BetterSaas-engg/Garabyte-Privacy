"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAssessmentResult,
  getTenant,
  getTenantHistory,
  isUnauthorized,
  whoami,
} from "@/lib/api";
import type {
  AssessmentResultOut,
  Tenant,
  TenantHistoryItem,
} from "@/lib/types";
import { ScoreSummary } from "@/components/ScoreSummary";
import { DimensionGrid } from "@/components/DimensionGrid";
import { GapFindingCard } from "@/components/GapFinding";
import { AssessmentHistory } from "@/components/AssessmentHistory";

export default function TenantDashboard({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<TenantHistoryItem[] | null>(null);
  const [latestResult, setLatestResult] = useState<AssessmentResultOut | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [t, h, w] = await Promise.all([
          getTenant(slug),
          getTenantHistory(slug),
          whoami(),
        ]);
        setTenant(t);
        document.title = `${t.name} — Garabyte Privacy Health Check`;
        setHistory(h);

        // Org admin (or Garabyte admin) can start a new assessment.
        const isGarabyteAdmin = w.memberships.some((m) => m.role === "garabyte_admin");
        const isOrgAdmin = w.memberships.some(
          (m) => m.org_id === t.id && m.role === "org_admin",
        );
        setCanStart(isGarabyteAdmin || isOrgAdmin);

        if (h.length > 0) {
          const latest = h[h.length - 1];
          const result = await getAssessmentResult(latest.assessment_id);
          setLatestResult(result);
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

        {/* No completed assessments yet — empty state */}
        {!latestResult && (
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

        {/* Score summary, dimension grid, gaps, history — only when there's a completed assessment */}
        {latestResult && (
          <>
            <ScoreSummary
              assessmentLabel={latestResult.assessment.label}
              overallScore={latestResult.result.overall_score}
              maturityLabel={latestResult.result.overall_maturity_label}
              previousScore={previousScore}
              coverage={latestResult.result.coverage}
              assessedAt={latestResult.result.assessed_at}
              rulesVersion={latestResult.result.rules_version}
            />

            <section>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-h2 text-garabyte-primary-800">Dimension breakdown</h2>
                <p className="text-sm text-garabyte-ink-500">
                  {latestResult.result.dimension_scores.length} dimensions scored
                </p>
              </div>
              <DimensionGrid dimensionScores={latestResult.result.dimension_scores} />
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-h2 text-garabyte-primary-800">Prioritized gaps</h2>
                <p className="text-sm text-garabyte-ink-500">
                  {latestResult.result.gaps.length} findings · sorted by severity
                </p>
              </div>
              <div className="space-y-3">
                {latestResult.result.gaps.map((gap, i) => (
                  <GapFindingCard key={`${gap.dimension_id}-${i}`} gap={gap} />
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
