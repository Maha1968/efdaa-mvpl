import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const nextUrl = next?.startsWith("/") ? next : "/";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <LoginForm nextUrl={nextUrl} />
    </main>
  );
}
