"use client";

import type { TenantHistoryItem } from "@/lib/types";

interface AssessmentHistoryProps {
  history: TenantHistoryItem[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssessmentHistory({ history }: AssessmentHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-garabyte-ink-500 italic">
        No completed assessments yet.
      </p>
    );
  }

  // Display newest first
  const sorted = [...history].reverse();

  return (
    <div className="bg-white rounded-xl shadow-soft overflow-hidden">
      <div className="divide-y divide-garabyte-ink-100">
        {sorted.map((h) => (
          <div
            key={h.assessment_id}
            className="flex items-center justify-between gap-4 px-6 py-4"
          >
            <div>
              <p className="text-sm font-semibold text-garabyte-primary-800">
                {h.label ?? `Assessment ${h.assessment_id}`}
              </p>
              <p className="text-xs text-garabyte-ink-500 mt-0.5">
                Completed {formatDate(h.completed_at)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-semibold text-garabyte-primary-800 tabular-nums">
                {h.overall_score?.toFixed(2) ?? "—"}
                <span className="text-sm font-normal text-garabyte-ink-500 ml-1">
                  / 4.00
                </span>
              </p>
              <p className="text-xs text-garabyte-ink-500">
                {h.overall_maturity}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
