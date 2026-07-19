import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { AdminPurchaseActions } from "@/components/admin-purchase-actions";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { notFound } from "next/navigation";

export default async function AdminPurchasesPage() {
  if (!(await isAdminUser())) notFound();

  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const enriched = await Promise.all(
    (purchases ?? []).map(async (purchase) => {
      const { data: token } = await supabase
        .from("tokens")
        .select("code, product_id")
        .eq("id", purchase.token_id)
        .single();

      const [{ data: store }, { data: product }] = await Promise.all([
        purchase.store_id
          ? supabase
              .from("stores")
              .select("name, address")
              .eq("id", purchase.store_id)
              .single()
          : Promise.resolve({ data: null }),
        token?.product_id
          ? supabase
              .from("products")
              .select("name, barcode")
              .eq("id", token.product_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      return { purchase, token, store, product };
    }),
  );

  return (
    <>
      <PageHeader
        eyebrow="Validate"
        title="Pending purchases"
        description="Review receipts and validate or reject each purchase. Buyer shown as User ID only."
      />

      {enriched.length === 0 ? (
        <EmptyState
          title="No pending purchases"
          description="When customers submit receipts, they appear here for review."
        />
      ) : (
        <div className="space-y-6">
          {enriched.map(({ purchase, token, store, product }) => (
            <article
              key={purchase.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-label">Product</p>
                    <p className="text-text-primary">{product?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-label">Buyer</p>
                    <p className="font-mono text-text-primary">
                      {toPublicUserId(purchase.buyer_user_id)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label">Store</p>
                    <p className="text-text-primary">{store?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-label">Amount</p>
                    <p className="text-text-primary">₹{purchase.amount}</p>
                  </div>
                  <div>
                    <p className="text-label">Receipt barcode</p>
                    <p className="font-mono text-text-primary">
                      {purchase.receipt_barcode ?? "—"}
                    </p>
                    <p className="text-caption">
                      Product barcode: {product?.barcode ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-label">Token</p>
                    <p className="font-mono text-text-primary">
                      {token?.code ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-label">Purchase GPS</p>
                    <p className="text-text-primary">
                      {purchase.purchase_lat != null &&
                      purchase.purchase_lng != null
                        ? `${purchase.purchase_lat.toFixed(5)}, ${purchase.purchase_lng.toFixed(5)}`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  {purchase.receipt_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={purchase.receipt_image_url}
                      alt="Receipt"
                      className="h-64 w-full rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-text-muted">
                      No receipt image
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <AdminPurchaseActions purchaseId={purchase.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
