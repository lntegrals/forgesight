"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { DocumentViewer } from "@/components/document-viewer";
import { FieldRow } from "@/components/field-row";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Sparkles, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import type { RFQ, ExtractedField } from "@/core/types";
import { RFQStatus, AuditAction } from "@/core/types";
import { toast } from "sonner";

export default function RFQReviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [rfq, setRfq] = useState<RFQ | null>(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [activeSnippet, setActiveSnippet] = useState<string | null>(null);

    const fetchRfq = useCallback(async () => {
        try {
            const res = await fetch(`/api/rfqs/${id}`);
            if (!res.ok) { router.push("/inbox"); return; }
            const data = await res.json();
            setRfq(data);
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => {
        fetchRfq();
    }, [fetchRfq]);

    // Auto-extract for NEW status
    useEffect(() => {
        if (rfq?.status === RFQStatus.NEW && !extracting) {
            handleExtract();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rfq?.status]);

    const handleExtract = async () => {
        setExtracting(true);
        try {
            const res = await fetch(`/api/rfqs/${id}/extract`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setRfq(data);
                toast.success("Fields extracted successfully");
            }
        } finally {
            setExtracting(false);
        }
    };

    const handleConfirm = async (key: string) => {
        if (!rfq) return;
        const fields = rfq.extractedFields.map((f) =>
            f.key === key ? { ...f, isConfirmed: true } : f
        );
        await updateFields(fields, AuditAction.FIELD_CONFIRMED, `Confirmed field: ${key}`);
    };

    const handleOverride = async (key: string, newValue: string) => {
        if (!rfq) return;
        const fields = rfq.extractedFields.map((f) =>
            f.key === key ? { ...f, userOverrideValue: newValue, isConfirmed: true } : f
        );
        await updateFields(fields, AuditAction.FIELD_OVERRIDDEN, `Overrode field "${key}" to "${newValue}"`);
    };

    const handleReset = async (key: string) => {
        if (!rfq) return;
        const fields = rfq.extractedFields.map((f) =>
            f.key === key ? { ...f, userOverrideValue: null, isConfirmed: false } : f
        );
        await updateFields(fields, AuditAction.FIELD_RESET, `Reset field: ${key}`);
    };

    const updateFields = async (fields: ExtractedField[], auditAction: AuditAction, auditDetail: string) => {
        const res = await fetch(`/api/rfqs/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ extractedFields: fields, auditAction, auditDetail }),
        });
        if (res.ok) {
            const data = await res.json();
            setRfq(data);
        }
    };

    const handleGenerateQuote = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/rfqs/${id}/quote`, { method: "POST" });
            if (res.ok) {
                toast.success("Quote generated successfully");
                router.push(`/rfq/${id}/quote`);
            }
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 gap-6">
                    <Skeleton className="h-[500px]" />
                    <Skeleton className="h-[500px]" />
                </div>
            </div>
        );
    }

    if (!rfq) return null;

    const needsReviewCount = rfq.extractedFields.filter(
        (f) => f.confidence < 0.85 && !f.isConfirmed
    ).length;
    const allConfirmed = rfq.extractedFields.length > 0 && rfq.extractedFields.every((f) => f.isConfirmed || f.confidence >= 0.85);
    const highlightSnippets = rfq.extractedFields.map((f) => f.sourceSnippet).filter(Boolean);

    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <div className="border-b border-border px-6 py-4 lg:px-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/inbox")} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Inbox
                    </Button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold">{rfq.subject}</h1>
                            <StatusBadge status={rfq.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{rfq.customerName}</p>
                    </div>
                    {extracting && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Extracting fields...
                        </div>
                    )}
                </div>
            </div>

            {/* Review banner */}
            {rfq.extractedFields.length > 0 && (
                <div className="border-b border-border px-6 py-2.5 lg:px-8">
                    {needsReviewCount > 0 ? (
                        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/10">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-sm text-amber-800 dark:text-amber-400">
                                <strong>{needsReviewCount}</strong> field{needsReviewCount !== 1 ? "s" : ""} need{needsReviewCount === 1 ? "s" : ""} review before generating a quote.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-400">
                                All fields confirmed. Ready to generate quote.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            {/* Two-column layout */}
            <div className="flex-1 overflow-hidden">
                <div className="grid h-full grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Document viewer */}
                    <div className="border-r border-border p-4 overflow-hidden flex flex-col">
                        <DocumentViewer
                            rawText={rfq.rawText}
                            highlightSnippets={highlightSnippets}
                            activeSnippet={activeSnippet}
                        />
                    </div>

                    {/* Right: Extracted fields */}
                    <div className="flex flex-col overflow-y-auto p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Extracted Fields ({rfq.extractedFields.length})
                            </h2>
                            {rfq.status === RFQStatus.NEW && (
                                <Button size="sm" variant="outline" onClick={handleExtract} disabled={extracting} className="gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Extract
                                </Button>
                            )}
                        </div>

                        {rfq.extractedFields.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
                                <p className="text-sm text-muted-foreground">
                                    {extracting ? "Extracting fields..." : "No fields extracted yet. Click Extract to begin."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rfq.extractedFields.map((field) => (
                                    <FieldRow
                                        key={field.key}
                                        field={field}
                                        onConfirm={handleConfirm}
                                        onOverride={handleOverride}
                                        onReset={handleReset}
                                        onSourceClick={(snippet) => setActiveSnippet(snippet)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Generate Quote CTA */}
                        {rfq.extractedFields.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-border">
                                <Button
                                    className="w-full gap-2"
                                    size="lg"
                                    disabled={!allConfirmed || generating}
                                    onClick={handleGenerateQuote}
                                >
                                    {generating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                    {generating ? "Generating Quote..." : "Generate Quote"}
                                </Button>
                                {!allConfirmed && (
                                    <p className="mt-1.5 text-center text-xs text-muted-foreground">
                                        Confirm all flagged fields to enable quote generation
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
