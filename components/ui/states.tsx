import { cn } from "@/lib/utils/cn";
import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-card-title text-text-primary">{title}</p>
      {description && (
        <p className="text-supporting mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error",
        className,
      )}
    >
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">{title}</p>
          {description && <p className="mt-0.5 opacity-90">{description}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-text-muted",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className="size-8 animate-spin rounded-full border-2 border-primary border-r-transparent"
        aria-hidden
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-surface-muted",
        className,
      )}
      aria-hidden
    />
  );
}
