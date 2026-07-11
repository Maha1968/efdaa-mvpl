import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getAppRole } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

function getDisplayName(user: {
  user_metadata?: { name?: string };
  email?: string;
  phone?: string;
}) {
  return (
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    user.phone ||
    "there"
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getAppRole();
  const displayName = getDisplayName(user);

  // Admins only see the admin home — never recommendations or points
  if (role === "admin") {
    return (
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
              EFDAA Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              Hello, {displayName}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">
              Administrator accounts can only access operations dashboards.
              They cannot recommend products or earn points.
            </p>
          </div>

          <Link
            href="/admin"
            className="mb-6 flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Open administrator dashboard
          </Link>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Signed in as</p>
            <p className="mt-1 text-base text-zinc-900">
              {user.email || user.phone || "Admin"}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Role: administrator (permanent)
            </p>
          </div>

          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
            Hello, {displayName}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-600">
            Create a token to share a product offer via WhatsApp — no purchase
            needed.
          </p>
        </div>

        <Link
          href="/create"
          className="mb-3 flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Create a token
        </Link>

        <Link
          href="/dashboard"
          className="mb-3 flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
        >
          My recommendations
        </Link>

        <Link
          href="/rewards"
          className="mb-6 flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-base font-medium text-emerald-900 transition-colors hover:bg-emerald-100"
        >
          My EFDAA points
        </Link>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-zinc-500">Signed in as</p>
            <p className="mt-1 text-base text-zinc-900">
              {user.email || user.phone || "Unknown user"}
            </p>
          </div>

          {user.user_metadata?.name && (
            <div>
              <p className="text-sm font-medium text-zinc-500">Name</p>
              <p className="mt-1 text-base text-zinc-900">
                {user.user_metadata.name as string}
              </p>
            </div>
          )}

          <p className="text-xs text-zinc-500">Role: customer (permanent)</p>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
