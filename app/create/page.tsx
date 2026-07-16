import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateTokenForm } from "@/components/create-token-form";
import { getAppRole } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export default async function CreateTokenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getAppRole();
  if (role === "admin") redirect("/admin");

  const [{ data: offers }, { data: stores }] = await Promise.all([
    supabase.from("offers").select("*").order("name"),
    supabase.from("stores").select("*").order("name"),
  ]);

  if (!offers?.length) {
    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Setup incomplete</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Add at least one offer in Supabase first.
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
            Recommend something
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Photos first. Barcode is optional. We only ask for your location
            when you are ready to share.
          </p>
        </div>

        <CreateTokenForm
          offers={offers}
          stores={stores ?? []}
          userId={user.id}
        />
      </div>
    </main>
  );
}
