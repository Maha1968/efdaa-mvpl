"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  LayoutGrid,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { MojodaaLogo } from "@/components/brand/mojodaa-logo";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/admin/purchases", label: "Validate", icon: ShieldCheck },
  { href: "/admin/purchase-view", label: "Purchases", icon: ShoppingBag },
  { href: "/admin/network", label: "Network", icon: GitBranch },
  { href: "/admin/assist", label: "Referral Assist", icon: Search },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Admin" className="space-y-1">
      {ADMIN_LINKS.map((link) => {
        const active = isActive(pathname, link.href, "exact" in link && link.exact);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="border-b border-border px-3 py-3">
          <MojodaaLogo height={180} />
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Admin
          </p>
        </div>
        <div className="flex-1 p-3">{nav}</div>
        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text-primary"
          >
            ← Account
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <MojodaaLogo height={180} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-text-muted">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="min-h-10 px-2"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">Menu</span>
        </Button>
      </div>

      {open && (
        <div
          id="admin-mobile-nav"
          className="border-b border-border bg-surface p-3 lg:hidden"
        >
          {nav}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
