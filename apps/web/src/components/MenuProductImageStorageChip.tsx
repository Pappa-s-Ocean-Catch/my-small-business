"use client";

import { getMenuItemImageStorageChip } from "@/lib/menu-item-image-storage";

interface MenuProductImageStorageChipProps {
  imageUrl: string | null | undefined;
}

/** Host/source chip for menu management cards (Vercel vs Bunny vs missing). */
export function MenuProductImageStorageChip({
  imageUrl,
}: MenuProductImageStorageChipProps) {
  const chip = getMenuItemImageStorageChip(imageUrl);

  return (
    <span
      className={`pointer-events-none inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight shadow-sm ring-1 ring-black/10 dark:ring-white/15 ${chip.className}`}
      title={chip.title}
    >
      {chip.label}
    </span>
  );
}
