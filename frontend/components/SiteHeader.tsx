"use client";

/**
 * Site header — appears on every customer-facing page (the (site) route group).
 * Fetches /auth/me on mount to show "Sign in" or "user · Sign out" depending
 * on session state. The header stays minimal — auth-aware but unobtrusive.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logout, whoami, type WhoAmI } from "@/lib/api";

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [checked, setChecked] = useState(false);

  // Re-run on every route change. Otherwise the header keeps the
  // pre-login state (me=null → "Sign in") after the user logs in,
  // because Next's App Router doesn't remount the layout on
  // intra-layout navigation. Same trick handles the post-logout
  // case from any page that doesn't manually clear the state.
  useEffect(() => {
    let cancelled = false;
    whoami()
      .then((w) => { if (!cancelled) setMe(w); })
      .catch(() => { if (!cancelled) setMe(null); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [pathname]);

  async function onSignOut() {
    try {
      await logout();
    } finally {
      setMe(null);
      router.push("/auth/login");
      router.refresh();
    }
  }

  // Marketing nav only renders on the public-facing pages — landing,
  // sample, about, privacy, terms, contact. Auth pages and authenticated
  // dashboards skip it to keep the chrome focused on the task at hand.
  const isMarketingPath =
    pathname === "/" ||
    pathname === "/sample" ||
    pathname === "/about" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/contact";
  const showMarketingNav = isMarketingPath && checked && !me;

  return (
    <header className="border-b border-garabyte-ink-100 bg-garabyte-cream-50/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <Link href="/" className="group flex-shrink-0">
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium">
            Garabyte
          </p>
          <p className="text-sm font-semibold text-garabyte-primary-800 group-hover:text-garabyte-primary-600 transition-colors">
            Privacy Health Check
          </p>
        </Link>

        {/* Marketing nav — anchor links scroll within the landing page; on
            other public pages (privacy/terms/etc) they navigate home and
            scroll once there. Small screens fall back to the right-rail
            CTA only. */}
        {showMarketingNav && (
          <nav className="hidden md:flex items-center gap-5 text-[12.5px] text-garabyte-ink-700">
            <Link href="/#dimensions" className="hover:text-garabyte-primary-700 transition-colors">
              Dimensions
            </Link>
            <Link href="/#coverage" className="hover:text-garabyte-primary-700 transition-colors">
              Coverage
            </Link>
            <Link href="/#how-it-works" className="hover:text-garabyte-primary-700 transition-colors">
              How it works
            </Link>
            <Link href="/sample" className="hover:text-garabyte-primary-700 transition-colors">
              Sample report
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-4 text-xs text-garabyte-ink-500">
          {!showMarketingNav && (
            <p className="hidden sm:block">Privacy maturity assessment</p>
          )}
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
