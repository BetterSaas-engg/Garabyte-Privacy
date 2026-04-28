import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Garabyte Privacy Health Check",
    template: "%s — Garabyte Privacy Health Check",
  },
  description:
    "Privacy program maturity assessment by Garabyte. Eight dimensions mapped to PIPEDA, Quebec Law 25, CASL, GDPR, and emerging AI governance standards.",
  openGraph: {
    title: "Garabyte Privacy Health Check",
    description:
      "Know where your privacy program stands. Know where to go next. By Garabyte.",
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
      <body className="flex flex-col min-h-screen">{children}</body>
    </html>
  );
}
