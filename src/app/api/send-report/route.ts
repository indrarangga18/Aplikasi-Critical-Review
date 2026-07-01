import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { runAnalysis } from "@/lib/analysis";
import { buildReportHtml, type ReportMeta } from "@/lib/report";
import type { RisRecord } from "@/lib/ris";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Payload {
  records: RisRecord[];
  keywords: string[];
  meta: Omit<ReportMeta, "generatedAt">;
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const { records, keywords, meta } = body || ({} as Payload);
  if (!meta?.email || !Array.isArray(records) || !records.length || !keywords?.length) {
    return NextResponse.json(
      { ok: false, error: "Data tidak lengkap (email / records / keywords)." },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Pengiriman email belum dikonfigurasi. Tambahkan RESEND_API_KEY di environment (lihat .env.example), lalu redeploy.",
      },
      { status: 501 }
    );
  }

  const generatedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const fullMeta: ReportMeta = { ...meta, generatedAt };

  const analysis = runAnalysis(records, keywords, meta.judul);
  const html = buildReportHtml(analysis, fullMeta);

  const resend = new Resend(apiKey);
  const from = process.env.REPORT_FROM_EMAIL || "onboarding@resend.dev";
  const subject = `Laporan Critical Review — ${meta.judul || meta.filename}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `Critical Review RIS <${from}>`,
      to: [meta.email],
      subject,
      html,
      attachments: [
        {
          filename: `critical-review-${(meta.judul || "laporan")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 40)}.html`,
          content: Buffer.from(html, "utf-8").toString("base64"),
        },
      ],
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "Gagal mengirim." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kesalahan tak terduga saat mengirim email.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
