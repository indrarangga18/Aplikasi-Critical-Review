import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Critical Review — Analisis Kebaruan Riset",
  description:
    "Unggah daftar pustaka (RIS, BibTeX, .nbib, atau ZIP) lalu ukur Novelty Score, peluang riset, gap, dan rekomendasi penelitian — bisa diunduh (PDF) & dikirim ke email.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
