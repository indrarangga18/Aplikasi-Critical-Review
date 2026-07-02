// Full analysis port of the "Critical Review RIS" notebook (steps 2–11).
// Pure functions — no rendering. Consumed by the dashboard components.

import type { RisRecord } from "./ris";
import { expandTerm } from "./terms";

// Penanda "masalah/gap" (Inggris + Indonesia). Bukan pemahaman makna, hanya isyarat.
export const PROBLEM_CUES = [
  "lack of", "challenge", "challenges", "problem", "problems",
  "limitation", "limitations", "gap", "gaps", "however", "difficult",
  "issue", "issues", "need for", "fail", "unable", "insufficient",
  "scarce", "under-explored", "underexplored", "not been",
  "remains unclear", "poorly understood",
  "masalah", "tantangan", "keterbatasan", "belum", "kurang",
  "sulit", "kesenjangan", "perlu",
];

// Minimal English stopword set for the TF-IDF fallback vocabulary.
const STOPWORDS = new Set(
  ("a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves").split(" ")
);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match a single surface form: word-boundary for words, substring for phrases. */
function matchOne(text: string, t: string): boolean {
  if (!t) return false;
  if (t.includes(" ") || t.includes("-")) return text.includes(t);
  return new RegExp("\\b" + escapeRegExp(t) + "\\b").test(text);
}

/** Synonym/bilingual-aware match: true if ANY equivalent surface form appears. */
export function containsTerm(text: string, term: string): boolean {
  return expandTerm(term).some((v) => matchOne(text, v));
}

function countOne(text: string, t: string): number {
  if (!t) return 0;
  if (t.includes(" ") || t.includes("-")) {
    let n = 0;
    let idx = 0;
    while ((idx = text.indexOf(t, idx)) !== -1) {
      n++;
      idx += t.length;
    }
    return n;
  }
  const m = text.match(new RegExp("\\b" + escapeRegExp(t) + "\\b", "g"));
  return m ? m.length : 0;
}

export function totalOccurrences(records: RisRecord[], term: string): number {
  const variants = expandTerm(term);
  let n = 0;
  for (const r of records) {
    for (const v of variants) n += countOne(r.searchable, v);
  }
  return n;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function counter<T extends string>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return m;
}

function mostCommon<T extends string>(map: Map<T, number>, n: number): [T, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------- Data quality (step 2) ----------
export interface Quality {
  total: number;
  withAbstract: number;
  withKeywords: number;
  yearMin: number | null;
  yearMax: number | null;
  warnAbstract: boolean;
  warnKeywords: boolean;
}

export function dataQuality(records: RisRecord[]): Quality {
  const total = records.length;
  const withAbstract = records.filter((r) => r.abstract.length > 0).length;
  const withKeywords = records.filter((r) => r.keywords.length > 0).length;
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  return {
    total,
    withAbstract,
    withKeywords,
    yearMin: years.length ? Math.min(...years) : null,
    yearMax: years.length ? Math.max(...years) : null,
    warnAbstract: total > 0 && withAbstract / total < 0.5,
    warnKeywords: total > 0 && withKeywords / total < 0.5,
  };
}

// ---------- Keyword match + bibliometrics (steps 4–5) ----------
export interface KeywordCount {
  keyword: string;
  docFreq: number;
}

export function keywordCounts(records: RisRecord[], keywords: string[]): KeywordCount[] {
  return keywords.map((kw) => ({
    keyword: kw,
    docFreq: records.filter((r) => containsTerm(r.searchable, kw)).length,
  }));
}

export function matchedRecords(records: RisRecord[], keywords: string[]): RisRecord[] {
  return records.filter((r) => keywords.some((kw) => containsTerm(r.searchable, kw)));
}

export interface CountPair {
  label: string;
  value: number;
}

export function publicationsPerYear(records: RisRecord[]): CountPair[] {
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  const c = counter(years.map(String));
  return [...c.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export function relevantPerYear(matched: RisRecord[]): CountPair[] {
  return publicationsPerYear(matched);
}

export function topAuthors(records: RisRecord[], n = 15): CountPair[] {
  const all = records.flatMap((r) => r.authors);
  return mostCommon(counter(all), n).map(([label, value]) => ({ label, value }));
}

export function topSources(records: RisRecord[], n = 15): CountPair[] {
  const srcs = records.map((r) => r.source).filter((s) => s.length > 0);
  return mostCommon(counter(srcs), n).map(([label, value]) => ({ label, value }));
}

export interface RefLink {
  title: string;
  year: number | null;
  url: string;
  source: string;
}

export interface GroupWithRefs {
  name: string;
  count: number;
  refs: RefLink[];
}

/** Group references by author, each with its list of papers (for drill-down). */
export function authorsWithRefs(records: RisRecord[], n = 12): GroupWithRefs[] {
  const map = new Map<string, RefLink[]>();
  for (const r of records) {
    const link: RefLink = { title: r.title || "(tanpa judul)", year: r.year, url: paperUrl(r), source: r.source };
    for (const au of r.authors) {
      const name = au.trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(link);
    }
  }
  return [...map.entries()]
    .map(([name, refs]) => ({ name, count: refs.length, refs }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Group references by source/journal, each with its list of papers. */
export function sourcesWithRefs(records: RisRecord[], n = 12): GroupWithRefs[] {
  const map = new Map<string, RefLink[]>();
  for (const r of records) {
    const src = r.source.trim();
    if (!src) continue;
    const link: RefLink = { title: r.title || "(tanpa judul)", year: r.year, url: paperUrl(r), source: src };
    if (!map.has(src)) map.set(src, []);
    map.get(src)!.push(link);
  }
  return [...map.entries()]
    .map(([name, refs]) => ({ name, count: refs.length, refs }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function topCorpusKeywords(records: RisRecord[], n = 20): CountPair[] {
  const all = records.flatMap((r) => r.keywords);
  return mostCommon(counter(all), n).map(([label, value]) => ({ label, value }));
}

/** Word-cloud data: uses the KW field when present, else falls back to
 *  the most frequent meaningful words from titles + abstracts. */
export interface CloudResult {
  terms: CountPair[];
  source: string;
}

export function keywordCloud(records: RisRecord[], n = 30): CloudResult {
  const corpusKw = records.flatMap((r) => r.keywords);
  if (corpusKw.length >= 12) {
    return {
      terms: mostCommon(counter(corpusKw), n).map(([label, value]) => ({ label, value })),
      source: "field KW korpus",
    };
  }
  // Fallback: unigram frequency from title + abstract, stopwords removed.
  const words: string[] = [];
  for (const r of records) {
    const toks = (r.title + " " + r.abstract)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    words.push(...toks);
  }
  return {
    terms: mostCommon(counter(words), n).map(([label, value]) => ({ label, value })),
    source: "kata terpenting judul + abstrak (field KW kosong)",
  };
}

// ---------- Keyword strength (step 6) ----------
export interface StrengthRow {
  keyword: string;
  docFreq: number;
  totalOcc: number;
  docSharePct: number;
  strengthScore: number;
}

export function keywordStrength(records: RisRecord[], keywords: string[]): StrengthRow[] {
  const counts = keywordCounts(records, keywords);
  const maxdf = Math.max(...counts.map((c) => c.docFreq), 1);
  const rows = counts.map((c) => ({
    keyword: c.keyword,
    docFreq: c.docFreq,
    totalOcc: totalOccurrences(records, c.keyword),
    docSharePct: records.length ? +(c.docFreq / records.length * 100).toFixed(1) : 0,
    strengthScore: +(c.docFreq / maxdf * 100).toFixed(1),
  }));
  return rows.sort((a, b) => b.strengthScore - a.strengthScore);
}

// ---------- Problem identification (step 7) ----------
export interface ProblemSentence {
  title: string;
  sentence: string;
  url: string;
}

export interface ProblemResult {
  sentences: ProblemSentence[];
  cueCounts: CountPair[];
  totalSentences: number;
}

/** Link to the source paper: DOI when available, else a Google Scholar title search. */
function paperUrl(row: RisRecord): string {
  const doi = row.doi.trim();
  if (doi) return doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
  if (row.title) return `https://scholar.google.com/scholar?q=${encodeURIComponent(row.title)}`;
  return "";
}

export function problemIdentification(matched: RisRecord[]): ProblemResult {
  const cueCounter = new Map<string, number>();
  const sentences: ProblemSentence[] = [];
  for (const row of matched) {
    const url = paperUrl(row);
    for (const sent of splitSentences(row.abstract)) {
      const low = sent.toLowerCase();
      const hits = PROBLEM_CUES.filter((c) => low.includes(c));
      if (hits.length) {
        for (const c of hits) cueCounter.set(c, (cueCounter.get(c) || 0) + 1);
        sentences.push({ title: row.title.slice(0, 55), sentence: sent, url });
      }
    }
  }
  return {
    sentences,
    cueCounts: mostCommon(cueCounter, 15).map(([label, value]) => ({ label, value })),
    totalSentences: sentences.length,
  };
}

// ---------- Co-occurrence (step 8) ----------
export interface CoocResult {
  vocab: string[];
  matrix: number[][];
  vocabSource: string;
  edges: { source: string; target: string; weight: number }[];
}

function tfidfVocab(records: RisRecord[], maxFeatures = 15): string[] {
  // Lightweight TF-IDF over unigrams + bigrams, English stopwords removed.
  const docTerms: string[][] = records.map((r) => {
    const toks = r.searchable
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    const grams: string[] = [...toks];
    for (let i = 0; i < toks.length - 1; i++) grams.push(toks[i] + " " + toks[i + 1]);
    return grams;
  });
  const df = new Map<string, number>();
  for (const terms of docTerms) {
    for (const t of new Set(terms)) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = records.length || 1;
  const score = new Map<string, number>();
  for (const terms of docTerms) {
    const tf = counter(terms);
    for (const [t, f] of tf) {
      const idf = Math.log((1 + N) / (1 + (df.get(t) || 0))) + 1;
      score.set(t, Math.max(score.get(t) || 0, f * idf));
    }
  }
  return mostCommon(score as Map<string, number>, maxFeatures).map(([t]) => t);
}

export function cooccurrence(records: RisRecord[]): CoocResult {
  const corpusKw = records.flatMap((r) => r.keywords);
  let vocab: string[];
  let vocabSource: string;
  if (corpusKw.length >= 20) {
    vocab = mostCommon(counter(corpusKw), 15).map(([t]) => t);
    vocabSource = "field KW korpus";
  } else {
    vocab = tfidfVocab(records, 15);
    vocabSource = "TF-IDF judul+abstrak";
  }

  const P = records.map((r) => vocab.map((term) => (containsTerm(r.searchable, term) ? 1 : 0)));
  const V = vocab.length;
  const matrix: number[][] = Array.from({ length: V }, () => new Array(V).fill(0));
  for (const row of P) {
    for (let a = 0; a < V; a++) {
      if (!row[a]) continue;
      for (let b = 0; b < V; b++) {
        if (a !== b && row[b]) matrix[a][b] += 1;
      }
    }
  }

  const edges: { source: string; target: string; weight: number }[] = [];
  for (let a = 0; a < V; a++) {
    for (let b = a + 1; b < V; b++) {
      if (matrix[a][b] > 0) edges.push({ source: vocab[a], target: vocab[b], weight: matrix[a][b] });
    }
  }
  return { vocab, matrix, vocabSource, edges };
}

// ---------- Research opportunity (step 9) ----------
export interface OpportunityResult {
  keywords: string[];
  matrix: number[][];
  rarePairs: { a: string; b: string; count: number }[];
  emerging: { keyword: string; value: number }[];
}

export function userCoocMatrix(records: RisRecord[], keywords: string[]): number[][] {
  const U = records.map((r) => keywords.map((kw) => (containsTerm(r.searchable, kw) ? 1 : 0)));
  const K = keywords.length;
  const m: number[][] = Array.from({ length: K }, () => new Array(K).fill(0));
  for (const row of U) {
    for (let a = 0; a < K; a++) {
      if (!row[a]) continue;
      for (let b = 0; b < K; b++) if (a !== b && row[b]) m[a][b] += 1;
    }
  }
  return m;
}

export function emergingScore(records: RisRecord[], term: string): number {
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  if (!years.length) return 0;
  const maxY = Math.max(...years);
  let cut = maxY - 2;
  let recent = records.filter((r) => r.year != null && r.year >= cut);
  let older = records.filter((r) => r.year != null && r.year < cut);
  if (!recent.length || !older.length) {
    const sorted = [...years].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    recent = records.filter((r) => r.year != null && r.year >= med);
    older = records.filter((r) => r.year != null && r.year < med);
    if (!recent.length || !older.length) return 0;
  }
  const mean = (arr: RisRecord[]) =>
    arr.reduce((acc, r) => acc + (containsTerm(r.searchable, term) ? 1 : 0), 0) / arr.length;
  return mean(recent) - mean(older);
}

export function researchOpportunity(records: RisRecord[], keywords: string[]): OpportunityResult {
  const matrix = userCoocMatrix(records, keywords);
  const pairs: { a: string; b: string; count: number }[] = [];
  for (let a = 0; a < keywords.length; a++) {
    for (let b = a + 1; b < keywords.length; b++) {
      pairs.push({ a: keywords[a], b: keywords[b], count: matrix[a][b] });
    }
  }
  pairs.sort((x, y) => x.count - y.count);
  const emerging = keywords
    .map((k) => ({ keyword: k, value: +emergingScore(records, k).toFixed(3) }))
    .sort((a, b) => b.value - a.value);
  return { keywords, matrix, rarePairs: pairs.slice(0, 8), emerging };
}

// ---------- Novelty score (step 10) ----------
export interface NoveltyComponent {
  name: string;
  measures: string; // apa yang diukur (satu baris)
  value: number; // 0–1 (nilai ternormalisasi)
  weight: number;
  contribution: number; // poin ke skor akhir
  detail: string; // angka mentah di baliknya
  interpretation: string; // arti nilai ini
}

export interface NoveltyResult {
  score: number;
  level: string; // Rendah / Sedang / Tinggi
  levelHint: string;
  components: NoveltyComponent[];
  nAll: number;
  totalRefs: number;
  totalPairs: number;
  zeroPairs: number;
  emergingMean: number;
  keywordCount: number;
}

const W = { rarity: 0.4, pairGap: 0.35, emerging: 0.25 };

export function noveltyScore(records: RisRecord[], keywords: string[]): NoveltyResult {
  const total = records.length || 1;
  const K = keywords.length;
  const U: number[][] = records.map((r) => keywords.map((kw) => (containsTerm(r.searchable, kw) ? 1 : 0)));
  const nAll = U.filter((row) => row.reduce((a, b) => a + b, 0) === K).length;
  const matrix = userCoocMatrix(records, keywords);
  const totalPairs = (K * (K - 1)) / 2;
  let zeroPairs = 0;
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) if (matrix[a][b] === 0) zeroPairs++;

  const rarity = Math.min(Math.max(1 - nAll / total, 0), 1);
  const pairGap = totalPairs ? zeroPairs / totalPairs : 0;
  const emergingMean = Math.max(
    -1,
    Math.min(1, keywords.reduce((a, k) => a + emergingScore(records, k), 0) / (K || 1))
  );
  const emergingNorm = (emergingMean + 1) / 2;

  const score = +(100 * (W.rarity * rarity + W.pairGap * pairGap + W.emerging * emergingNorm)).toFixed(1);

  const level = score >= 66 ? "Tinggi" : score >= 40 ? "Sedang" : "Rendah";
  const levelHint =
    level === "Tinggi"
      ? "Kombinasi keyword ini relatif jarang & sedang naik daun — indikasi kuat ada ruang kebaruan. Tetap validasi dengan membaca paper."
      : level === "Sedang"
      ? "Ada sebagian ruang kebaruan, tapi sebagian kombinasi sudah cukup ramai. Pertimbangkan pertajam sudut pandang."
      : "Kombinasi keyword ini sudah banyak diteliti bersama. Untuk kebaruan, coba ganti/tambah keyword yang lebih spesifik atau lintas-bidang.";

  const components: NoveltyComponent[] = [
    {
      name: "Kelangkaan kombinasi",
      measures: "Seberapa sedikit referensi yang memuat SEMUA keyword sekaligus.",
      value: +rarity.toFixed(3),
      weight: W.rarity,
      contribution: +(rarity * W.rarity * 100).toFixed(1),
      detail: `${nAll} dari ${total} referensi (${(nAll / total * 100).toFixed(1)}%) memuat seluruh ${K} keyword.`,
      interpretation:
        rarity >= 0.8
          ? "Sangat langka → kuat mendukung kebaruan."
          : rarity >= 0.5
          ? "Cukup langka → mendukung kebaruan."
          : "Kombinasi sudah umum → menurunkan kebaruan.",
    },
    {
      name: "Pasangan belum diteliti",
      measures: "Berapa banyak pasangan keyword yang belum pernah muncul bersama.",
      value: +pairGap.toFixed(3),
      weight: W.pairGap,
      contribution: +(pairGap * W.pairGap * 100).toFixed(1),
      detail: `${zeroPairs} dari ${totalPairs} pasangan keyword (${(pairGap * 100).toFixed(0)}%) belum pernah digabung di korpus.`,
      interpretation:
        pairGap >= 0.6
          ? "Banyak celah antar-keyword belum dijelajah."
          : pairGap >= 0.3
          ? "Ada beberapa celah antar-keyword."
          : "Sebagian besar pasangan sudah pernah digabung.",
    },
    {
      name: "Tren emerging",
      measures: "Rata-rata apakah keyword menaik (baru) atau menurun belakangan.",
      value: +emergingNorm.toFixed(3),
      weight: W.emerging,
      contribution: +(emergingNorm * W.emerging * 100).toFixed(1),
      detail: `Rata-rata Δ proporsi = ${emergingMean >= 0 ? "+" : ""}${emergingMean.toFixed(3)} (periode baru − lama).`,
      interpretation:
        emergingMean > 0.05
          ? "Topik cenderung menaik (emerging)."
          : emergingMean < -0.05
          ? "Topik cenderung menurun."
          : "Topik relatif stabil.",
    },
  ];

  return {
    score,
    level,
    levelHint,
    components,
    nAll,
    totalRefs: total,
    totalPairs,
    zeroPairs,
    emergingMean: +emergingMean.toFixed(3),
    keywordCount: K,
  };
}

// ---------- Recommendations (step 11) ----------
export interface Recommendation {
  combo: string;
  cooccurrence: number;
  emergingAvg: number;
  score: number;
}

export function recommendations(records: RisRecord[], keywords: string[]): Recommendation[] {
  const matrix = userCoocMatrix(records, keywords);
  const emergingMap = new Map(keywords.map((k) => [k, emergingScore(records, k)]));
  const cands: Recommendation[] = [];
  for (let a = 0; a < keywords.length; a++) {
    for (let b = a + 1; b < keywords.length; b++) {
      const ka = keywords[a];
      const kb = keywords[b];
      const cooc = matrix[a][b];
      const gap = 1 / (1 + cooc);
      const emAvg = ((emergingMap.get(ka) || 0) + (emergingMap.get(kb) || 0)) / 2;
      const emNorm = (Math.max(-1, Math.min(1, emAvg)) + 1) / 2;
      cands.push({
        combo: `${ka} × ${kb}`,
        cooccurrence: cooc,
        emergingAvg: +emAvg.toFixed(3),
        score: +(100 * (0.6 * gap + 0.4 * emNorm)).toFixed(1),
      });
    }
  }
  return cands.sort((a, b) => b.score - a.score);
}

// ---------- Venn: overlapping domains (top 3 keywords) ----------
export interface VennData {
  sets: string[]; // [A, B, C]
  totals: number[]; // docFreq of each set (for legend)
  onlyA: number;
  onlyB: number;
  onlyC: number;
  ab: number; // A∩B only (not C)
  ac: number;
  bc: number;
  abc: number;
  recommendation: string;
}

export function vennDomains(records: RisRecord[], keywords: string[]): VennData {
  const df = keywordCounts(records, keywords); // aligned to `keywords` order
  const matrix = userCoocMatrix(records, keywords); // aligned too
  const involvement = keywords.map((k, i) => ({
    k,
    df: df[i].docFreq,
    co: matrix[i].reduce((a, b) => a + b, 0), // total co-occurrence with the others
  }));
  const anyCo = involvement.some((x) => x.co > 0);
  // Prefer the domains that actually intersect; fall back to raw frequency.
  const chosen = [...involvement]
    .sort((a, b) => (anyCo ? b.co - a.co || b.df - a.df : b.df - a.df))
    .slice(0, 3);
  const sets = chosen.map((c) => c.k);
  const totals = chosen.map((c) => c.df);
  const [A, B, C] = sets;
  let onlyA = 0, onlyB = 0, onlyC = 0, ab = 0, ac = 0, bc = 0, abc = 0;
  for (const r of records) {
    const a = A ? containsTerm(r.searchable, A) : false;
    const b = B ? containsTerm(r.searchable, B) : false;
    const c = C ? containsTerm(r.searchable, C) : false;
    if (a && b && c) abc++;
    else if (a && b) ab++;
    else if (a && c) ac++;
    else if (b && c) bc++;
    else if (a) onlyA++;
    else if (b) onlyB++;
    else if (c) onlyC++;
  }

  let recommendation: string;
  if (sets.length < 3) {
    recommendation = "Butuh minimal 3 domain untuk diagram Venn tiga lingkaran.";
  } else if (abc === 0) {
    recommendation = `Belum ada satu pun referensi yang menggabungkan ketiga domain "${A}", "${B}", dan "${C}" sekaligus — inilah celah kebaruan tertinggi. Arahkan penelitian ke irisan ketiganya.`;
  } else {
    const pairs = [
      { name: `${A} ∩ ${B}`, v: ab + abc },
      { name: `${A} ∩ ${C}`, v: ac + abc },
      { name: `${B} ∩ ${C}`, v: bc + abc },
    ].sort((x, y) => x.v - y.v);
    recommendation = `Ketiga domain sudah pernah digabung (${abc} referensi). Irisan paling tipis: ${pairs[0].name} (${pairs[0].v} referensi) — memperkuat irisan ini paling menjanjikan untuk kontribusi baru.`;
  }
  return { sets, totals, onlyA, onlyB, onlyC, ab, ac, bc, abc, recommendation };
}

// ---------- Title vs recommendation fit ----------
export interface TitleFit {
  combo: string;
  ka: string;
  kb: string;
  kaInTitle: boolean;
  kbInTitle: boolean;
  recScore: number;
  titleFitPct: number;
}

export function titleRecommendationFit(
  judul: string,
  recs: Recommendation[],
  n = 8
): TitleFit[] {
  const t = (judul || "").toLowerCase();
  return recs.slice(0, n).map((r) => {
    const parts = r.combo.split(" × ");
    const ka = parts[0]?.trim() || "";
    const kb = parts[1]?.trim() || "";
    const kaIn = ka ? containsTerm(t, ka) : false;
    const kbIn = kb ? containsTerm(t, kb) : false;
    const fit = (((kaIn ? 1 : 0) + (kbIn ? 1 : 0)) / 2) * 100;
    return { combo: r.combo, ka, kb, kaInTitle: kaIn, kbInTitle: kbIn, recScore: r.score, titleFitPct: Math.round(fit) };
  });
}

// ---------- Top-level orchestrator ----------
export interface AnalysisResult {
  quality: Quality;
  keywordCounts: KeywordCount[];
  matchedCount: number;
  totalCount: number;
  relevantPerYear: CountPair[];
  publicationsPerYear: CountPair[];
  topAuthors: CountPair[];
  topSources: CountPair[];
  authorsDetail: GroupWithRefs[];
  sourcesDetail: GroupWithRefs[];
  topCorpusKeywords: CountPair[];
  keywordCloud: CloudResult;
  strength: StrengthRow[];
  problem: ProblemResult;
  cooc: CoocResult;
  opportunity: OpportunityResult;
  novelty: NoveltyResult;
  recommendations: Recommendation[];
  venn: VennData;
  titleFit: TitleFit[];
}

export function runAnalysis(records: RisRecord[], keywords: string[], judul = ""): AnalysisResult {
  const matched = matchedRecords(records, keywords);
  const recs = recommendations(records, keywords);
  return {
    quality: dataQuality(records),
    keywordCounts: keywordCounts(records, keywords),
    matchedCount: matched.length,
    totalCount: records.length,
    relevantPerYear: relevantPerYear(matched),
    publicationsPerYear: publicationsPerYear(records),
    topAuthors: topAuthors(records),
    topSources: topSources(records),
    authorsDetail: authorsWithRefs(records),
    sourcesDetail: sourcesWithRefs(records),
    topCorpusKeywords: topCorpusKeywords(records),
    keywordCloud: keywordCloud(records),
    strength: keywordStrength(records, keywords),
    problem: problemIdentification(matched),
    cooc: cooccurrence(records),
    opportunity: researchOpportunity(records, keywords),
    novelty: noveltyScore(records, keywords),
    recommendations: recs,
    venn: vennDomains(records, keywords),
    titleFit: titleRecommendationFit(judul, recs),
  };
}
