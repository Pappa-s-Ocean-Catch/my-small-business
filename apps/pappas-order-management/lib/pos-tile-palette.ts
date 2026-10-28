export const POS_TILE_COLORS = [
  '#1f2937',
  '#1d4ed8',
  '#047857',
  '#b91c1c',
  '#7e22ce',
  '#c2410c',
  '#0f766e',
  '#ca8a04',
  '#be123c',
  '#4338ca',
  '#0369a1',
  '#15803d',
  '#a16207',
  '#0e7490',
  '#6d28d9',
  '#9f1239',
] as const;

const channels = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
const luminance = (hex: string) => channels(hex).map(v => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

/** Choose the more legible foreground, including the lighter amber preset. */
export const tileTextColor = (background: string) => {
  const l = luminance(background);
  return (l + 0.05) / (luminance('#172E3A') + 0.05) > 1.05 / (l + 0.05) ? '#172E3A' : '#FFFFFF';
};

/** A darker shade of the effective fill, including custom layout colours. */
export const tileBorderColor = (background: string) => '#' + channels(background)
  .map(c => Math.round(c * 0.72).toString(16).padStart(2, '0')).join('');

export const PRODUCT_TILE_PALETTE = POS_TILE_COLORS.map(backgroundColor => ({
  backgroundColor,
  borderColor: tileBorderColor(backgroundColor),
  priceColor: tileTextColor(backgroundColor),
}));

/** Stable pseudo-random assignment; rendering or switching views never changes a tile. */
export const productTilePalette = (productId: string) => {
  let hash = 2166136261;
  for (const char of productId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return PRODUCT_TILE_PALETTE[(hash >>> 0) % PRODUCT_TILE_PALETTE.length];
};
