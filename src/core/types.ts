// ── Enums ──────────────────────────────────────────────────────────────────

export enum RFQStatus {
  NEW = "NEW",
  EXTRACTED = "EXTRACTED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  READY_TO_SEND = "READY_TO_SEND",
  SENT = "SENT",
}

export enum LineItemType {
  MATERIAL = "MATERIAL",
  SETUP = "SETUP",
  RUN_TIME = "RUN_TIME",
  LABOR = "LABOR",
  OVERHEAD = "OVERHEAD",
  MARGIN = "MARGIN",
}

export enum AuditAction {
  RFQ_CREATED = "RFQ_CREATED",
  FIELDS_EXTRACTED = "FIELDS_EXTRACTED",
  FIELD_CONFIRMED = "FIELD_CONFIRMED",
  FIELD_OVERRIDDEN = "FIELD_OVERRIDDEN",
  FIELD_RESET = "FIELD_RESET",
  QUOTE_GENERATED = "QUOTE_GENERATED",
  EMAIL_SENT = "EMAIL_SENT",
}

export enum Actor {
  SYSTEM = "SYSTEM",
  USER = "USER",
}

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0..1
  sourceSnippet: string;
  sourceRef: string;
  isConfirmed: boolean;
  userOverrideValue: string | null;
}

export interface QuoteLineItem {
  type: LineItemType;
  label: string;
  formula: string;
  inputs: Record<string, number>;
  amount: number;
  why: string;
}

export interface QuoteTotals {
  subtotal: number;
  overheadAmount: number;
  marginPct: number;
  marginAmount: number;
  total: number;
}

export interface Quote {
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
  assumptions: string[];
}

export interface AuditEvent {
  at: string; // ISO datetime
  actor: Actor;
  action: AuditAction;
  detail: string;
}

export interface RFQ {
  id: string;
  createdAt: string; // ISO datetime
  customerName: string;
  subject: string;
  status: RFQStatus;
  rawText: string;
  extractedFields: ExtractedField[];
  quote: Quote | null;
  audit: AuditEvent[];
}

// ── Pricing Inputs ─────────────────────────────────────────────────────────

export interface PricingInputs {
  quantity: number;
  materialCostPerUnit: number;
  materialQty: number;
  setupHours: number;
  laborHours: number;
  machineHours: number;
}

export interface ShopConfig {
  setupRate: number;    // $/hr
  laborRate: number;    // $/hr
  machineRate: number;  // $/hr
  overheadPct: number;  // 0..1
  marginPct: number;    // 0..1
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  setupRate: 85,
  laborRate: 65,
  machineRate: 120,
  overheadPct: 0.15,
  marginPct: 0.20,
};
