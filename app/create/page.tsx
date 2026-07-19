import { CreateTokenForm } from "@/components/create-token-form";
import { CustomerShell } from "@/components/layout/customer-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getAppRole } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export default async function CreateTokenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/create");

  const role = await getAppRole();
  if (role === "admin") redirect("/admin");

  const [{ data: offers }, { data: stores }] = await Promise.all([
    supabase.from("offers").select("*").order("name"),
    supabase.from("stores").select("*").order("name"),
  ]);

  if (!offers?.length) {
    return (
      <CustomerShell showBottomNav={false}>
        <PageHeader
          title="Setup incomplete"
          description="Add at least one offer in Supabase first."
        />
        <ButtonLink href="/" variant="secondary" fullWidth>
          Back home
        </ButtonLink>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell showBottomNav={false}>
      <PageHeader
        title="Found something you love?"
        description="What did you discover today? Share it with friends who'd love it too — you both earn EFDAA points when they buy."
      />
      <CreateTokenForm
        offers={offers}
        stores={stores ?? []}
        userId={user.id}
      />
    </CustomerShell>
  );
}
