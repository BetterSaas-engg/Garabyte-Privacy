"use client";

import { ScoreDots } from "./ScoreDots";

interface ScoreSummaryProps {
  tenantName: string;
  assessmentLabel: string | null;
  overallScore: number;
  maturityLabel: string;
  previousScore: number | null;
}

export function ScoreSummary({
  tenantName,
  assessmentLabel,
  overallScore,
  maturityLabel,
  previousScore,
}: ScoreSummaryProps) {
  const delta = previousScore != null ? overallScore - previousScore : null;

  return (
    <div className="bg-white rounded-xl shadow-card p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-6">
        {assessmentLabel ?? "Current assessment"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 items-center">
        {/* Score dots + numeric */}
        <div>
          <ScoreDots score={overallScore} className="mb-3" />
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold text-garabyte-primary-800 tabular-nums">
              {overallScore.toFixed(2)}
            </span>
            <span className="text-xl font-normal text-garabyte-ink-500">
              / 4.00
            </span>
          </div>
        </div>

        {/* Maturity label */}
        <div className="md:border-l md:border-garabyte-ink-100 md:pl-8">
          <p className="text-xs uppercase tracking-wider text-garabyte-ink-500 mb-1">
            Maturity
          </p>
          <p className="text-h3 text-garabyte-primary-800">
            {maturityLabel}
          </p>
        </div>

        {/* Delta */}
        {delta !== null && (
          <div className="md:border-l md:border-garabyte-ink-100 md:pl-8">
            <p className="text-xs uppercase tracking-wider text-garabyte-ink-500 mb-1">
              vs previous quarter
            </p>
            {delta > 0 ? (
              <p className="text-h3 text-garabyte-status-good">
                ↑ +{delta.toFixed(2)}
              </p>
            ) : delta < 0 ? (
              <p className="text-h3 text-garabyte-status-critical">
                ↓ {delta.toFixed(2)}
              </p>
            ) : (
              <p className="text-h3 text-garabyte-ink-500">
                No change
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
