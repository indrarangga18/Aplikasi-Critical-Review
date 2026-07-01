"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  Download,
  Lightbulb,
  Loader2,
  Mail,
  Network,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { runAnalysis } from "@/lib/analysis";
import { buildReportHtml } from "@/lib/report";
import { DivergingBar, GroupedBar, HBar, Heatmap, TrendLine } from "@/components/Charts";
import type { SessionData } from "@/components/Landing";

export default function Dashboard({ data, onReset }: { data: SessionData; onReset: () => void }) {
  const a = useMemo(() => runAnalysis(data.records, data.keywords), [data]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const meta = {
    name: data.name,
    email: data.email,
    judul: data.judul,
    topik: data.topik,
    keywords: data.keywords,
    filename: data.filename,
  };

  const generatedAt = () =>
    new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  const download = () => {
    const html = buildReportHtml(a, { ...meta, generatedAt: generatedAt() });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `critical-review-${(data.judul || "laporan").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async () => {
    setSending(true);
    setToast(null);
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: data.records, keywords: data.keywords, meta }),
      });
      const json = await res.json();
      if (res.ok && json.ok) setToast({ ok: true, msg: `Laporan terkirim ke ${data.email}.` });
      else setToast({ ok: false, msg: json.error || "Gagal mengirim laporan." });
    } catch {
      setToast({ ok: false, msg: "Gagal terhubung ke server." });
    } finally {
      setSending(false);
    }
  };

  const noveltyColor = a.novelty.score >= 66 ? "#34d399" : a.novelty.score >= 40 ? "#fbbf24" : "#fb7185";
  const recData = a.recommendations.slice(0, 10).map((r) => ({ label: r.combo, value: r.score }));
  const strengthData = a.strength.map((s) => ({ label: s.keyword, docFreq: s.docFreq, totalOcc: s.totalOcc }));

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-violet-300/80 mb-1">Laporan Critical Review</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.judul || "(tanpa judul)"}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data.topik} • {a.totalCount} referensi • {data.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={download} className="btn-secondary">
            <Download className="w-4 h-4" /> Unduh HTML
          </button>
          <button onClick={sendEmail} disabled={sending} className="btn-primary">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim ke Email
          </button>
          <button onClick={onReset} className="btn-secondary">
            <RotateCcw className="w-4 h-4" /> Ulang
          </button>
        </div>
      </div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${
            toast.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-rose-500/10 border-rose-500/30 text-rose-200"
          }`}
        >
          <Mail className="w-4 h-4" /> {toast.msg}
        </motion.div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total referensi" value={a.totalCount} />
        <Kpi label="Relevan (≥1 keyword)" value={a.matchedCount} sub={`${Math.round((a.matchedCount / a.totalCount) * 100)}%`} />
        <Kpi label="Punya abstrak" value={a.quality.withAbstract} sub={`${Math.round((a.quality.withAbstract / a.totalCount) * 100)}%`} />
        <Kpi label="Rentang tahun" value={a.quality.yearMin && a.quality.yearMax ? `${a.quality.yearMin}–${a.quality.yearMax}` : "—"} />
      </div>

      {/* Novelty + components */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="flex flex-col items-center justify-center text-center">
          <div
            className="relative w-36 h-36 rounded-full grid place-items-center mb-3"
            style={{ background: `conic-gradient(${noveltyColor} ${a.novelty.score}%, rgba(255,255,255,.07) 0)` }}
          >
            <div className="w-28 h-28 rounded-full bg-[#0b0f1e] grid place-items-center">
              <div>
                <div className="text-3xl font-bold" style={{ color: noveltyColor }}>{a.novelty.score}</div>
                <div className="text-[10px] text-slate-400">/ 100</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Award className="w-4 h-4 text-violet-300" /> Novelty Score
          </div>
          <p className="text-xs text-slate-400 mt-1">{a.novelty.nAll} referensi memuat SEMUA keyword</p>
        </Card>

        <Card className="lg:col-span-2" title="Rincian Novelty Score" icon={<BarChart3 className="w-4 h-4" />} hint="Bobot dipilih manual — alat bandingkan alternatif, bukan metrik baku.">
          <div className="space-y-3 mt-2">
            {a.novelty.components.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{c.name}</span>
                  <span className="text-slate-400">{c.contribution} poin · bobot {c.weight}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${c.value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card title="Rekomendasi Kombinasi Topik" icon={<Lightbulb className="w-4 h-4" />} hint="Pasangan keyword jarang digabung namun sedang naik daun = kandidat celah riset." className="mb-4">
        <HBar data={recData} height={Math.max(200, recData.length * 34)} color="#c084fc" />
        {a.recommendations[0] && (
          <div className="mt-3 text-sm bg-violet-500/10 border border-violet-400/20 rounded-xl px-4 py-3">
            Arah paling menjanjikan: <b>{a.recommendations[0].combo}</b> (co-occurrence={a.recommendations[0].cooccurrence}, skor={a.recommendations[0].score}).
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Keyword Strength" icon={<BarChart3 className="w-4 h-4" />} hint="Seberapa mapan keyword di korpus. Strength tinggi = topik padat (cenderung kurang novel).">
          <GroupedBar data={strengthData} height={300} />
        </Card>
        <Card title="Sinyal Emerging Keyword" hint="Δ proporsi periode baru − lama. Hijau = menaik belakangan.">
          <DivergingBar data={a.opportunity.emerging} height={300} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Sebaran Keyword dalam Korpus" hint="Jumlah referensi yang memuat tiap keyword.">
          <HBar data={a.keywordCounts.map((k) => ({ label: k.keyword, value: k.docFreq })).sort((x, y) => y.value - x.value)} height={280} />
        </Card>
        <Card title="Referensi Relevan per Tahun" hint="Tren publikasi yang cocok minimal 1 keyword.">
          {a.relevantPerYear.length ? <TrendLine data={a.relevantPerYear} height={280} /> : <Empty />}
        </Card>
      </div>

      {/* Co-occurrence heatmaps */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Co-occurrence Keyword Anda" icon={<Network className="w-4 h-4" />} hint="0 = pasangan keyword belum pernah muncul bersama (peluang).">
          <Heatmap labels={data.keywords} matrix={a.opportunity.matrix} annotate />
        </Card>
        <Card title={`Co-occurrence Topik Korpus`} icon={<Network className="w-4 h-4" />} hint={`Sumber vocab: ${a.cooc.vocabSource}.`}>
          <Heatmap labels={a.cooc.vocab} matrix={a.cooc.matrix} />
        </Card>
      </div>

      {/* Rare pairs + Problem */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Pasangan Keyword Paling Jarang Digabung" hint="Kandidat peluang — 0 bisa berarti belum diteliti ATAU tidak relevan.">
          <ul className="space-y-2 mt-1">
            {a.opportunity.rarePairs.map((p, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                <span className="text-slate-200">{p.a} <span className="text-slate-500">+</span> {p.b}</span>
                <span className="text-violet-300 font-medium">{p.count} ref</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Identifikasi Masalah / Gap" icon={<TriangleAlert className="w-4 h-4" />} hint={`${a.problem.totalSentences} kalimat berpenanda (berbasis kata kunci, bukan pemahaman).`}>
          {a.problem.cueCounts.length ? (
            <HBar data={a.problem.cueCounts} height={Math.max(160, a.problem.cueCounts.length * 24)} color="#fb7185" />
          ) : (
            <Empty text="Tidak ada penanda terdeteksi (kemungkinan abstrak kosong)." />
          )}
        </Card>
      </div>

      {/* Problem sentences */}
      {a.problem.sentences.length > 0 && (
        <Card title="Contoh Kalimat Bermuatan Masalah" hint="Baca kalimat asli sebelum menyimpulkan ada gap." className="mb-4">
          <ul className="space-y-2.5 mt-1">
            {a.problem.sentences.slice(0, 8).map((s, i) => (
              <li key={i} className="text-sm text-slate-300">
                <span className="text-violet-300 font-medium">[{s.title}…]</span> {s.sentence.slice(0, 220)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bibliometrics */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Publikasi per Tahun (korpus)">
          {a.publicationsPerYear.length ? <TrendLine data={a.publicationsPerYear} height={260} /> : <Empty />}
        </Card>
        <Card title="Keyword Terbanyak (field KW korpus)">
          {a.topCorpusKeywords.length ? <HBar data={a.topCorpusKeywords.slice(0, 12)} height={300} color="#818cf8" /> : <Empty text="Field KW korpus kosong." />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        <Card title="Penulis Paling Produktif">
          {a.topAuthors.length ? <HBar data={a.topAuthors.slice(0, 12)} height={320} color="#a78bfa" /> : <Empty />}
        </Card>
        <Card title="Sumber / Jurnal Teratas">
          {a.topSources.length ? <HBar data={a.topSources.slice(0, 12)} height={320} color="#f472b6" /> : <Empty />}
        </Card>
      </div>

      <p className="text-slate-500 text-xs text-center max-w-2xl mx-auto pb-10">
        ⚠️ Seluruh rekomendasi adalah TITIK AWAL, bukan kesimpulan. Analisis memakai pencocokan kata kunci —
        homonim/sinonim tidak ditangani, dan Novelty Score bukan metrik bibliometrik standar. Validasi dengan
        membaca paper aktual pada pasangan keyword teratas.
      </p>

      <style jsx global>{`
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          color: #fff;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          box-shadow: 0 10px 25px -10px rgba(139, 92, 246, 0.6);
          transition: opacity 0.2s;
        }
        .btn-primary:disabled {
          opacity: 0.5;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          color: #e2e8f0;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: background 0.2s;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">
        {label} {sub && <span className="text-violet-300">· {sub}</span>}
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  icon,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className={`glass rounded-2xl p-5 ${className}`}
    >
      {title && (
        <div className="mb-1 flex items-center gap-1.5">
          {icon && <span className="text-violet-300">{icon}</span>}
          <h3 className="font-semibold text-sm text-white">{title}</h3>
        </div>
      )}
      {hint && <p className="text-xs text-slate-400 mb-3">{hint}</p>}
      {children}
    </motion.div>
  );
}

function Empty({ text = "Tidak ada data untuk ditampilkan." }: { text?: string }) {
  return <div className="h-40 grid place-items-center text-slate-500 text-sm">{text}</div>;
}
