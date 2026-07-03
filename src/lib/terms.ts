// Bilingual (EN↔ID) synonym layer so that terms with the same meaning are
// matched the same, regardless of the language used in the RIS file or the
// keywords. Each group lists surface forms considered equivalent.
//
// NOTE: this is a curated glossary, not full semantic understanding. Terms
// outside it are still matched literally. Add pairs here to extend coverage.

const SYNONYM_GROUPS: string[][] = [
  // --- AI / computing ---
  ["artificial intelligence", "kecerdasan buatan", "ai"],
  ["machine learning", "pembelajaran mesin", "ml"],
  ["deep learning", "pembelajaran mendalam", "pembelajaran dalam"],
  ["neural network", "jaringan saraf", "jaringan saraf tiruan", "jaringan syaraf"],
  ["natural language processing", "pemrosesan bahasa alami", "nlp"],
  ["data mining", "penambangan data", "penggalian data"],
  ["big data", "data besar"],
  ["algorithm", "algoritma"],
  ["model", "model"],
  ["prediction", "prediksi", "peramalan"],
  ["forecasting", "peramalan", "prakiraan"],
  ["classification", "klasifikasi"],
  ["clustering", "pengelompokan", "klasterisasi"],
  ["optimization", "optimasi", "optimalisasi"],
  ["automation", "otomatisasi", "otomasi"],
  ["technology", "teknologi"],
  ["information system", "sistem informasi"],
  ["decision support", "pendukung keputusan", "penunjang keputusan"],

  // --- finance / tax / audit (domain pengguna) ---
  ["fraud", "kecurangan", "penipuan"],
  ["fraud mitigation", "mitigasi fraud", "mitigasi kecurangan", "pencegahan kecurangan"],
  ["fraud detection", "deteksi fraud", "deteksi kecurangan"],
  ["tax", "pajak"],
  ["taxation", "perpajakan"],
  ["taxpayer", "wajib pajak"],
  ["receivable", "piutang", "receivables"],
  ["receivables management", "pengelolaan piutang", "manajemen piutang"],
  ["billing", "penagihan"],
  ["collection", "penagihan", "pemungutan"],
  ["billing effectiveness", "efektivitas penagihan", "efektivitas pemungutan"],
  ["effectiveness", "efektivitas", "keefektifan"],
  ["efficiency", "efisiensi"],
  ["revenue", "pendapatan", "penerimaan"],
  ["local government", "pemerintah daerah", "pemda"],
  ["region", "daerah", "wilayah", "regional"],
  ["local revenue", "pendapatan asli daerah", "pad"],
  ["finance", "keuangan"],
  ["financial", "keuangan", "finansial"],
  ["accounting", "akuntansi"],
  ["audit", "audit", "pemeriksaan"],
  ["management", "manajemen", "pengelolaan"],
  ["performance", "kinerja"],
  ["policy", "kebijakan"],
  ["governance", "tata kelola"],
  ["compliance", "kepatuhan"],
  ["risk", "risiko", "resiko"],

  // --- general research ---
  ["analysis", "analisis"],
  ["evaluation", "evaluasi"],
  ["implementation", "implementasi", "penerapan"],
  ["development", "pengembangan"],
  ["system", "sistem"],
  ["health", "kesehatan"],
  ["education", "pendidikan"],
  ["quality", "kualitas", "mutu"],
  ["service", "layanan", "pelayanan"],
  ["public service", "pelayanan publik", "layanan publik"],
  ["decision", "keputusan"],
  ["strategy", "strategi"],
];

// Build lookup: normalized surface form -> its full equivalence group.
const GROUP_INDEX = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const form of group) GROUP_INDEX.set(form.toLowerCase(), group);
}

const expandCache = new Map<string, string[]>();

/** Return all equivalent surface forms for a term (always includes the term). */
export function expandTerm(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const cached = expandCache.get(t);
  if (cached) return cached;
  const group = GROUP_INDEX.get(t);
  const variants = group ? Array.from(new Set([t, ...group.map((g) => g.toLowerCase())])) : [t];
  expandCache.set(t, variants);
  return variants;
}

/** True when the term has a bilingual/synonym mapping beyond itself. */
export function hasSynonyms(term: string): boolean {
  return expandTerm(term).length > 1;
}

// --- Canonicalisation (for bilingual-aware token similarity) ---
// Map every surface form to a single canonical alphanumeric token (English
// head of its group, spaces removed) so that e.g. "kecerdasan buatan", "ai",
// and "artificial intelligence" all become "artificialintelligence".
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const CANON_PAIRS: [string, string][] = [];
const CANON_LABEL = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canon = group[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  CANON_LABEL.set(canon, group[0]);
  for (const form of group) CANON_PAIRS.push([form.toLowerCase(), canon]);
}
CANON_PAIRS.sort((a, b) => b[0].length - a[0].length); // longest surface form first

/** Replace known surface forms with their canonical token (bilingual-normalised). */
export function canonicalizeText(text: string): string {
  let s = " " + text.toLowerCase() + " ";
  for (const [form, canon] of CANON_PAIRS) {
    const re = new RegExp("([^a-z0-9])" + escRe(form) + "([^a-z0-9])", "g");
    let prev: string;
    do {
      prev = s;
      s = s.replace(re, (_m, p1, p2) => p1 + canon + p2);
    } while (s !== prev);
  }
  return s.trim();
}

/** Human-readable label for a (possibly canonical) token. */
export function canonLabel(token: string): string {
  return CANON_LABEL.get(token) || token;
}

/** Register extra synonym groups at runtime (e.g. from the LLM keyword expander).
 *  Enriches BOTH the matching layer (expandTerm) and canonicalisation (similarity). */
export function registerSynonymGroups(groups: string[][]): void {
  for (const raw of groups) {
    const group = Array.from(new Set(raw.map((g) => String(g).trim().toLowerCase()).filter(Boolean)));
    if (group.length < 2) continue;
    const canon = group[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!canon) continue;
    CANON_LABEL.set(canon, group[0]);
    for (const form of group) {
      GROUP_INDEX.set(form, group);
      CANON_PAIRS.push([form, canon]);
    }
  }
  CANON_PAIRS.sort((a, b) => b[0].length - a[0].length);
  expandCache.clear(); // invalidate memoised expansions
}
