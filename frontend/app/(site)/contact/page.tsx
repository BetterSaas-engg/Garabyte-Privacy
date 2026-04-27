export const metadata = {
  title: "Contact",
  description:
    "How to reach Garabyte about the Privacy Health Check — sales, support, or privacy requests.",
};

export default function ContactPage() {
  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <article className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
          Contact
        </p>
        <h1 className="text-h1 text-garabyte-primary-800 mb-5">
          How to reach us
        </h1>
        <p className="text-[14.5px] text-garabyte-ink-700 leading-relaxed mb-8">
          Different questions go to different inboxes — we&apos;ve listed
          the right address for each below to keep response times short.
        </p>

        <div className="space-y-4">
          <Card
            label="New engagement"
            email="hello@garabyte.com"
            body="If you're considering the Privacy Health Check for your organization. Garabyte will set up a discovery conversation to see if it's a fit."
          />
          <Card
            label="Existing customer support"
            email="support@garabyte.com"
            body="If you're already onboarded and something isn't working — invitation issues, sign-in problems, evidence upload failures, or questions about a finding."
          />
          <Card
            label="Privacy requests"
            email="privacy@garabyte.com"
            body="Access, correction, deletion, or any other Data Subject Access Request. Acknowledged within 2 business days, fulfilled within 30 days. See the privacy notice for the full process."
          />
          <Card
            label="Security disclosure"
            email="security@garabyte.com"
            body="If you've found a vulnerability in the platform. We respond to coordinated disclosures and will not pursue legal action against good-faith research."
          />
        </div>

        <p className="text-[12px] text-garabyte-ink-500 mt-8 leading-relaxed">
          For invitation-only sign-in help: ask the privacy lead at your
          own organization first. They issued the invitation and can
          re-issue if your link expired.
        </p>
      </article>
    </main>
  );
}

function Card({
  label,
  email,
  body,
}: {
  label: string;
  email: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-garabyte-ink-100 bg-white p-4">
      <p className="text-[10.5px] uppercase tracking-[0.08em] text-garabyte-ink-500 font-medium mb-1.5">
        {label}
      </p>
      <a
        href={`mailto:${email}`}
        className="text-[15px] font-medium text-garabyte-primary-700 hover:text-garabyte-primary-500 mb-1.5 block"
      >
        {email}
      </a>
      <p className="text-[13px] text-garabyte-ink-700 leading-relaxed">{body}</p>
    </div>
  );
}
