/** Base URL for share links. Set NEXT_PUBLIC_APP_URL on Vercel for production. */
export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export function getTokenShareUrl(code: string) {
  return `${getAppUrl()}/t/${code}`;
}
