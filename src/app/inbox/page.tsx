"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { NewRfqDialog } from "@/components/new-rfq-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, Inbox } from "lucide-react";
import type { RFQ } from "@/core/types";

export default function InboxPage() {
    const router = useRouter();
    const [rfqs, setRfqs] = useState<RFQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [creating, setCreating] = useState(false);

    const fetchRfqs = async () => {
        try {
            const res = await fetch("/api/rfqs");
            const data = await res.json();
            setRfqs(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRfqs();
    }, []);

    const handleCreateRfq = async (data: {
        customerName: string;
        subject: string;
        rawText: string;
    }) => {
        setCreating(true);
        try {
            const res = await fetch("/api/rfqs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                await fetchRfqs();
            }
        } finally {
            setCreating(false);
        }
    };

    const filtered = rfqs.filter(
        (r) =>
            r.customerName.toLowerCase().includes(search.toLowerCase()) ||
            r.subject.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">RFQ Inbox</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {rfqs.length} request{rfqs.length !== 1 ? "s" : ""} for quote
                    </p>
                </div>
                <NewRfqDialog onSubmit={handleCreateRfq} loading={creating} />
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by customer or subject..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                    <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                        {search ? "No matching RFQs found" : "No RFQs yet. Create your first one!"}
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[240px]">Customer</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead className="w-[140px]">Status</TableHead>
                                <TableHead className="w-[160px] text-right">Last Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((rfq) => (
                                <TableRow
                                    key={rfq.id}
                                    className="cursor-pointer transition-colors hover:bg-muted/50"
                                    onClick={() => router.push(`/rfq/${rfq.id}`)}
                                    tabIndex={0}
                                    role="link"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") router.push(`/rfq/${rfq.id}`);
                                    }}
                                >
                                    <TableCell className="font-medium">{rfq.customerName}</TableCell>
                                    <TableCell className="text-muted-foreground">{rfq.subject}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={rfq.status} />
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                        {new Date(rfq.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
