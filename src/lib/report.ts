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

  const noveltyRows = a.novelty.factors
    .map(
      (c) =>
        `<tr><td><b>${esc(c.name)}</b>${c.direction !== "netral" ? ` <span style="font-size:10px;color:${c.direction === "naik" ? "#16a34a" : "#dc2626"};">${c.direction === "naik" ? "↑" : "↓"} novelty</span>` : ""}<div style="font-size:11px;color:#64748b;">${esc(c.measures)}<br/>${esc(c.detail)} → <span style="color:#6366f1;">${esc(c.interpretation)}</span></div></td><td class="num">${c.value}</td><td class="num">${c.weight}</td><td class="num">${c.contribution}</td></tr>`
    )
    .join("");

  const noveltyFormula = a.novelty.factors.map((c) => `${c.weight}×${c.value}`).join(" + ");

  const explanationItems = a.novelty.explanations.map((e) => `<li>${esc(e)}</li>`).join("");
  const confReasons = a.novelty.confidence.reasons.map((r) => `<li>${esc(r)}</li>`).join("");
  const sensRows = a.novelty.sensitivity
    .map((s) => {
      const col = s.delta > 0 ? "#16a34a" : s.delta < 0 ? "#dc2626" : "#64748b";
      return `<tr><td>${esc(s.keyword)}</td><td class="num">${a.novelty.score} → ${s.scoreWithout}</td><td class="num" style="color:${col};font-weight:600;">${s.delta > 0 ? "+" : ""}${s.delta}</td></tr>`;
    })
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

  // Advanced gap analysis
  const gaps = a.gaps;
  const gapClassRows = gaps.classification
    .map((g) => `<tr><td>${esc(g.name)}</td><td>${"★".repeat(g.stars)}${"☆".repeat(5 - g.stars)}</td><td class="num">${g.count}</td></tr>`)
    .join("");
  const evList = (items: { title: string; sentence: string; url: string }[]) =>
    items.map((e) => `<li>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">` : ""}“${esc(e.sentence)}” — ${esc(e.title)}…${e.url ? "</a>" : ""}</li>`).join("");
  const gapEvItems = evList(gaps.gapEvidence.items);
  const futureWorkItems = evList(gaps.future.futureWork.items);
  const limitationItems = evList(gaps.future.limitations.items);
  const recommendationItems = evList(gaps.future.recommendations.items);
  const ctr = gaps.contradiction;

  // Advanced novelty (Section 4)
  const nx = a.noveltyExtra;
  const dimRows = nx.dimensions.map((d) => `<tr><td>${esc(d.name)}</td><td class="num">${d.score}</td><td class="num">${d.count}</td></tr>`).join("");
  const simRows = nx.similar.map((s) => `<tr><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${s.year ? ` (${s.year})` : ""}</td><td class="num">${s.similarity}%</td></tr>`).join("");
  const wsRows = nx.whiteSpace.map((w) => `<tr><td>${esc(w.a)} × ${esc(w.b)}</td><td class="num">${w.aFreq}·${w.bFreq}</td><td class="num">${w.score}</td></tr>`).join("");

  // Research design (Section 5)
  const dz = a.design;
  const titleItems = dz.titles.slice(0, 20).map((t, i) => `<li>${esc(t.text)} <span style="color:#94a3b8;">(${t.score})</span></li>`).join("");
  const rqItems = dz.questions.map((q) => `<li>${esc(q.text)} <span style="color:#94a3b8;">(${q.score})</span></li>`).join("");
  const hypItems = dz.hypotheses.map((h) => `<li>${esc(h.text)} <span style="color:#94a3b8;">(${h.score})</span></li>`).join("");
  const varCell = (vs: { name: string; score: number }[]) => vs.map((v) => `${esc(v.name)} (${v.score})`).join(", ");
  const methodRows = dz.methods.map((m) => `<tr><td>${esc(m.name)}</td><td class="num">${m.score}</td><td>${esc(m.reason)}</td></tr>`).join("");
  const dsRows = dz.datasets.map((d) => `<tr><td>${esc(d.name)}</td><td class="num">${d.score}</td><td>${esc(d.reason)}</td></tr>`).join("");
  const fw = dz.framework;
  const fwText = `${esc(fw.independent.join(", ") || "—")} → ${fw.mediator ? esc(fw.mediator) + " → " : ""}${esc(fw.dependent)}${fw.moderator ? ` (dimoderasi ${esc(fw.moderator)})` : ""}`;

  // Literature Intelligence (Section 6)
  const li = a.litIntel;
  const landmarkRows = li.landmarks.map((p, i) => `<tr><td>${i + 1}. ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title.slice(0, 80))}</a>` : esc(p.title.slice(0, 80))}${p.year ? ` (${p.year})` : ""}</td><td class="num">${p.citations != null ? p.citations : p.score}</td></tr>`).join("");
  const authorRows = li.authors.map((x, i) => `<tr><td>${i + 1}. ${esc(x.name)}</td><td class="num">${x.papers}</td><td class="num">${x.citations != null ? x.citations : "—"}</td></tr>`).join("");
  const instRows = li.institutions.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.count}</td></tr>`).join("");
  const countryRows = li.countries.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.count}</td></tr>`).join("");
  const dirItems = li.emergingDirections.map((d) => `<li>${esc(d)}</li>`).join("");

  // Keyword dynamics
  const dyn = a.dynamics;
  const evoFlow = dyn.evolution
    .map((s) => `<b>${esc(s.label)}</b>: ${s.emerged.map((e) => (e.isNew ? "<u>" + esc(e.term) + "</u>" : esc(e.term)).toString()).join(", ") || "—"}`)
    .join(" &nbsp;→&nbsp; ");
  const momLabel = (m: { growthPct: number | null; direction: string }) =>
    m.growthPct === null ? "BARU" : `${m.growthPct > 0 ? "+" : ""}${m.growthPct}%`;
  const momColor = (d: string) => (d === "up" ? "#16a34a" : d === "down" ? "#dc2626" : "#64748b");
  const userMomItems = dyn.userMomentum
    .map((m) => `<li>${esc(m.term)} <span style="color:#94a3b8;">(${m.fprev}→${m.ft})</span> — <b style="color:${momColor(m.direction)};">${momLabel(m)}</b></li>`)
    .join("");
  const candItems = dyn.candidates
    .map((m) => `<li><i>${esc(m.term)}</i> <span style="color:#94a3b8;">(${m.fprev}→${m.ft})</span> — <b style="color:${momColor(m.direction)};">${momLabel(m)}</b></li>`)
    .join("");
  const momCaption = dyn.yearT != null && dyn.yearPrev != null ? `Year-over-year (Fₜ − Fₜ₋₁)/Fₜ₋₁ × 100, t=${dyn.yearT}, t−1=${dyn.yearPrev}.` : "";
  const centralityRows = dyn.centrality
    .slice(0, 10)
    .map((c) => `<tr><td>${esc(c.term)}</td><td class="num">${c.degree}</td><td class="num">${c.betweenness}</td><td class="num">${c.eigenvector}</td></tr>`)
    .join("");
  const quadGroups = ["Motor", "Basic", "Niche", "Emerging/Declining"]
    .map((q) => {
      const terms = dyn.thematic.filter((t) => t.quadrant === q).map((t) => esc(t.term));
      return `<tr><td><b>${q}</b></td><td>${terms.join(", ") || "—"}</td></tr>`;
    })
    .join("");

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
      <h2 style="margin:0 0 6px;">Novelty Score (heuristik): ${a.novelty.score} / 100 — <span style="color:${noveltyColor};">${esc(a.novelty.level)}</span></h2>
      <p class="hint" style="margin:0 0 4px;">${esc(a.novelty.levelHint)}</p>
      <p class="hint" style="margin:0;">${a.novelty.nAll} dari ${a.novelty.totalRefs} referensi memuat SEMUA ${a.novelty.keywordCount} keyword • ${a.novelty.zeroPairs}/${a.novelty.totalPairs} pasangan belum digabung • rata-rata emerging ${a.novelty.emergingMean >= 0 ? "+" : ""}${a.novelty.emergingMean}.</p>
    </div>
  </div>

  <section>
    <h2>Rincian Novelty Score — Kontributor Skor</h2>
    <p class="hint">Rumus: Skor = 100 × (${noveltyFormula}) = <b>${a.novelty.score}</b>. Bobot dipilih manual — untuk membandingkan alternatif keyword, bukan klaim ilmiah baku.</p>
    <table><thead><tr><th>Faktor &amp; makna</th><th class="num">Nilai 0–1</th><th class="num">Bobot</th><th class="num">Kontribusi</th></tr></thead><tbody>${noveltyRows}</tbody></table>
  </section>

  <section>
    <h2>Kenapa Skornya Segini? (Explainability)</h2>
    <p class="hint">Tiga alasan paling menentukan skor.</p>
    <ol style="margin:6px 0 0; padding-left:18px;">${explanationItems}</ol>
  </section>

  <section>
    <h2>Confidence Score: ${a.novelty.confidence.percent}% (${esc(a.novelty.confidence.level)})</h2>
    <p class="hint">Seberapa layak skor ini dipercaya — dipengaruhi jumlah &amp; cakupan data. Novelty sangat dipengaruhi jumlah data.</p>
    <ul>${confReasons}</ul>
  </section>

  ${
    a.novelty.sensitivity.length
      ? `<section>
    <h2>Sensitivity Analysis</h2>
    <p class="hint">Perubahan Novelty Score bila satu keyword dihapus. Δ negatif = keyword menambah kebaruan; Δ positif = menekan kebaruan.</p>
    <table><thead><tr><th>Keyword dihapus</th><th class="num">Skor</th><th class="num">Δ</th></tr></thead><tbody>${sensRows}</tbody></table>
  </section>`
      : ""
  }

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
    <h2>Novelty Dimension &amp; Innovation Radar</h2>
    <p class="hint">Dari mana potensi kebaruan berasal (0–100). ${esc(nx.radarInsight)}</p>
    <table><thead><tr><th>Dimensi</th><th class="num">Skor</th><th class="num">Paper</th></tr></thead><tbody>${dimRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
  </section>

  <section>
    <h2>Similarity Against Existing Research</h2>
    <p class="hint">Kemiripan judul + keyword Anda dengan paper yang ada.</p>
    <table><thead><tr><th>Paper</th><th class="num">Kemiripan</th></tr></thead><tbody>${simRows || "<tr><td class='muted'>Isi judul untuk menghitung.</td></tr>"}</tbody></table>
  </section>

  <section>
    <h2>White Space Analysis</h2>
    <p class="hint">Area kosong: keyword belum tersentuh & pasangan yang keduanya ramai tapi belum digabung.</p>
    ${nx.untouched.length ? `<p style="font-size:13px;">Keyword belum tersentuh di korpus: <b>${esc(nx.untouched.join(", "))}</b>.</p>` : ""}
    <table><thead><tr><th>Kombinasi belum digabung</th><th class="num">Paper (a·b)</th><th class="num">Skor</th></tr></thead><tbody>${wsRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
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

  <section>
    <h2>Gap Classification</h2>
    <p class="hint">Jenis gap yang tersirat di abstrak paper relevan; bintang = severity (banyaknya paper).</p>
    <table><thead><tr><th>Jenis gap</th><th>Severity</th><th class="num">Paper</th></tr></thead><tbody>${gapClassRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
  </section>

  <section>
    <h2>Gap Evidence — pernyataan gap eksplisit (${gaps.gapEvidence.count} paper)</h2>
    <ul>${gapEvItems || "<li class='muted'>—</li>"}</ul>
  </section>

  <section>
    <h2>Future Research Extraction</h2>
    <div class="cols">
      <div><h3 style="font-size:14px;margin:0 0 4px;">Future Work (${gaps.future.futureWork.count})</h3><ul>${futureWorkItems || "<li class='muted'>—</li>"}</ul></div>
      <div><h3 style="font-size:14px;margin:0 0 4px;">Limitations (${gaps.future.limitations.count})</h3><ul>${limitationItems || "<li class='muted'>—</li>"}</ul></div>
    </div>
    <h3 style="font-size:14px;margin:12px 0 4px;">Recommendations (${gaps.future.recommendations.count})</h3>
    <ul>${recommendationItems || "<li class='muted'>—</li>"}</ul>
  </section>

  <section>
    <h2>Contradictory Findings — "${esc(ctr.topic)}"</h2>
    <p class="hint">Klaim positif: <b style="color:#16a34a;">${ctr.positiveCount} paper</b> · Klaim negatif: <b style="color:#dc2626;">${ctr.negativeCount} paper</b>.
    ${ctr.positiveCount >= 2 && ctr.negativeCount >= 2 ? "<b>⚑ Terindikasi research controversy.</b>" : ""}</p>
    ${ctr.negativeExamples.length ? `<ul>${evList(ctr.negativeExamples)}</ul>` : ""}
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

  <section>
    <h2>Dinamika Keyword</h2>
    <p class="hint">Berbasis keyword Anda (${esc(dyn.source)}). ${esc(momCaption)}</p>
    ${evoFlow ? `<p style="font-size:13px;"><b>Evolution (kumulatif, garis bawah = baru):</b> ${evoFlow}</p>` : ""}
    <div class="cols">
      <div>
        <h3 style="font-size:14px;margin:0 0 4px;">Momentum keyword Anda</h3>
        <ul>${userMomItems || "<li class='muted'>—</li>"}</ul>
      </div>
      <div>
        <h3 style="font-size:14px;margin:0 0 4px;">Kandidat lain (korpus)</h3>
        <ul>${candItems || "<li class='muted'>—</li>"}</ul>
      </div>
    </div>
    <h3 style="font-size:14px;margin:14px 0 4px;">Keyword Centrality</h3>
    <table><thead><tr><th>Keyword</th><th class="num">Degree</th><th class="num">Betweenness</th><th class="num">Eigenvector</th></tr></thead><tbody>${centralityRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
    <h3 style="font-size:14px;margin:14px 0 4px;">Thematic Map (Quadrant)</h3>
    <table><thead><tr><th>Kuadran</th><th>Keyword</th></tr></thead><tbody>${quadGroups}</tbody></table>
  </section>

  <section>
    <h2>Desain Penelitian — Rekomendasi</h2>
    <h3 style="font-size:14px;margin:8px 0 4px;">Top 20 Judul</h3>
    <ol style="margin:0; padding-left:18px; font-size:13px;">${titleItems}</ol>
    <div class="cols" style="margin-top:10px;">
      <div><h3 style="font-size:14px;margin:0 0 4px;">Research Question</h3><ol style="margin:0;padding-left:18px;font-size:13px;">${rqItems}</ol></div>
      <div><h3 style="font-size:14px;margin:0 0 4px;">Hipotesis</h3><ol style="margin:0;padding-left:18px;font-size:13px;">${hypItems}</ol></div>
    </div>
    <h3 style="font-size:14px;margin:12px 0 4px;">Variabel</h3>
    <table><tbody>
      <tr><td><b>Dependent</b></td><td>${varCell(dz.variables.dependent)}</td></tr>
      <tr><td><b>Independent</b></td><td>${varCell(dz.variables.independent)}</td></tr>
      <tr><td><b>Mediator</b></td><td>${varCell(dz.variables.mediator)}</td></tr>
      <tr><td><b>Moderator</b></td><td>${varCell(dz.variables.moderator)}</td></tr>
    </tbody></table>
    <p style="font-size:13px;margin-top:8px;"><b>Framework:</b> ${fwText}</p>
    <div class="cols" style="margin-top:8px;">
      <div><h3 style="font-size:14px;margin:0 0 4px;">Metode</h3><table><tbody>${methodRows}</tbody></table></div>
      <div><h3 style="font-size:14px;margin:0 0 4px;">Dataset</h3><table><tbody>${dsRows}</tbody></table></div>
    </div>
  </section>

  <section>
    <h2>Literature Intelligence</h2>
    <div class="warn" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3;">${esc(li.aiSummary)}</div>
    ${!li.hasCitations ? `<p class="hint">Data sitasi/afiliasi tidak tersedia di RIS ini — pengaruh & kolaborasi memakai proksi.</p>` : ""}
    <h3 style="font-size:14px;margin:10px 0 4px;">Paper Landmark / Highly Cited</h3>
    <table><thead><tr><th>Paper</th><th class="num">${li.hasCitations ? "Sitasi" : "Skor"}</th></tr></thead><tbody>${landmarkRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table>
    <div class="cols" style="margin-top:10px;">
      <div><h3 style="font-size:14px;margin:0 0 4px;">Influential Author</h3><table><thead><tr><th>Penulis</th><th class="num">Paper</th><th class="num">Sitasi</th></tr></thead><tbody>${authorRows || "<tr><td class='muted'>—</td></tr>"}</tbody></table></div>
      <div><h3 style="font-size:14px;margin:0 0 4px;">Institution</h3><table><tbody>${instRows || "<tr><td class='muted'>tidak tersedia</td></tr>"}</tbody></table></div>
    </div>
    <div class="cols" style="margin-top:10px;">
      <div><h3 style="font-size:14px;margin:0 0 4px;">Country</h3><table><tbody>${countryRows || "<tr><td class='muted'>tidak tersedia</td></tr>"}</tbody></table></div>
      <div>
        <h3 style="font-size:14px;margin:0 0 4px;">Frontier</h3><p style="font-size:13px;">${esc(li.frontier.join(", ") || "—")}</p>
        <h3 style="font-size:14px;margin:8px 0 4px;">Emerging Direction</h3><ul style="font-size:13px;margin:0;padding-left:18px;">${dirItems || "<li class='muted'>—</li>"}</ul>
      </div>
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
