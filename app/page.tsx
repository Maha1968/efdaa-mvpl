import Link from "next/link";
import { Gift, Share2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getAppRole } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { MojodaaLogo } from "@/components/brand/mojodaa-logo";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  formatRewardAmount,
  roundRewardAmount,
} from "@/lib/purchases/rewards";

function getDisplayName(user: {
  user_metadata?: { name?: string };
  email?: string;
  phone?: string;
}) {
  return (
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    user.phone ||
    "there"
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getAppRole();
  const displayName = getDisplayName(user);
  const firstName = String(displayName).trim().split(/\s+/)[0] || "there";

  if (role === "admin") {
    return (
      <main className="flex flex-1 flex-col px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <MojodaaLogo height={24} />
          <h1 className="text-page-title mt-3">Hello, {firstName}</h1>
          <p className="text-supporting mt-2">
            Administrator accounts can only access operations dashboards. They
            cannot recommend products or earn points.
          </p>
          <ButtonLink href="/admin" fullWidth className="mt-8">
            Open administrator dashboard
          </ButtonLink>
          <Card className="mt-6">
            <p className="text-label">Signed in as</p>
            <p className="mt-1 text-sm text-text-primary">
              {user.email || user.phone || "Admin"}
            </p>
            <p className="text-caption mt-3">Role: administrator (permanent)</p>
          </Card>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="secondary" fullWidth>
              Sign out
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const { data: myRewards } = await supabase
    .from("rewards")
    .select("amount")
    .eq("user_id", user.id);

  const lifetime = roundRewardAmount(
    (myRewards ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
  );

  const { count: activeCount } = await supabase
    .from("tokens")
    .select("id", { count: "exact", head: true })
    .eq("holder_user_id", user.id)
    .gt("expires_at", new Date().toISOString());

  return (
    <CustomerShell>
      <div className="space-y-6">
        <header>
          <MojodaaLogo height={28} />
          <h1 className="text-page-title mt-2">Hi, {firstName}</h1>
          <p className="text-supporting mt-2">
            Found something you love? Share it with friends — you both earn
            MOJODAA points when they buy.
          </p>
        </header>

        <MetricCard
          label="Your MOJODAA points"
          value={formatRewardAmount(lifetime)}
          hint="Lifetime earnings"
          tone="accent"
        />

        <ButtonLink href="/create" fullWidth className="gap-2">
          <Share2 className="size-5" aria-hidden />
          Share a find
        </ButtonLink>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/rewards"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
          >
            <Sparkles className="size-5 text-accent" aria-hidden />
            <p className="text-card-title mt-2">My points</p>
            <p className="text-caption mt-0.5">
              {formatRewardAmount(lifetime)} pts
            </p>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
          >
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {activeCount ?? 0}
            </p>
            <p className="text-card-title mt-1">Active finds</p>
            <p className="text-caption mt-0.5">Still sharing</p>
          </Link>
        </div>

        <Card>
          <p className="text-card-title">What&apos;s next?</p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li className="flex gap-2">
              <span className="font-semibold text-primary">1.</span>
              Photograph a find you love (1–5 photos).
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">2.</span>
              Share the link on WhatsApp.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">3.</span>
              Earn points when friends buy.
            </li>
          </ul>
          <Link
            href="/efdaagifts"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <Gift className="size-4" aria-hidden />
            Browse MOJODAA gifts
          </Link>
        </Card>

        <Card className="!bg-surface-muted !shadow-none">
          <p className="text-label">Signed in as</p>
          <p className="mt-1 text-sm text-text-primary">
            {user.email || user.phone || "Customer"}
          </p>
          <form action={signOut} className="mt-4">
            <Button type="submit" variant="secondary" size="md" fullWidth>
              Sign out
            </Button>
          </form>
        </Card>
      </div>
    </CustomerShell>
  );
}
