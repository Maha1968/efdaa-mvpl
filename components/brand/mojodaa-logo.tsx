import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type MojodaaLogoProps = {
  className?: string;
  /**
   * Preferred display height in px (5× previous defaults).
   * On narrow screens the logo scales down to fit the container width.
   */
  height?: number;
  priority?: boolean;
};

/** Brand wordmark for customer-facing screens. */
export function MojodaaLogo({
  className,
  height = 280,
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
      sizes="(max-width: 480px) 100vw, 560px"
      className={cn(
        "h-auto w-full max-w-full object-contain object-left",
        className,
      )}
      style={{ maxHeight: `${height}px`, width: "100%", height: "auto" }}
    />
  );
}
