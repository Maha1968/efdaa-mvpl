import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { TokenClaimFlow } from "@/components/token-claim-flow";
import { hasTokenBeenRedeemed } from "@/lib/tokens/redemption";
import { loadReceiverPayload } from "@/lib/tokens/receiver";
import { logReferralEvent } from "@/lib/actions/events";
import { isAdminUser } from "@/lib/auth/admin";
import { notFound, redirect } from "next/navigation";

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
    // Public preview: service role so finds + timer show before login.
    let payload;
    try {
      payload = await loadReceiverPayload(createServiceClient(), code);
    } catch {
      payload = null;
    }

    if (!payload) notFound();

    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-md">
          <TokenClaimFlow
            token={{
              ...payload.token,
              product: payload.product,
              offer: payload.offer,
            }}
            alreadyRedeemed={false}
            photos={payload.photos}
            senderFirstName={payload.senderFirstName}
            previewOnly
            signInHref={`/login?next=${encodeURIComponent(`/t/${code}`)}`}
          />
        </div>
      </main>
    );
  }

  if (await isAdminUser()) redirect("/admin");

  const payload = await loadReceiverPayload(supabase, code);
  if (!payload) notFound();

  await logReferralEvent({
    tokenId: payload.token.id,
    eventType: "opened",
    actorUserId: user.id,
  });

  const alreadyRedeemed = await hasTokenBeenRedeemed(
    supabase,
    payload.token.id,
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <TokenClaimFlow
          token={{
            ...payload.token,
            product: payload.product,
            offer: payload.offer,
          }}
          alreadyRedeemed={alreadyRedeemed}
          photos={payload.photos}
          senderFirstName={payload.senderFirstName}
        />
      </div>
    </main>
  );
}
