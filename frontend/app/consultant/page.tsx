"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getConsultantEngagements,
  isUnauthorized,
} from "@/lib/api";
import type { Engagement } from "@/lib/api";

function daysSince(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function statusOf(e: Engagement): { label: string; tone: "info" | "warning" | "success" | "muted" } {
  if (e.assessment_status === "in_progress") {
    return { label: "Customer filling out", tone: "muted" };
  }
  if (e.published_at) return { label: "Published", tone: "success" };
  if (e.findings_unreviewed > 0) return { label: "Needs review", tone: "warning" };
  return { label: "Ready to publish", tone: "info" };
}

const TONE_STYLES = {
  info: "bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5]",
  warning: "bg-[#FAF3E6] text-[#85601A] border-[#EAD9B2]",
  success: "bg-[#EDF6EF] text-[#2C6741] border-[#CFE3D6]",
  muted: "bg-[#EEF0F3] text-[#4B5360] border-[#E2E5EA]",
} as const;

export default function ConsultantHome() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setEngagements(await getConsultantEngagements());
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [router]);

  const counts = useMemo(() => {
    if (!engagements) return null;
    return engagements.reduce(
      (acc, e) => {
        const s = statusOf(e);
        if (s.label === "Customer filling out") acc.in_progress += 1;
        else if (s.label === "Needs review") acc.needs_review += 1;
        else if (s.label === "Ready to publish") acc.ready += 1;
        else if (s.label === "Published") acc.published += 1;
        return acc;
      },
      { in_progress: 0, needs_review: 0, ready: 0, published: 0 },
    );
  }, [engagements]);

  if (error) {
    return (
      <main className="min-h-screen bg-[#F7F8FA] px-6 py-12" style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div className="max-w-5xl mx-auto">
          <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-3 text-sm text-[#8A2A2A]">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#F7F8FA] text-[#1F242C]"
      style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#EEF0F3]">
        <div className="max-w-[1200px] mx-auto px-6 h-12 flex items-center gap-5">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-5 h-5 rounded-sm bg-[#1F242C] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#3A6FB8]" />
            </div>
            <div className="text-[13px] font-medium text-[#1F242C]">Consultant console</div>
          </div>
          <nav className="ml-auto flex items-center gap-3 text-[12px]">
            <Link href="/consultant/admin/access-log" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Access log →
            </Link>
            <Link href="/consultant/design" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Design canvas →
            </Link>
            <Link href="/" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Customer site →
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1.5">
            Garabyte Privacy Health Check · internal
          </p>
          <h1 className="text-[28px] leading-9 font-medium text-[#1F242C] mb-2" style={{ letterSpacing: "-0.005em" }}>
            My engagements
          </h1>
          <p className="text-[13px] text-[#6B7280]">
            Customers you&apos;re assigned to as a consultant, plus every customer if you have Garabyte admin elevation. Click into any row to review and publish findings.
          </p>
        </div>

        {/* Status strip */}
        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatusCard count={counts.needs_review} label="Needs review" sub="Findings without an annotation" tone="warning" />
            <StatusCard count={counts.ready} label="Ready to publish" sub="All findings reviewed" tone="info" />
            <StatusCard count={counts.in_progress} label="In progress" sub="Customer still filling out" />
            <StatusCard count={counts.published} label="Published" sub="Locked; customer can read" tone="success" />
          </div>
        )}

        {/* Engagements table */}
        <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-medium text-[#6B7280] tracking-[0.06em] uppercase bg-[#F7F8FA] border-b border-[#EEF0F3]">
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Score</th>
                <th className="px-3 py-2 font-medium text-right">Findings</th>
                <th className="px-3 py-2 font-medium text-right">Submitted</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {!engagements ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[12.5px] text-[#9AA1AD]">Loading…</td></tr>
              ) : engagements.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[12.5px] text-[#9AA1AD]">
                  You don&apos;t have any consultant assignments. Ask a Garabyte admin to assign you to a customer.
                </td></tr>
              ) : (
                engagements.map((e) => {
                  const s = statusOf(e);
                  return (
                    <tr key={e.assessment_id} className="border-b border-[#EEF0F3] hover:bg-[#F7F8FA] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col leading-[18px]">
                          <span className="text-[#1F242C] font-medium">{e.tenant_name}</span>
                          <span className="text-[11.5px] text-[#6B7280]">
                            {e.tenant_sector} · {e.tenant_jurisdiction}
                            {e.tenant_employee_count && ` · ${e.tenant_employee_count.toLocaleString()} staff`}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center h-5 px-2 rounded text-[11px] font-medium border tabular-nums ${TONE_STYLES[s.tone]}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {e.overall_score === null ? <span className="text-[#9AA1AD]">—</span> :
                          <span className="font-medium text-[#1F242C]">{e.overall_score.toFixed(2)}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {e.findings_total === 0 ? <span className="text-[#9AA1AD]">—</span> : (
                          <span className="text-[#4B5360]">
                            {e.findings_total}
                            {e.findings_unreviewed > 0 && (
                              <span className="text-[#85601A]"> · {e.findings_unreviewed} unreviewed</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">
                        {daysSince(e.completed_at)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {e.assessment_status === "completed" ? (
                          <Link
                            href={`/consultant/${e.tenant_slug}/${e.assessment_id}/findings`}
                            className="text-[#3A6FB8] hover:underline"
                          >
                            Open findings →
                          </Link>
                        ) : (
                          <span className="text-[#9AA1AD]">Awaiting submission</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {engagements && engagements.length > 0 && (
          <p className="text-[11.5px] text-[#6B7280] mt-3">
            Showing {engagements.length} engagement{engagements.length !== 1 ? "s" : ""}. Other consultants&apos; assignments aren&apos;t listed — per the access model, you only see customers you&apos;re assigned to (R&P C15).
          </p>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  count,
  label,
  sub,
  tone,
}: {
  count: number;
  label: string;
  sub: string;
  tone?: "info" | "warning" | "success";
}) {
  const accent =
    tone === "warning" ? "text-[#85601A]" :
    tone === "info" ? "text-[#264B80]" :
    tone === "success" ? "text-[#2C6741]" : "text-[#1F242C]";
  return (
    <div className="rounded-lg border border-[#E2E5EA] bg-white px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className={`text-[26px] font-medium tabular-nums leading-none ${accent}`}>{count}</span>
        <span className="text-[12.5px] text-[#4B5360]">{label}</span>
      </div>
      <div className="text-[11.5px] text-[#6B7280] mt-1.5">{sub}</div>
    </div>
  );
}
