import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function PurchaseSubmittedPage({
  params,
  searchParams,
}: PageProps) {
  const { code } = await params;
  const { id } = await searchParams;
  const supabase = await createClient();

  const purchaseQuery = id
    ? supabase.from("purchases").select("*").eq("id", id).single()
    : supabase
        .from("purchases")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const { data: purchase } = await purchaseQuery;

  if (!purchase) notFound();

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          Submitted
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
          Receipt uploaded
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Your purchase is <strong>pending validation</strong>. We&apos;ll check
          the receipt and update the reward chain once approved.
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm">
          <p className="text-sm text-zinc-500">Amount</p>
          <p className="text-lg font-semibold text-zinc-900">₹{purchase.amount}</p>
          <p className="mt-3 text-sm text-zinc-500">Time since originator shared</p>
          <p className="text-sm text-zinc-900">
            {purchase.time_to_purchase_hours ?? "—"} hours
            {purchase.receipt_purchased_at
              ? ` (from receipt ${new Date(purchase.receipt_purchased_at).toLocaleString()})`
              : ""}
          </p>
        </div>

        <Link
          href={`/t/${code}`}
          className="mt-4 inline-block w-full rounded-xl border border-emerald-700 bg-white px-4 py-3.5 text-base font-medium text-emerald-800"
        >
          Share this offer with others
        </Link>

        <Link
          href="/"
          className="mt-3 inline-block w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
