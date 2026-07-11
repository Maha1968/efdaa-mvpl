import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ code: string }> };

export default async function LegacyTokenDetailRedirect({ params }: PageProps) {
  const { code } = await params;
  if (await isAdminUser()) redirect(`/admin/assist?code=${code}`);
  redirect("/dashboard");
}
