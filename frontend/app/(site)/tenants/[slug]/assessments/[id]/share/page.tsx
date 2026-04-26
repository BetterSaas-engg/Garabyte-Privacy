"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createShareLink,
  getAssessment,
  isUnauthorized,
  listShareLinks,
  revokeShareLink,
} from "@/lib/api";
import type { ShareLink } from "@/lib/api";

function shareUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

export default function ShareManagementPage() {
  const params = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const assessmentId = Number(params.id);

  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  async function refresh() {
    setLinks(await listShareLinks(assessmentId));
  }

  useEffect(() => {
    (async () => {
      try {
        await getAssessment(assessmentId);
        await refresh();
      } catch (e) {
        if (isUnauthorized(e)) router.replace("/auth/login");
        else setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const link = await createShareLink(assessmentId, {
        label: label.trim() || undefined,
        expires_in_days: days,
      });
      setRevealedToken(link.token);
      setLabel("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(linkId: number) {
    try {
      await revokeShareLink(linkId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/tenants/${params.slug}`}
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700"
        >
          ← Back to dashboard
        </Link>

        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mt-4 mb-3">
          Read-only sharing
        </p>
        <h1 className="text-h2 text-garabyte-primary-800 mb-2">Share this report</h1>
        <p className="text-sm text-garabyte-ink-700 max-w-prose mb-6">
          Issue a signed link a board member or auditor can open without creating an account.
          Each link is tied to the published version of this assessment, expires after the
          chosen window, and can be revoked at any time. When the report is republished, all
          outstanding links are automatically revoked.
        </p>

        {error && (
          <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-3 py-2 text-sm text-garabyte-status-critical mb-4">
            {error}
          </div>
        )}

        {revealedToken && (
          <div className="rounded-md bg-garabyte-status-good/10 border border-garabyte-status-good/30 px-3 py-3 text-sm mb-4">
            <p className="font-medium text-garabyte-ink-900 mb-1">New link issued. Copy it now — we won&apos;t show it again.</p>
            <code className="block w-full mt-1 px-2 py-1.5 bg-white border border-garabyte-ink-100 rounded font-mono text-xs break-all">
              {shareUrl(revealedToken)}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl(revealedToken));
              }}
              className="mt-2 text-xs px-2 py-1 rounded bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600"
            >
              Copy
            </button>
          </div>
        )}

        <form onSubmit={onCreate} className="rounded-md border border-garabyte-ink-100 bg-white p-4 mb-6 space-y-3">
          <h2 className="text-sm font-medium text-garabyte-ink-900">Issue a new link</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
                placeholder="e.g. Q1 board review"
                className="w-full h-9 px-3 rounded-md text-sm bg-white border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">Expires in</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full h-9 px-3 pr-9 rounded-md text-sm bg-white border border-garabyte-ink-100 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none appearance-none"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={creating}
              className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 disabled:bg-garabyte-primary-300"
            >
              {creating ? "Issuing…" : "Issue link"}
            </button>
          </div>
        </form>

        <h2 className="text-sm font-medium text-garabyte-ink-900 mb-3">Existing links</h2>
        {!links ? (
          <p className="text-sm text-garabyte-ink-500">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-garabyte-ink-500">No links have been issued yet.</p>
        ) : (
          <div className="rounded-md border border-garabyte-ink-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] font-medium text-garabyte-ink-500 tracking-[0.06em] uppercase bg-garabyte-ink-50 border-b border-garabyte-ink-100">
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Issued</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                  <th className="px-3 py-2 font-medium text-right">Views</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const now = Date.now();
                  const expired = new Date(l.expires_at).getTime() < now;
                  const status = l.revoked_at
                    ? "Revoked"
                    : expired
                      ? "Expired"
                      : "Active";
                  return (
                    <tr key={l.id} className="border-b border-garabyte-ink-100 last:border-b-0">
                      <td className="px-3 py-2 text-garabyte-ink-900">{l.label ?? <span className="text-garabyte-ink-300">— unlabeled —</span>}</td>
                      <td className="px-3 py-2 tabular-nums text-garabyte-ink-700">{new Date(l.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 tabular-nums text-garabyte-ink-700">{new Date(l.expires_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.access_count}</td>
                      <td className="px-3 py-2">
                        <span className={
                          status === "Active"
                            ? "text-garabyte-status-good font-medium"
                            : status === "Revoked"
                              ? "text-garabyte-status-critical"
                              : "text-garabyte-ink-500"
                        }>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {status === "Active" && (
                          <button
                            onClick={() => onRevoke(l.id)}
                            className="text-xs text-garabyte-status-critical hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
