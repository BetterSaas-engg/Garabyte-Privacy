/**
 * Site footer — appears on every page below the main content.
 * Reinforces the partnership messaging plus links to the public
 * About / Privacy / Terms / Contact pages.
 */

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-garabyte-ink-100 bg-garabyte-cream-100/50 mt-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid sm:grid-cols-[1fr_auto] gap-6 mb-6">
          <p className="text-sm text-garabyte-ink-700 max-w-xl leading-relaxed">
            Garabyte Privacy Health Check · Co-designed with{" "}
            <a
              href="https://garabyte.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-garabyte-primary-600 hover:text-garabyte-primary-800 transition-colors"
            >
              Garabyte Consulting
            </a>
            . A scored, defensible read on your privacy program.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-garabyte-ink-700">
            <Link href="/about" className="hover:text-garabyte-primary-700 transition-colors">
              About
            </Link>
            <Link href="/sample" className="hover:text-garabyte-primary-700 transition-colors">
              Sample report
            </Link>
            <Link href="/privacy" className="hover:text-garabyte-primary-700 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-garabyte-primary-700 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-garabyte-primary-700 transition-colors">
              Contact
            </Link>
          </nav>
        </div>
        <p className="text-xs text-garabyte-ink-500">
          © {new Date().getFullYear()} Garabyte. Maturity assessment ·
          PIPEDA · Quebec Law 25 · CASL · GDPR · CCPA · AIDA
        </p>
      </div>
    </footer>
  );
}
