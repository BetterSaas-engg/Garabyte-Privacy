export const metadata = {
  title: "Terms of service",
  description:
    "Terms governing use of the Garabyte Privacy Health Check platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <article className="max-w-3xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          Terms of service
        </p>
        <h1 className="text-h1 text-garabyte-primary-800 mb-3">
          Terms of service
        </h1>
        <p className="text-sm text-garabyte-ink-500 mb-8">
          Last reviewed April 2026.
        </p>

        <div className="text-[14px] text-garabyte-ink-700 leading-relaxed space-y-5">
          <p>
            The Garabyte Privacy Health Check is provided by Garabyte
            Consulting. By using the platform you agree to the engagement
            agreement signed with Garabyte and to the terms below; if a
            conflict arises, the engagement agreement controls.
          </p>

          <Section title="Eligibility">
            <p>
              The platform is invitation-only. You may only access an
              organization&apos;s data if Garabyte or your organization&apos;s
              privacy lead has issued you an invitation with a defined role
              and scope. Sharing credentials, attempting to access another
              tenant&apos;s data, or circumventing role restrictions
              terminates your access.
            </p>
          </Section>

          <Section title="Acceptable use">
            <ul className="list-disc list-outside pl-5 space-y-1.5">
              <li>You will answer assessment questions in good faith. The platform records what you submitted; deliberate misrepresentation undermines the report&apos;s defensibility.</li>
              <li>You will not use the platform to assess organizations you don&apos;t have authority over.</li>
              <li>You will not reverse-engineer, scrape, or attempt to extract Garabyte&apos;s rules library or scoring engine logic for resale.</li>
              <li>You will not upload evidence files containing personal data of individuals beyond what is necessary to support a specific question.</li>
            </ul>
          </Section>

          <Section title="Reports and consultant review">
            <p>
              Every assessment is reviewed by a Garabyte consultant before
              the report is published. The consultant may adjust severity,
              add findings the engine missed, or dismiss findings that
              don&apos;t apply to your situation. The published report — not
              the engine&apos;s raw output — is the authoritative deliverable.
              Reports are bound to the rules library version active at
              scoring time; reassessments under a later rules version may
              produce different scores.
            </p>
          </Section>

          <Section title="Sharing and disclosure">
            <p>
              You may share your published report via the platform&apos;s
              signed share-link feature with the recipients of your choice.
              Garabyte does not share your report with third parties. We
              may use anonymized, aggregated trends across customers
              (e.g., &quot;30% of customers in Sector X struggle with d5&quot;)
              for research and product improvement; no individual
              organization is identifiable in such aggregates.
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              The platform is hosted on managed infrastructure with the
              uptime targets of those providers. We do not currently
              commit to a specific SLA in this notice; SLA terms, if any,
              are in your engagement agreement.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              Either party may terminate the engagement under the
              engagement agreement&apos;s terms. On termination, your data
              is retained for the period described in the{" "}
              <a href="/privacy" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">privacy notice</a>{" "}
              (active engagement + 12 months by default) unless you
              request earlier deletion.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              The platform produces a structured assessment of your
              privacy program; it does not constitute legal advice. The
              report is a working document for your privacy program, not a
              compliance certification. Garabyte&apos;s liability for use
              of the platform is bounded by the limitations in your
              engagement agreement.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              Material changes to these terms are versioned in git, dated
              above, and announced to active-engagement customers by email.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms?{" "}
              <a href="mailto:hello@garabyte.com" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
                hello@garabyte.com
              </a>
              .
            </p>
          </Section>
        </div>

        <p className="text-[11px] text-garabyte-ink-300 mt-10 text-center">
          Garabyte Privacy Health Check
        </p>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-h3 text-garabyte-primary-800 mb-2 mt-6">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
