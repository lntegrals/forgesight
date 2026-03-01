"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { QuoteCard } from "@/components/quote-card";
import { ShopConfigSheet } from "@/components/shop-config-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import type { RFQ, ShopConfig } from "@/core/types";
import { DEFAULT_SHOP_CONFIG } from "@/core/types";
import { toast } from "sonner";

export default function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [rfq, setRfq] = useState<RFQ | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [shopConfig, setShopConfig] = useState<ShopConfig>(DEFAULT_SHOP_CONFIG);

    const fetchRfq = useCallback(async () => {
        try {
            const res = await fetch(`/api/rfqs/${id}`);
            if (!res.ok) { router.push("/inbox"); return; }
            const data = await res.json();
            setRfq(data);
            if (!data.quote) {
                router.push(`/rfq/${id}`);
            }
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => {
        fetchRfq();
    }, [fetchRfq]);

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const res = await fetch(`/api/rfqs/${id}/quote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopConfig }),
            });
            if (res.ok) {
                const data = await res.json();
                setRfq(data);
                toast.success("Quote regenerated with updated rates");
            }
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    if (!rfq || !rfq.quote) return null;

    const quote = rfq.quote;

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-1">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/rfq/${id}`)} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Review
                    </Button>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Quote Builder</h1>
                            <StatusBadge status={rfq.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {rfq.customerName} — {rfq.subject}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ShopConfigSheet config={shopConfig} onConfigChange={setShopConfig} />
                        <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating} className="gap-1.5">
                            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Regenerate
                        </Button>
                    </div>
                </div>
            </div>

            {/* Cost breakdown cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {quote.lineItems.map((item, i) => (
                    <QuoteCard key={i} item={item} />
                ))}
            </div>

            <Separator className="my-6" />

            {/* Totals */}
            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Quote Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="tabular-nums">${quote.totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Overhead ({(quote.totals.marginPct !== undefined ? Math.round(shopConfig.overheadPct * 100) : 15)}%)</span>
                            <span className="tabular-nums">${quote.totals.overheadAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Margin ({Math.round(quote.totals.marginPct * 100)}%)</span>
                            <span className="tabular-nums">${quote.totals.marginAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="tabular-nums">${quote.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Assumptions */}
            {quote.assumptions.length > 0 && (
                <Card className="mb-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Assumptions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            {quote.assumptions.map((a, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                    {a}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* CTA */}
            <div className="flex justify-end">
                <Button size="lg" className="gap-2" onClick={() => router.push(`/rfq/${id}/send`)}>
                    Ready to Send
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
