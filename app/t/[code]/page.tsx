import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TokenClaimFlow } from "@/components/token-claim-flow";
import { isTokenExpired } from "@/lib/tokens/helpers";
import { hasTokenBeenRedeemed } from "@/lib/tokens/redemption";
import { logReferralEvent } from "@/lib/actions/events";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function TokenLandingPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            You&apos;ve received an offer
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Sign in to claim token{" "}
            <span className="font-mono font-semibold">{code}</span>
          </p>
          <Link
            href={`/login?next=/t/${code}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Sign in to claim
          </Link>
        </div>
      </main>
    );
  }

  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .single();

  if (!token) notFound();

  await logReferralEvent({
    tokenId: token.id,
    eventType: "opened",
    actorUserId: user.id,
  });

  if (isTokenExpired(token.expires_at)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            EFDAA
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            This offer has expired
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            This token expired on{" "}
            {new Date(token.expires_at).toLocaleString()}. Ask the sender for a
            new link.
          </p>
          <Link href="/" className="mt-6 inline-block text-emerald-700 underline">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: product }, { data: offer }, alreadyRedeemed] = await Promise.all([
    supabase.from("products").select("name, price, barcode").eq("id", token.product_id).single(),
    supabase.from("offers").select("name, base_reward_pct").eq("id", token.offer_id).single(),
    hasTokenBeenRedeemed(supabase, token.id),
  ]);

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          EFDAA
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          Token offer
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Code: <span className="font-mono font-semibold">{code}</span>
        </p>

        <div className="mt-8">
          <TokenClaimFlow
            token={{
              ...token,
              product: product ?? null,
              offer: offer ?? null,
            }}
            alreadyRedeemed={alreadyRedeemed}
          />
        </div>
      </div>
    </main>
  );
}
