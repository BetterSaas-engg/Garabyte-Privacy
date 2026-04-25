"use client";

import { Pill } from "./atoms";

export function ConsoleTopBar({ pageTitle, pageContext }: { pageTitle: string; pageContext?: string }) {
  return (
    <header className="border-b border-[#EEF0F3] bg-white flex-shrink-0">
      <div className="h-12 px-5 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-sm bg-[#1F242C] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#3A6FB8]" />
          </div>
          <div className="text-[13px] font-medium text-[#1F242C]">Garabyte</div>
          <span className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.06em] uppercase ml-1">Consultant console</span>
        </div>
        <span className="w-px h-5 bg-[#E2E5EA]" />
        <div className="flex items-center gap-1.5 min-w-0">
          {pageContext && (
            <a
              href={pageContext === "Engagements" ? "#home" : "#overview"}
              className="text-[12px] text-[#6B7280] truncate hover:text-[#1F242C] hover:underline"
            >
              {pageContext}
            </a>
          )}
          {pageContext && pageTitle && <span className="text-[12px] text-[#9AA1AD]">/</span>}
          <span className="text-[12.5px] text-[#1F242C] font-medium truncate">{pageTitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[12px] text-[#6B7280]">
            <kbd className="font-mono text-[10.5px] px-1.5 h-5 inline-flex items-center rounded border border-[#E2E5EA] bg-[#F7F8FA] text-[#4B5360]">⌘ K</kbd>
            <span>Quick search</span>
          </div>
          <span className="w-px h-5 bg-[#E2E5EA]" />
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full inline-flex items-center justify-center font-medium text-[11px]" style={{ background: "#E2E1E8", color: "#3F3D52" }}>JT</span>
            <div className="hidden md:flex flex-col leading-[14px]">
              <span className="text-[12px] text-[#1F242C] font-medium">Jordan Taylor</span>
              <span className="text-[10.5px] text-[#9AA1AD]">Senior consultant</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SidebarMetric({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  const valColor = tone === "warning" ? "#85601A" : tone === "success" ? "#2C6741" : "#1F242C";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11.5px] text-[#6B7280]">{label}</span>
      <span className="text-[12px] font-medium tabular-nums" style={{ color: valColor }}>{value}</span>
    </div>
  );
}

export function EngagementSidebar({ active }: { active: string }) {
  const tabs: { id: string; label: string; count?: number; sub?: string; accent?: boolean }[] = [
    { id: "overview",  label: "Overview" },
    { id: "findings",  label: "Findings",  count: 14, accent: true },
    { id: "responses", label: "Raw responses" },
    { id: "evidence",  label: "Evidence",  count: 9, sub: "3 unreviewed" },
    { id: "history",   label: "History" },
    { id: "publish",   label: "Publish" },
  ];
  return (
    <aside className="w-[260px] border-r border-[#EEF0F3] bg-[#F7F8FA] flex-shrink-0 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-[#EEF0F3]">
        <div className="text-[10.5px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1.5">Engagement</div>
        <div className="text-[14px] font-medium text-[#1F242C] leading-5">Northwind Logistics Inc.</div>
        <div className="text-[11.5px] text-[#6B7280] leading-[16px] mt-0.5">Logistics &amp; supply chain · 142 staff · Canada</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="info" dot>Under review</Pill>
          <Pill tone="muted">Day 3 of 5 SLA</Pill>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-[#EEF0F3] space-y-1.5">
        <SidebarMetric label="Overall score" value="68 / 100" tone="warning" />
        <SidebarMetric label="Confident dimensions" value="5 of 8" tone="success" />
        <SidebarMetric label="Low-confidence flagged" value="3" tone="warning" />
        <SidebarMetric label="Submitted" value="Mar 14, 2025" />
      </div>
      <nav className="flex-1 px-2 py-2.5">
        {tabs.map((t) => {
          const sel = t.id === active;
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`flex items-center justify-between px-2.5 h-8 rounded-md text-[12.5px] transition-colors ${
                sel
                  ? "bg-white text-[#1F242C] font-medium border border-[#E2E5EA] shadow-[0_1px_1px_rgba(17,21,27,0.03)]"
                  : "text-[#4B5360] hover:bg-[#EEF0F3] hover:text-[#1F242C]"
              }`}
            >
              <span className="flex items-center gap-2">
                {t.label}
                {t.accent && sel && <span className="w-1.5 h-1.5 rounded-full bg-[#3A6FB8]" />}
              </span>
              {t.count !== undefined && (
                <span className="flex items-center gap-1.5">
                  {t.sub && <span className="text-[10.5px] text-[#B5821F]">{t.sub}</span>}
                  <span className="text-[11px] tabular-nums text-[#6B7280]">{t.count}</span>
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-[#EEF0F3] space-y-1">
        <a href="#home" className="flex items-center gap-1.5 text-[12px] text-[#4B5360] hover:text-[#1F242C]" title="Back to engagements list">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All engagements
        </a>
      </div>
    </aside>
  );
}

export function CanvasHeader() {
  const groups = [
    { id: "home",      label: "Home" },
    { id: "overview",  label: "Overview" },
    { id: "findings",  label: "Findings" },
    { id: "responses", label: "Raw responses" },
    { id: "evidence",  label: "Evidence" },
    { id: "history",   label: "History" },
    { id: "publish",   label: "Publish" },
  ];
  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#EEF0F3]">
      <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center gap-5">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-5 h-5 rounded-sm bg-[#1F242C] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#3A6FB8]" />
          </div>
          <div className="text-[13px] font-medium text-[#1F242C]">Consultant console</div>
        </div>
        <nav className="flex items-center gap-1 ml-auto overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {groups.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="text-[12px] text-[#4B5360] hover:text-[#1F242C] hover:bg-[#EEF0F3] px-2.5 py-1 rounded transition-colors whitespace-nowrap">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function CanvasIntro() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10 pb-6">
      <div className="max-w-[820px]">
        <div className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-2">
          Garabyte Privacy Health Check · internal
        </div>
        <h1 className="text-[28px] leading-9 font-medium text-[#1F242C] mb-3" style={{ letterSpacing: "-0.005em" }}>
          Consultant console
        </h1>
        <p className="text-[14px] text-[#4B5360] leading-[22px]">
          Where Garabyte consultants validate engine findings, refine prose, and produce reports defensible enough that the customer could hand them to a regulator. Denser than the customer surfaces, persistent left rail, every edit reversible. Per the access model, a consultant only sees customers they&apos;re explicitly assigned to.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center h-5 px-2 rounded border bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5] font-medium">
            Consultant role · access scoped to assigned customers
          </span>
          <span className="inline-flex items-center h-5 px-2 rounded border bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5] font-medium">
            Original engine output always recoverable
          </span>
          <span className="inline-flex items-center h-5 px-2 rounded border bg-[#EEF0F3] text-[#4B5360] border-[#E2E5EA] font-medium">
            Hours estimates internal — never on customer report
          </span>
        </div>
      </div>
    </section>
  );
}
