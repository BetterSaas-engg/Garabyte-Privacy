"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isUnauthorized,
  listAccessRequests,
  updateAccessRequest,
  whoami,
} from "@/lib/api";
import type { AccessRequestRow } from "@/lib/api";

const STATUSES = ["pending", "contacted", "onboarded", "declined"] as const;

const STATUS_TONES: Record<string, string> = {
  pending:    "bg-[#FAF3E6] text-[#85601A] border-[#EAD9B2]",
  contacted:  "bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5]",
  onboarded:  "bg-[#EDF6EF] text-[#2C6741] border-[#CFE3D6]",
  declined:   "bg-[#EEF0F3] text-[#4B5360] border-[#E2E5EA]",
};

export default function AccessRequestsAdmin() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<"checking" | "yes" | "no">("checking");
  const [rows, setRows] = useState<AccessRequestRow[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");

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

  async function refresh() {
    try {
      setRows(await listAccessRequests({ status: filter || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (allowed === "yes") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, filter]);

  function startEdit(r: AccessRequestRow) {
    setEditing(r.id);
    setEditNotes(r.triage_notes ?? "");
    setEditStatus(r.status);
  }

  async function saveEdit(id: number) {
    try {
      await updateAccessRequest(id, {
        status: editStatus,
        triage_notes: editNotes,
      });
      setEditing(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (allowed === "checking") {
    return <Shell><p className="text-sm text-[#6B7280]">Checking permissions…</p></Shell>;
  }
  if (allowed === "no") {
    return (
      <Shell>
        <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-3 text-sm text-[#8A2A2A]">
          Garabyte admins only.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.08em] text-[#9AA1AD] font-medium mb-1.5">
          Garabyte admin · access requests
        </p>
        <h1 className="text-[28px] leading-9 font-medium text-[#1F242C] mb-2">
          Inbound queue
        </h1>
        <p className="text-[13px] text-[#6B7280] max-w-prose">
          Submissions from the public &quot;Request access&quot; form. Triage
          manually — reach out by email, then mark as contacted, onboarded,
          or declined. Once a request becomes a real customer, create the
          tenant via{" "}
          <Link href="/tenants/new" className="text-[#3A6FB8] hover:underline">
            New organization
          </Link>{" "}
          and invite the privacy lead.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-3 py-2 text-sm text-[#8A2A2A] mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 text-[12.5px]">
        <span className="text-[#6B7280]">Filter:</span>
        <button
          onClick={() => setFilter("")}
          className={`px-2.5 py-1 rounded-md border ${
            filter === ""
              ? "bg-[#1F242C] text-white border-[#1F242C]"
              : "bg-white border-[#E2E5EA] text-[#4B5360] hover:bg-[#F7F8FA]"
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-md border capitalize ${
              filter === s
                ? "bg-[#1F242C] text-white border-[#1F242C]"
                : "bg-white border-[#E2E5EA] text-[#4B5360] hover:bg-[#F7F8FA]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
        {!rows ? (
          <p className="px-4 py-6 text-[13px] text-[#9AA1AD]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[#9AA1AD]">
            No access requests {filter ? `with status ${filter}` : "yet"}.
          </p>
        ) : (
          <ul className="divide-y divide-[#EEF0F3]">
            {rows.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <div className="text-[14px] font-medium text-[#1F242C]">
                      {r.name}
                      <span className="ml-2 text-[12px] font-normal text-[#6B7280]">
                        · {r.email}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-[#4B5360]">
                      {r.org_name}
                      {r.sector && <span className="text-[#9AA1AD]"> · {r.sector.replace("_", " ")}</span>}
                      {r.employee_count !== null && <span className="text-[#9AA1AD]"> · ~{r.employee_count.toLocaleString()} staff</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center h-5 px-2 rounded text-[11px] font-medium border tabular-nums capitalize ${STATUS_TONES[r.status] ?? STATUS_TONES.pending}`}>
                      {r.status}
                    </span>
                    <span className="text-[11.5px] text-[#9AA1AD] tabular-nums">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {r.message && (
                  <p className="text-[13px] text-[#4B5360] leading-snug mb-2 whitespace-pre-wrap">
                    {r.message}
                  </p>
                )}

                {editing === r.id ? (
                  <div className="rounded-md bg-[#F7F8FA] border border-[#E2E5EA] p-3 mt-2">
                    <label className="text-[11px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium block mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="h-8 px-2 rounded text-[13px] bg-white border border-[#E2E5EA] mb-3"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <label className="text-[11px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium block mb-1">
                      Triage notes (internal)
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 rounded text-[13px] bg-white border border-[#E2E5EA] resize-y mb-3"
                      placeholder="Reached out 2026-04-28 …"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(r.id)}
                        className="text-[12px] px-3 py-1.5 rounded bg-[#3A6FB8] text-white hover:bg-[#2C5A91]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-[12px] px-3 py-1.5 rounded border border-[#E2E5EA] text-[#4B5360] hover:bg-[#F7F8FA]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => startEdit(r)}
                      className="text-[12px] text-[#3A6FB8] hover:underline"
                    >
                      Triage →
                    </button>
                    {r.triage_notes && (
                      <span className="text-[11.5px] text-[#9AA1AD]">
                        notes: {r.triage_notes.slice(0, 80)}
                        {r.triage_notes.length > 80 ? "…" : ""}
                      </span>
                    )}
                    {r.triaged_by_email && (
                      <span className="text-[11.5px] text-[#9AA1AD]">
                        last triaged by {r.triaged_by_email}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
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
            <Link href="/consultant/admin/access-log" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Access log →
            </Link>
          </nav>
        </div>
      </header>
      <div className="max-w-[1200px] mx-auto px-6 py-8">{children}</div>
    </main>
  );
}
