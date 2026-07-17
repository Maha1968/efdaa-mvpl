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
            photos={[]}
            senderFirstName={payload.senderFirstName}
            needsClaim
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

  const isHolder = payload.token.holder_user_id === user.id;

  // Opening someone else's link: if we already claimed, go to our child token.
  if (!isHolder) {
    const { data: existingChild } = await supabase
      .from("tokens")
      .select("code")
      .eq("parent_token_id", payload.token.id)
      .eq("holder_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChild?.code) {
      redirect(`/t/${existingChild.code}`);
    }
  }

  const alreadyRedeemed = await hasTokenBeenRedeemed(
    supabase,
    payload.token.id,
  );

  // Sender first name for a claimed token: the parent holder (who shared it).
  let senderFirstName = payload.senderFirstName;
  if (isHolder && payload.token.parent_token_id) {
    const { data: parent } = await supabase
      .from("tokens")
      .select("holder_user_id")
      .eq("id", payload.token.parent_token_id)
      .maybeSingle();
    if (parent?.holder_user_id) {
      const { data: parentUser } = await supabase
        .from("users")
        .select("name")
        .eq("id", parent.holder_user_id)
        .maybeSingle();
      const first = parentUser?.name?.trim().split(/\s+/)[0];
      if (first) senderFirstName = first;
    }
  }

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
          photos={isHolder ? payload.photos : []}
          senderFirstName={senderFirstName}
          needsClaim={!isHolder}
        />
      </div>
    </main>
  );
}
