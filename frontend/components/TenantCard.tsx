"use client";

import Link from "next/link";
import { ScoreDots } from "./ScoreDots";
import type { Tenant, TenantHistoryItem } from "@/lib/types";

interface TenantCardProps {
  tenant: Tenant;
  history: TenantHistoryItem[];
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${days >= 60 ? "s" : ""} ago`;
}

function sectorLabel(sector: string): string {
  return sector.charAt(0).toUpperCase() + sector.slice(1);
}

export function TenantCard({ tenant, history }: TenantCardProps) {
  const latest = history[history.length - 1];
  const previous = history.length >= 2 ? history[history.length - 2] : null;

  const score = latest?.overall_score ?? 0;
  const maturity = latest?.overall_maturity ?? "Not assessed";
  const delta =
    latest?.overall_score != null && previous?.overall_score != null
      ? latest.overall_score - previous.overall_score
      : null;

  return (
    <Link
      href={`/tenants/${tenant.slug}`}
      className="group block bg-white rounded-xl shadow-card hover:shadow-lifted transition-all duration-200 hover:-translate-y-0.5 h-full"
    >
      <div className="p-6 flex flex-col h-full">
        {/* Name row — fixed min-height so cards align */}
        <div className="flex items-start justify-between gap-3 mb-1 min-h-[3.5rem]">
          <h3 className="text-h3 text-garabyte-primary-800 leading-tight">
            {tenant.name}
          </h3>
          <span className="text-garabyte-primary-300 group-hover:text-garabyte-primary-600 text-lg shrink-0 transition-colors">
            →
          </span>
        </div>

        <p className="text-sm text-garabyte-ink-500 mb-5">
          {sectorLabel(tenant.sector)} · {tenant.jurisdiction}
          {tenant.employee_count && ` · ${tenant.employee_count.toLocaleString()} employees`}
        </p>

        {latest ? (
          <>
            <div className="flex items-baseline gap-4 mb-2">
              <ScoreDots score={score} />
              <span className="text-2xl font-semibold text-garabyte-primary-800 tabular-nums">
                {score.toFixed(2)}
                <span className="text-sm font-normal text-garabyte-ink-500 ml-1">
                  / 4.00
                </span>
              </span>
            </div>
            <p className="text-sm text-garabyte-ink-700">
              {maturity} maturity
            </p>
            {delta !== null && delta > 0 && (
              <p className="text-sm text-garabyte-status-good mt-1">
                Improved +{delta.toFixed(2)} this quarter
              </p>
            )}
            {delta !== null && delta < 0 && (
              <p className="text-sm text-garabyte-status-critical mt-1">
                Down {delta.toFixed(2)} this quarter
              </p>
            )}
            <p className="text-xs text-garabyte-ink-500 mt-auto pt-4">
              Last assessed {formatTimeAgo(latest.completed_at)}
            </p>
          </>
        ) : (
          <p className="text-sm text-garabyte-ink-500 italic">
            No assessments yet
          </p>
        )}
      </div>
    </Link>
  );
}
