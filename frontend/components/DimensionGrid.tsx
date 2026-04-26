"use client";

import { ScoreDots } from "./ScoreDots";
import type { DimensionScore } from "@/lib/types";

interface DimensionGridProps {
  dimensionScores: DimensionScore[];
}

function scoreColor(score: number): string {
  // Color-code by strength so weak dimensions visually stand out
  if (score >= 3.0) return "text-garabyte-status-good";       // Managed / Optimized
  if (score >= 2.0) return "text-garabyte-primary-800";       // Defined — neutral
  if (score >= 1.0) return "text-garabyte-accent-600";        // Developing — amber warning
  return "text-garabyte-status-critical";                      // Ad hoc — concerning
}

function confidencePill(c: "high" | "low" | "none" | undefined) {
  if (!c) return null;
  const map = {
    high: { bg: "bg-garabyte-status-good/10", text: "text-garabyte-status-good", label: "Confident" },
    low: { bg: "bg-garabyte-status-high/10", text: "text-garabyte-status-high", label: "Low confidence" },
    none: { bg: "bg-garabyte-ink-100", text: "text-garabyte-ink-500", label: "No data" },
  } as const;
  const m = map[c];
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

export function DimensionGrid({ dimensionScores }: DimensionGridProps) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {dimensionScores.map((ds) => (
        <div
          key={ds.dimension_id}
          className="bg-white rounded-xl shadow-soft p-5"
        >
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-garabyte-ink-500">
              {ds.dimension_id.toUpperCase()}
            </p>
            {confidencePill(ds.confidence)}
          </div>
          <p className="text-sm font-semibold text-garabyte-primary-800 mb-4 leading-snug min-h-[2.5rem]">
            {ds.dimension_name}
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <ScoreDots score={ds.score} />
            <span className={`text-2xl font-semibold tabular-nums ${scoreColor(ds.score)}`}>
              {ds.score.toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-garabyte-ink-500 mt-2">
            {ds.maturity_label}
          </p>
          <div className="text-[11px] text-garabyte-ink-500 mt-2 flex items-center justify-between">
            <span>
              {ds.answered_count} of {ds.question_count} answered
            </span>
            {typeof ds.evidence_coverage === "number" && ds.evidence_coverage > 0 && (
              <span className="text-garabyte-status-good">
                {Math.round(ds.evidence_coverage * 100)}% verified
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
