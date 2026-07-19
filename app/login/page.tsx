import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/auth/next-url";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const nextUrl = safeNextPath(next, "/");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, #f3e8ff 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, #fff7ed 0%, transparent 45%)",
        }}
      />
      <LoginForm nextUrl={nextUrl} />
    </main>
  );
}
