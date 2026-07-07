import Link from "next/link";

type PageProps = {
  params: Promise<{ code: string }>;
};

/** Placeholder landing page — full claim flow built in Stage 4. */
export default async function TokenLandingPage({ params }: PageProps) {
  const { code } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          EFDAA
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
          Token received
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Code: <span className="font-mono font-semibold">{code}</span>
        </p>
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
          Claim, redeem, and forward options coming in the next stage.
        </p>
        <Link href="/login" className="mt-6 inline-block text-emerald-700 underline">
          Sign in
        </Link>
      </div>
    </main>
  );
}
