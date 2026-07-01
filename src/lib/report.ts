// Builds a self-contained HTML report from the analysis result.
// Shared by the client download button and the server-side email route.

import type { AnalysisResult } from "./analysis";

export interface ReportMeta {
  name: string;
  email: string;
  judul: string;
  topik: string;
  keywords: string[];
  filename: string;
  generatedAt: string; // ISO string, passed in (Date.now unavailable in some contexts)
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bar(value: number, max: number): string {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="bar"><span style="width:${pct}%"></span></div>`;
}

export function buildReportHtml(a: AnalysisResult, meta: ReportMeta): string {
  const q = a.quality;
  const noveltyColor = a.novelty.score >= 66 ? "#16a34a" : a.novelty.score >= 40 ? "#d97706" : "#dc2626";

  const strengthRows = a.strength
    .map(
      (s) => `<tr><td>${esc(s.keyword)}</td><td class="num">${s.docFreq}</td><td class="num">${s.totalOcc}</td><td class="num">${s.docSharePct}%</td><td class="num">${s.strengthScore}</td></tr>`
    )
    .join("");

  const noveltyRows = a.novelty.components
    .map(
      (c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.value}</td><td class="num">${c.weight}</td><td class="num">${c.contribution}</td></tr>`
    )
    .join("");

  const recRows = a.recommendations
    .slice(0, 8)
    .map(
      (r) => `<tr><td>${esc(r.combo)}</td><td class="num">${r.cooccurrence}</td><td class="num">${r.emergingAvg}</td><td class="num"><b>${r.score}</b></td></tr>`
    )
    .join("");

  const rarePairs = a.opportunity.rarePairs
    .map((p) => `<li>${esc(p.a)} + ${esc(p.b)} → <b>${p.count}</b> referensi</li>`)
    .join("");

  const cueMax = Math.max(...a.problem.cueCounts.map((c) => c.value), 1);
  const cueRows = a.problem.cueCounts
    .map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${c.value}</td><td>${bar(c.value, cueMax)}</td></tr>`)
    .join("");

  const problemSentences = a.problem.sentences
    .slice(0, 8)
    .map((s) => {
      const label = `<span class="ptitle">[${esc(s.title)}…]</span> ${esc(s.sentence.slice(0, 220))}`;
      return `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${label}</a>` : label}</li>`;
    })
    .join("");

  const topAuthors = a.topAuthors
    .slice(0, 10)
    .map((x) => `<li>${esc(x.label)} <span class="muted">(${x.value})</span></li>`)
    .join("");

  const topSources = a.topSources
    .slice(0, 8)
    .map((x) => `<li>${esc(x.label)} <span class="muted">(${x.value})</span></li>`)
    .join("");

  const best = a.recommendations[0];

  const v = a.venn;
  const [vA, vB, vC] = v.sets;
  const vennRows = [
    [`Hanya ${vA}`, v.onlyA],
    [`Hanya ${vB ?? "—"}`, v.onlyB],
    [`Hanya ${vC ?? "—"}`, v.onlyC],
    [`${vA} ∩ ${vB ?? "—"}`, v.ab],
    [`${vA} ∩ ${vC ?? "—"}`, v.ac],
    [`${vB ?? "—"} ∩ ${vC ?? "—"}`, v.bc],
    [`${vA} ∩ ${vB ?? "—"} ∩ ${vC ?? "—"}`, v.abc],
  ]
    .map(([lab, n]) => `<tr><td>${esc(String(lab))}</td><td class="num">${n}</td></tr>`)
    .join("");

  const titleFitRows = a.titleFit
    .map((f) => {
      const chip = (on: boolean, w: string) =>
        `<span style="font-size:11px;border-radius:9px;padding:1px 7px;border:1px solid ${on ? "#86efac" : "#e2e8f0"};color:${on ? "#15803d" : "#94a3b8"};${on ? "" : "text-decoration:line-through;"}">${on ? "✓ " : ""}${esc(w)}</span>`;
      return `<tr><td>${esc(f.combo)}</td><td>${chip(f.kaInTitle, f.ka)} ${f.kb ? chip(f.kbInTitle, f.kb) : ""}</td><td class="num">${f.recScore}</td><td class="num">${f.titleFitPct}%</td></tr>`;
    })
    .join("");
  const bestFit = [...a.titleFit].sort((x, y) => y.titleFitPct - x.titleFitPct || y.recScore - x.recScore)[0];
  const noneAligned = a.titleFit.every((f) => f.titleFitPct === 0);

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Critical Review — ${esc(meta.judul || meta.filename)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#0f172a; background:#f8fafc; margin:0; padding:0; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 28px 80px; }
  .hero { background: linear-gradient(135deg,#4f46e5,#7c3aed 55%,#db2777); color:#fff; border-radius: 22px; padding: 34px 32px; box-shadow: 0 20px 45px -20px rgba(79,70,229,.6); }
  .hero .kicker { text-transform: uppercase; letter-spacing: .18em; font-size: 12px; opacity:.85; margin:0 0 10px; }
  .hero h1 { margin: 0 0 6px; font-size: 26px; line-height: 1.2; }
  .hero p { margin: 4px 0 0; opacity:.9; font-size: 14px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap:14px; margin:22px 0; }
  .stat { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:16px 18px; }
  .stat .v { font-size:24px; font-weight:700; }
  .stat .l { font-size:12px; color:#64748b; margin-top:2px; }
  .novelty { display:flex; align-items:center; gap:20px; background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:22px 24px; margin:18px 0; }
  .ring { --v:0; width:104px; height:104px; border-radius:50%; background: conic-gradient(${noveltyColor} calc(var(--v)*1%), #eef2ff 0); display:grid; place-items:center; flex:none; }
  .ring b { background:#fff; width:78px; height:78px; border-radius:50%; display:grid; place-items:center; font-size:22px; color:${noveltyColor}; }
  section { background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:22px 24px; margin:18px 0; }
  section h2 { font-size:17px; margin:0 0 4px; }
  section .hint { font-size:12.5px; color:#64748b; margin:0 0 14px; }
  table { width:100%; border-collapse: collapse; font-size:13.5px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #eef2f7; }
  th { color:#475569; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  td.num { text-align:right; font-variant-numeric: tabular-nums; }
  .bar { background:#eef2ff; border-radius:6px; height:8px; width:120px; overflow:hidden; }
  .bar span { display:block; height:100%; background: linear-gradient(90deg,#6366f1,#a855f7); }
  ul { margin:6px 0 0; padding-left:18px; }
  li { margin:6px 0; font-size:13.5px; }
  .ptitle { color:#6366f1; font-weight:600; }
  section a { color: inherit; text-decoration: none; }
  section a:hover { text-decoration: underline; }
  section a:hover .ptitle { text-decoration: underline; }
  .muted { color:#94a3b8; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
  .warn { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; border-radius:12px; padding:12px 14px; font-size:13px; margin-top:12px; }
  .foot { color:#94a3b8; font-size:12px; text-align:center; margin-top:30px; line-height:1.6; }
  @media (max-width:640px){ .cols{grid-template-columns:1fr;} }
  @media print {
    body { background:#fff; }
    .wrap { padding: 8px 0 0; max-width: 100%; }
    section, .novelty, .hero { break-inside: avoid; page-break-inside: avoid; }
    .foot { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <p class="kicker">Laporan Critical Review Literatur</p>
    <h1>${esc(meta.judul || "(tanpa judul)")}</h1>
    <p>Topik: ${esc(meta.topik || "—")}</p>
    <p>Disiapkan untuk ${esc(meta.name)} &lt;${esc(meta.email)}&gt; • ${esc(meta.generatedAt)}</p>
    <p>Sumber: ${esc(meta.filename)} • Keyword: ${esc(meta.keywords.join(", "))}</p>
  </div>

  <div class="grid">
    <div class="stat"><div class="v">${q.total}</div><div class="l">Total referensi</div></div>
    <div class="stat"><div class="v">${a.matchedCount}</div><div class="l">Relevan (≥1 keyword)</div></div>
    <div class="stat"><div class="v">${q.withAbstract}</div><div class="l">Punya abstrak</div></div>
    <div class="stat"><div class="v">${q.withKeywords}</div><div class="l">Punya field KW</div></div>
    <div class="stat"><div class="v">${q.yearMin ?? "—"}–${q.yearMax ?? "—"}</div><div class="l">Rentang tahun</div></div>
  </div>

  <div class="novelty">
    <div class="ring" style="--v:${a.novelty.score}"><b>${a.novelty.score}</b></div>
    <div>
      <h2 style="margin:0 0 6px;">Novelty Score (heuristik): ${a.novelty.score} / 100</h2>
      <p class="hint" style="margin:0;">Referensi yang menggabungkan SEMUA ${meta.keywords.length} keyword: <b>${a.novelty.nAll}</b>. Skor tinggi = kombinasi keyword jarang muncul bersama (cenderung lebih baru).</p>
    </div>
  </div>

  <section>
    <h2>Rincian Novelty Score</h2>
    <p class="hint">Bobot dipilih manual. Gunakan untuk membandingkan alternatif keyword, bukan klaim ilmiah baku.</p>
    <table><thead><tr><th>Komponen</th><th class="num">Nilai 0–1</th><th class="num">Bobot</th><th class="num">Kontribusi</th></tr></thead><tbody>${noveltyRows}</tbody></table>
  </section>

  <section>
    <h2>Rekomendasi Kombinasi Topik</h2>
    <p class="hint">Skor tinggi = pasangan keyword jarang digabung namun sedang naik daun (kandidat celah riset).</p>
    <table><thead><tr><th>Kombinasi</th><th class="num">Co-occurrence</th><th class="num">Emerging</th><th class="num">Skor</th></tr></thead><tbody>${recRows}</tbody></table>
    ${best ? `<div class="warn">Arah paling menjanjikan: <b>${esc(best.combo)}</b> (co-occurrence=${best.cooccurrence}, skor=${best.score}). Validasi dengan membaca paper aktual.</div>` : ""}
  </section>

  <section>
    <h2>Domain yang Beririsan (Venn)</h2>
    <p class="hint">3 domain tersering: ${esc(v.sets.join(", "))}. Jumlah referensi per wilayah irisan.</p>
    <table><thead><tr><th>Wilayah</th><th class="num">Referensi</th></tr></thead><tbody>${vennRows}</tbody></table>
    <div class="warn" style="background:#ecfdf5;border-color:#a7f3d0;color:#065f46;">Rekomendasi: ${esc(v.recommendation)}</div>
  </section>

  <section>
    <h2>Kesesuaian Judul dengan Rekomendasi</h2>
    <p class="hint">Seberapa banyak kata dari tiap kombinasi rekomendasi sudah tercermin di judul Anda.</p>
    <table><thead><tr><th>Kombinasi</th><th>Kata di judul</th><th class="num">Skor rekom</th><th class="num">Kesesuaian</th></tr></thead><tbody>${titleFitRows}</tbody></table>
    ${
      bestFit
        ? `<div class="warn">${
            noneAligned
              ? `Belum ada kombinasi teratas yang katanya muncul di judul. Pertimbangkan menyisipkan kata kunci menjanjikan (mis. <b>${esc(best?.combo || "")}</b>) ke judul.`
              : `Judul paling selaras dengan <b>${esc(bestFit.combo)}</b> (${bestFit.titleFitPct}% kata cocok, skor ${bestFit.recScore}).`
          }</div>`
        : ""
    }
  </section>

  <section>
    <h2>Keyword Strength</h2>
    <p class="hint">Seberapa mapan/ramai keyword di korpus — strength tinggi = topik padat (cenderung kurang novel).</p>
    <table><thead><tr><th>Keyword</th><th class="num">Dokumen</th><th class="num">Total muncul</th><th class="num">Share</th><th class="num">Strength</th></tr></thead><tbody>${strengthRows}</tbody></table>
  </section>

  <section>
    <h2>Peluang Riset — pasangan keyword paling jarang digabung</h2>
    <ul>${rarePairs || "<li class='muted'>Tidak ada.</li>"}</ul>
  </section>

  <section>
    <h2>Identifikasi Masalah / Gap</h2>
    <p class="hint">${a.problem.totalSentences} kalimat berpenanda masalah terdeteksi (berbasis kata kunci, bukan pemahaman).</p>
    <div class="cols">
      <div>
        <h3 style="font-size:14px;margin:0 0 6px;">Penanda tersering</h3>
        <table><tbody>${cueRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
      </div>
      <div>
        <h3 style="font-size:14px;margin:0 0 6px;">Contoh kalimat memuat research gap</h3>
        <ul>${problemSentences || "<li class='muted'>Abstrak kosong.</li>"}</ul>
      </div>
    </div>
  </section>

  <section class="cols">
    <div>
      <h2>Penulis Produktif</h2>
      <ul>${topAuthors || "<li class='muted'>—</li>"}</ul>
    </div>
    <div>
      <h2>Sumber / Jurnal Teratas</h2>
      <ul>${topSources || "<li class='muted'>—</li>"}</ul>
    </div>
  </section>

  <p class="foot">
    Seluruh rekomendasi adalah TITIK AWAL, bukan kesimpulan. Analisis ini memakai pencocokan kata kunci —
    homonim/sinonim tidak ditangani, dan Novelty Score bukan metrik bibliometrik standar.<br/>
    Dihasilkan oleh Critical Review RIS • Inboxed Digital Press
  </p>
</div>
</body>
</html>`;
}
