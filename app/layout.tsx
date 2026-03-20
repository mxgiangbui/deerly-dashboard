import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheDeerly Dashboard",
  description: "P&L Dashboard — TheDeerly",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f1117] text-slate-100">{children}</body>
    </html>
  );
}
