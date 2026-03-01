import type { ExtractedField } from "./types";

/**
 * extractFields — Stub field extractor.
 *
 * Uses regex/keyword matching to extract plausible structured fields from raw RFQ text.
 * Returns confidence scores and source snippets for every field.
 *
 * If an LLM API key were available, this would be swapped for an AI-based extractor.
 * The stub guarantees the app runs with NO external keys.
 */
export function extractFields(rawText: string): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const lines = rawText.split("\n");

    // Helper: find a line matching a pattern, return the match and context
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

    // ── Extract known fields via patterns ────────────────────────────────

    // Material
    findMatch(/material[:\s]+(.+)/i, "material", "Material", true);
    if (!fields.find(f => f.key === "material")) {
        // Fuzzy: look for common material names
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
    if (!fields.find(f => f.key === "quantity")) {
        findMatch(/(\d{2,})\s*(?:pcs|pieces|parts|units|ea)/i, "quantity", "Quantity", false);
    }

    // Tolerance
    findMatch(/tolerance[:\s]*([^\n,]+)/i, "tolerance", "Tolerance", true);
    if (!fields.find(f => f.key === "tolerance")) {
        findMatch(/(±\s*[\d.]+\s*(?:mm|in|"|thou)?)/i, "tolerance", "Tolerance", false);
    }

    // Finish / Surface
    findMatch(/(?:finish|surface)[:\s]*(.+)/i, "finish", "Surface Finish", true);

    // Due Date / Delivery
    findMatch(/(?:due\s*date|delivery|deadline|needed\s*by|ship\s*by)[:\s]*(.+)/i, "dueDate", "Due Date", true);
    if (!fields.find(f => f.key === "dueDate")) {
        // Look for date patterns
        findMatch(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, "dueDate", "Due Date", false);
    }

    // Part number
    findMatch(/(?:part\s*(?:no|number|#|num))[:\s]*(.+)/i, "partNumber", "Part Number", true);

    // Process / Method
    findMatch(/(?:process|method|machining)[:\s]*(.+)/i, "process", "Process", false);

    // If no fields found, add a warning placeholder
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
