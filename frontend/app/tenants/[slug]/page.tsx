"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTenant, getTenantHistory } from "@/lib/api";
import type { Tenant, TenantHistoryItem } from "@/lib/types";

export default function TenantDashboard({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<TenantHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTenant(slug), getTenantHistory(slug)])
      .then(([t, h]) => {
        setTenant(t);
        setHistory(h);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [slug]);

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6"
        >
          ← All organizations
        </Link>

        {error && (
          <div className="p-4 rounded-xl bg-garabyte-status-critical/10 border border-garabyte-status-critical/20">
            <p className="text-garabyte-status-critical font-medium">
              Error loading tenant: {error}
            </p>
          </div>
        )}

        {tenant && (
          <>
            <header className="mb-10">
              <p className="text-sm uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
                {tenant.sector} · {tenant.jurisdiction}
              </p>
              <h1 className="text-h1 text-garabyte-primary-800">
                {tenant.name}
              </h1>
            </header>

            <div className="bg-white rounded-xl shadow-card p-8">
              <h2 className="text-h3 text-garabyte-primary-800 mb-3">
                Dashboard coming soon
              </h2>
              <p className="text-garabyte-ink-700 mb-6">
                The tenant dashboard — dimension scores, gap findings, quarter-over-quarter history — will be built in the next step. For now, this confirms the routing works.
              </p>

              {history && history.length > 0 && (
                <div className="border-t border-garabyte-ink-100 pt-6">
                  <h3 className="text-sm font-semibold text-garabyte-primary-800 uppercase tracking-wider mb-3">
                    Assessment history
                  </h3>
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li key={h.assessment_id} className="flex items-center justify-between text-sm">
                        <span className="text-garabyte-ink-700">{h.label}</span>
                        <span className="text-garabyte-primary-800 font-medium tabular-nums">
                          {h.overall_score?.toFixed(2)} · {h.overall_maturity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
