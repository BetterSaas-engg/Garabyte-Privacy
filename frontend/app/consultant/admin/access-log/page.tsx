"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessLog, isUnauthorized, whoami } from "@/lib/api";
import type { AccessLogRow } from "@/lib/api";

const PAGE_SIZE = 100;

export default function AccessLogPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<"checking" | "yes" | "no">("checking");
  const [rows, setRows] = useState<AccessLogRow[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    whoami()
      .then((w) => {
        const ok = w.memberships.some((m) => m.role === "garabyte_admin");
        setAllowed(ok ? "yes" : "no");
      })
      .catch((e) => {
        if (isUnauthorized(e)) router.replace("/auth/login");
        else setAllowed("no");
      });
  }, [router]);

  useEffect(() => {
    if (allowed !== "yes") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getAccessLog({
          limit: PAGE_SIZE,
          offset,
          action: filterAction.trim() || undefined,
        });
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [allowed, offset, filterAction]);

  if (allowed === "checking") {
    return <Shell><p className="text-[12.5px] text-[#6B7280]">Checking permissions…</p></Shell>;
  }
  if (allowed === "no") {
    return (
      <Shell>
        <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-3 text-[12.5px] text-[#8A2A2A]">
          Garabyte admins only. The audit log surfaces every customer&apos;s activity, so it&apos;s gated to platform-wide elevated roles.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1.5">
          Garabyte admin · audit log
        </p>
        <h1 className="text-[28px] leading-9 font-medium text-[#1F242C] mb-2" style={{ letterSpacing: "-0.005em" }}>
          Access log
        </h1>
        <p className="text-[13px] text-[#6B7280] max-w-prose">
          Append-only record of every privileged action. Used for regulatory defensibility and to investigate access disputes. Reading this page itself is logged.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
          placeholder="Filter by action prefix (e.g. tenant., publish., login)"
          className="flex-1 max-w-md h-9 px-3 rounded-md text-[13px] bg-white border border-[#E2E5EA] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none"
        />
        <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-2 py-1 rounded border border-[#E2E5EA] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Newer
          </button>
          <span className="tabular-nums px-1">
            rows {offset + 1}–{offset + (rows?.length ?? 0)}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!rows || rows.length < PAGE_SIZE}
            className="px-2 py-1 rounded border border-[#E2E5EA] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Older →
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-3 text-[12.5px] text-[#8A2A2A] mb-4">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] font-medium text-[#6B7280] tracking-[0.06em] uppercase bg-[#F7F8FA] border-b border-[#EEF0F3]">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Org</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Resource</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Context</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-[#9AA1AD]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-[#9AA1AD]">No log rows match.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#EEF0F3] hover:bg-[#F7F8FA] transition-colors align-top">
                  <td className="px-3 py-2 tabular-nums text-[#4B5360] whitespace-nowrap">
                    {new Date(r.at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {r.user_email ?? <span className="text-[#9AA1AD]">— anonymous —</span>}
                    {r.user_id !== null && <span className="text-[#9AA1AD]"> #{r.user_id}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.org_slug ?? <span className="text-[#9AA1AD]">—</span>}
                  </td>
                  <td className="px-3 py-2 font-medium text-[#1F242C]">{r.action}</td>
                  <td className="px-3 py-2 text-[#4B5360]">
                    {r.resource_kind && r.resource_id !== null
                      ? `${r.resource_kind} #${r.resource_id}`
                      : <span className="text-[#9AA1AD]">—</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#6B7280]">
                    {r.ip ?? <span className="text-[#9AA1AD]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#6B7280] font-mono break-all max-w-[280px]">
                    {r.context ? JSON.stringify(r.context) : <span className="text-[#9AA1AD]">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#F7F8FA] text-[#1F242C]"
      style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#EEF0F3]">
        <div className="max-w-[1200px] mx-auto px-6 h-12 flex items-center gap-5">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-5 h-5 rounded-sm bg-[#1F242C] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#3A6FB8]" />
            </div>
            <div className="text-[13px] font-medium text-[#1F242C]">Consultant console</div>
          </div>
          <nav className="ml-auto flex items-center gap-3 text-[12px]">
            <Link href="/consultant" className="text-[#9AA1AD] hover:text-[#4B5360]">
              ← Engagements
            </Link>
            <Link href="/consultant/admin/access-requests" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Inbound queue →
            </Link>
            <Link href="/" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Customer site →
            </Link>
          </nav>
        </div>
      </header>
      <div className="max-w-[1200px] mx-auto px-6 py-8">{children}</div>
    </main>
  );
}
