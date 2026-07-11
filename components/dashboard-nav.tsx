import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tokens", label: "Chains" },
  { href: "/dashboard/purchases", label: "Purchases" },
  { href: "/dashboard/leaderboard", label: "Leaderboard" },
  { href: "/rewards", label: "My points" },
];

export function DashboardNav({ current }: { current: string }) {
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
