"use client";

import Link from "next/link";
import { ReactNode } from "react";

/**
 * Shared chrome for all customer-facing auth pages. Centered card on a
 * neutral background, no SiteHeader/SiteFooter (the (site) layout's
 * footer still wraps it via the parent layout). Matches the design
 * bundle's Auth.html screens.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#F7F8FA] px-6 py-12 flex items-start justify-center">
      <div className="w-full max-w-[440px]">
        <div className="mb-6">
          <Link
            href="/"
            className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.18em] uppercase hover:text-[#4B5360]"
          >
            Garabyte Privacy
          </Link>
        </div>
        <div className="rounded-lg bg-white border border-[#E2E5EA] shadow-[0_1px_2px_rgba(17,21,27,0.04),0_8px_24px_rgba(17,21,27,0.04)] p-8">
          <h1 className="text-[22px] leading-7 font-medium text-[#1F242C] mb-1.5" style={{ letterSpacing: "-0.005em" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-[#6B7280] mb-6 leading-[19px]">{subtitle}</p>
          )}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
        {footer && <div className="mt-5 text-[12.5px] text-[#6B7280] text-center">{footer}</div>}
      </div>
    </main>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9AA1AD] block mb-1.5">
      {children}
    </label>
  );
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 rounded-md text-[13px] bg-white text-[#1F242C] placeholder:text-[#9AA1AD] border border-[#E2E5EA] hover:border-[#CBD0D8] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none transition-colors ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton({
  type = "submit",
  disabled,
  children,
}: {
  type?: "submit" | "button";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="w-full h-10 rounded-md text-[13px] font-medium bg-[#3A6FB8] hover:bg-[#2F5C9C] disabled:bg-[#7AA0D8] disabled:cursor-not-allowed text-white transition-colors"
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-3 py-2.5 text-[12.5px] text-[#8A2A2A]">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md bg-[#EDF6EF] border border-[#CFE3D6] px-3 py-2.5 text-[12.5px] text-[#2C6741]">
      {message}
    </div>
  );
}

export function InfoBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md bg-[#EEF3FB] border border-[#D8E3F5] px-3 py-2.5 text-[12.5px] text-[#264B80]">
      {message}
    </div>
  );
}
