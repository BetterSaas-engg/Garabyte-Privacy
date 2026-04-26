import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell
      title="Garabyte Privacy is invitation-only"
      subtitle="Accounts are created when you accept an invitation from your privacy lead."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#3A6FB8] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-4 text-[13.5px] leading-6 text-[#4B5360]">
        <p>
          We don&apos;t support self-signup. To get access:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5">
          <li>
            If your <span className="text-[#1F242C] font-medium">privacy lead</span> has invited you,
            check your email for a link from Garabyte. Following that link will set up your account.
          </li>
          <li>
            If you&apos;re a Garabyte client and you don&apos;t have an invitation yet, ask the
            person at your organization who manages privacy.
          </li>
          <li>
            If you&apos;re unsure, contact{" "}
            <a href="mailto:support@garabyte.com" className="text-[#3A6FB8] hover:underline">
              support@garabyte.com
            </a>
            .
          </li>
        </ul>
      </div>
    </AuthShell>
  );
}
