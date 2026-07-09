import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { AdminPurchaseActions } from "@/components/admin-purchase-actions";
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

      const [{ data: buyer }, { data: store }, { data: product }] =
        await Promise.all([
          supabase
            .from("users")
            .select("name, phone")
            .eq("id", purchase.buyer_user_id)
            .single(),
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

      return { purchase, token, buyer, store, product };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Back home
        </Link>

        <div className="mb-8 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Admin
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            Pending purchases
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Review receipts and validate or reject each purchase.
          </p>
        </div>

        {enriched.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No pending purchases right now.
          </p>
        ) : (
          <div className="space-y-6">
            {enriched.map(({ purchase, token, buyer, store, product }) => (
              <article
                key={purchase.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-zinc-500">Product</p>
                      <p className="text-zinc-900">{product?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Buyer</p>
                      <p className="text-zinc-900">{buyer?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Store</p>
                      <p className="text-zinc-900">{store?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Amount</p>
                      <p className="text-zinc-900">₹{purchase.amount}</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Receipt barcode</p>
                      <p className="font-mono text-zinc-900">
                        {purchase.receipt_barcode ?? "—"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Product barcode: {product?.barcode ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Token</p>
                      <p className="font-mono text-zinc-900">{token?.code ?? "—"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Hours since originator</p>
                      <p className="text-zinc-900">
                        {purchase.time_to_purchase_hours ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-500">Purchase GPS</p>
                      <p className="text-zinc-900">
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
                        className="h-64 w-full rounded-xl border border-zinc-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500">
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
      </div>
    </main>
  );
}
