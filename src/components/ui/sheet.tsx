"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet ala native (drag-to-dismiss) berbasis vaul.
 * Pakai: <Sheet open={x} onOpenChange={setX}><SheetContent>...</SheetContent></Sheet>
 */
export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer.Root>
  );
}

export function SheetContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Drawer.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-md flex-col rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] outline-none",
          className,
        )}
      >
        {/* grabber */}
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
        <div className="overflow-y-auto p-5">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  );
}

export const SheetTitle = Drawer.Title;
export const SheetDescription = Drawer.Description;
