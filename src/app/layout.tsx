import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Critical Review RIS — Analisis Kebaruan Riset",
  description:
    "Unggah file RIS, ukur kekuatan keyword, peluang riset, dan Novelty Score — lalu unduh atau kirim laporannya ke email.",
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
