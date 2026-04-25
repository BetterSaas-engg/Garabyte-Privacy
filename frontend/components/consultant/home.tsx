"use client";

import { ENGAGEMENTS } from "@/lib/consultant-mock";
import { Btn, FilterChip, StatusBadge, SlaCell } from "./atoms";
import { ConsoleTopBar } from "./chrome";

function StatusStrip() {
  const cards = [
    { count: 3, label: "Under review",                sub: "1 over SLA" },
    { count: 1, label: "Awaiting publication",        sub: "Lattice — ready since Mar 12" },
    { count: 2, label: "Scheduled reviews this week", sub: "Mariner · Birchmark" },
    { count: 2, label: "New submissions",             sub: "Kestrel · Outpost" },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {cards.map((c, i) => (
        <div key={i} className="rounded-lg border border-[#E2E5EA] bg-white px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-medium tabular-nums text-[#1F242C] leading-none">{c.count}</span>
            <span className="text-[12.5px] text-[#4B5360]">{c.label}</span>
          </div>
          <div className="text-[11.5px] text-[#6B7280] mt-1.5">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function ConsultantHome() {
  return (
    <>
      <ConsoleTopBar pageTitle="My engagements" />
      <div className="flex-1 px-6 py-5 bg-[#F7F8FA]">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-[20px] leading-7 font-medium text-[#1F242C]" style={{ letterSpacing: "-0.005em" }}>
              My engagements
            </h1>
            <p className="text-[12.5px] text-[#6B7280] mt-0.5">10 customers assigned to you. Sorted by next action priority.</p>
          </div>
          <div className="flex items-center gap-2">
            <Btn kind="secondary" sm>Export CSV</Btn>
            <Btn kind="secondary" sm>Schedule review</Btn>
          </div>
        </div>

        <StatusStrip />

        <div className="rounded-t-lg border border-[#E2E5EA] bg-white px-3 py-2.5 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-[340px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.25" stroke="#9AA1AD" strokeWidth="1.25" />
              <path d="M9.5 9.5l2.5 2.5" stroke="#9AA1AD" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search by organization name…"
              className="w-full h-7 pl-8 pr-2 text-[12.5px] rounded border border-[#E2E5EA] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none placeholder:text-[#9AA1AD]"
            />
          </div>
          <span className="w-px h-5 bg-[#E2E5EA]" />
          <FilterChip label="Status" value="All" />
          <FilterChip label="Industry" value="Any" />
          <FilterChip label="Jurisdiction" value="Any" />
          <FilterChip label="SLA" value="All" />
          <button className="text-[12px] text-[#3A6FB8] hover:underline ml-1">Clear filters</button>
          <span className="ml-auto text-[11.5px] text-[#6B7280]">
            Sort: <span className="text-[#1F242C]">Next action priority</span>
          </span>
        </div>

        <div className="rounded-b-lg border border-t-0 border-[#E2E5EA] bg-white overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-medium text-[#6B7280] tracking-[0.06em] uppercase bg-[#F7F8FA] border-b border-[#EEF0F3]">
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Score</th>
                <th className="px-3 py-2 font-medium text-right">Low-conf.</th>
                <th className="px-3 py-2 font-medium text-right">Since submission</th>
                <th className="px-3 py-2 font-medium">Next action</th>
                <th className="px-3 py-2 font-medium text-right">SLA</th>
              </tr>
            </thead>
            <tbody>
              {ENGAGEMENTS.map((e, i) => (
                <tr key={i} className="border-b border-[#EEF0F3] hover:bg-[#F7F8FA] transition-colors">
                  <td className="px-3 py-2.5">
                    <a href="#overview" className="flex flex-col leading-[18px] hover:text-[#3A6FB8]">
                      <span className="text-[#1F242C] font-medium hover:text-[#3A6FB8]">{e.org}</span>
                      <span className="text-[11.5px] text-[#6B7280]">{e.industry} · {e.hc.toLocaleString()} staff · {e.jur}</span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {e.score === null ? <span className="text-[#9AA1AD]">—</span> : (
                      <span className="font-medium" style={{ color: e.score >= 80 ? "#2C6741" : e.score >= 65 ? "#1F242C" : "#85601A" }}>
                        {e.score}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {e.low === null ? <span className="text-[#9AA1AD]">—</span> :
                      e.low === 0    ? <span className="text-[#9AA1AD]">0</span> :
                      <span style={{ color: e.low >= 4 ? "#8A2A2A" : "#85601A" }}>{e.low}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#4B5360]">
                    {e.since === null ? <span className="text-[#9AA1AD]">—</span> :
                      e.since === 0   ? "Today" :
                      e.since === 1   ? "Yesterday" : `${e.since}d ago`}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.next === "—" ? <span className="text-[#9AA1AD]">—</span> :
                      <a href="#overview" className="text-[#3A6FB8] hover:underline">{e.next}</a>}
                  </td>
                  <td className="px-3 py-2.5 text-right"><SlaCell sla={e.sla} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11.5px] text-[#6B7280] mt-3">
          Showing 10 of 10 engagements assigned to you. Other consultants&apos; engagements aren&apos;t listed — per the access model, you only see customers you&apos;re assigned to.
        </div>
      </div>
    </>
  );
}

