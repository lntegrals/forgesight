import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { extractFields } from "@/core/extractor";
import { RFQStatus, Actor, AuditAction, ExtractorMode } from "@/core/types";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    // Run field extractor (LLM if key present, else deterministic MOCK)
    const mode = process.env.ANTHROPIC_API_KEY ? ExtractorMode.LLM : ExtractorMode.MOCK;
    const fields = await extractFields(rfq.rawText, mode);

    updateRfq(id, {
        extractedFields: fields,
        status: RFQStatus.NEEDS_REVIEW,
    });

    appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.SYSTEM,
        action: AuditAction.FIELDS_EXTRACTED,
        detail: `Extracted ${fields.length} fields from RFQ text (${mode} mode)`,
    });

    const updated = getRfq(id);
    return NextResponse.json(updated);
}
