"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  Home,
  LayoutDashboard,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MojodaaLogo } from "@/components/brand/mojodaa-logo";

const CUSTOMER_TABS: {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/create",
    label: "Share",
    icon: Share2,
    match: (p) => p.startsWith("/create"),
  },
  {
    href: "/rewards",
    label: "Points",
    icon: Sparkles,
    match: (p) => p.startsWith("/rewards") || p.startsWith("/efdaagifts"),
  },
  {
    href: "/dashboard",
    label: "Activity",
    icon: LayoutDashboard,
    match: (p) => p.startsWith("/dashboard"),
  },
];

/** Hide bottom nav on transactional / immersive screens. */
const HIDDEN_PREFIXES = ["/t/", "/redeem/", "/login", "/demo", "/admin"];

export function CustomerBottomNav() {
  const pathname = usePathname() || "/";

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1 safe-pb">
        {CUSTOMER_TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25]")}
                  aria-hidden
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CustomerHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur safe-pt">
      <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <Link
            href="/"
            className="min-w-0 flex-1 focus-visible:outline-none"
            aria-label="MOJODAA home"
          >
            <MojodaaLogo height={220} priority />
          </Link>
          {right ?? (
            <Link
              href="/efdaagifts"
              className="mt-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              <Gift className="size-5" aria-hidden />
              Gifts
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function CustomerShell({
  children,
  showHeader = true,
  showBottomNav = true,
  headerRight,
  wide = false,
}: {
  children: React.ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  headerRight?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {showHeader && <CustomerHeader right={headerRight} />}
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6",
          wide ? "max-w-2xl" : "max-w-lg",
          showBottomNav && "pb-24 md:pb-8",
        )}
      >
        {children}
      </main>
      {showBottomNav && <CustomerBottomNav />}
    </div>
  );
}
