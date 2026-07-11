import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const CUSTOMER_ONLY_PREFIXES = [
  "/create",
  "/dashboard",
  "/rewards",
  "/efdaagifts",
  "/redeem",
  "/t/",
];

const ADMIN_ONLY_PREFIXES = ["/admin"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isAuthRoute = pathname.startsWith("/auth");
  const isPublicTokenLink = pathname.startsWith("/t/");
  const isDemoPage = pathname === "/demo" || pathname.startsWith("/demo/");

  if (!user && !isLoginPage && !isAuthRoute && !isPublicTokenLink && !isDemoPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    // Role-aware default home
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    let defaultHome = "/";
    if (profile?.role === "admin") defaultHome = "/admin";
    else if (profile?.role === "customer") defaultHome = "/";

    // Admins may not land on customer-only next paths
    let dest = next?.startsWith("/") ? next : defaultHome;
    if (profile?.role === "admin" && startsWithAny(dest, CUSTOMER_ONLY_PREFIXES)) {
      dest = "/admin";
    }
    if (profile?.role === "customer" && startsWithAny(dest, ADMIN_ONLY_PREFIXES)) {
      dest = "/";
    }

    url.pathname = dest;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as "admin" | "customer" | null | undefined;

    // If role already locked as admin, block customer surfaces
    if (role === "admin" && startsWithAny(pathname, CUSTOMER_ONLY_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Customers cannot open admin
    if (role === "customer" && startsWithAny(pathname, ADMIN_ONLY_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
