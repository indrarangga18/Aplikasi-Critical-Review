import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 20;

interface Body {
  keywords: string[];
  topik?: string;
}

// Expand each keyword into a cross-language (EN↔ID) + synonym equivalence group
// via the Anthropic API. Result feeds the app's synonym-matching layer.
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }
  const keywords = (body?.keywords || []).map((k) => String(k).trim()).filter(Boolean).slice(0, 12);
  if (!keywords.length) return NextResponse.json({ ok: false, error: "Keyword kosong." }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful: app still works with the built-in glossary.
    return NextResponse.json({ ok: true, configured: false, groups: [] });
  }

  const client = new Anthropic({ apiKey });
  const prompt = `You expand research keywords for a bibliometric search that must match papers written in ENGLISH and INDONESIAN.

Topic: ${body.topik || "(unspecified)"}
Keywords (one per line):
${keywords.map((k) => "- " + k).join("\n")}

For EACH keyword, produce one equivalence group: an array of surface forms with the SAME meaning, including:
- the original keyword
- its English translation (if Indonesian) or Indonesian translation (if English)
- common synonyms, abbreviations and spelling variants in BOTH languages

Rules:
- Output ONLY a JSON array of arrays of lowercase strings. No prose, no markdown fences.
- Exactly one inner array per keyword, in the SAME order as given.
- Max 8 items per group; keep each term 1-4 words; avoid overly generic words.

Example: [["artificial intelligence","kecerdasan buatan","ai"],["fraud","kecurangan","penipuan"]]`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Format respons tidak dikenali.");
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error("Bukan array.");
    const groups: string[][] = parsed
      .filter((g: unknown) => Array.isArray(g))
      .map((g: unknown[]) => g.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 8))
      .filter((g: string[]) => g.length >= 2);
    return NextResponse.json({ ok: true, configured: true, groups });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Gagal memanggil model.";
    return NextResponse.json({ ok: true, configured: true, groups: [], error }, { status: 200 });
  }
}
