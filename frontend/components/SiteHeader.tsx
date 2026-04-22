/**
 * Site header — appears on every page.
 * Deliberately minimal: the eyebrow-style wordmark links to home,
 * and that's it. No nav items until we have more than two screens.
 */

import Link from "next/link";

export function SiteHeader() {
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
        <p className="text-xs text-garabyte-ink-500 hidden sm:block">
          Co-designed with Garabyte Consulting
        </p>
      </div>
    </header>
  );
}
