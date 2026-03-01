import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { computeQuote } from "@/core/pricing";
import { RFQStatus, Actor, AuditAction, DEFAULT_SHOP_CONFIG } from "@/core/types";
import type { PricingInputs, ShopConfig } from "@/core/types";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    // Read optional shop config override from body
    let shopConfig: ShopConfig = DEFAULT_SHOP_CONFIG;
    try {
        const body = await request.json();
        if (body.shopConfig) {
            shopConfig = { ...DEFAULT_SHOP_CONFIG, ...body.shopConfig };
        }
    } catch {
        // Use defaults if no body
    }

    // Map confirmed/overridden extracted fields to pricing inputs
    const fieldValue = (key: string): string => {
        const field = rfq.extractedFields.find((f) => f.key === key);
        if (!field) return "";
        return field.userOverrideValue ?? field.value;
    };

    const parseNum = (val: string): number => {
        // Handle ranges like "25-50" by taking the first number
        const match = val.match(/[\d,.]+/);
        if (!match) return 0;
        return parseFloat(match[0].replace(/,/g, "")) || 0;
    };

    const qty = parseNum(fieldValue("quantity"));

    // Default pricing inputs based on extracted data
    const pricingInputs: PricingInputs = {
        quantity: qty,
        materialCostPerUnit: qty > 100 ? 2.50 : qty > 50 ? 4.75 : 12.50, // Scale with quantity
        materialQty: 1,
        setupHours: 2,
        laborHours: Math.max(1, Math.ceil(qty * 0.05)),
        machineHours: Math.max(1, Math.ceil(qty * 0.03)),
    };

    const quote = computeQuote(pricingInputs, shopConfig);

    updateRfq(id, {
        quote,
        status: RFQStatus.READY_TO_SEND,
    });

    appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.SYSTEM,
        action: AuditAction.QUOTE_GENERATED,
        detail: `Quote generated: $${quote.totals.total.toFixed(2)} total (${quote.lineItems.length} line items)`,
    });

    const updated = getRfq(id);
    return NextResponse.json(updated);
}
