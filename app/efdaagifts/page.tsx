import Link from "next/link";
import { isAdminUser } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * EFDAAgifts — placeholder catalog for spending EFDAA points.
 * Full gift catalog + redemption comes in a later stage.
 */
export default async function EfdaaGiftsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/efdaagifts");

  if (await isAdminUser()) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/rewards" className="text-sm text-emerald-700 underline">
          ← Back to EFDAA points
        </Link>

        <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200">
            Coming soon
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            EFDAAgifts
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-emerald-100">
            Spend your EFDAA points on gifts and items here. Catalog and checkout
            will be added in a later stage.
          </p>
        </div>
      </div>
    </main>
  );
}
