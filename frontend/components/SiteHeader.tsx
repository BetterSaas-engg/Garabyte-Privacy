"use client";

/**
 * Site header — appears on every customer-facing page (the (site) route group).
 * Fetches /auth/me on mount to show "Sign in" or "user · Sign out" depending
 * on session state. The header stays minimal — auth-aware but unobtrusive.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout, whoami, type WhoAmI } from "@/lib/api";

export function SiteHeader() {
  const router = useRouter();
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    whoami()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecked(true));
  }, []);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      setMe(null);
      router.push("/auth/login");
      router.refresh();
    }
  }

  return (
    <header className="border-b border-garabyte-ink-100 bg-garabyte-cream-50/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="group">
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium">
            Garabyte
          </p>
          <p className="text-sm font-semibold text-garabyte-primary-800 group-hover:text-garabyte-primary-600 transition-colors">
            Privacy Health Check
          </p>
        </Link>
        <div className="flex items-center gap-4 text-xs text-garabyte-ink-500">
          <p className="hidden sm:block">Co-designed with Garabyte Consulting</p>
          {checked && (
            me ? (
              <div className="flex items-center gap-3">
                <span className="text-garabyte-ink-700 hidden sm:inline">
                  {me.user.name || me.user.email}
                </span>
                <button
                  onClick={onSignOut}
                  className="text-garabyte-primary-500 hover:text-garabyte-primary-700 transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="text-garabyte-primary-500 hover:text-garabyte-primary-700 transition-colors"
              >
                Sign in
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
