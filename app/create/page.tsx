import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateTokenForm } from "@/components/create-token-form";
import { redirect } from "next/navigation";

export default async function CreateTokenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: products }, { data: offers }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("offers").select("*").order("name"),
  ]);

  if (!products?.length || !offers?.length) {
    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">No products yet</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Add sample products and offers in Supabase first.
          </p>
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
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Back home
        </Link>

        <div className="mb-8 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
            Create a token
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Photograph a product and its barcode, capture your location, and
            share a token — no purchase needed.
          </p>
        </div>

        <CreateTokenForm
          products={products}
          offers={offers}
          userId={user.id}
        />
      </div>
    </main>
  );
}
