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
export interface NoveltyFactor {
  key: string;
  name: string;
  measures: string; // apa yang diukur (satu baris)
  value: number; // 0–1 ternormalisasi
  weight: number;
  contribution: number; // poin ke skor akhir
  detail: string; // angka mentah di baliknya
  interpretation: string;
  direction: "naik" | "turun" | "netral"; // efek ke novelty
}

export interface NoveltyConfidence {
  percent: number;
  level: string; // Tinggi / Sedang / Rendah
  reasons: string[];
}

export interface NoveltySensitivity {
  keyword: string;
  scoreWithout: number;
  delta: number; // scoreWithout − skor dasar
}

export interface NoveltyResult {
  score: number;
  level: string; // Rendah / Sedang / Tinggi
  levelHint: string;
  factors: NoveltyFactor[]; // 5 kontributor
  confidence: NoveltyConfidence;
  sensitivity: NoveltySensitivity[];
  explanations: string[]; // 3 alasan utama
  nAll: number;
  totalRefs: number;
  totalPairs: number;
  zeroPairs: number;
  emergingMean: number;
  keywordCount: number;
}

// Bobot 5 kontributor (jumlah = 1).
const NW = { rare: 0.3, gap: 0.25, emerging: 0.2, interdisciplinary: 0.15, coverage: 0.1 };

interface NoveltyCore {
  score: number;
  rare: number;
  gap: number;
  emerging: number;
  interdisciplinary: number;
  coverage: number;
  nAll: number;
  total: number;
  totalPairs: number;
  zeroPairs: number;
  emergingMean: number;
  coverageShare: number;
  avgJaccard: number;
  bestA: string;
  bestB: string;
  bestCount: number; // referensi memuat pasangan keyword terkuat
  refs3plus: number; // referensi memuat ≥3 keyword sekaligus
  maxDepth: number; // jumlah keyword terbanyak yang muncul bersama di satu referensi
  effVenues: number; // jumlah venue/jurnal "efektif" (perplexity) literatur relevan
  distinctSrc: number; // jumlah jurnal/sumber berbeda
  interdiscBasis: string; // "sumber" atau "tumpang tindih keyword"
}

/** Pure factor + score computation (reused by the main result and sensitivity). */
function noveltyCore(records: RisRecord[], keywords: string[]): NoveltyCore {
  const total = records.length || 1;
  const K = keywords.length;
  const U: number[][] = records.map((r) => keywords.map((kw) => (containsTerm(r.searchable, kw) ? 1 : 0)));
  const rowSums = U.map((row) => row.reduce((a, b) => a + b, 0));
  const nAll = rowSums.filter((s) => s === K).length;
  const refs2plus = rowSums.filter((s) => s >= 2).length;
  const refs3plus = rowSums.filter((s) => s >= 3).length;
  const maxDepth = rowSums.length ? Math.max(...rowSums) : 0;

  const matrix = userCoocMatrix(records, keywords);
  const totalPairs = (K * (K - 1)) / 2;
  let zeroPairs = 0;
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) if (matrix[a][b] === 0) zeroPairs++;

  // Interdisciplinarity via document-set overlap (Jaccard) between keywords.
  const docCount = keywords.map((_, k) => U.reduce((acc, row) => acc + row[k], 0));
  let jaccSum = 0;
  let jaccN = 0;
  // Rarity: seberapa jarang pasangan keyword muncul BERSAMA (jumlah absolut, berbasis
  // pasangan/subset — bukan menuntut semua keyword di satu paper). Sedikit kemunculan
  // bersama = langka = mendukung kebaruan.
  let coSum = 0;
  let bestA = "";
  let bestB = "";
  let bestCount = -1;
  for (let a = 0; a < K; a++)
    for (let b = a + 1; b < K; b++) {
      const inter = matrix[a][b];
      const uni = docCount[a] + docCount[b] - inter;
      if (uni > 0) {
        jaccSum += inter / uni;
        jaccN++;
      }
      coSum += inter;
      if (inter > bestCount) {
        bestCount = inter;
        bestA = keywords[a];
        bestB = keywords[b];
      }
    }
  const avgJaccard = jaccN ? jaccSum / jaccN : 0;

  // Rata-rata kemunculan bersama per pasangan, meluruh terhadap "skala matang"
  // (≈2% korpus, minimal 2). avgPairCo kecil → rare tinggi (menuju 1).
  const avgPairCo = totalPairs ? coSum / totalPairs : 0;
  const rareScale = Math.max(2, total * 0.02);
  const rare = Math.min(Math.max(Math.exp(-avgPairCo / rareScale), 0), 1);
  const gap = totalPairs ? zeroPairs / totalPairs : 0;
  const emergingMean = Math.max(
    -1,
    Math.min(1, keywords.reduce((a, k) => a + emergingScore(records, k), 0) / (K || 1))
  );
  const emerging = (emergingMean + 1) / 2;

  // Interdisciplinary: keragaman VENUE (jurnal/sumber) literatur relevan — sinyal
  // lintas-bidang yang INDEPENDEN dari co-occurrence. Fallback ke tumpang tindih
  // dokumen antar-keyword bila metadata sumber minim.
  const srcCounts = new Map<string, number>();
  let relevantN = 0;
  let withSrc = 0;
  for (let i = 0; i < records.length; i++) {
    if (rowSums[i] < 1) continue;
    relevantN++;
    const s = records[i].source.trim();
    if (s) {
      withSrc++;
      srcCounts.set(s, (srcCounts.get(s) || 0) + 1);
    }
  }
  const srcCoverage = relevantN ? withSrc / relevantN : 0;
  const distinctSrc = srcCounts.size;
  let effVenues = 0;
  let interdiscBasis = "sumber";
  let interdisciplinary: number;
  if (srcCoverage >= 0.5 && withSrc > 0 && distinctSrc >= 1) {
    let H = 0;
    for (const cnt of srcCounts.values()) {
      const p = cnt / withSrc;
      H -= p * Math.log(p);
    }
    effVenues = Math.exp(H); // venue "efektif" (perplexity)
    interdisciplinary = Math.min(Math.max((effVenues - 1) / (10 - 1), 0), 1); // ~10 venue = penuh
  } else {
    interdisciplinary = Math.min(Math.max(1 - avgJaccard, 0), 1);
    interdiscBasis = "tumpang tindih keyword";
  }

  const coverageShare = refs2plus / total;
  const coverage = Math.min(Math.max(1 - coverageShare, 0), 1);

  const score = +(
    100 *
    (NW.rare * rare +
      NW.gap * gap +
      NW.emerging * emerging +
      NW.interdisciplinary * interdisciplinary +
      NW.coverage * coverage)
  ).toFixed(1);

  return {
    score, rare, gap, emerging, interdisciplinary, coverage, nAll, total, totalPairs, zeroPairs,
    emergingMean, coverageShare, avgJaccard,
    bestA, bestB, bestCount: Math.max(bestCount, 0), refs3plus, maxDepth,
    effVenues, distinctSrc, interdiscBasis,
  };
}

export function noveltyScore(records: RisRecord[], keywords: string[]): NoveltyResult {
  const c = noveltyCore(records, keywords);
  const K = keywords.length;
  const kwList = keywords.slice(0, 3).join(", ") + (K > 3 ? ", dst" : "");
  const pct = (x: number) => Math.round(x * 100);

  const level = c.score >= 66 ? "Tinggi" : c.score >= 40 ? "Sedang" : "Rendah";
  const levelHint =
    level === "Tinggi"
      ? "Kombinasi keyword ini relatif jarang & sedang naik daun — indikasi kuat ada ruang kebaruan. Tetap validasi dengan membaca paper."
      : level === "Sedang"
      ? "Ada sebagian ruang kebaruan, tapi sebagian kombinasi sudah cukup ramai. Pertimbangkan pertajam sudut pandang."
      : "Kombinasi keyword ini sudah banyak diteliti bersama. Untuk kebaruan, coba ganti/tambah keyword yang lebih spesifik atau lintas-bidang.";

  const mk = (
    key: string,
    name: string,
    measures: string,
    value: number,
    weight: number,
    detail: string,
    interpretation: string,
    good: boolean
  ): NoveltyFactor => ({
    key,
    name,
    measures,
    value: +value.toFixed(3),
    weight,
    contribution: +(value * weight * 100).toFixed(1),
    detail,
    interpretation,
    direction: value >= 0.55 ? (good ? "naik" : "netral") : value <= 0.45 ? "turun" : "netral",
  });

  const factors: NoveltyFactor[] = [
    mk("rare", "Keyword Rare", "Seberapa jarang keyword muncul BERSAMA di referensi (berbasis pasangan/subset, bukan harus semua keyword sekaligus).", c.rare, NW.rare,
      c.bestCount > 0
        ? `Kombinasi terkuat: "${c.bestA}" + "${c.bestB}" (${c.bestCount} ref). ${c.refs3plus} referensi memuat ≥3 keyword; kedalaman maks ${c.maxDepth} keyword.`
        : `Tidak ada satu pun pasangan keyword yang pernah muncul bersama di korpus.`,
      c.rare >= 0.66 ? "Keyword sangat jarang digabung → kuat mendukung kebaruan." : c.rare >= 0.33 ? "Sebagian kombinasi sudah pernah digabung." : "Keyword sudah sering digabung → menurunkan kebaruan.",
      true),
    mk("gap", "Gap Research", "Berapa banyak pasangan keyword yang belum pernah digabung.", c.gap, NW.gap,
      `${c.zeroPairs} dari ${c.totalPairs} pasangan keyword (${pct(c.gap)}%) belum pernah muncul bersama.`,
      c.gap >= 0.6 ? "Banyak celah antar-keyword belum dijelajah." : c.gap >= 0.3 ? "Ada beberapa celah antar-keyword." : "Sebagian besar pasangan sudah pernah digabung.",
      true),
    mk("emerging", "Emerging Topic", "Rata-rata apakah keyword menaik (baru) atau menurun belakangan.", c.emerging, NW.emerging,
      `Rata-rata Δ proporsi = ${c.emergingMean >= 0 ? "+" : ""}${c.emergingMean.toFixed(3)} (periode baru − lama).`,
      c.emergingMean > 0.05 ? "Topik cenderung menaik (emerging)." : c.emergingMean < -0.05 ? "Topik cenderung menurun." : "Topik relatif stabil.",
      true),
    mk("interdisciplinary", "Interdisciplinary", "Seberapa lintas-bidang topik: keragaman jurnal/sumber literatur relevan (independen dari co-occurrence).", c.interdisciplinary, NW.interdisciplinary,
      c.interdiscBasis === "sumber"
        ? `Literatur relevan tersebar di ~${c.effVenues.toFixed(1)} venue efektif (dari ${c.distinctSrc} jurnal/sumber berbeda).`
        : `Metadata sumber minim → dihitung dari tumpang tindih dokumen antar-keyword = ${pct(c.avgJaccard)}%.`,
      c.interdisciplinary >= 0.66 ? "Tersebar di banyak bidang → berpotensi lintas-disiplin." : c.interdisciplinary >= 0.33 ? "Sebagian lintas-bidang." : "Terkonsentrasi di sedikit bidang.",
      true),
    mk("coverage", "Coverage Literatur", "Seberapa jarang literatur membahas ≥2 keyword sekaligus.", c.coverage, NW.coverage,
      `${pct(c.coverageShare)}% referensi membahas ≥2 keyword sekaligus.`,
      c.coverage >= 0.7 ? "Kombinasi belum banyak tergarap." : c.coverage >= 0.4 ? "Sebagian sudah tergarap." : "Topik sudah matang (banyak dibahas).",
      true),
  ];

  // ----- Confidence: seberapa layak skor ini dipercaya (dipengaruhi jumlah data) -----
  const withAbstract = records.filter((r) => r.abstract.length > 0).length;
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  const yMin = years.length ? Math.min(...years) : null;
  const yMax = years.length ? Math.max(...years) : null;
  const span = yMin != null && yMax != null ? yMax - yMin : 0;
  const kwCovered = keywords.filter((k) => records.some((r) => containsTerm(r.searchable, k))).length;

  // Jumlah data = pendorong utama (novelty sangat dipengaruhi jumlah data).
  // Dipakai sebagai PENGALI, bukan penjumlah — supaya mutu data (coverage/abstract)
  // tidak bisa menutupi korpus yang terlalu kecil.
  const n = records.length;
  const dataReliability = 1 - Math.exp(-n / 120); // ~0.34 di 50 artikel, ~0.81 di 200, ~0.98 di 450
  const spanS = Math.min(span / 8, 1);
  const covS = K ? kwCovered / K : 0;
  const absS = n ? withAbstract / n : 0;
  const qualityAvg = 0.5 * covS + 0.3 * absS + 0.2 * spanS; // mutu data yang tersedia (0–1)
  const qualityFactor = 0.4 + 0.6 * qualityAvg; // 0.4–1.0: mutu bagus menaikkan, buruk menahan
  const confPercent = Math.round(100 * dataReliability * qualityFactor);
  const confidence: NoveltyConfidence = {
    percent: confPercent,
    level: confPercent >= 80 ? "Tinggi" : confPercent >= 60 ? "Sedang" : "Rendah",
    reasons: [
      `${n} referensi dianalisis${n < 80 ? " → data sedikit, jadi penentu utama & menekan confidence" : n >= 300 ? " (data memadai)" : ""} (bobot jumlah data = ${Math.round(dataReliability * 100)}%).`,
      yMin != null && yMax != null ? `Rentang tahun ${yMin}–${yMax} (${span} tahun).` : "Data tahun tidak tersedia.",
      `${kwCovered} dari ${K} keyword benar-benar muncul di korpus.`,
      `${withAbstract} referensi (${pct(absS)}%) memuat abstrak.`,
    ],
  };

  // ----- Sensitivity: efek menghapus tiap keyword terhadap skor -----
  const sensitivity: NoveltySensitivity[] =
    K > 2
      ? keywords
          .map((k) => {
            const rest = keywords.filter((x) => x !== k);
            const sc = noveltyCore(records, rest).score;
            return { keyword: k, scoreWithout: sc, delta: +(sc - c.score).toFixed(1) };
          })
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      : [];

  // ----- Explainability: 3 alasan utama (paling menentukan skor) -----
  const neutral = (w: number) => 0.5 * w * 100;
  const explanations = factors
    .map((f) => {
      const pull = f.contribution - neutral(f.weight);
      let text = "";
      switch (f.key) {
        case "rare":
          if (c.bestCount <= 0) {
            text = `Tidak ada satu pun pasangan keyword (mis. "${keywords[0]}" + "${keywords[1] ?? ""}") yang pernah dibahas bersama di korpus — kombinasi apa pun akan sangat baru, tetapi cek juga apakah keyword-nya memang relevan satu sama lain.`;
          } else if (c.rare >= 0.5) {
            text = `Keyword Anda jarang dikombinasikan: pasangan terkuat pun hanya "${c.bestA}" + "${c.bestB}" (${c.bestCount} referensi)${c.refs3plus === 0 ? `, dan tidak ada referensi yang menggabungkan tiga keyword atau lebih` : `, dengan hanya ${c.refs3plus} referensi memuat ≥3 keyword`} — masih banyak ruang kebaruan pada kombinasi yang lebih dalam.`;
          } else {
            text = `Beberapa kombinasi keyword sudah cukup banyak dibahas (mis. "${c.bestA}" + "${c.bestB}" di ${c.bestCount} referensi${c.refs3plus > 0 ? `, dan ${c.refs3plus} referensi bahkan memuat ≥3 keyword` : ""}), sehingga sebagian arah penelitian ini kurang baru.`;
          }
          break;
        case "emerging":
          text =
            c.emergingMean > 0.05
              ? `Minat pada keyword ini cenderung menaik beberapa tahun terakhir (Δ=+${c.emergingMean.toFixed(2)}), menambah potensi kebaruan.`
              : c.emergingMean < -0.05
              ? `Topik dengan keyword ini telah banyak dipublikasikan dan minatnya menurun belakangan (Δ=${c.emergingMean.toFixed(2)}), sehingga kebaruannya berkurang.`
              : `Tren keyword relatif stabil belakangan (Δ≈0), tidak banyak mengubah kebaruan.`;
          break;
        case "gap":
          text =
            c.gap >= 0.5
              ? `Masih ada ${c.zeroPairs} dari ${c.totalPairs} pasangan keyword yang belum pernah digabung — ruang kebaruan masih terbuka lebar.`
              : `Sebagian besar pasangan keyword sudah pernah digabung (${c.totalPairs - c.zeroPairs}/${c.totalPairs}), menandakan area relatif matang.`;
          break;
        case "interdisciplinary":
          if (c.interdiscBasis === "sumber") {
            text =
              c.interdisciplinary >= 0.6
                ? `Literatur relevan tersebar di banyak jurnal/bidang (~${c.effVenues.toFixed(0)} venue efektif dari ${c.distinctSrc} sumber), menandakan topik lintas-disiplin yang berpotensi baru.`
                : `Literatur relevan terpusat di sedikit jurnal/bidang (~${c.effVenues.toFixed(0)} venue efektif), jadi kurang lintas-disiplin.`;
          } else {
            text =
              c.interdisciplinary >= 0.6
                ? `Keyword Anda jarang muncul di paper yang sama (tumpang tindih ${pct(c.avgJaccard)}%), menandakan kombinasi lintas-disiplin yang berpotensi baru.`
                : `Keyword Anda sering muncul bersama di paper yang sama (tumpang tindih ${pct(c.avgJaccard)}%), jadi kombinasinya kurang lintas-disiplin.`;
          }
          break;
        case "coverage":
          text =
            c.coverageShare >= 0.5
              ? `Sebanyak ${pct(c.coverageShare)}% referensi sudah membahas minimal dua keyword sekaligus, menandakan topik cukup matang sehingga kebaruan menurun.`
              : `Hanya ${pct(c.coverageShare)}% referensi yang membahas ≥2 keyword sekaligus, jadi kombinasi ini belum banyak tergarap.`;
          break;
      }
      return { pull: Math.abs(pull), text };
    })
    .sort((a, b) => b.pull - a.pull)
    .slice(0, 3)
    .map((x) => x.text);

  return {
    score: c.score,
    level,
    levelHint,
    factors,
    confidence,
    sensitivity,
    explanations,
    nAll: c.nAll,
    totalRefs: c.total,
    totalPairs: c.totalPairs,
    zeroPairs: c.zeroPairs,
    emergingMean: +c.emergingMean.toFixed(3),
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

// ---------- Keyword dynamics (evolution, burst, declining, centrality, thematic map) ----------
export interface EvolutionStage {
  label: string;
  docs: number;
  top: { term: string; count: number; isUserKw: boolean }[];
}
export interface BurstTerm {
  term: string;
  pct: number | null; // null = topik baru muncul (dari 0)
  latePct: number; // proporsi di periode akhir (%)
  isNew: boolean;
  isUserKw: boolean;
}
export interface DecliningTerm {
  term: string;
  pct: number; // negatif
  isUserKw: boolean;
}
export interface CentralityTerm {
  term: string;
  degree: number;
  betweenness: number;
  eigenvector: number;
  isUserKw: boolean;
}
export interface ThematicTerm {
  term: string;
  centrality: number; // 0–1 (relevansi/keterhubungan)
  density: number; // 0–1 (perkembangan/kohesi)
  quadrant: "Motor" | "Niche" | "Basic" | "Emerging/Declining";
  isUserKw: boolean;
}
export interface KeywordDynamics {
  source: string;
  evolution: EvolutionStage[];
  burst: BurstTerm[];
  declining: DecliningTerm[];
  centrality: CentralityTerm[];
  thematic: ThematicTerm[];
}


function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Betweenness centrality (Brandes, unweighted: edge where co>0), normalized to 0–1. */
function betweennessBrandes(co: number[][]): number[] {
  const n = co.length;
  const CB = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const S: number[] = [];
    const P: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Array(n).fill(0);
    sigma[s] = 1;
    const dist = new Array(n).fill(-1);
    dist[s] = 0;
    const Q: number[] = [s];
    while (Q.length) {
      const v = Q.shift() as number;
      S.push(v);
      for (let w = 0; w < n; w++) {
        if (co[v][w] <= 0) continue;
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          Q.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          P[w].push(v);
        }
      }
    }
    const delta = new Array(n).fill(0);
    while (S.length) {
      const w = S.pop() as number;
      for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }
  const norm = (n - 1) * (n - 2); // undirected pairs counted twice → this normalizes both
  return CB.map((x) => (norm > 0 ? x / norm : 0));
}

export function keywordDynamics(records: RisRecord[], keywords: string[]): KeywordDynamics {
  const K = keywords.length;
  // Presence of EACH user keyword per record (bilingual match, sama seperti Section 1).
  const present = records.map((r) => ({
    year: r.year,
    has: keywords.map((k) => containsTerm(r.searchable, k)),
  }));
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  const yearMin = years.length ? Math.min(...years) : null;
  const yearMax = years.length ? Math.max(...years) : null;

  // 1) Evolution — ranking keyword ANDA per periode waktu.
  const evolution: EvolutionStage[] = [];
  if (yearMin != null && yearMax != null && yearMax > yearMin) {
    const P = Math.min(4, yearMax - yearMin + 1);
    const span = (yearMax - yearMin + 1) / P;
    for (let p = 0; p < P; p++) {
      const lo = Math.round(yearMin + p * span);
      const hi = p === P - 1 ? yearMax : Math.round(yearMin + (p + 1) * span) - 1;
      const inP = present.filter((u) => u.year != null && u.year >= lo && u.year <= hi);
      const counts = keywords
        .map((k, ki) => ({ term: k, count: inP.reduce((a, u) => a + (u.has[ki] ? 1 : 0), 0), isUserKw: true }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count);
      evolution.push({ label: lo === hi ? `${lo}` : `${lo}–${hi}`, docs: inP.length, top: counts.slice(0, 4) });
    }
  }

  // 2) Burst + 3) Declining — proporsi tiap keyword ANDA di periode awal vs akhir.
  let burst: BurstTerm[] = [];
  let declining: DecliningTerm[] = [];
  if (yearMin != null && yearMax != null && yearMax > yearMin) {
    const mid = Math.floor((yearMin + yearMax) / 2);
    const early = present.filter((u) => u.year != null && u.year <= mid);
    const late = present.filter((u) => u.year != null && u.year > mid);
    if (early.length && late.length) {
      const rows = keywords.map((k, ki) => {
        const e = early.reduce((a, u) => a + (u.has[ki] ? 1 : 0), 0) / early.length;
        const l = late.reduce((a, u) => a + (u.has[ki] ? 1 : 0), 0) / late.length;
        const g = e > 0 ? ((l - e) / e) * 100 : l > 0 ? Infinity : 0;
        return { term: k, e, l, g };
      });
      burst = rows
        .filter((r) => r.l > 0 && (r.g === Infinity || r.g >= 25))
        .sort((a, b) => (b.g === Infinity ? 1e9 : b.g) - (a.g === Infinity ? 1e9 : a.g))
        .map((r) => ({ term: r.term, pct: r.g === Infinity ? null : Math.round(r.g), latePct: +(r.l * 100).toFixed(1), isNew: r.e === 0, isUserKw: true }));
      declining = rows
        .filter((r) => r.e > 0 && r.g !== Infinity && r.g <= -25)
        .sort((a, b) => a.g - b.g)
        .map((r) => ({ term: r.term, pct: Math.round(r.g), isUserKw: true }));
    }
  }

  // 4) Centrality + 5) Thematic map — jaringan co-occurrence keyword ANDA
  // (matriks yang sama dengan Section 1: userCoocMatrix).
  const co = userCoocMatrix(records, keywords);
  let centrality: CentralityTerm[] = [];
  let thematic: ThematicTerm[] = [];
  const V = K;
  if (V >= 2) {
    const degree = co.map((row) => row.filter((w) => w > 0).length / (V - 1));
    // eigenvector via power iteration (weighted)
    let x = new Array(V).fill(1 / Math.sqrt(V));
    for (let it = 0; it < 200; it++) {
      const y = new Array(V).fill(0);
      for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) y[i] += co[i][j] * x[j];
      const norm = Math.hypot(...y) || 1;
      const xn = y.map((v) => v / norm);
      let diff = 0;
      for (let i = 0; i < V; i++) diff += Math.abs(xn[i] - x[i]);
      x = xn;
      if (diff < 1e-9) break;
    }
    const emax = Math.max(...x.map((v) => Math.abs(v))) || 1;
    const eig = x.map((v) => Math.abs(v) / emax);
    const bet = betweennessBrandes(co);
    centrality = keywords
      .map((t, i) => ({ term: t, degree: +degree[i].toFixed(3), betweenness: +bet[i].toFixed(3), eigenvector: +eig[i].toFixed(3), isUserKw: true }))
      .sort((a, b) => b.eigenvector - a.eigenvector);

    // Thematic map: centrality (total links) vs density (avg internal strength)
    const cRaw = co.map((row) => row.reduce((a, b) => a + b, 0));
    const dRaw = co.map((row) => {
      const nb = row.filter((w) => w > 0);
      return nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : 0;
    });
    const cmax = Math.max(...cRaw, 1);
    const dmax = Math.max(...dRaw, 1);
    const cN = cRaw.map((v) => v / cmax);
    const dN = dRaw.map((v) => v / dmax);
    const cMed = median(cN.filter((v) => v > 0)) || median(cN);
    const dMed = median(dN.filter((v) => v > 0)) || median(dN);
    thematic = keywords.map((t, i) => {
      const hiC = cN[i] >= cMed && cN[i] > 0;
      const hiD = dN[i] >= dMed && dN[i] > 0;
      const quadrant: ThematicTerm["quadrant"] = hiC && hiD ? "Motor" : !hiC && hiD ? "Niche" : hiC && !hiD ? "Basic" : "Emerging/Declining";
      return { term: t, centrality: +cN[i].toFixed(3), density: +dN[i].toFixed(3), quadrant, isUserKw: true };
    });
  }

  return { source: "keyword Anda (pencocokan bilingual EN↔ID)", evolution, burst, declining, centrality, thematic };
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
  dynamics: KeywordDynamics;
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
    dynamics: keywordDynamics(records, keywords),
  };
}
