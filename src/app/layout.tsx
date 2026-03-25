import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/layout/LayoutShell";

export const metadata: Metadata = {
  title: "Xavant Ops Dashboard",
  description: "Cross-app analytics and monitoring",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
