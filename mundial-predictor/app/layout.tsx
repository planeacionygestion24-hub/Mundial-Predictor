// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaptureMode } from "@/components/CaptureMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mundial 26 · Modelo IA",
  description:
    "Proyección estadística de todos los mercados del Mundial 2026. Análisis de entretenimiento.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <Suspense fallback={null}>
          <CaptureMode />
        </Suspense>
        <header
          className="hairline-b sticky top-0 z-10 flex items-center justify-between px-4 py-2"
          style={{ background: "var(--bg)" }}
        >
          <Link href="/" className="flex items-baseline gap-3 no-underline">
            <span className="display text-xl" style={{ color: "var(--accent)" }}>
              Mundial 26
            </span>
            <span className="eyebrow">Modelo Poisson-v1</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/torneo" className="eyebrow no-underline hover:underline">
              Torneo
            </Link>
            <Link href="/grupos" className="eyebrow no-underline hover:underline">
              Grupos
            </Link>
            <span className="eyebrow hidden sm:block">Recalculo diario</span>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        <footer className="hairline-b mx-auto w-full max-w-5xl border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>
          <p className="eyebrow" style={{ letterSpacing: "0.08em" }}>
            Análisis estadístico de entretenimiento. No es asesoría de apuestas.
          </p>
        </footer>
      </body>
    </html>
  );
}
