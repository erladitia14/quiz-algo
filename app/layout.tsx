import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ops Edu Quiz — Pre-Test & Post-Test",
  description:
    "Platform quiz pre-test dan post-test untuk course Python & Visual Programming Algonova",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#0b0f11] text-slate-200">
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0b0f11]/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-slate-950">
                Q
              </span>
              Ops Edu Quiz
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/courses"
                className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Kursus
              </Link>
              <Link
                href="/riwayat"
                className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Riwayat
              </Link>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-slate-500">
          Ops Edu Quiz · Materi soal bersumber dari kurikulum LMS Algonova
        </footer>
      </body>
    </html>
  );
}
