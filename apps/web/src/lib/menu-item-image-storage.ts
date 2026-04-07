export type MenuItemImageStorageKind = "none" | "vercel" | "bunny" | "other";

export interface MenuItemImageStorageChip {
  kind: MenuItemImageStorageKind;
  label: string;
  title: string;
  className: string;
}

function bunnyPublicBase(): string {
  if (typeof process === "undefined") return "";
  return (process.env.NEXT_PUBLIC_BUNNY_CDN_PUBLIC_URL ?? "").replace(
    /\/$/,
    "",
  );
}

export function getMenuItemImageStorageKind(
  imageUrl: string | null | undefined,
): MenuItemImageStorageKind {
  if (!imageUrl?.trim()) return "none";
  const url = imageUrl.trim();
  if (url.includes("blob.vercel-storage.com")) return "vercel";

  const bunnyBase = bunnyPublicBase();
  if (bunnyBase && url.startsWith(bunnyBase)) return "bunny";

  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".b-cdn.net")) return "bunny";
  } catch {
    return "other";
  }

  return "other";
}

export function getMenuItemImageStorageChip(
  imageUrl: string | null | undefined,
): MenuItemImageStorageChip {
  const kind = getMenuItemImageStorageKind(imageUrl);

  switch (kind) {
    case "none":
      return {
        kind,
        label: "No image",
        title:
          "No image URL — open Edit to upload or generate an image for this item.",
        className: "bg-slate-600 text-white dark:bg-slate-500",
      };
    case "vercel":
      return {
        kind,
        label: "Vercel Blob",
        title:
          "Image is on Vercel Blob (higher cost). Open Edit to upload or migrate to Bunny CDN.",
        className: "bg-amber-500 text-white dark:bg-amber-600",
      };
    case "bunny":
      return {
        kind,
        label: "Bunny CDN",
        title: "Image is on your Bunny pull zone.",
        className: "bg-emerald-600 text-white dark:bg-emerald-700",
      };
    default:
      return {
        kind: "other",
        label: "Other URL",
        title:
          "URL is not Vercel Blob or your configured Bunny base (NEXT_PUBLIC_BUNNY_CDN_PUBLIC_URL). Check the link still works or re-upload.",
        className: "bg-violet-600 text-white dark:bg-violet-700",
      };
  }
}
