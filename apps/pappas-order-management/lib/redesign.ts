/** Pappa's v2 design contract. Keep shared visual values here. */
export const designTokens = {
  color: {
    navy: '#122E40', primary: '#087F82', primaryPressed: '#066467',
    background: '#F4F6F5', surface: '#FFFFFF', text: '#172E3A', muted: '#526773',
    border: '#D7E0E2', success: '#166647', successTint: '#E6F4EC',
    warning: '#88520B', warningTint: '#FFF2D6', danger: '#B53535', dangerTint: '#FFF0EF',
    primaryTint: '#E5F2F0', navyTint: '#EDF1F6', scrim: 'rgba(18, 46, 64, 0.36)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { control: 10, card: 16, dialog: 24 },
  font: { body: 16, small: 14, title: 28, metric: 32 },
  touch: { minimum: 48, primaryHeight: 52 },
} as const;

export type WindowSizeClass = 'compact' | 'medium' | 'expanded';
export function getWindowSizeClass(width: number): WindowSizeClass {
  return width < 600 ? 'compact' : width < 1100 ? 'medium' : 'expanded';
}

export function getPosWorkspaceLayout(width: number, fontScale = 1) {
  const sizeClass = getWindowSizeClass(width);
  const cartWidth = sizeClass === 'expanded' ? 352 : 288;
  const gutter = sizeClass === 'expanded' ? 16 : 12;
  const railWidth = sizeClass === 'compact' ? 0 : sizeClass === 'expanded' ? 72 : 64;
  const gap = sizeClass === 'expanded' ? 16 : 12;
  const available = Math.max(0, width - railWidth - gutter * 2);
  const split = sizeClass !== 'compact' && available - cartWidth - gap >= 300 * Math.max(1, fontScale);
  const menuWidth = split ? available - cartWidth - gap : available;
  return {
    sizeClass, gutter, cartWidth, split, menuWidth, railWidth, gap,
    groupColumns: Math.max(1, Math.min(sizeClass === 'expanded' ? 3 : 2, Math.floor(menuWidth / (150 * Math.max(1, fontScale))))),
    productColumns: Math.max(1, Math.min(4, Math.floor(menuWidth / (160 * Math.max(1, fontScale))))),
  };
}
