// RIS parser + record normalisation.
// Port of the "Parse RIS menjadi tabel" step from the Colab notebook.

export interface RisRecord {
  title: string;
  abstract: string;
  authors: string[];
  year: number | null;
  source: string;
  keywords: string[];
  doi: string;
  type: string;
  citations: number | null; // times-cited (WoS Z9/TC or "cited by" in notes), if present
  affiliations: string[]; // author addresses (AD/C1), if present
  searchable: string;
}

// Tag priority — first non-empty wins, mirroring `first_field` in the notebook.
const TITLE_KEYS = ["TI", "T1"];
const ABSTRACT_KEYS = ["AB", "N2", "N1"];
const AUTHOR_KEYS = ["AU", "A1", "A2"];
const YEAR_KEYS = ["PY", "Y1", "DA"];
const SOURCE_KEYS = ["JO", "JF", "JA", "T2"];
const KEYWORD_KEYS = ["KW"];
const CITATION_KEYS = ["Z9", "TC"]; // WoS total cited / times cited

const YEAR_RE = /(19|20)\d{2}/;

interface RawEntry {
  [tag: string]: string[];
}

/** Split raw RIS text into per-reference tag maps. */
function parseRawEntries(text: string): RawEntry[] {
  const lines = text.split(/\r\n|\r|\n/);
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;
  let lastTag: string | null = null;

  const tagLine = /^([A-Z][A-Z0-9])\s{0,2}-\s?(.*)$/;

  for (const rawLine of lines) {
    const line = rawLine.replace(/﻿/g, "");
    const m = line.match(tagLine);
    if (m) {
      const tag = m[1];
      const value = m[2].trim();
      if (tag === "TY") {
        current = {};
        entries.push(current);
      }
      if (!current) {
        current = {};
        entries.push(current);
      }
      if (tag === "ER") {
        current = null;
        lastTag = null;
        continue;
      }
      if (!current[tag]) current[tag] = [];
      if (value) current[tag].push(value);
      lastTag = tag;
    } else if (current && lastTag && line.trim()) {
      // Continuation line (e.g. multi-line abstract) — append to last value.
      const arr = current[lastTag];
      if (arr && arr.length) arr[arr.length - 1] += " " + line.trim();
      else if (arr) arr.push(line.trim());
    }
  }
  return entries.filter((e) => Object.keys(e).length > 0);
}

function firstField(entry: RawEntry, keys: string[]): string[] {
  for (const k of keys) {
    if (entry[k] && entry[k].length) return entry[k];
  }
  return [];
}

function cleanText(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractYear(entry: RawEntry): number | null {
  const vals = firstField(entry, YEAR_KEYS);
  for (const v of vals) {
    const m = String(v).match(YEAR_RE);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

export function parseRis(text: string): RisRecord[] {
  const entries = parseRawEntries(text);
  const records: RisRecord[] = entries.map((e) => {
    const title = cleanText(firstField(e, TITLE_KEYS));
    const abstract = cleanText(firstField(e, ABSTRACT_KEYS));
    const authors = firstField(e, AUTHOR_KEYS)
      .map((a) => a.trim())
      .filter(Boolean);
    const year = extractYear(e);
    const source = cleanText(firstField(e, SOURCE_KEYS));
    const keywords = firstField(e, KEYWORD_KEYS)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const doi = cleanText(e["DO"] || e["DOI"] || []);
    const type = cleanText(e["TY"] || []);

    // Citations: WoS Z9/TC, else "Cited By: N" inside note fields.
    let citations: number | null = null;
    const cRaw = firstField(e, CITATION_KEYS);
    if (cRaw.length) {
      const m = String(cRaw[0]).match(/\d+/);
      if (m) citations = parseInt(m[0], 10);
    }
    if (citations == null) {
      const notes = [...(e["N1"] || []), ...(e["N2"] || [])].join(" ");
      const m = notes.match(/cited\s*by[:\s]*?(\d+)/i);
      if (m) citations = parseInt(m[1], 10);
    }

    const affiliations = [...(e["AD"] || []), ...(e["C1"] || [])]
      .map((a) => a.trim())
      .filter(Boolean);

    const searchable = (
      title +
      " . " +
      abstract +
      " . " +
      keywords.join(" ")
    ).toLowerCase();

    return { title, abstract, authors, year, source, keywords, doi, type, citations, affiliations, searchable };
  });

  return records.filter((r) => r.title || r.abstract || r.authors.length);
}
