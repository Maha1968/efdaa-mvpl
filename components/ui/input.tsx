import { cn } from "@/lib/utils/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary",
        "placeholder:text-text-muted",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-ring/40",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-sm text-text-primary",
        "placeholder:text-text-muted",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-ring/40",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full min-h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-ring/40",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-label", className)}
      {...props}
    />
  );
}

export function FieldError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("mt-1.5 text-sm text-error", className)}>
      {children}
    </p>
  );
}
