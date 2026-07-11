import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export default async function LegacyPurchasesRedirect() {
  if (await isAdminUser()) redirect("/admin/purchase-view");
  redirect("/dashboard");
}
