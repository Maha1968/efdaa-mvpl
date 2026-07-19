import { cn } from "@/lib/utils/cn";

/** Fixed bottom action bar for transactional mobile screens. */
export function StickyActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur",
        "sm:static sm:z-auto sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-3 safe-pb sm:max-w-none sm:px-0 sm:pt-0">
        {children}
      </div>
    </div>
  );
}

/** Spacer so page content isn't hidden behind StickyActionBar + optional bottom nav. */
export function StickyActionSpacer({
  withBottomNav = false,
}: {
  withBottomNav?: boolean;
}) {
  return (
    <div
      className={cn(
        "sm:hidden",
        withBottomNav ? "h-36" : "h-24",
      )}
      aria-hidden
    />
  );
}
