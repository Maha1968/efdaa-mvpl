import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RedeemForm } from "@/components/redeem-form";
import { isTokenExpired } from "@/lib/tokens/helpers";
import { hasTokenBeenRedeemed } from "@/lib/tokens/redemption";
import { isAdminUser } from "@/lib/auth/admin";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function RedeemPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/redeem/${code}`);
  }

  if (await isAdminUser()) redirect("/admin");

  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .single();

  if (!token) notFound();

  if (isTokenExpired(token.expires_at)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            This offer has expired
          </h1>
          <Link href="/" className="mt-6 inline-block text-emerald-700 underline">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  if (await hasTokenBeenRedeemed(supabase, token.id)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Already redeemed
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            This token has already been redeemed. You can still share it with
            others.
          </p>
          <Link
            href={`/t/${code}`}
            className="mt-6 inline-block w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white"
          >
            Back to token — share again
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: product }, { data: stores }] = await Promise.all([
    supabase.from("products").select("*").eq("id", token.product_id).single(),
    supabase.from("stores").select("*").order("name"),
  ]);

  if (!product || !stores?.length) {
    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Setup incomplete</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Product or store data is missing in Supabase.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link href={`/t/${code}`} className="text-sm text-emerald-700 underline">
          ← Back to token
        </Link>

        <div className="mb-8 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Redeem
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            Submit your purchase
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Select the store, capture your location, enter the receipt details,
            and upload a photo of your bill. You can only redeem this token once.
          </p>
        </div>

        <RedeemForm
          tokenCode={code}
          product={product}
          stores={stores}
          userId={user.id}
        />
      </div>
    </main>
  );
}
