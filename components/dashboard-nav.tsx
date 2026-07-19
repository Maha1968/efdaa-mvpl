import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type NavLink = { href: string; label: string };

/** Compact pill nav — prefer CustomerBottomNav / AdminShell for primary chrome. */
export function DashboardNav({
  current,
  links,
}: {
  current: string;
  links: NavLink[];
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Section">
      {links.map((link) => {
        const active = current === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "bg-surface-muted text-text-secondary hover:bg-border hover:text-text-primary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const CUSTOMER_NAV: NavLink[] = [
  { href: "/dashboard", label: "My recommendations" },
  { href: "/rewards", label: "My points" },
];

export const ADMIN_NAV: NavLink[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/network", label: "Network" },
  { href: "/admin/purchase-view", label: "Purchases" },
  { href: "/admin/assist", label: "Referral Assist" },
  { href: "/admin/purchases", label: "Validate" },
];
