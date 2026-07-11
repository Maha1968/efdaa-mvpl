import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export default async function LegacyLeaderboardRedirect() {
  if (await isAdminUser()) redirect("/admin");
  redirect("/dashboard");
}
