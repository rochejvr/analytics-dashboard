import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Xavant Ops Dashboard",
  description: "Cross-app analytics and monitoring",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex antialiased">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
