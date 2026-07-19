import { cn } from "@/lib/utils/cn";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "primary";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-sm",
        tone === "accent" && "border-accent/20 bg-accent-soft",
        tone === "primary" && "border-primary/20 bg-primary-soft",
        className,
      )}
    >
      <p className="text-label">{label}</p>
      <p className="text-metric mt-1 text-text-primary">{value}</p>
      {hint && <p className="text-caption mt-1">{hint}</p>}
    </div>
  );
}

export function UserIdChip({ id }: { id: string }) {
  return (
    <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text-secondary">
      {id}
    </code>
  );
}
