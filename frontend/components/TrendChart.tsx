"use client";

/**
 * Trend chart — line of overall_score over time across completed
 * assessments, with a vertical discontinuity marker between any two
 * points whose rules_version differs.
 *
 * Hand-rolled SVG. The visual is too narrow to justify pulling in a
 * full chart library (Recharts/Chart.js are ~120 KB each); this is
 * ~150 lines of code, server-renderable, palette-aligned.
 */

import type { TenantHistoryItem } from "@/lib/types";

interface Props {
  history: TenantHistoryItem[];
}

const Y_MAX = 4; // assessment scores live on 0-4
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const VIEW_W = 720;
const VIEW_H = 220;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "2-digit",
    month: "short",
  });
}

export function TrendChart({ history }: Props) {
  // Only completed assessments with a numeric score appear on the chart.
  const points = history
    .filter((h) => h.overall_score !== null && (h.completed_at || h.published_at))
    .sort((a, b) => {
      const aT = new Date(a.completed_at ?? a.published_at ?? "").getTime();
      const bT = new Date(b.completed_at ?? b.published_at ?? "").getTime();
      return aT - bT;
    });

  if (points.length === 0) {
    return (
      <p className="text-sm text-garabyte-ink-500 italic">
        No scored assessments yet — the trend chart populates after the first
        completed assessment.
      </p>
    );
  }

  // X scale: equal spacing per point (date-aware spacing only matters when
  // gaps are highly uneven; for typical quarterly cadence it's fine).
  const xFor = (i: number): number => {
    if (points.length === 1) return PAD_LEFT + PLOT_W / 2;
    return PAD_LEFT + (i / (points.length - 1)) * PLOT_W;
  };
  const yFor = (score: number): number =>
    PAD_TOP + PLOT_H - (score / Y_MAX) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.overall_score!)}`)
    .join(" ");

  // Discontinuities: indices where rules_version differs from the previous
  // point's rules_version. The marker sits between (i-1) and (i).
  const discontinuities: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].rules_version;
    const curr = points[i].rules_version;
    if (prev && curr && prev !== curr) {
      discontinuities.push(i);
    }
  }

  // Y-axis gridlines at integer scores.
  const gridScores = [0, 1, 2, 3, 4];

  return (
    <div className="rounded-xl bg-white border border-garabyte-ink-100 px-4 py-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium">
          Overall maturity over time
        </p>
        <p className="text-[11px] text-garabyte-ink-500">
          {points.length} {points.length === 1 ? "assessment" : "assessments"}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Overall maturity score across ${points.length} assessments`}
      >
        {/* Gridlines + Y-axis labels */}
        {gridScores.map((s) => (
          <g key={s}>
            <line
              x1={PAD_LEFT}
              x2={VIEW_W - PAD_RIGHT}
              y1={yFor(s)}
              y2={yFor(s)}
              stroke="#e4e7ea"
              strokeWidth={s === 0 ? 1 : 0.5}
              strokeDasharray={s === 0 ? "" : "2,3"}
            />
            <text
              x={PAD_LEFT - 8}
              y={yFor(s) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#6b7682"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {s}
            </text>
          </g>
        ))}

        {/* Discontinuity markers — vertical line between affected points */}
        {discontinuities.map((i) => {
          const x = (xFor(i - 1) + xFor(i)) / 2;
          return (
            <g key={`disc-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={PAD_TOP}
                y2={PAD_TOP + PLOT_H}
                stroke="#d48b2f"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <text
                x={x + 3}
                y={PAD_TOP + 9}
                fontSize="8"
                fill="#d48b2f"
                fontFamily="Inter, system-ui, sans-serif"
              >
                rules update
              </text>
            </g>
          );
        })}

        {/* Trend line */}
        <path
          d={linePath}
          fill="none"
          stroke="#2c5a73"
          strokeWidth={1.5}
        />

        {/* Points + per-point labels */}
        {points.map((p, i) => {
          const cx = xFor(i);
          const cy = yFor(p.overall_score!);
          const dateLabel = formatDate(p.completed_at ?? p.published_at);
          return (
            <g key={p.assessment_id}>
              <circle
                cx={cx}
                cy={cy}
                r={3.5}
                fill={p.published_at ? "#2c5a73" : "#b3bac2"}
              />
              <text
                x={cx}
                y={cy - 7}
                textAnchor="middle"
                fontSize="8.5"
                fill="#3a4550"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {p.overall_score!.toFixed(2)}
              </text>
              <text
                x={cx}
                y={VIEW_H - 12}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7682"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {dateLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend — only when something needs explaining */}
      {(discontinuities.length > 0 || points.some((p) => !p.published_at)) && (
        <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-garabyte-ink-500">
          {points.some((p) => !p.published_at) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-garabyte-ink-300" />
              Awaiting consultant review
            </span>
          )}
          {discontinuities.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-px border-t border-dashed border-garabyte-status-high" />
              Rules library was updated — comparisons across this line may
              reflect rule changes, not program changes
            </span>
          )}
        </div>
      )}
    </div>
  );
}
