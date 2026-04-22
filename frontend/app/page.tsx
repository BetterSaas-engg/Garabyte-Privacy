/**
 * Temporary homepage — system check.
 * Confirms Tailwind/Garabyte theme loaded and the API is reachable.
 * Will be replaced with the real tenant picker in the next step.
 */

"use client";

import { useEffect, useState } from "react";
import { getHealth, getTenants } from "@/lib/api";
import type { HealthResponse, Tenant } from "@/lib/types";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHealth(), getTenants()])
      .then(([h, t]) => {
        setHealth(h);
        setTenants(t);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-garabyte-cream-50 px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-sm uppercase tracking-wider text-garabyte-primary-500 mb-2">
            Garabyte Privacy Health Check
          </p>
          <h1 className="text-display text-garabyte-primary-800">
            System check
          </h1>
          <p className="mt-4 text-garabyte-ink-700 text-lg leading-relaxed">
            Temporary verification page. Confirms the Garabyte theme is loaded
            and the frontend can reach the backend API. Replace me with the
            real landing page.
          </p>
        </header>

        {error && (
          <div className="mb-8 p-4 rounded-xl bg-garabyte-status-critical/10 border border-garabyte-status-critical/20">
            <p className="text-garabyte-status-critical font-medium">
              API error: {error}
            </p>
            <p className="text-sm text-garabyte-ink-500 mt-1">
              Make sure the backend is running on http://localhost:8001
            </p>
          </div>
        )}

        <section className="mb-8 p-6 rounded-xl bg-white shadow-card">
          <h2 className="text-h3 text-garabyte-primary-800 mb-4">
            Backend health
          </h2>
          {health ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-garabyte-ink-500">Status</dt>
              <dd className="font-medium text-garabyte-status-good">
                {health.status}
              </dd>
              <dt className="text-garabyte-ink-500">Environment</dt>
              <dd className="font-medium">{health.environment}</dd>
              <dt className="text-garabyte-ink-500">Dimensions loaded</dt>
              <dd className="font-medium">{health.dimensions_loaded}</dd>
              <dt className="text-garabyte-ink-500">Total questions</dt>
              <dd className="font-medium">{health.total_questions}</dd>
            </dl>
          ) : !error ? (
            <p className="text-garabyte-ink-500">Loading…</p>
          ) : null}
        </section>

        <section className="p-6 rounded-xl bg-white shadow-card">
          <h2 className="text-h3 text-garabyte-primary-800 mb-4">
            Demo tenants
          </h2>
          {tenants ? (
            <ul className="divide-y divide-garabyte-ink-100">
              {tenants.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-garabyte-primary-800">
                      {t.name}
                    </p>
                    <p className="text-sm text-garabyte-ink-500">
                      {t.sector} · {t.jurisdiction}
                      {t.employee_count && ` · ${t.employee_count} employees`}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-garabyte-primary-500 bg-garabyte-primary-50 px-3 py-1 rounded-full">
                    {t.slug}
                  </span>
                </li>
              ))}
            </ul>
          ) : !error ? (
            <p className="text-garabyte-ink-500">Loading…</p>
          ) : null}
        </section>

        <footer className="mt-12 text-center text-sm text-garabyte-ink-500">
          If you see this styled page with 3 tenants listed, the frontend
          foundation is working.
        </footer>
      </div>
    </main>
  );
}
