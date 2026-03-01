"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Settings, ClipboardList, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/audit", label: "Audit Log", icon: ClipboardList },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex h-screen w-[240px] flex-col border-r border-border bg-sidebar">
            {/* Logo */}
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-sm font-bold tracking-tight">ForgeSight AI</h1>
                    <p className="text-[10px] text-muted-foreground">Manufacturing Copilot</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-3">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <li key={item.label}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        isActive && "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3">
                <p className="text-[10px] text-muted-foreground">
                    Demo Mode — No API Keys
                </p>
            </div>
        </aside>
    );
}
