"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  ChevronDown,
  Combine,
  ExternalLink,
  FileDown,
  Lightbulb,
  Loader2,
  Mail,
  Network,
  Pencil,
  RotateCcw,
  Send,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { runAnalysis, type GroupWithRefs } from "@/lib/analysis";
import { buildReportHtml } from "@/lib/report";
import { DivergingBar, FitBars, GroupedBar, HBar, Heatmap, MultiTrend, TrendLine, Venn, WordCloud } from "@/components/Charts";
import type { SessionData } from "@/components/Landing";

export default function Dashboard({ data, onReset }: { data: SessionData; onReset: () => void }) {
  // Editable inputs — changing these re-runs the analysis automatically.
  const [judul, setJudul] = useState(data.judul);
  const [topik, setTopik] = useState(data.topik);
  const [keywords, setKeywords] = useState<string[]>(data.keywords);

  const [editing, setEditing] = useState(false);
  const [judulDraft, setJudulDraft] = useState(data.judul);
  const [topikDraft, setTopikDraft] = useState(data.topik);
  const [kwDraft, setKwDraft] = useState(data.keywords.join(", "));

  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const a = useMemo(() => runAnalysis(data.records, keywords, judul), [data.records, keywords, judul]);

  // Merge corpus-total and keyword-relevant counts per year for comparison.
  const yearTrend = useMemo(() => {
    const m = new Map<string, { label: string; korpus: number; relevan: number }>();
    for (const d of a.publicationsPerYear) m.set(d.label, { label: d.label, korpus: d.value, relevan: 0 });
    for (const d of a.relevantPerYear) {
      const e = m.get(d.label) || { label: d.label, korpus: 0, relevan: 0 };
      e.relevan = d.value;
      m.set(d.label, e);
    }
    return [...m.values()].sort((x, y) => Number(x.label) - Number(y.label));
  }, [a]);
  const shareTrend = yearTrend.map((d) => ({ label: d.label, value: d.korpus ? Math.round((d.relevan / d.korpus) * 100) : 0 }));

  const draftKeywords = Array.from(
    new Set(kwDraft.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))
  );
  const draftValid = judulDraft.trim().length > 0 && draftKeywords.length >= 5 && draftKeywords.length <= 10;

  const openEdit = () => {
    setJudulDraft(judul);
    setTopikDraft(topik);
    setKwDraft(keywords.join(", "));
    setEditing(true);
  };
  const applyEdit = () => {
    if (!draftValid) return;
    setJudul(judulDraft.trim());
    setTopik(topikDraft.trim());
    setKeywords(draftKeywords);
    setEditing(false);
    setToast(null);
  };

  const meta = {
    name: data.name,
    email: data.email,
    judul,
    topik,
    keywords,
    filename: data.filename,
  };

  const generatedAt = () =>
    new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  const downloadPdf = () => {
    const html = buildReportHtml(a, { ...meta, generatedAt: generatedAt() });
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      setToast({ ok: false, msg: "Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi." });
      return;
    }
    // Auto-trigger the print dialog (which offers "Save as PDF").
    const trigger = `<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);}<\/script>`;
    w.document.open();
    w.document.write(html + trigger);
    w.document.close();
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
          <h1 className="text-2xl sm:text-3xl font-bold">{judul || "(tanpa judul)"}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {topik} • {a.totalCount} referensi • {data.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openEdit} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Edit input
          </button>
          <button onClick={downloadPdf} className="btn-secondary">
            <FileDown className="w-4 h-4" /> Unduh PDF
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

      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-strong rounded-2xl p-5 mb-6 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-violet-300" /> Ubah judul, topik & keyword</h3>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-300 mb-1.5 block">Judul penelitian</span>
              <input className={editInput} value={judulDraft} onChange={(e) => setJudulDraft(e.target.value)} placeholder="Judul penelitian Anda" />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300 mb-1.5 block">Topik / area</span>
              <input className={editInput} value={topikDraft} onChange={(e) => setTopikDraft(e.target.value)} placeholder="mis. Medical AI" />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300 mb-1.5 block">Keyword (pisahkan koma, 5–10)</span>
              <input className={editInput} value={kwDraft} onChange={(e) => setKwDraft(e.target.value)} placeholder="kata1, kata2, ..." />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {draftKeywords.map((k) => (
              <span key={k} className="text-xs bg-violet-500/20 text-violet-200 border border-violet-400/20 rounded-full px-2.5 py-0.5">{k}</span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className={`text-xs ${draftValid ? "text-emerald-300" : "text-slate-400"}`}>
              {draftKeywords.length} keyword unik {draftKeywords.length < 5 ? "(minimal 5)" : draftKeywords.length > 10 ? "(maksimal 10)" : "✓"}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Batal</button>
              <button onClick={applyEdit} disabled={!draftValid} className="btn-primary">Terapkan & Analisis Ulang</button>
            </div>
          </div>
        </motion.div>
      )}

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
        <HBar data={recData} height={Math.max(220, recData.length * 46)} color="#c084fc" labelWidth={230} />
        {a.recommendations[0] && (
          <div className="mt-3 text-sm bg-violet-500/10 border border-violet-400/20 rounded-xl px-4 py-3">
            Arah paling menjanjikan: <b>{a.recommendations[0].combo}</b> (co-occurrence={a.recommendations[0].cooccurrence}, skor={a.recommendations[0].score}).
          </div>
        )}
      </Card>

      {/* Venn — overlapping domains */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card
          title="Domain yang Beririsan (Diagram Venn)"
          icon={<Combine className="w-4 h-4" />}
          hint={`3 domain tersering: ${a.venn.sets.join(", ")}. Angka = jumlah referensi di tiap wilayah.`}
        >
          <Venn sets={a.venn.sets} regions={a.venn} totals={a.venn.totals} />
          <div className="mt-3 text-sm bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-4 py-3 text-emerald-100">
            <b>Rekomendasi:</b> {a.venn.recommendation}
          </div>
        </Card>

        <Card
          title="Kesesuaian Judul ↔ Rekomendasi"
          icon={<Target className="w-4 h-4" />}
          hint="Membandingkan skor rekomendasi vs berapa banyak kata kombinasi yang sudah muncul di judul Anda, per kombinasi."
        >
          <FitBars data={a.titleFit.map((f) => ({ label: f.combo, recScore: f.recScore, titleFitPct: f.titleFitPct }))} height={Math.max(240, a.titleFit.length * 46)} />
        </Card>
      </div>

      {/* Title fit table */}
      <Card title="Tabel Kesesuaian Judul dengan Rekomendasi" icon={<Target className="w-4 h-4" />} hint="Cek apakah kata dari tiap kombinasi rekomendasi sudah tercermin di judul penelitian Anda." className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Kombinasi rekomendasi</th>
                <th className="py-2 px-3 font-medium">Kata di judul</th>
                <th className="py-2 px-3 font-medium text-right">Skor rekom</th>
                <th className="py-2 pl-3 font-medium">Kesesuaian judul</th>
              </tr>
            </thead>
            <tbody>
              {a.titleFit.map((f, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-200">{f.combo}</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex gap-1 flex-wrap">
                      <Chip on={f.kaInTitle}>{f.ka}</Chip>
                      {f.kb && <Chip on={f.kbInTitle}>{f.kb}</Chip>}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-300">{f.recScore}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-white/5 w-24 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${f.titleFitPct}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-300 w-10">{f.titleFitPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(() => {
          const best = [...a.titleFit].sort((x, y) => y.titleFitPct - x.titleFitPct || y.recScore - x.recScore)[0];
          const noneAligned = a.titleFit.every((f) => f.titleFitPct === 0);
          return best ? (
            <div className="mt-3 text-sm bg-violet-500/10 border border-violet-400/20 rounded-xl px-4 py-3">
              {noneAligned ? (
                <>Belum ada kombinasi rekomendasi teratas yang katanya muncul di judul. Pertimbangkan menyisipkan salah satu kata kunci menjanjikan (mis. <b>{a.recommendations[0]?.combo}</b>) ke judul agar fokusnya lebih tajam.</>
              ) : (
                <>Judul Anda paling selaras dengan <b>{best.combo}</b> ({best.titleFitPct}% kata cocok, skor rekomendasi {best.recScore}).</>
              )}
            </div>
          ) : null;
        })()}
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
        <Card title="Tren per Tahun: Korpus vs Relevan" hint="Ungu = seluruh publikasi tiap tahun (seberapa aktif bidangnya). Pink = yang menyinggung keyword Anda. Selisih garis = bagian korpus yang di luar fokus Anda.">
          {yearTrend.length ? <MultiTrend data={yearTrend} height={280} /> : <Empty />}
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
        <Card title="Contoh Kalimat Memuat Research Gap" hint="Klik tiap kalimat untuk membuka paper aslinya. Baca sumber asli sebelum menyimpulkan ada gap." className="mb-4">
          <ul className="space-y-1.5 mt-1">
            {a.problem.sentences.slice(0, 8).map((s, i) => (
              <li key={i}>
                <a
                  href={s.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex gap-1.5 text-sm rounded-lg px-3 py-2 transition ${
                    s.url ? "text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer" : "text-slate-300 cursor-default"
                  }`}
                >
                  <span>
                    <span className="text-violet-300 font-medium group-hover:underline">[{s.title}…]</span>{" "}
                    {s.sentence.slice(0, 220)}
                  </span>
                  {s.url && <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-70 transition" />}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bibliometrics */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Rasio Relevansi per Tahun (%)" hint="Persentase publikasi tiap tahun yang menyinggung keyword Anda — apakah porsi topik Anda menaik atau menurun di dalam bidang.">
          {shareTrend.length ? <TrendLine data={shareTrend} height={260} /> : <Empty />}
        </Card>
        <Card title="Word Cloud Keyword Korpus" hint={`Ukuran kata ∝ frekuensi. Sumber: ${a.keywordCloud.source}.`}>
          {a.keywordCloud.terms.length ? <WordCloud data={a.keywordCloud.terms} height={300} /> : <Empty text="Tidak ada teks untuk membentuk word cloud." />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        <Card title="Penulis Paling Produktif" hint="Klik nama penulis untuk melihat daftar paper & jurnalnya.">
          {a.authorsDetail.length ? <DrillList groups={a.authorsDetail} showSource /> : <Empty />}
        </Card>
        <Card title="Sumber / Jurnal Teratas" hint="Klik nama jurnal untuk melihat daftar paper yang terbit di sana.">
          {a.sourcesDetail.length ? <DrillList groups={a.sourcesDetail} /> : <Empty />}
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

const editInput =
  "w-full bg-white/5 border border-white/10 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 outline-none rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 transition";

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

// Clickable ranked list; each row expands to show its references.
function DrillList({ groups, showSource = false }: { groups: GroupWithRefs[]; showSource?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const max = Math.max(...groups.map((g) => g.count), 1);
  return (
    <div className="space-y-1">
      {groups.map((g, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-lg">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180 text-violet-300" : ""}`} />
                <span className="text-sm text-slate-200 flex-1 break-words">{g.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{g.count} paper</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 mt-1.5 ml-6 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${(g.count / max) * 100}%` }} />
              </div>
            </button>
            {isOpen && (
              <ul className="mt-1 mb-2 ml-6 pl-3 space-y-1.5 border-l border-white/10">
                {g.refs.map((ref, j) => (
                  <li key={j}>
                    <a
                      href={ref.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex gap-1.5 text-xs leading-relaxed ${ref.url ? "text-slate-300 hover:text-white cursor-pointer" : "text-slate-300"}`}
                    >
                      <span>
                        <span className="text-violet-300 tabular-nums">{ref.year ?? "—"}</span> · {ref.title}
                        {showSource && ref.source && <span className="text-slate-500"> — {ref.source}</span>}
                      </span>
                      {ref.url && <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-70 transition" />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`text-xs rounded-full px-2 py-0.5 border ${
        on
          ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30"
          : "bg-white/5 text-slate-400 border-white/10 line-through decoration-slate-600"
      }`}
    >
      {on ? "✓ " : ""}
      {children}
    </span>
  );
}
