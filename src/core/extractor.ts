/**
 * extractor.ts — Field extraction adapter.
 *
 * MOCK mode (default): deterministic regex/keyword extractor.
 *   Works with no API keys. Demo-safe.
 * LLM mode: calls Anthropic Messages API, validates output with Zod.
 *   Activated when ANTHROPIC_API_KEY is set and mode is ExtractorMode.LLM.
 */
import { z } from "zod";
import { ExtractorMode, type ExtractedField } from "./types";

// ── Zod schema for validated LLM output ─────────────────────────────────────

const ExtractedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  sourceSnippet: z.string(),
  sourceRef: z.string(),
});

export const ExtractedRFQSchema = z.object({
  fields: z.array(ExtractedFieldSchema),
});

type ExtractedRFQOutput = z.infer<typeof ExtractedRFQSchema>;

// ── Main entry point ─────────────────────────────────────────────────────────

export async function extractFields(
  rawText: string,
  mode: ExtractorMode = ExtractorMode.MOCK
): Promise<ExtractedField[]> {
  if (mode === ExtractorMode.LLM && process.env.ANTHROPIC_API_KEY) {
    try {
      return await extractFieldsLLM(rawText);
    } catch (err) {
      console.warn("[extractor] LLM extraction failed, falling back to MOCK:", err);
    }
  }
  return extractFieldsMock(rawText);
}

// ── LLM extractor (Anthropic Messages API) ───────────────────────────────────

async function extractFieldsLLM(rawText: string): Promise<ExtractedField[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  const systemPrompt = `You are a manufacturing RFQ parser. Extract structured fields from the provided RFQ text.
Return ONLY valid JSON matching this exact schema:
{
  "fields": [
    {
      "key": "material",
      "label": "Material",
      "value": "6061-T6 Aluminum",
      "confidence": 0.95,
      "sourceSnippet": "exact text from the RFQ",
      "sourceRef": "Line N"
    }
  ]
}
Extract these fields when clearly present: material, quantity, tolerance, finish, dueDate, partNumber, process.
Omit fields not found. Set confidence 0.0–1.0 based on clarity of evidence in the text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: rawText }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const result = await response.json() as { content: { text: string }[] };
  const text = result.content[0]?.text ?? "";

  // Extract JSON from response (may contain markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in LLM response");

  const parsed = JSON.parse(jsonMatch[0]) as unknown;
  const validated: ExtractedRFQOutput = ExtractedRFQSchema.parse(parsed);

  return validated.fields.map((f) => ({
    ...f,
    isConfirmed: false,
    userOverrideValue: null,
  }));
}

// ── MOCK extractor (deterministic regex) ─────────────────────────────────────

function extractFieldsMock(rawText: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const lines = rawText.split("\n");

  function findMatch(
    pattern: RegExp,
    key: string,
    label: string,
    highConfidence: boolean = true
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(pattern);
      if (match) {
        const value = match[1]?.trim() ?? match[0].trim();
        fields.push({
          key,
          label,
          value,
          confidence: highConfidence ? 0.92 : 0.65,
          sourceSnippet: lines[i].trim(),
          sourceRef: `Line ${i + 1}`,
          isConfirmed: false,
          userOverrideValue: null,
        });
        return;
      }
    }
  }

  // Material
  findMatch(/material[:\s]+(.+)/i, "material", "Material", true);
  if (!fields.find((f) => f.key === "material")) {
    const materialKeywords = /\b(aluminum|steel|stainless|titanium|brass|copper|6061|7075|304|316|A36)\b/i;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(materialKeywords);
      if (match) {
        fields.push({
          key: "material",
          label: "Material",
          value: match[1],
          confidence: 0.72,
          sourceSnippet: lines[i].trim(),
          sourceRef: `Line ${i + 1}`,
          isConfirmed: false,
          userOverrideValue: null,
        });
        break;
      }
    }
  }

  // Quantity
  findMatch(/(?:quantity|qty|units)[:\s]*(\d[\d,]*)/i, "quantity", "Quantity", true);
  if (!fields.find((f) => f.key === "quantity")) {
    findMatch(/(\d{2,})\s*(?:pcs|pieces|parts|units|ea)/i, "quantity", "Quantity", false);
  }

  // Tolerance
  findMatch(/tolerance[:\s]*([^\n,]+)/i, "tolerance", "Tolerance", true);
  if (!fields.find((f) => f.key === "tolerance")) {
    findMatch(/(±\s*[\d.]+\s*(?:mm|in|"|thou)?)/i, "tolerance", "Tolerance", false);
  }

  // Finish / Surface
  findMatch(/(?:finish|surface)[:\s]*(.+)/i, "finish", "Surface Finish", true);

  // Due Date / Delivery
  findMatch(/(?:due\s*date|delivery|deadline|needed\s*by|ship\s*by)[:\s]*(.+)/i, "dueDate", "Due Date", true);
  if (!fields.find((f) => f.key === "dueDate")) {
    findMatch(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, "dueDate", "Due Date", false);
  }

  // Part number
  findMatch(/(?:part\s*(?:no|number|#|num))[:\s]*(.+)/i, "partNumber", "Part Number", true);

  // Process / Method
  findMatch(/(?:process|method|machining)[:\s]*(.+)/i, "process", "Process", false);

  if (fields.length === 0) {
    fields.push({
      key: "material",
      label: "Material",
      value: "Not detected",
      confidence: 0.2,
      sourceSnippet: lines[0]?.trim() ?? "",
      sourceRef: "Line 1",
      isConfirmed: false,
      userOverrideValue: null,
    });
  }

  return fields;
}
