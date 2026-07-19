import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "primary" | "accent" | "success" | "warning" | "error" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-text-secondary",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: "pending" | "validated" | "rejected" | "active" | "expired" | "completed";
}) {
  const map: Record<typeof status, { label: string; tone: BadgeTone }> = {
    pending: { label: "Pending", tone: "warning" },
    validated: { label: "Validated", tone: "success" },
    rejected: { label: "Rejected", tone: "error" },
    active: { label: "Active", tone: "success" },
    expired: { label: "Expired", tone: "neutral" },
    completed: { label: "Completed", tone: "info" },
  };
  const { label, tone } = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
