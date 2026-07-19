import { cn } from "@/lib/utils/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "destructive"
  | "ghost";

type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50",
  secondary:
    "border border-border-strong bg-surface text-text-primary hover:bg-surface-muted disabled:opacity-50",
  tertiary:
    "bg-transparent text-primary hover:bg-primary-soft disabled:opacity-50",
  accent:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/50",
  destructive:
    "bg-error text-white hover:bg-error/90 disabled:bg-error/50",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm rounded-md gap-1.5",
  md: "min-h-11 px-4 text-sm rounded-lg gap-2",
  lg: "min-h-12 px-5 text-base rounded-xl gap-2",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "lg",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
          <span>{typeof children === "string" ? children : "Loading…"}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
