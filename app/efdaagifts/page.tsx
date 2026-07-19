import { Gift } from "lucide-react";
import { CustomerShell } from "@/components/layout/customer-shell";
import { ButtonLink } from "@/components/ui/button-link";
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
    <CustomerShell>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
        <div
          className="px-5 py-14 text-center sm:px-8 sm:py-16"
          style={{
            background:
              "linear-gradient(145deg, #5b21b6 0%, #7c3aed 45%, #ea580c 120%)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Coming soon
          </p>
          <div className="mx-auto mt-4 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <Gift className="size-7" aria-hidden />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            EFDAAgifts
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/90">
            Spend your EFDAA points on gifts and finds here. Catalog and
            checkout arrive in a later stage — keep earning in the meantime.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <ButtonLink href="/rewards" variant="secondary" fullWidth>
            Back to my points
          </ButtonLink>
          <ButtonLink href="/create" fullWidth>
            Share a find
          </ButtonLink>
        </div>
      </div>
    </CustomerShell>
  );
}
