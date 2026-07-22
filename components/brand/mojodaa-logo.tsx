import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type MojodaaLogoProps = {
  className?: string;
  /** Height in pixels; width scales to preserve aspect ratio. */
  height?: number;
  priority?: boolean;
};

/** Brand wordmark for customer-facing screens. */
export function MojodaaLogo({
  className,
  height = 28,
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
      className={cn("h-auto w-auto object-contain object-left", className)}
      style={{ height, width: "auto" }}
    />
  );
}
