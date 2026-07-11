import Link from "next/link";

type NavLink = { href: string; label: string };

export function DashboardNav({
  current,
  links,
}: {
  current: string;
  links: NavLink[];
}) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {links.map((link) => {
        const active = current === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              active
                ? "bg-emerald-700 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
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
