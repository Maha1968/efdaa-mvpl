import { createClient } from "@/lib/supabase/server";

export type AppRole = "customer" | "admin";

/**
 * Resolve the signed-in user's permanent role.
 * Role is assigned ONCE on first login and never changed after that
 * (customer cannot become admin later, and vice versa).
 *
 * First assignment: ADMIN_EMAIL → admin, everyone else → customer.
 */
export async function getAppRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin" || profile?.role === "customer") {
    return profile.role;
  }

  // First-time assignment only (role is null / missing row)
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const role: AppRole =
    user.email && adminEmail && user.email.toLowerCase() === adminEmail
      ? "admin"
      : "customer";

  if (!profile) {
    const { error } = await supabase.from("users").insert({
      id: user.id,
      name: (user.user_metadata?.name as string) || "",
      phone: user.phone ?? null,
      role,
    });
    // If insert raced / failed, try to read again
    if (error) {
      const { data: again } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (again?.role === "admin" || again?.role === "customer") {
        return again.role;
      }
      // Fall back to computed role for this request only
      return role;
    }
    return role;
  }

  // Profile exists but role is null — set once
  const { error: updateError } = await supabase
    .from("users")
    .update({ role })
    .eq("id", user.id)
    .is("role", null);

  if (updateError) {
    const { data: again } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (again?.role === "admin" || again?.role === "customer") {
      return again.role;
    }
  }

  return role;
}

export async function isAdminUser() {
  return (await getAppRole()) === "admin";
}

export async function isCustomerUser() {
  return (await getAppRole()) === "customer";
}

/** Require customer — admins are redirected to the admin home. */
export async function requireCustomer() {
  const role = await getAppRole();
  if (!role) return { ok: false as const, role: null };
  if (role === "admin") return { ok: false as const, role: "admin" as const };
  return { ok: true as const, role: "customer" as const };
}

/** Require admin — customers get not-found behavior at the page layer. */
export async function requireAdmin() {
  const role = await getAppRole();
  if (!role) return { ok: false as const, role: null };
  if (role !== "admin") return { ok: false as const, role: "customer" as const };
  return { ok: true as const, role: "admin" as const };
}
