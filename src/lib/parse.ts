// Multi-format upload parser: RIS, BibTeX (.bib), PubMed MEDLINE (.nbib),
// and ZIP archives containing any of those. Merges + de-duplicates records.
import JSZip from "jszip";
import { parseRis, type RisRecord } from "./ris";

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const YEAR_RE = /(19|20)\d{2}/;

// ---------- BibTeX ----------
function parseBibFields(s: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(s[i])) i++;
    let name = "";
    while (i < n && /[a-zA-Z0-9_-]/.test(s[i])) name += s[i++];
    if (!name) break;
    while (i < n && /\s/.test(s[i])) i++;
    if (s[i] !== "=") break;
    i++;
    while (i < n && /\s/.test(s[i])) i++;
    let value = "";
    if (s[i] === "{") {
      let d = 0;
      for (; i < n; i++) {
        const c = s[i];
        if (c === "{") {
          d++;
          if (d === 1) continue;
        } else if (c === "}") {
          d--;
          if (d === 0) {
            i++;
            break;
          }
        }
        value += c;
      }
    } else if (s[i] === '"') {
      i++;
      while (i < n && s[i] !== '"') value += s[i++];
      i++;
    } else {
      while (i < n && !/[,\n]/.test(s[i])) value += s[i++];
    }
    fields[name.toLowerCase()] = value.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  }
  return fields;
}

function parseBibtex(text: string): RisRecord[] {
  const out: RisRecord[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] !== "@") {
      i++;
      continue;
    }
    i++;
    let type = "";
    while (i < n && /[a-zA-Z]/.test(text[i])) type += text[i++];
    while (i < n && text[i] !== "{") i++;
    if (i >= n) break;
    let depth = 0;
    const start = i;
    for (; i < n; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const body = text.slice(start + 1, i - 1);
    const t = type.toLowerCase();
    if (t === "comment" || t === "string" || t === "preamble") continue;
    const comma = body.indexOf(",");
    const f = parseBibFields(comma >= 0 ? body.slice(comma + 1) : body);
    const title = f.title || "";
    const abstract = f.abstract || "";
    const authors = (f.author || f.editor || "")
      .split(/\s+and\s+/i)
      .map((a) => a.trim())
      .filter(Boolean);
    const ym = (f.year || f.date || "").match(YEAR_RE);
    const year = ym ? parseInt(ym[0], 10) : null;
    const source = f.journal || f.booktitle || f.publisher || "";
    const keywords = (f.keywords || f.keyword || "")
      .split(/[;,]/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const doi = (f.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    if (!title && !abstract && !authors.length) continue;
    const searchable = (title + " . " + abstract + " . " + keywords.join(" ")).toLowerCase();
    out.push({ title, abstract, authors, year, source, keywords, doi, type: "JOUR", citations: null, affiliations: [], searchable });
  }
  return out;
}

// ---------- PubMed MEDLINE / .nbib ----------
function parseNbib(text: string): RisRecord[] {
  const out: RisRecord[] = [];
  const blocks = text.split(/\r?\n\s*\r?\n/);
  const tagLine = /^([A-Z]{2,4})\s*-\s?(.*)$/;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const tags: Record<string, string[]> = {};
    let lastTag: string | null = null;
    for (const raw of block.split(/\r?\n/)) {
      const m = raw.match(tagLine);
      if (m) {
        lastTag = m[1];
        (tags[lastTag] ||= []).push(m[2].trim());
      } else if (lastTag && raw.trim()) {
        const arr = tags[lastTag];
        if (arr.length) arr[arr.length - 1] += " " + raw.trim();
      }
    }
    const title = (tags["TI"] || []).join(" ").trim();
    const abstract = (tags["AB"] || []).join(" ").trim();
    if (!title && !abstract) continue;
    const authors = (tags["FAU"] || tags["AU"] || []).map((a) => a.trim()).filter(Boolean);
    const dp = (tags["DP"] || tags["DEP"] || tags["EDAT"] || [])[0] || "";
    const ym = dp.match(YEAR_RE);
    const year = ym ? parseInt(ym[0], 10) : null;
    const source = (tags["JT"] || tags["TA"] || [])[0] || "";
    const keywords = [...(tags["OT"] || []), ...(tags["MH"] || [])].map((k) => k.toLowerCase().replace(/^\*/, "").split("/")[0].trim()).filter(Boolean);
    const doi = ((tags["LID"] || tags["AID"] || []).find((x) => /\[doi\]/i.test(x)) || "").replace(/\s*\[doi\]/i, "").trim();
    const affiliations = (tags["AD"] || []).map((a) => a.trim()).filter(Boolean);
    const searchable = (title + " . " + abstract + " . " + keywords.join(" ")).toLowerCase();
    out.push({ title, abstract, authors, year, source, keywords, doi, type: "JOUR", citations: null, affiliations, searchable });
  }
  return out;
}

// ---------- format detection + dispatch ----------
function detectAndParse(text: string, name: string): RisRecord[] {
  const lower = name.toLowerCase();
  const t = text.trim();
  if (lower.endsWith(".bib") || /@\w+\s*\{/.test(t.slice(0, 400))) return parseBibtex(t);
  if (lower.endsWith(".nbib") || /^PMID\s*-\s/m.test(t)) return parseNbib(t);
  if (/^TY\s{0,2}-/m.test(t) || /^ER\s{0,2}-/m.test(t)) return parseRis(t);
  // MEDLINE-style without PMID but with TI/AB and no TY
  if (/^TI\s{0,4}-/m.test(t) && !/^TY\s{0,2}-/m.test(t)) return parseNbib(t);
  return parseRis(t);
}

const PARSEABLE = /\.(ris|txt|bib|bibtex|nbib|ciw|enw|medline)$/i;

export interface ParseResult {
  records: RisRecord[];
  log: { name: string; count: number; note?: string }[];
}

export async function parseUploadFiles(files: File[]): Promise<ParseResult> {
  const all: RisRecord[] = [];
  const log: ParseResult["log"] = [];

  for (const f of files) {
    const lower = f.name.toLowerCase();
    try {
      if (lower.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(await f.arrayBuffer());
        const entries = Object.values(zip.files).filter((e) => !e.dir && PARSEABLE.test(e.name) && !e.name.startsWith("__MACOSX"));
        if (!entries.length) {
          log.push({ name: f.name, count: 0, note: "tidak ada file .ris/.bib/.nbib di dalam ZIP" });
          continue;
        }
        for (const e of entries) {
          const txt = await e.async("string");
          const recs = detectAndParse(txt, e.name);
          all.push(...recs);
          log.push({ name: e.name.split("/").pop() || e.name, count: recs.length });
        }
      } else if (/\.rar$/i.test(lower)) {
        log.push({ name: f.name, count: 0, note: "RAR tidak didukung — kompres ulang sebagai ZIP" });
      } else if (/\.pdf$/i.test(lower)) {
        log.push({ name: f.name, count: 0, note: "PDF belum didukung — unggah RIS/BibTeX/nbib" });
      } else {
        const txt = decodeText(await f.arrayBuffer());
        const recs = detectAndParse(txt, f.name);
        all.push(...recs);
        log.push({ name: f.name, count: recs.length });
      }
    } catch {
      log.push({ name: f.name, count: 0, note: "gagal dibaca" });
    }
  }

  // De-duplicate by DOI, else by normalised title.
  const seen = new Set<string>();
  const records = all.filter((r) => {
    const key = r.doi ? "doi:" + r.doi.toLowerCase() : r.title ? "ti:" + normTitle(r.title) : "";
    if (!key || key === "ti:") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { records, log };
}
