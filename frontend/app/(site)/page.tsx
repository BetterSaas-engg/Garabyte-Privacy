"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getTenants,
  getTenantHistory,
  isUnauthorized,
  whoami,
} from "@/lib/api";
import type { AuthMembership, WhoAmI } from "@/lib/api";
import type { Tenant, TenantHistoryItem } from "@/lib/types";
import Link from "next/link";
import { TenantCard } from "@/components/TenantCard";
import { InviteModal } from "@/components/InviteModal";

interface TenantWithHistory {
  tenant: Tenant;
  history: TenantHistoryItem[];
}

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<TenantWithHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [tenants, w] = await Promise.all([getTenants(), whoami()]);
        setMe(w);
        const withHistory = await Promise.all(
          tenants.map(async (t) => ({
            tenant: t,
            history: await getTenantHistory(t.slug),
          }))
        );
        setData(withHistory);
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
  }, [router]);

  const memberships: AuthMembership[] = me?.memberships ?? [];
  const isGarabyteAdmin = memberships.some((m) => m.role === "garabyte_admin");
  const canInvite = memberships.some(
    (m) => m.role === "org_admin" || m.role === "garabyte_admin",
  );

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <section className="mb-12 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-3">
            Privacy program assessment
          </p>
          <h1 className="text-h1 text-garabyte-primary-800 mb-5 leading-tight">
            Know where your privacy program stands.
            Know where to go next.
          </h1>
          <p className="text-base text-garabyte-ink-700 leading-relaxed max-w-2xl">
            An 8-dimension maturity assessment mapped to PIPEDA, Quebec Law 25,
            CASL, GDPR, and emerging AI governance standards. Co-designed with
            Garabyte Consulting.
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-h2 text-garabyte-primary-800">
              Client organizations
            </h2>
            <div className="flex items-baseline gap-3">
              <p className="text-sm text-garabyte-ink-500">
                {data ? `${data.length} active` : ""}
              </p>
              {isGarabyteAdmin && (
                <Link
                  href="/tenants/new"
                  className="text-sm px-3 py-1.5 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100 text-garabyte-primary-700 transition-colors"
                >
                  Add organization
                </Link>
              )}
              {canInvite && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 transition-colors"
                >
                  Invite colleague
                </button>
              )}
            </div>
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
                  className="bg-white rounded-xl shadow-card p-6 animate-pulse h-60"
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

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        memberships={memberships}
        isGarabyteAdmin={isGarabyteAdmin}
      />
    </main>
  );
}
