"use client";

import type { GapFinding as GapFindingType } from "@/lib/types";

interface GapFindingProps {
  gap: GapFindingType;
}

function severityStyles(severity: string): { bg: string; text: string; border: string } {
  switch (severity) {
    case "critical":
      return {
        bg: "bg-garabyte-status-critical/10",
        text: "text-garabyte-status-critical",
        border: "border-garabyte-status-critical/30",
      };
    case "high":
      return {
        bg: "bg-garabyte-accent-100",
        text: "text-garabyte-accent-700",
        border: "border-garabyte-accent-300",
      };
    case "moderate":
      return {
        bg: "bg-garabyte-primary-50",
        text: "text-garabyte-primary-600",
        border: "border-garabyte-primary-200",
      };
    default:
      return {
        bg: "bg-garabyte-ink-100",
        text: "text-garabyte-ink-700",
        border: "border-garabyte-ink-300",
      };
  }
}

export function GapFindingCard({ gap }: GapFindingProps) {
  const s = severityStyles(gap.severity);

  return (
    <div className="bg-white rounded-xl shadow-soft overflow-hidden">
      <div className="flex items-stretch">
        {/* Severity strip on the left */}
        <div className={`w-1.5 ${s.bg} ${s.border} border-r`} />

        <div className="flex-1 p-6">
          {/* Header: severity badge + dimension + score + hours */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md ${s.bg} ${s.text}`}
              >
                {gap.severity}
              </span>
              <span className="text-sm text-garabyte-ink-500">
                {gap.dimension_name} · scored {gap.score.toFixed(2)}
              </span>
            </div>
            {gap.typical_consulting_hours != null && (
              <div className="text-right shrink-0">
                <p className="text-xs uppercase tracking-wider text-garabyte-ink-500">
                  Estimated
                </p>
                <p className="text-lg font-semibold text-garabyte-primary-800 tabular-nums">
                  {gap.typical_consulting_hours}h
                </p>
              </div>
            )}
          </div>

          <h4 className="text-h3 text-garabyte-primary-800 mb-2 leading-snug">
            {gap.finding}
          </h4>

          <p className="text-sm text-garabyte-ink-700 leading-relaxed mb-4">
            {gap.recommendation}
          </p>

          {gap.regulatory_risk && (
            <div className="text-xs text-garabyte-ink-700 bg-garabyte-cream-100 rounded-lg p-3 mb-3">
              <span className="font-semibold text-garabyte-primary-800">Regulatory risk:</span>{" "}
              {gap.regulatory_risk}
            </div>
          )}

          {gap.upsell_hook && (
            <div className="text-xs text-garabyte-accent-700 bg-garabyte-accent-50 rounded-lg p-3 border border-garabyte-accent-200">
              <span className="font-semibold">Related opportunity:</span>{" "}
              {gap.upsell_hook}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
