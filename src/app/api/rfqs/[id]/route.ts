import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { Actor, AuditAction } from "@/core/types";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }
    return NextResponse.json(rfq);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    try {
        const body = await request.json();
        const { extractedFields, status } = body;

        const patch: Record<string, unknown> = {};
        if (extractedFields) {
            patch.extractedFields = extractedFields;
        }
        if (status) {
            patch.status = status;
        }

        const updated = updateRfq(id, patch);

        // Log field overrides/confirmations
        if (body.auditAction) {
            appendAudit(id, {
                at: new Date().toISOString(),
                actor: Actor.USER,
                action: body.auditAction as AuditAction,
                detail: body.auditDetail || "",
            });
        }

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
}
