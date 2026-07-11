/** Platform display User ID — never show PII in operational dashboards. */
export function toPublicUserId(userId: string | null | undefined): string {
  if (!userId) return "U-UNKNOWN";
  const hex = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `U-${hex}`;
}

export function campaignStatus(expiresAt: string, hasValidatedPurchase: boolean) {
  if (hasValidatedPurchase) return "Completed" as const;
  if (new Date(expiresAt).getTime() <= Date.now()) return "Expired" as const;
  return "Active" as const;
}
