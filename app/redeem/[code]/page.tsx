import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShareOnWhatsApp } from "@/components/share-on-whatsapp";
import { isTokenExpired } from "@/lib/tokens/helpers";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ shared?: string }>;
};

/** Stage 5 placeholder — full purchase flow comes next. */
export default async function RedeemPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { shared } = await searchParams;
  const supabase = await createClient();

  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .single();

  if (!token) notFound();

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", token.product_id)
    .single();

  const productName = product?.name ?? "this product";

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

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          Redeem
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
          Purchase flow
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          You chose to redeem <strong>{productName}</strong>. The full receipt
          upload flow arrives in Stage 5.
        </p>

        {shared && (
          <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-700">
              Your new token is ready to share
            </p>
            <ShareOnWhatsApp code={shared} productName={productName} />
          </div>
        )}

        <Link
          href="/"
          className="mt-6 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-base font-medium text-zinc-700"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
