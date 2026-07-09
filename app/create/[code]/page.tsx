import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShareOnWhatsApp } from "@/components/share-on-whatsapp";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import { getTokenShareUrl } from "@/lib/utils/app-url";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function TokenCreatedPage({
  params,
  searchParams,
}: PageProps) {
  const { code } = await params;
  const { from } = await searchParams;
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
  const shareUrl = getTokenShareUrl(code);
  const expiresAt = new Date(token.expires_at).toLocaleString();

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Token ready
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
            Share your offer
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Send this link via WhatsApp. Anyone who opens it can claim, redeem,
            or share it.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-zinc-500">Product</p>
            <p className="mt-1 text-base text-zinc-900">{productName}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-500">Token code</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-zinc-900">
              {code}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-500">Share link</p>
            <p className="mt-1 break-all text-sm text-emerald-700">{shareUrl}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-500">Expires</p>
            <p className="mt-1 text-sm text-zinc-900">
              {expiresAt} ({TOKEN_VALIDITY_HOURS}h from creation)
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <ShareOnWhatsApp code={code} productName={productName} />

          {from?.startsWith("/t/") && (
            <Link
              href={from}
              className="block w-full rounded-xl border border-emerald-700 bg-white px-4 py-3 text-center text-base font-medium text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              Share again from original token
            </Link>
          )}

          <Link
            href="/create"
            className="block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Create another token
          </Link>

          <Link
            href="/"
            className="block w-full text-center text-sm text-zinc-500 underline"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
