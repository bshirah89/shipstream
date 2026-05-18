import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipStream — Real-time Operations Dashboard",
  description:
    "Live shipboard event monitoring with AI-powered operational summaries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
