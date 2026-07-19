import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ButtonLinkVariant = "primary" | "secondary" | "tertiary" | "accent" | "ghost";
type ButtonLinkSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonLinkVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary:
    "border border-border-strong bg-surface text-text-primary hover:bg-surface-muted",
  tertiary: "bg-transparent text-primary hover:bg-primary-soft",
  accent: "bg-accent text-white hover:bg-accent-hover",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
};

const sizeClasses: Record<ButtonLinkSize, string> = {
  sm: "min-h-9 px-3 text-sm rounded-md gap-1.5",
  md: "min-h-11 px-4 text-sm rounded-lg gap-2",
  lg: "min-h-12 px-5 text-base rounded-xl gap-2",
};

export function ButtonLink({
  href,
  className,
  variant = "primary",
  size = "lg",
  fullWidth = false,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string;
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
  fullWidth?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
