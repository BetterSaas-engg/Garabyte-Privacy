import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Garabyte Privacy Health Check",
    template: "%s — Garabyte Privacy Health Check",
  },
  description:
    "Privacy program maturity assessment co-designed with Garabyte Consulting. Eight dimensions mapped to PIPEDA, Quebec Law 25, CASL, GDPR, and emerging AI governance standards.",
  openGraph: {
    title: "Garabyte Privacy Health Check",
    description:
      "Know where your privacy program stands. Know where to go next. Co-designed with Garabyte Consulting.",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
