import { v4 as uuidv4 } from "uuid";
import {
  RFQStatus,
  AuditAction,
  Actor,
  type RFQ,
  type AuditEvent,
  type Actuals,
} from "./types";
import { getSeedRFQs } from "./seed";

// ── In-memory store (server-side singleton) ────────────────────────────────

let store: Map<string, RFQ> | null = null;

function getStore(): Map<string, RFQ> {
  if (!store) {
    store = new Map();
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
  externalId?: string;
  sourceType?: "manual" | "file" | "webhook";
  attachmentName?: string;
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
    ...(data.externalId ? { externalId: data.externalId } : {}),
    ...(data.sourceType ? { sourceType: data.sourceType } : {}),
    ...(data.attachmentName ? { attachmentName: data.attachmentName } : {}),
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

/** Record actuals against a sent RFQ and append audit event. */
export function recordActuals(id: string, actuals: Actuals): RFQ | undefined {
  const s = getStore();
  const existing = s.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, actuals };
  s.set(id, updated);
  appendAudit(id, {
    at: new Date().toISOString(),
    actor: Actor.USER,
    action: AuditAction.ACTUALS_RECORDED,
    detail: `Actuals recorded — material: $${actuals.materialCost}, setup: ${actuals.setupHours}h, labor: ${actuals.laborHours}h, machine: ${actuals.machineHours}h`,
  });
  return getRfq(id);
}

/** Find an RFQ by externalId (for webhook deduplication). */
export function findByExternalId(externalId: string): RFQ | undefined {
  const s = getStore();
  for (const rfq of s.values()) {
    if (rfq.externalId === externalId) return rfq;
  }
  return undefined;
}

/** Reset the store and re-seed with demo data. */
export function resetStore(): void {
  store = null; // next getStore() call will re-seed
}
