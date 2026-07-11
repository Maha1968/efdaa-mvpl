import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function LegacyPurchaseDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  if (await isAdminUser()) redirect(`/admin/purchases/${id}`);
  redirect("/rewards");
}
