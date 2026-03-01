import { v4 as uuidv4 } from "uuid";
import { RFQStatus, AuditAction, Actor, type RFQ, type AuditEvent } from "./types";
import { getSeedRFQs } from "./seed";

// ── In-memory store (server-side singleton) ────────────────────────────────

let store: Map<string, RFQ> | null = null;

function getStore(): Map<string, RFQ> {
    if (!store) {
        store = new Map();
        // Auto-seed on first access
        const seeds = getSeedRFQs();
        for (const rfq of seeds) {
            store.set(rfq.id, rfq);
        }
    }
    return store;
}

// ── CRUD helpers ───────────────────────────────────────────────────────────

export function getAllRfqs(): RFQ[] {
    const s = getStore();
    return Array.from(s.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getRfq(id: string): RFQ | undefined {
    return getStore().get(id);
}

export function createRfq(data: {
    customerName: string;
    subject: string;
    rawText: string;
}): RFQ {
    const s = getStore();
    const rfq: RFQ = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        customerName: data.customerName,
        subject: data.subject,
        status: RFQStatus.NEW,
        rawText: data.rawText,
        extractedFields: [],
        quote: null,
        audit: [
            {
                at: new Date().toISOString(),
                actor: Actor.USER,
                action: AuditAction.RFQ_CREATED,
                detail: `RFQ created for ${data.customerName}: "${data.subject}"`,
            },
        ],
    };
    s.set(rfq.id, rfq);
    return rfq;
}

export function updateRfq(
    id: string,
    patch: Partial<Omit<RFQ, "id" | "createdAt">>
): RFQ | undefined {
    const s = getStore();
    const existing = s.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    s.set(id, updated);
    return updated;
}

export function appendAudit(id: string, event: AuditEvent): void {
    const s = getStore();
    const existing = s.get(id);
    if (!existing) return;
    existing.audit.push(event);
    s.set(id, existing);
}
