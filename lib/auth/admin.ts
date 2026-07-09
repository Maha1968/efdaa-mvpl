import { createClient } from "@/lib/supabase/server";

export async function isAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user?.email || !adminEmail) return false;

  return user.email.toLowerCase() === adminEmail;
}
