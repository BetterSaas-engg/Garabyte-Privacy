/**
 * Site footer — appears on every page below the main content.
 * Deliberately understated. Reinforces the partnership messaging
 * and gives every page a clean ending.
 */

export function SiteFooter() {
  return (
    <footer className="border-t border-garabyte-ink-100 bg-garabyte-cream-100/50 mt-16">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-garabyte-ink-700">
          Garabyte Privacy Health Check · Co-designed with{" "}
          <a
            href="https://garabyte.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-garabyte-primary-600 hover:text-garabyte-primary-800 transition-colors"
          >
            Garabyte Consulting
          </a>
        </p>
        <p className="text-xs text-garabyte-ink-500">
          Maturity assessment · PIPEDA · Quebec Law 25 · GDPR · AIDA
        </p>
      </div>
    </footer>
  );
}
