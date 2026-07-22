import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type MojodaaLogoProps = {
  className?: string;
  /**
   * Display height in px. Wordmark is wide; use ≥48 on page heroes and ≥40 in headers
   * so the letters stay at least ~2× body text (~15px).
   */
  height?: number;
  priority?: boolean;
};

/** Brand wordmark for customer-facing screens. */
export function MojodaaLogo({
  className,
  height = 56,
  priority = false,
}: MojodaaLogoProps) {
  // Source asset is a wide wordmark (~5.5:1).
  const width = Math.round(height * 5.5);

  return (
    <Image
      src="/mojodaa-logo.png"
      alt="MOJODAA"
      width={width}
      height={height}
      priority={priority}
      sizes={`${width}px`}
      className={cn("max-w-none object-contain object-left", className)}
      style={{ height: `${height}px`, width: "auto", maxWidth: "none" }}
    />
  );
}
