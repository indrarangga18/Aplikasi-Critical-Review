"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  ChevronDown,
  Combine,
  CopyCheck,
  ExternalLink,
  FileDown,
  Gauge,
  Grid3x3,
  Info,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Loader2,
  Mail,
  Network,
  Pencil,
  Quote,
  Radar,
  Scale,
  ScanSearch,
  SlidersHorizontal,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  Telescope,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import { runAnalysis, type GroupWithRefs } from "@/lib/analysis";
import { registerSynonymGroups } from "@/lib/terms";
import { buildReportHtml } from "@/lib/report";
import { DivergingBar, FitBars, GroupedBar, HBar, Heatmap, InnovationRadar, MultiTrend, QuadrantMap, TrendLine, Venn, WordCloud } from "@/components/Charts";
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

  // AI semantic keyword expansion (bilingual + synonyms, beyond the glossary).
  const [semantic, setSemantic] = useState<{ status: "idle" | "loading" | "on" | "off" | "error"; note?: string }>({ status: "idle" });
  const [enrichVersion, setEnrichVersion] = useState(0);
  const [synonymGroups, setSynonymGroups] = useState<string[][]>([]);
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    const key = keywords.join("|");
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;
    setSemantic({ status: "loading" });
    fetch("/api/expand-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, topik }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.configured && Array.isArray(j.groups) && j.groups.length) {
          registerSynonymGroups(j.groups);
          setSynonymGroups(j.groups);
          setEnrichVersion((v) => v + 1);
          setSemantic({ status: "on", note: `${j.groups.length} keyword diperkaya AI` });
        } else if (j.ok && j.configured === false) {
          setSemantic({ status: "off" });
        } else {
          setSemantic({ status: "error", note: j.error });
        }
      })
      .catch(() => setSemantic({ status: "error" }));
  }, [keywords, topik]);

  const a = useMemo(() => runAnalysis(data.records, keywords, judul, topik), [data.records, keywords, judul, topik, enrichVersion]);

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
        body: JSON.stringify({ records: data.records, keywords, meta, synonymGroups }),
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
  const confColor = a.novelty.confidence.percent >= 80 ? "#34d399" : a.novelty.confidence.percent >= 60 ? "#fbbf24" : "#fb7185";
  const recData = a.recommendations.slice(0, 10).map((r) => ({ label: r.combo, value: r.score }));
  const strengthData = a.strength.map((s) => ({ label: s.keyword, docFreq: s.docFreq, totalOcc: s.totalOcc }));

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-violet-300/80 mb-1">Laporan Critical Review</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{judul || "(tanpa judul)"}</h1>
          <p className="text-slate-400 text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{topik} • {a.totalCount} referensi • {data.name}</span>
            <SemanticBadge state={semantic} />
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

      {/* ===== Section 1: Rincian Novelty Score ===== */}
      <SectionHeader
        n={1}
        title="Rincian Novelty Score"
        subtitle="Skor kebaruan dari kombinasi keyword Anda beserta komponen pembentuknya."
      />
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
          <span
            className="mt-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5"
            style={{ color: noveltyColor, background: `${noveltyColor}1f`, border: `1px solid ${noveltyColor}55` }}
          >
            Novelty {a.novelty.level}
          </span>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{a.novelty.levelHint}</p>
        </Card>

        <Card className="lg:col-span-2" title="Kontributor Skor" icon={<BarChart3 className="w-4 h-4" />} hint="5 faktor pembentuk Novelty Score. Bobot dipilih manual — alat bandingkan alternatif, bukan metrik baku.">
          {/* Formula with real numbers plugged in */}
          <div className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2 mb-4 leading-relaxed">
            <span className="text-slate-300 font-medium">Rumus:</span> Skor = 100 × (
            {a.novelty.factors.map((c, i) => (
              <span key={c.key}>
                {i > 0 && " + "}
                <span className="text-violet-300">{c.weight}</span>×{c.value}
              </span>
            ))}
            ) = <span className="text-white font-semibold">{a.novelty.score}</span>
          </div>

          <div className="space-y-4">
            {a.novelty.factors.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between items-baseline mb-0.5 gap-2">
                  <span className="text-sm text-slate-200 font-medium flex items-center gap-1.5">
                    {c.name}
                    <DirTag dir={c.direction} />
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    +{c.contribution} poin · bobot {c.weight} · nilai {c.value}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-1.5">{c.measures}</p>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${c.value * 100}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs">
                  <span className="text-slate-400">{c.detail}</span>
                  <span className="text-violet-300">→ {c.interpretation}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Explainability + Confidence */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2" title="Kenapa Skornya Segini? (Explainability)" icon={<Info className="w-4 h-4" />} hint="3 alasan paling menentukan skor, dalam bahasa manusia — lebih berguna daripada sekadar angka.">
          <ol className="space-y-2.5 mt-1">
            {a.novelty.explanations.map((e, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-200 text-xs font-semibold shrink-0 mt-0.5">{i + 1}</span>
                <span>{e}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Confidence Score" icon={<Gauge className="w-4 h-4" />} hint="Seberapa layak skor ini dipercaya — dipengaruhi jumlah & cakupan data.">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold" style={{ color: confColor }}>{a.novelty.confidence.percent}%</span>
            <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ color: confColor, background: `${confColor}1f`, border: `1px solid ${confColor}55` }}>{a.novelty.confidence.level}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-2">
            <div className="h-full rounded-full" style={{ width: `${a.novelty.confidence.percent}%`, background: confColor }} />
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            {a.novelty.confidence.reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-violet-300 shrink-0">•</span> {r}</li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-white/10">Novelty sangat dipengaruhi jumlah data — makin banyak & luas referensinya, makin stabil skornya.</p>
        </Card>
      </div>

      {/* Sensitivity */}
      {a.novelty.sensitivity.length > 0 && (
        <Card title="Sensitivity Analysis" icon={<SlidersHorizontal className="w-4 h-4" />} hint={`Skenario "what-if": skor utama (${a.novelty.score}) memakai SEMUA keyword; tiap baris = skor bila 1 keyword dihapus. Wajar berbeda — |Δ| besar = keyword itu paling menentukan skor.`} className="mb-4">
          <div className="space-y-1.5 mt-1">
            {a.novelty.sensitivity.map((s) => {
              const up = s.delta > 0;
              const flat = s.delta === 0;
              const col = flat ? "#94a3b8" : up ? "#34d399" : "#fb7185";
              return (
                <div key={s.keyword} className="flex items-center gap-3 text-sm bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-slate-500 text-xs shrink-0">tanpa</span>
                  <span className="text-slate-200 flex-1 truncate">{s.keyword}</span>
                  <span className="text-slate-400 tabular-nums text-xs">{a.novelty.score} → {s.scoreWithout}</span>
                  <span className="tabular-nums font-medium w-14 text-right" style={{ color: col }}>
                    {up ? "+" : ""}{s.delta}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Δ negatif = menghapus keyword <b>menurunkan</b> novelty (keyword itu menambah kebaruan). Δ positif = keyword itu justru <b>menekan</b> novelty (umum / sudah matang).
          </p>
        </Card>
      )}

      {/* ===== Section 2: Distribusi Keyword ===== */}
      <SectionHeader
        n={2}
        title="Hasil Analisis Distribusi Keyword"
        subtitle="Sebaran & kekuatan keyword, tren waktu, penulis produktif, dan sumber/jurnal."
      />
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
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Rasio Relevansi per Tahun (%)" hint="Persentase publikasi tiap tahun yang menyinggung keyword Anda — apakah porsi topik Anda menaik atau menurun di dalam bidang.">
          {shareTrend.length ? <TrendLine data={shareTrend} height={260} /> : <Empty />}
        </Card>
        <Card title="Word Cloud Keyword Korpus" hint={`Ukuran kata ∝ frekuensi. Sumber: ${a.keywordCloud.source}.`}>
          {a.keywordCloud.terms.length ? <WordCloud data={a.keywordCloud.terms} height={300} /> : <Empty text="Tidak ada teks untuk membentuk word cloud." />}
        </Card>
      </div>

      {/* Keyword dynamics — semuanya atas keyword Anda + kandidat korpus */}
      <Card title="Keyword Evolution" icon={<Workflow className="w-4 h-4" />} hint="Perkembangan kumulatif keyword Anda: tiap keyword muncul pada periode puncaknya lalu terus terbawa (A → A+B → A+B+C). [+baru] = muncul di periode itu." className="mb-4">
        {a.dynamics.evolution.length ? (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            {a.dynamics.evolution.map((s, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className="glass rounded-xl px-4 py-3 min-w-[170px] max-w-[220px]">
                  <div className="text-xs text-violet-300/80 mb-1.5">{s.label} · {s.docs} doc</div>
                  {s.emerged.length ? (
                    <div className="flex flex-wrap gap-1">
                      {s.emerged.map((e, j) => (
                        <span key={j} className={`text-xs rounded-full px-2 py-0.5 ${e.isNew ? "bg-violet-500/25 text-violet-100 border border-violet-400/40 font-medium" : "bg-white/5 text-slate-400 border border-white/10"}`}>
                          {e.isNew ? "+ " : ""}{e.term}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">—</div>
                  )}
                </div>
                {i < a.dynamics.evolution.length - 1 && <ChevronDown className="w-5 h-5 text-slate-600 -rotate-90 shrink-0" />}
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Butuh data tahun yang bervariasi untuk membentuk evolusi." />
        )}
      </Card>

      <Card
        title="Momentum Keyword — Burst & Declining"
        icon={<TrendingUp className="w-4 h-4" />}
        hint={
          a.dynamics.yearT != null && a.dynamics.yearPrev != null
            ? `Rumus year-over-year: (Fₜ − Fₜ₋₁)/Fₜ₋₁ × 100, dengan t = ${a.dynamics.yearT} dan t−1 = ${a.dynamics.yearPrev}. ▲ hijau = burst (naik), ▼ merah = declining (turun). Selaras dgn Emerging di Section 1.`
            : "Butuh minimal 2 tahun berbeda untuk menghitung momentum."
        }
        className="mb-4"
      >
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">Keyword Anda ({a.dynamics.userMomentum.length})</div>
            {a.dynamics.userMomentum.length ? (
              <ul className="space-y-1.5">
                {a.dynamics.userMomentum.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-slate-200 flex items-center gap-1.5 min-w-0">
                      <MomIcon dir={m.direction} /> <span className="truncate">{m.term}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-500 tabular-nums">{m.fprev}→{m.ft}</span>
                      <MomBadge m={m} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Butuh minimal 2 tahun berbeda untuk menghitung momentum." />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">Kandidat lain dari korpus ({a.dynamics.candidates.length})</div>
            {a.dynamics.candidates.length ? (
              <ul className="space-y-1.5">
                {a.dynamics.candidates.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-slate-300 italic flex items-center gap-1.5 min-w-0">
                      <MomIcon dir={m.direction} /> <span className="truncate">{m.term}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-500 tabular-nums">{m.fprev}→{m.ft}</span>
                      <MomBadge m={m} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full grid place-items-center text-slate-500 text-xs py-6">Tidak ada kandidat menonjol di korpus.</div>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Fₜ₋₁→Fₜ = frekuensi keyword pada tahun t−1 dan t. Kandidat = istilah lain di korpus yang sedang naik/turun tajam — pertimbangkan menambahkannya sebagai keyword.</p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Keyword Centrality" icon={<Share2 className="w-4 h-4" />} hint="Keyword Anda paling sentral di jaringan co-occurrence (matriks sama dgn Section 1). Bar = Eigenvector (kepentingan utama).">
          {a.dynamics.centrality.length ? (
            <>
              <div className="space-y-2 mb-3">
                {a.dynamics.centrality.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-200">{c.term}</span>
                      <span className="text-slate-400 tabular-nums">deg {c.degree} · betw {c.betweenness} · eig {c.eigenvector}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${c.eigenvector * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-white/10">
                <p><b className="text-slate-400">Degree</b> — berapa banyak keyword lain yang pernah digabung dengannya (0–1).</p>
                <p><b className="text-slate-400">Betweenness</b> — seberapa sering jadi "jembatan" antar keyword (0 = bukan jembatan; wajar kecil di jaringan kecil).</p>
                <p><b className="text-slate-400">Eigenvector</b> — terhubung ke keyword yang juga penting (1 = paling sentral).</p>
              </div>
            </>
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Thematic Map (Quadrant)" icon={<LayoutGrid className="w-4 h-4" />} hint="Motor (penting & matang), Basic (penting, belum matang), Niche (matang, terisolasi), Emerging/Declining (baru/menurun). Termasuk kandidat korpus; ▲/▼ = momentum.">
          {a.dynamics.thematic.length ? <QuadrantMap points={a.dynamics.thematic} /> : <Empty text="Butuh minimal 2 keyword dengan co-occurrence." />}
        </Card>
      </div>

      {/* Bibliometrik: penulis & sumber (ditaruh di akhir Section 2) */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Penulis Paling Produktif" hint="Klik nama penulis untuk melihat daftar paper & jurnalnya.">
          {a.authorsDetail.length ? <DrillList groups={a.authorsDetail} showSource /> : <Empty />}
        </Card>
        <Card title="Sumber / Jurnal Teratas" hint="Klik nama jurnal untuk melihat daftar paper yang terbit di sana.">
          {a.sourcesDetail.length ? <DrillList groups={a.sourcesDetail} /> : <Empty />}
        </Card>
      </div>

      {/* ===== Section 3: Identifikasi Gap ===== */}
      <SectionHeader
        n={3}
        title="Hasil Analisis Identifikasi Gap"
        subtitle="Celah antar-topik pada korpus dan penanda masalah/gap dari abstrak."
      />
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Co-occurrence Topik Korpus" icon={<Network className="w-4 h-4" />} hint={`Sumber vocab: ${a.cooc.vocabSource}. Sel gelap = jarang digabung.`}>
          <Heatmap labels={a.cooc.vocab} matrix={a.cooc.matrix} />
        </Card>
        <Card title="Pasangan Keyword Paling Jarang Digabung" hint="Padanan EN↔ID sudah diperhitungkan. Nilai 0 = pasangan ini belum pernah muncul bersama di korpus (kandidat celah riset), bukan error.">
          <ul className="space-y-2 mt-1">
            {a.opportunity.rarePairs.map((p, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                <span className="text-slate-200">{p.a} <span className="text-slate-500">+</span> {p.b}</span>
                <span className="text-violet-300 font-medium">{p.count} ref</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Identifikasi Masalah / Gap" icon={<TriangleAlert className="w-4 h-4" />} hint={`${a.problem.totalSentences} kalimat berpenanda (berbasis kata kunci, bukan pemahaman).`}>
          {a.problem.cueCounts.length ? (
            <HBar data={a.problem.cueCounts} height={Math.max(160, a.problem.cueCounts.length * 24)} color="#fb7185" />
          ) : (
            <Empty text="Tidak ada penanda terdeteksi (kemungkinan abstrak kosong)." />
          )}
        </Card>
        {a.problem.sentences.length > 0 && (
          <Card title="Contoh Kalimat Memuat Research Gap" hint="Klik tiap kalimat untuk membuka paper aslinya. Baca sumber asli sebelum menyimpulkan ada gap.">
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
      </div>

      {/* Gap Classification — klik tiap jenis untuk lihat evidence + link */}
      <Card title="Gap Classification" icon={<Layers className="w-4 h-4" />} hint="Jenis gap yang tersirat di abstrak paper relevan (10 kategori). Bintang = severity (berapa banyak paper). Klik untuk melihat kalimat bukti + link papernya." className="mb-4">
        {a.gaps.classification.length ? (
          <GapClassList items={a.gaps.classification} />
        ) : (
          <Empty text="Tidak ada penanda jenis gap terdeteksi di abstrak relevan." />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Gap Evidence */}
        <Card title="Gap Evidence" icon={<Quote className="w-4 h-4" />} hint={`${a.gaps.gapEvidence.count} paper menyatakan gap/kebutuhan riset secara eksplisit. Klik untuk buka sumbernya.`}>
          {a.gaps.gapEvidence.items.length ? (
            <ul className="space-y-1.5 mt-1">
              {a.gaps.gapEvidence.items.map((e, i) => (
                <EvidenceItem key={i} e={e} />
              ))}
            </ul>
          ) : (
            <Empty text="Tidak ada pernyataan gap eksplisit terdeteksi." />
          )}
        </Card>

        {/* Contradictory Findings */}
        <Card title="Contradictory Findings" icon={<Scale className="w-4 h-4" />} hint={`Kontroversi hasil pada "${a.gaps.contradiction.topic}": klaim positif vs negatif dari abstrak.`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-center">
              <div className="text-2xl font-bold text-emerald-300">{a.gaps.contradiction.positiveCount}</div>
              <div className="text-xs text-emerald-200/80">paper: efektif/positif</div>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-center">
              <div className="text-2xl font-bold text-rose-300">{a.gaps.contradiction.negativeCount}</div>
              <div className="text-xs text-rose-200/80">paper: tidak efektif/negatif</div>
            </div>
          </div>
          {a.gaps.contradiction.positiveCount >= 2 && a.gaps.contradiction.negativeCount >= 2 ? (
            <div className="text-xs bg-amber-500/10 border border-amber-500/25 text-amber-200 rounded-lg px-3 py-2 mb-2">⚑ Terindikasi <b>research controversy</b> — hasil bertentangan, layak diteliti lebih lanjut.</div>
          ) : (
            <p className="text-xs text-slate-500 mb-2">Belum cukup bukti dua arah untuk menyebut kontroversi.</p>
          )}
          {a.gaps.contradiction.negativeExamples[0] && (
            <div className="text-xs text-slate-400">
              <span className="text-rose-300">Contra:</span>{" "}
              <a href={a.gaps.contradiction.negativeExamples[0].url || undefined} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">“{a.gaps.contradiction.negativeExamples[0].sentence}”</a>
            </div>
          )}
        </Card>
      </div>

      {/* Future Research Extraction */}
      <Card title="Future Research Extraction" icon={<Telescope className="w-4 h-4" />} hint="Rangkuman langsung dari abstrak paper relevan: Future Work, Limitation, Recommendation." className="mb-4">
        <div className="grid md:grid-cols-3 gap-x-5 gap-y-3">
          <FutureCol icon={<Telescope className="w-3.5 h-3.5" />} label="Future Work" group={a.gaps.future.futureWork} color="text-violet-300" />
          <FutureCol icon={<TriangleAlert className="w-3.5 h-3.5" />} label="Limitations" group={a.gaps.future.limitations} color="text-amber-300" />
          <FutureCol icon={<ListChecks className="w-3.5 h-3.5" />} label="Recommendations" group={a.gaps.future.recommendations} color="text-emerald-300" />
        </div>
      </Card>

      {/* ===== Section 4: Analisis Novelty ===== */}
      <SectionHeader
        n={4}
        title="Hasil Analisis Novelty"
        subtitle="Dari mana kebaruan berasal, peluang & area kosong, serta seberapa mirip judul Anda dengan yang sudah ada."
      />

      {/* 4.1 Dari mana novelty berasal */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Novelty Dimension" icon={<Sparkles className="w-4 h-4" />} hint="Dari mana potensi kebaruan berasal (8 dimensi). Klik tiap dimensi untuk lihat kalimat bukti + link papernya.">
          {a.noveltyExtra.dimensions.some((d) => d.score > 0) ? (
            <DimensionList items={a.noveltyExtra.dimensions} />
          ) : (
            <Empty text="Belum ada sinyal dimensi novelty (abstrak terbatas)." />
          )}
        </Card>
        <Card title="Innovation Radar" icon={<Radar className="w-4 h-4" />} hint="Visual potensi kebaruan pada 6 poros: Method, Theory, Context, Variable, Technology, Contribution.">
          <InnovationRadar data={a.noveltyExtra.radar} height={280} />
          <div className="mt-2 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <b className="text-slate-300">Interpretasi:</b> {a.noveltyExtra.radarInsight}
          </div>
        </Card>
      </div>

      {/* 4.2 Peluang & area kosong */}
      <Card title="Novelty Opportunity Map" icon={<Grid3x3 className="w-4 h-4" />} hint="Peluang kebaruan tiap pasangan keyword (terang = keduanya ramai diteliti TAPI jarang digabung = peluang tinggi; gelap = sudah sering digabung / salah satu keyword tak ada di korpus)." className="mb-4">
        <Heatmap labels={a.noveltyExtra.oppLabels} matrix={a.noveltyExtra.oppMatrix} annotate />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="White Space Analysis" icon={<ScanSearch className="w-4 h-4" />} hint="Area kosong: keyword yang belum tersentuh & pasangan yang keduanya ramai tapi belum digabung — kandidat kebaruan terkuat.">
          {a.noveltyExtra.untouched.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">Keyword belum tersentuh di korpus</div>
              <div className="flex flex-wrap gap-1.5">
                {a.noveltyExtra.untouched.map((k) => (
                  <span key={k} className="text-xs bg-amber-500/15 text-amber-200 border border-amber-400/25 rounded-full px-2.5 py-0.5">{k}</span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Tidak muncul di korpus — bisa berarti benar-benar baru, atau perlu diperiksa relevansinya.</p>
            </div>
          )}
          <div className="text-xs font-semibold text-slate-300 mb-1.5">Pasangan belum digabung (keduanya ramai)</div>
          {a.noveltyExtra.whiteSpace.length ? (
            <ul className="space-y-1.5">
              {a.noveltyExtra.whiteSpace.map((w, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-slate-200 truncate">{w.a} <span className="text-slate-500">×</span> {w.b}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500 tabular-nums">{w.aFreq}·{w.bFreq} paper</span>
                    <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-violet-500/20 text-violet-200 border border-violet-400/25">{w.score}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">{a.noveltyExtra.untouched.length ? "Semua pasangan yang ada datanya sudah pernah digabung." : "Tidak ada white space (semua pasangan sudah digabung)."}</p>
          )}
        </Card>

        {/* Co-occurrence context */}
        <Card title="Co-occurrence Keyword Anda" icon={<Network className="w-4 h-4" />} hint="Berapa paper memuat tiap pasangan keyword Anda bersama (matriks sama dgn Section 1). 0 = belum pernah digabung.">
          <Heatmap labels={data.keywords} matrix={a.opportunity.matrix} annotate />
          {a.noveltyExtra.untouched.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-2">Baris/kolom nol pada <b className="text-amber-300">{a.noveltyExtra.untouched.join(", ")}</b> karena keyword itu tak muncul di korpus.</p>
          )}
        </Card>
      </div>

      {/* 4.3 Domain overlap + similarity */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card
          title="Domain yang Beririsan (Diagram Venn)"
          icon={<Combine className="w-4 h-4" />}
          hint={`3 domain paling beririsan yang benar-benar ada di korpus: ${a.venn.sets.join(", ")}. Angka = jumlah referensi tiap wilayah.`}
        >
          <Venn sets={a.venn.sets} regions={a.venn} totals={a.venn.totals} />
          <div className="mt-3 text-sm bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-4 py-3 text-emerald-100">
            <b>Rekomendasi:</b> {a.venn.recommendation}
          </div>
        </Card>

        <Card title="Similarity Against Existing Research" icon={<CopyCheck className="w-4 h-4" />} hint="Kemiripan judul + keyword Anda dengan tiap paper (cosine kata). Klik untuk melihat kata pemicu kemiripan + link.">
          {a.noveltyExtra.similar.length ? (
            <SimilarList items={a.noveltyExtra.similar} />
          ) : (
            <Empty text="Isi judul penelitian untuk menghitung kemiripan." />
          )}
          {a.noveltyExtra.similar[0]?.similarity >= 80 && (
            <div className="mt-2.5 text-xs bg-rose-500/10 border border-rose-500/25 text-rose-200 rounded-lg px-3 py-2">⚠️ Ada paper yang <b>sangat mirip</b> ({a.noveltyExtra.similar[0].similarity}%) — pertimbangkan mempertajam sudut/judul.</div>
          )}
        </Card>
      </div>

      {/* ===== Section 5: Rekomendasi Penelitian ===== */}
      <SectionHeader
        n={5}
        title="Hasil Analisis Rekomendasi Penelitian"
        subtitle="Kombinasi topik yang disarankan dan kesesuaiannya dengan judul Anda."
      />
      <Card title="Rekomendasi Kombinasi Topik" icon={<Lightbulb className="w-4 h-4" />} hint="Pasangan keyword jarang digabung namun sedang naik daun = kandidat celah riset." className="mb-4">
        <HBar data={recData} height={Math.max(220, recData.length * 46)} color="#c084fc" labelWidth={230} />
        {a.recommendations[0] && (
          <div className="mt-3 text-sm bg-violet-500/10 border border-violet-400/20 rounded-xl px-4 py-3">
            Arah paling menjanjikan: <b>{a.recommendations[0].combo}</b> (co-occurrence={a.recommendations[0].cooccurrence}, skor={a.recommendations[0].score}).
          </div>
        )}
      </Card>
      <Card
        title="Kesesuaian Judul ↔ Rekomendasi"
        icon={<Target className="w-4 h-4" />}
        hint="Membandingkan skor rekomendasi vs berapa banyak kata kombinasi yang sudah muncul di judul Anda, per kombinasi."
        className="mb-4"
      >
        <FitBars data={a.titleFit.map((f) => ({ label: f.combo, recScore: f.recScore, titleFitPct: f.titleFitPct }))} height={Math.max(240, a.titleFit.length * 46)} />
      </Card>
      <Card title="Tabel Kesesuaian Judul dengan Rekomendasi" icon={<Target className="w-4 h-4" />} hint="Cek apakah kata dari tiap kombinasi rekomendasi sudah tercermin di judul penelitian Anda." className="mb-10">
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

      <p className="text-slate-500 text-xs text-center max-w-2xl mx-auto pb-10">
        ⚠️ Seluruh rekomendasi adalah TITIK AWAL, bukan kesimpulan. Pencocokan sudah memakai glosarium bilingual
        EN↔ID untuk istilah umum (mis. "artificial intelligence" = "kecerdasan buatan"), tetapi istilah di luar
        glosarium tetap dicocokkan apa adanya dan homonim tidak dibedakan. Novelty Score bukan metrik bibliometrik
        standar. Validasi dengan membaca paper aktual pada pasangan keyword teratas.
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

function SectionHeader({ n, title, subtitle, icon }: { n: number; title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-12 mb-5 first:mt-2">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white text-base font-bold shrink-0 shadow-lg shadow-violet-500/25">
        {n}
      </span>
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white leading-tight flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
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

function SemanticBadge({ state }: { state: { status: string; note?: string } }) {
  const map: Record<string, { label: string; cls: string; title: string }> = {
    idle: { label: "", cls: "", title: "" },
    loading: { label: "AI semantic: memuat…", cls: "bg-white/5 text-slate-400 border-white/10", title: "Memperkaya keyword dengan AI" },
    on: { label: `AI semantic: aktif`, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25", title: state.note || "Keyword diperkaya padanan lintas-bahasa & sinonim oleh AI" },
    off: { label: "AI semantic: nonaktif", cls: "bg-white/5 text-slate-400 border-white/10", title: "Set ANTHROPIC_API_KEY untuk mengaktifkan; kini memakai glosarium bawaan" },
    error: { label: "AI semantic: gagal", cls: "bg-amber-500/15 text-amber-300 border-amber-400/25", title: state.note || "Gagal memanggil model; memakai glosarium bawaan" },
  };
  const m = map[state.status];
  if (!m || !m.label) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border ${m.cls}`} title={m.title}>
      <Sparkles className="w-3 h-3" /> {m.label}
    </span>
  );
}

function GapClassList({ items }: { items: { key: string; name: string; count: number; stars: number; examples: { title: string; sentence: string; url: string }[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      {items.map((g) => {
        const isOpen = open === g.key;
        return (
          <div key={g.key}>
            <button onClick={() => setOpen(isOpen ? null : g.key)} className="w-full flex items-center justify-between gap-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition">
              <span className="flex items-center gap-2 text-slate-200">
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180 text-violet-300" : ""}`} />
                {g.name}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <Stars n={g.stars} />
                <span className="text-xs text-slate-500 tabular-nums w-14 text-right">{g.count} paper</span>
              </span>
            </button>
            {isOpen && (
              <ul className="mt-1 mb-2 ml-6 pl-3 space-y-1 border-l border-white/10">
                {g.examples.length ? g.examples.map((e, i) => <EvidenceItem key={i} e={e} />) : <li className="text-xs text-slate-500 py-1">Tidak ada kalimat contoh.</li>}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DimensionList({ items }: { items: { key: string; name: string; score: number; count: number; examples: { title: string; sentence: string; url: string }[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {items.map((d) => {
        const isOpen = open === d.key;
        const clickable = d.examples.length > 0;
        return (
          <div key={d.key}>
            <button onClick={() => clickable && setOpen(isOpen ? null : d.key)} className={`w-full text-left ${clickable ? "cursor-pointer" : "cursor-default"}`}>
              <div className="flex justify-between items-center text-xs mb-0.5">
                <span className="text-slate-200 flex items-center gap-1">
                  {clickable && <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? "rotate-180 text-violet-300" : ""}`} />}
                  {d.name}
                </span>
                <span className="text-slate-400 tabular-nums">{d.score} · {d.count} paper</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden ml-4">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${d.score}%` }} />
              </div>
            </button>
            {isOpen && (
              <ul className="mt-1.5 mb-1 ml-6 pl-3 space-y-1 border-l border-white/10">
                {d.examples.map((e, i) => (
                  <EvidenceItem key={i} e={e} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SimilarList({ items }: { items: { title: string; similarity: number; url: string; year: number | null; shared: string[] }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="space-y-2 mt-1">
      {items.map((s, i) => {
        const col = s.similarity >= 80 ? "#fb7185" : s.similarity >= 60 ? "#fbbf24" : "#818cf8";
        const isOpen = open === i;
        return (
          <li key={i}>
            <button onClick={() => setOpen(isOpen ? null : i)} className="w-full text-left">
              <div className="flex justify-between text-xs mb-0.5 gap-2 items-center">
                <span className="text-slate-300 truncate flex items-center gap-1">
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180 text-violet-300" : ""}`} />
                  {s.title} {s.year && <span className="text-slate-500">({s.year})</span>}
                </span>
                <span className="tabular-nums font-medium shrink-0" style={{ color: col }}>{s.similarity}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden ml-4">
                <div className="h-full rounded-full" style={{ width: `${s.similarity}%`, background: col }} />
              </div>
            </button>
            {isOpen && (
              <div className="mt-1.5 mb-1 ml-6 pl-3 border-l border-white/10 text-xs text-slate-400">
                <div className="mb-1">Kata pemicu kemiripan: {s.shared.length ? s.shared.map((w) => <span key={w} className="inline-block bg-white/5 rounded px-1.5 py-0.5 mr-1 mb-1 text-slate-300">{w}</span>) : <span className="text-slate-500">—</span>}</div>
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline inline-flex items-center gap-1">Buka paper <ExternalLink className="w-3 h-3" /></a>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center" title={`Severity ${n}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5" style={{ fill: i < n ? "#fbbf24" : "transparent", color: i < n ? "#fbbf24" : "#475569" }} />
      ))}
    </span>
  );
}

function EvidenceItem({ e }: { e: { title: string; sentence: string; url: string } }) {
  return (
    <li>
      <a
        href={e.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex gap-1.5 text-xs leading-relaxed rounded-lg px-2.5 py-1.5 transition ${e.url ? "text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer" : "text-slate-300"}`}
      >
        <span>
          “{e.sentence}” <span className="text-violet-300/70">— {e.title}…</span>
        </span>
        {e.url && <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-70 transition" />}
      </a>
    </li>
  );
}

function FutureCol({ icon, label, group, color }: { icon: React.ReactNode; label: string; group: { count: number; items: { title: string; sentence: string; url: string }[] }; color: string }) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${color}`}>
        {icon} {label} <span className="text-slate-500 font-normal">({group.count})</span>
      </div>
      {group.items.length ? (
        <ul className="space-y-1">
          {group.items.map((e, i) => (
            <EvidenceItem key={i} e={e} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">—</p>
      )}
    </div>
  );
}

function MomIcon({ dir }: { dir: string }) {
  if (dir === "up") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (dir === "down") return <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  return <span className="w-3.5 text-center text-slate-500 shrink-0">·</span>;
}

function MomBadge({ m }: { m: { growthPct: number | null; direction: string } }) {
  const up = m.direction === "up";
  const down = m.direction === "down";
  const label = m.growthPct === null ? "BARU" : `${m.growthPct > 0 ? "+" : ""}${m.growthPct}%`;
  const cls = up
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/25"
    : down
    ? "bg-rose-500/15 text-rose-300 border-rose-400/25"
    : "bg-white/5 text-slate-400 border-white/10";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 border shrink-0 ${cls}`}>{label}</span>;
}

function DirTag({ dir }: { dir: "naik" | "turun" | "netral" }) {
  if (dir === "netral") return null;
  const up = dir === "naik";
  return (
    <span
      className="text-[10px] font-medium rounded px-1.5 py-0.5"
      style={
        up
          ? { color: "#6ee7b7", background: "rgba(52,211,153,.12)" }
          : { color: "#fda4af", background: "rgba(251,113,133,.12)" }
      }
      title={up ? "Menambah novelty" : "Menurunkan novelty"}
    >
      {up ? "↑ novelty" : "↓ novelty"}
    </span>
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
