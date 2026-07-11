import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

/** Legacy Stage 7 list leaked PII — redirect to privacy-first routes. */
export default async function LegacyTokensRedirect() {
  if (await isAdminUser()) redirect("/admin/network");
  redirect("/dashboard");
}
