import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShareOnWhatsApp } from "@/components/share-on-whatsapp";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Card, PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
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

  const { data: product } = token.product_id
    ? await supabase
        .from("products")
        .select("name")
        .eq("id", token.product_id)
        .single()
    : { data: null };

  const productName =
    product?.name ??
    (token.category ? `Find — ${token.category}` : "your find");
  const shareUrl = getTokenShareUrl(code);
  const expiresAt = new Date(token.expires_at).toLocaleString();

  return (
    <CustomerShell showBottomNav={false}>
      <PageHeader
        eyebrow="Ready to share"
        title="Share your find"
        description="Send this link via WhatsApp. Friends who open it see your finds — and you both earn MOJODAA points when they buy."
      />

      <Card className="space-y-4">
        <div>
          <p className="text-label">Find</p>
          <p className="mt-1 text-base text-text-primary">{productName}</p>
        </div>
        <div>
          <p className="text-label">Code</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-text-primary">
            {code}
          </p>
        </div>
        <div>
          <p className="text-label">Share link</p>
          <p className="mt-1 break-all text-sm text-primary">{shareUrl}</p>
        </div>
        <div>
          <p className="text-label">Expires</p>
          <p className="mt-1 text-sm text-text-primary">
            {expiresAt} ({TOKEN_VALIDITY_HOURS}h window)
          </p>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        <ShareOnWhatsApp code={code} productName={productName} />
        {from?.startsWith("/t/") && (
          <ButtonLink href={from} variant="secondary" fullWidth>
            Share again from original
          </ButtonLink>
        )}
        <ButtonLink href="/create" variant="secondary" fullWidth>
          Share another find
        </ButtonLink>
        <Link
          href="/"
          className="block w-full py-2 text-center text-sm text-text-muted hover:text-text-secondary"
        >
          Back home
        </Link>
      </div>
    </CustomerShell>
  );
}
