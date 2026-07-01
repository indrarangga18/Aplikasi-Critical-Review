"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Sparkles,
  Tag,
  UploadCloud,
  User,
} from "lucide-react";
import { parseRis, type RisRecord } from "@/lib/ris";
import { dataQuality } from "@/lib/analysis";

export interface SessionData {
  name: string;
  email: string;
  judul: string;
  topik: string;
  keywords: string[];
  records: RisRecord[];
  filename: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Landing({ onStart }: { onStart: (d: SessionData) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [records, setRecords] = useState<RisRecord[]>([]);
  const [filename, setFilename] = useState("");
  const [parseError, setParseError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [judul, setJudul] = useState("");
  const [topik, setTopik] = useState("");
  const [kwRaw, setKwRaw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const keywords = Array.from(
    new Set(
      kwRaw
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const handleFile = useCallback(async (file: File) => {
    setParseError("");
    try {
      const buf = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^﻿/, "");
      } catch {
        text = new TextDecoder("latin1").decode(buf);
      }
      const recs = parseRis(text);
      if (!recs.length) {
        setParseError("File terbaca tapi 0 referensi ditemukan. Pastikan ini benar file .ris.");
        setRecords([]);
        return;
      }
      setRecords(recs);
      setFilename(file.name);
    } catch {
      setParseError("Gagal membaca file. Coba file .ris lain.");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const q = records.length ? dataQuality(records) : null;

  const canNext =
    (step === 0 && name.trim().length > 1 && EMAIL_RE.test(email)) ||
    (step === 1 && records.length > 0) ||
    (step === 2 && judul.trim() && topik.trim() && keywords.length >= 5 && keywords.length <= 10);

  const next = () => {
    if (step < 2) setStep(step + 1);
    else onStart({ name: name.trim(), email: email.trim(), judul: judul.trim(), topik: topik.trim(), keywords, records, filename });
  };

  const steps = ["Identitas", "Unggah RIS", "Fokus Riset"];

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-10 sm:py-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mb-10"
      >
        <div className="inline-flex items-center gap-2 text-xs font-medium tracking-wide uppercase text-violet-300/80 border border-white/10 rounded-full px-3 py-1 mb-5 glass">
          <Sparkles className="w-3.5 h-3.5" /> Critical Review Literatur • Bertenaga RIS
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
          Ukur <span className="gradient-text">kebaruan riset</span> Anda
          <br className="hidden sm:block" /> dari file RIS
        </h1>
        <p className="text-slate-400 text-base sm:text-lg">
          Unggah hasil ekspor Scopus/Mendeley/Zotero, tentukan keyword, dan dapatkan Novelty Score,
          peluang riset, serta rekomendasi kombinasi topik — bisa diunduh & dikirim ke email.
        </p>
      </motion.div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition ${
                i === step ? "glass-strong text-white" : i < step ? "text-emerald-300" : "text-slate-500"
              }`}
            >
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-5 h-5 grid place-items-center rounded-full bg-white/10 text-xs">{i + 1}</span>}
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-xl glass-strong rounded-3xl p-6 sm:p-8 shadow-2xl">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" {...anim}>
              <Field icon={<User className="w-4 h-4" />} label="Nama lengkap">
                <input className={inputCls} placeholder="mis. John Doe" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field icon={<span className="text-sm">@</span>} label="Email (tujuan pengiriman laporan)">
                <input className={inputCls} placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                {email && !EMAIL_RE.test(email) && <p className="text-rose-400 text-xs mt-1.5">Format email belum valid.</p>}
              </Field>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" {...anim}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  dragging ? "border-violet-400 bg-violet-500/10" : "border-white/15 hover:border-white/30"
                }`}
              >
                <UploadCloud className="w-10 h-10 mx-auto mb-3 text-violet-300" />
                <p className="font-medium">Seret & letakkan file .ris di sini</p>
                <p className="text-slate-400 text-sm mt-1">atau klik untuk memilih file</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ris,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              {parseError && <p className="text-rose-400 text-sm mt-3">{parseError}</p>}
              {q && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Referensi" value={q.total} />
                  <Stat label="Abstrak" value={`${Math.round((q.withAbstract / q.total) * 100)}%`} />
                  <Stat label="Keyword" value={`${Math.round((q.withKeywords / q.total) * 100)}%`} />
                  <div className="col-span-3 text-xs text-slate-400 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> {filename}
                  </div>
                  {(q.warnAbstract || q.warnKeywords) && (
                    <p className="col-span-3 text-amber-300/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      ⚠️ {q.warnAbstract && "<50% referensi punya abstrak — analisis masalah/novelty akan lebih lemah. "}
                      {q.warnKeywords && "<50% punya field KW — co-occurrence bergantung judul/abstrak."}
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" {...anim}>
              <Field icon={<FileText className="w-4 h-4" />} label="Judul penelitian Anda">
                <input className={inputCls} placeholder="mis. Deep learning untuk deteksi dini sepsis" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </Field>
              <Field icon={<Sparkles className="w-4 h-4" />} label="Topik / area penelitian">
                <input className={inputCls} placeholder="mis. Medical AI" value={topik} onChange={(e) => setTopik(e.target.value)} />
              </Field>
              <Field icon={<Tag className="w-4 h-4" />} label="Keyword (pisahkan koma, 5–10)">
                <input className={inputCls} placeholder="deep learning, sepsis, early detection, icu, ..." value={kwRaw} onChange={(e) => setKwRaw(e.target.value)} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((k) => (
                    <span key={k} className="text-xs bg-violet-500/20 text-violet-200 border border-violet-400/20 rounded-full px-2.5 py-0.5">
                      {k}
                    </span>
                  ))}
                </div>
                <p className={`text-xs mt-2 ${keywords.length >= 5 && keywords.length <= 10 ? "text-emerald-300" : "text-slate-400"}`}>
                  {keywords.length} keyword unik {keywords.length < 5 ? "(butuh minimal 5)" : keywords.length > 10 ? "(maksimal 10)" : "✓"}
                </p>
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav */}
        <div className="flex items-center justify-between mt-7">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 disabled:opacity-30 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2.5 rounded-xl transition shadow-lg shadow-violet-500/25"
          >
            {step === 2 ? "Jalankan Analisis" : "Lanjut"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-slate-500 text-xs mt-8 max-w-md text-center">
        Analisis berjalan sepenuhnya di browser Anda. File RIS tidak diunggah ke server kecuali saat
        Anda memilih mengirim laporan ke email.
      </p>
    </main>
  );
}

const anim = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25 },
};

const inputCls =
  "w-full bg-white/5 border border-white/10 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 transition";

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="flex items-center gap-1.5 text-sm text-slate-300 mb-1.5">
        <span className="text-violet-300">{icon}</span> {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
