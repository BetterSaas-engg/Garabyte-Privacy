"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getTenant,
  getTenantHistory,
  getAssessmentResult,
} from "@/lib/api";
import type {
  Tenant,
  TenantHistoryItem,
  AssessmentResultOut,
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

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<TenantHistoryItem[] | null>(null);
  const [latestResult, setLatestResult] = useState<AssessmentResultOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [t, h] = await Promise.all([
          getTenant(slug),
          getTenantHistory(slug),
        ]);
        setTenant(t);
        document.title = `${t.name} — Garabyte Privacy Health Check`;
        setHistory(h);

        // Fetch the latest completed assessment's full result
        if (h.length > 0) {
          const latest = h[h.length - 1];
          const result = await getAssessmentResult(latest.assessment_id);
          setLatestResult(result);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
  }, [slug]);

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

  if (!tenant || !history || !latestResult) {
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
        {/* Breadcrumb */}
        <div>
          <Link
            href="/"
            className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-4"
          >
            ← All organizations
          </Link>
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
            {tenant.sector} · {tenant.jurisdiction}
            {tenant.employee_count && ` · ${tenant.employee_count.toLocaleString()} employees`}
          </p>
          <h1 className="text-h1 text-garabyte-primary-800">
            {tenant.name}
          </h1>
        </div>

        {/* Section 1: score summary */}
        <ScoreSummary
          assessmentLabel={latestResult.assessment.label}
          overallScore={latestResult.result.overall_score}
          maturityLabel={latestResult.result.overall_maturity_label}
          previousScore={previousScore}
        />

        {/* Section 2: dimension grid */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-h2 text-garabyte-primary-800">
              Dimension breakdown
            </h2>
            <p className="text-sm text-garabyte-ink-500">
              {latestResult.result.dimension_scores.length} dimensions scored
            </p>
          </div>
          <DimensionGrid
            dimensionScores={latestResult.result.dimension_scores}
          />
        </section>

        {/* Section 3: gap findings */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-h2 text-garabyte-primary-800">
              Prioritized gaps
            </h2>
            <p className="text-sm text-garabyte-ink-500">
              {latestResult.result.gaps.length} findings · sorted by severity
            </p>
          </div>
          <div className="space-y-3">
            {latestResult.result.gaps.map((gap, i) => (
              <GapFindingCard
                key={`${gap.dimension_id}-${i}`}
                gap={gap}
              />
            ))}
          </div>
        </section>

        {/* Section 4: assessment history */}
        <section>
          <h2 className="text-h2 text-garabyte-primary-800 mb-5">
            Assessment history
          </h2>
          <AssessmentHistory history={history} />
        </section>
      </div>
    </main>
  );
}
