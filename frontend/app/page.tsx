"use client";

import { useEffect, useState } from "react";
import { getTenants, getTenantHistory } from "@/lib/api";
import type { Tenant, TenantHistoryItem } from "@/lib/types";
import { TenantCard } from "@/components/TenantCard";

interface TenantWithHistory {
  tenant: Tenant;
  history: TenantHistoryItem[];
}

export default function Home() {
  const [data, setData] = useState<TenantWithHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const tenants = await getTenants();
        // Fetch history for each tenant in parallel
        const withHistory = await Promise.all(
          tenants.map(async (t) => ({
            tenant: t,
            history: await getTenantHistory(t.slug),
          }))
        );
        setData(withHistory);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <section className="mb-16 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-3">
            Privacy program assessment
          </p>
          <h1 className="text-display text-garabyte-primary-800 mb-6">
            Know where your privacy program stands.
            <br />
            Know where to go next.
          </h1>
          <p className="text-lg text-garabyte-ink-700 leading-relaxed">
            An 8-dimension maturity assessment mapped to PIPEDA, Quebec Law 25,
            CASL, GDPR, and emerging AI governance standards. Co-designed with
            Garabyte Consulting.
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-h2 text-garabyte-primary-800">
              Your organizations
            </h2>
            <p className="text-sm text-garabyte-ink-500">
              {data ? `${data.length} active` : ""}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 mb-6">
              <p className="text-garabyte-status-critical font-medium">
                Could not load tenants: {error}
              </p>
              <p className="text-sm text-garabyte-ink-500 mt-1">
                Make sure the backend is running on http://localhost:8001
              </p>
            </div>
          )}

          {!data && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-card p-6 animate-pulse h-56"
                >
                  <div className="h-5 bg-garabyte-ink-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-garabyte-ink-100 rounded w-1/2 mb-8" />
                  <div className="h-8 bg-garabyte-ink-100 rounded w-1/2 mb-3" />
                  <div className="h-3 bg-garabyte-ink-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {data && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.map(({ tenant, history }) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  history={history}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
