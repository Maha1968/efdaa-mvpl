import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  padded = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface shadow-sm",
        padded && "p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow = "EFDAA",
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string | null;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow !== null && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-page-title mt-2 text-text-primary">{title}</h1>
          {description && (
            <p className="text-supporting mt-2 max-w-prose">{description}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-section text-text-primary">{title}</h2>
        {description && (
          <p className="text-supporting mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
