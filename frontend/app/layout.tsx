import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garabyte Privacy Health Check",
  description: "Privacy program maturity assessment, co-designed with Garabyte Consulting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
