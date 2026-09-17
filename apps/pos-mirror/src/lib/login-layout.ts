export type LoginLayout = {
  compact: boolean;
  horizontalGutter: number;
  verticalGutter: number;
  cardPadding: number;
  cardMaxWidth: number;
};

export function getLoginLayout({ width, height }: { width: number; height: number }): LoginLayout {
  const compact = width > height && height < 520;
  const horizontalGutter = width >= 900 ? 32 : 16;
  const verticalGutter = compact ? 16 : 32;
  const cardPadding = compact ? 16 : 32;

  return {
    compact,
    horizontalGutter,
    verticalGutter,
    cardPadding,
    cardMaxWidth: compact
      ? Math.max(0, width - horizontalGutter * 2)
      : Math.min(520, Math.max(0, width - horizontalGutter * 2)),
  };
}
