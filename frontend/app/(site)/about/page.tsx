import Link from "next/link";

export const metadata = {
  title: "About",
  description:
    "About the Garabyte Privacy Health Check — what it is, who it's for, and how Garabyte built it.",
};

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <article className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          About
        </p>
        <h1 className="text-h1 text-garabyte-primary-800 mb-5">
          The Garabyte Privacy Health Check
        </h1>
        <div className="text-[14.5px] text-garabyte-ink-700 leading-relaxed space-y-4">
          <p>
            The Privacy Health Check is a structured assessment of an
            organization&apos;s privacy program maturity, scored against the
            regulations most likely to apply to Canadian and EU operating
            customers — PIPEDA, Quebec Law 25, CASL, GDPR, CCPA, and the
            anticipated AIDA framework.
          </p>
          <p>
            It exists because the gap between &quot;we have a privacy
            policy&quot; and &quot;we can defend our program under regulator
            scrutiny&quot; is enormous, and most organizations don&apos;t
            know which side of it they&apos;re on. The assessment is
            structured so the answer is unambiguous, scored, and tied to
            specific regulatory citations.
          </p>
          <p>
            We built the platform from our privacy practice. The scoring
            rubric, question set, regulatory mappings, and remediation
            guidance are the same ones our consultants would write by
            hand — structured, scored, and ready to defend. Engagements
            typically combine the platform&apos;s output with a
            consultant&apos;s review to produce a remediation plan the
            customer can act on.
          </p>
          <p>
            The product is invitation-only. Customers come through a
            sales conversation with us; the platform handles the
            assessment, the consultant&apos;s review, and the published
            report. See the{" "}
            <Link href="/sample" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
              sample report
            </Link>{" "}
            for what the output looks like, or the{" "}
            <Link href="/privacy" className="text-garabyte-primary-500 hover:text-garabyte-primary-700">
              privacy notice
            </Link>{" "}
            for how we handle your data while you&apos;re using the platform.
          </p>
        </div>
        <p className="text-[11px] text-garabyte-ink-300 mt-10 text-center">
          Built by Garabyte.
        </p>
      </article>
    </main>
  );
}
