import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { extractFields } from "@/core/extractor";
import { RFQStatus, Actor, AuditAction } from "@/core/types";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    // Run the stub extractor on raw text
    const fields = extractFields(rfq.rawText);

    updateRfq(id, {
        extractedFields: fields,
        status: RFQStatus.NEEDS_REVIEW,
    });

    appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.SYSTEM,
        action: AuditAction.FIELDS_EXTRACTED,
        detail: `Extracted ${fields.length} fields from RFQ text (stub extractor)`,
    });

    const updated = getRfq(id);
    return NextResponse.json(updated);
}
