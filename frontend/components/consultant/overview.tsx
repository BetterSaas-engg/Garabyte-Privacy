"use client";

import { DIMENSIONS, TEAM, ACTIVITY } from "@/lib/consultant-mock";
import { Btn, ConfidenceDot, Pill, Stat } from "./atoms";
import { ConsoleTopBar, EngagementSidebar } from "./chrome";

export function CustomerOverview() {
  return (
    <>
      <ConsoleTopBar pageContext="Engagements" pageTitle="Northwind Logistics Inc." />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="overview" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          {/* Org context strip */}
          <div className="bg-white border-b border-[#EEF0F3] px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[10.5px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1.5">Customer engagement</div>
                <h1 className="text-[22px] leading-7 font-medium text-[#1F242C]" style={{ letterSpacing: "-0.005em" }}>
                  Northwind Logistics Inc.
                </h1>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-[#4B5360] mt-2">
                  <span><span className="text-[#9AA1AD]">Industry</span>&nbsp;&nbsp;Logistics &amp; supply chain</span>
                  <span><span className="text-[#9AA1AD]">Headcount</span>&nbsp;&nbsp;142</span>
                  <span><span className="text-[#9AA1AD]">HQ</span>&nbsp;&nbsp;Toronto, ON · Canada</span>
                  <span><span className="text-[#9AA1AD]">Account since</span>&nbsp;&nbsp;Jan 2024</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Pill tone="info" dot>Under review</Pill>
                  <Pill tone="warning">Day 3 of 5 SLA</Pill>
                  <Pill tone="muted">Submitted Mar 14</Pill>
                  <Pill tone="muted">Engagement #ENG-2025-0481</Pill>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Btn kind="secondary" sm>Notes</Btn>
                  <Btn kind="secondary" sm>Reassign</Btn>
                  <a
                    href="#findings"
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium bg-[#3A6FB8] hover:bg-[#2F5C9C] text-white border border-[#3A6FB8] transition-colors"
                  >
                    Open findings review
                  </a>
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  Primary contact: <span className="text-[#1F242C]">Maya Reyes, privacy lead</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-[#EEF0F3] px-6">
            <nav className="flex items-center gap-0">
              {[
                { id: "overview",  label: "Overview" },
                { id: "findings",  label: "Findings", count: 14 },
                { id: "responses", label: "Raw responses", count: 96 },
                { id: "evidence",  label: "Evidence", count: 9 },
                { id: "history",   label: "History" },
                { id: "publish",   label: "Publish" },
              ].map((t, i) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`px-3 h-9 inline-flex items-center gap-1.5 text-[12.5px] border-b-2 transition-colors -mb-px ${
                    i === 0 ? "border-[#3A6FB8] text-[#1F242C] font-medium" : "border-transparent text-[#4B5360] hover:text-[#1F242C]"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && <span className="text-[11px] tabular-nums text-[#6B7280]">{t.count}</span>}
                </a>
              ))}
            </nav>
          </div>

          {/* Two-column body */}
          <div className="p-6 grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8 space-y-5">
              <div className="rounded-lg border border-[#E2E5EA] bg-white p-5">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="text-[10.5px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1.5">Overall score</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[44px] font-medium tabular-nums leading-none" style={{ color: "#85601A", letterSpacing: "-0.01em" }}>68</span>
                      <span className="text-[14px] text-[#6B7280]">/ 100</span>
                    </div>
                    <div className="text-[11.5px] text-[#6B7280] mt-2">Engine output, before consultant review</div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Stat label="Confident dimensions"   value="5 of 8"  tone="success" />
                    <Stat label="Low-confidence flagged" value="3"       tone="warning" />
                    <Stat label="Findings to review"     value="14"      tone="info" />
                    <Stat label="Evidence files"         value="9"       sub="3 unreviewed" tone="warning" />
                    <Stat label="Customer questions"     value="0 open"  tone="muted" />
                    <Stat label="Estimated hours"        value="8 — 12"  sub="internal pricing" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3] flex items-baseline justify-between">
                  <div className="text-[13px] font-medium text-[#1F242C]">Dimensions</div>
                  <div className="text-[11.5px] text-[#6B7280]">8 dimensions · low-confidence flagged for review</div>
                </div>
                <div className="divide-y divide-[#EEF0F3]">
                  {DIMENSIONS.map((d) => (
                    <a key={d.id} href="#findings" className="px-4 py-2.5 flex items-center gap-4 hover:bg-[#F7F8FA] transition-colors group">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[11px] font-medium tabular-nums text-[#9AA1AD] w-6 text-right">{d.id}</span>
                        <ConfidenceDot conf={d.conf} />
                        <span className="text-[13px] text-[#1F242C] truncate group-hover:text-[#3A6FB8]">{d.name}</span>
                      </div>
                      <div className="w-32 h-1.5 rounded-full bg-[#EEF0F3] overflow-hidden">
                        <div className="h-full" style={{ width: `${d.score}%`, background: d.score >= 80 ? "#3F8B5C" : d.score >= 65 ? "#3A6FB8" : "#B5821F" }} />
                      </div>
                      <span className="text-[12px] tabular-nums w-8 text-right text-[#4B5360]">{d.score}</span>
                      <span className="text-[11.5px] tabular-nums w-16 text-right text-[#6B7280]">
                        {d.findings} {d.findings === 1 ? "finding" : "findings"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-5">
              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3]">
                  <div className="text-[13px] font-medium text-[#1F242C]">Customer team</div>
                </div>
                <div className="divide-y divide-[#EEF0F3]">
                  {TEAM.map((p, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full inline-flex items-center justify-center font-medium text-[11px]" style={{ background: p.color.bg, color: p.color.fg }}>
                        {p.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-[#1F242C] leading-4 truncate">{p.name}</div>
                        <div className="text-[11px] text-[#6B7280] leading-4">{p.role}</div>
                      </div>
                      <span className="text-[11.5px] tabular-nums text-[#6B7280]">{p.ans} answers</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3]">
                  <div className="text-[13px] font-medium text-[#1F242C]">Recent activity</div>
                </div>
                <ul className="divide-y divide-[#EEF0F3] text-[12px]">
                  {ACTIVITY.map((a, i) => (
                    <li key={i} className="px-4 py-2 flex items-baseline gap-2.5">
                      <span
                        className="text-[10.5px] font-medium uppercase tracking-[0.06em] w-14 flex-shrink-0"
                        style={{ color: a.tone === "info" ? "#264B80" : "#9AA1AD" }}
                      >
                        {a.who}
                      </span>
                      <span className="flex-1 text-[#4B5360] leading-[18px]">{a.text}</span>
                      <span className="text-[11px] text-[#9AA1AD] flex-shrink-0">{a.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
