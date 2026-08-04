export const COMPACT_PHONE_WIDTH = 600;
export const LANDSCAPE_TABLET_WIDTH = 900;

export const isCompactPhoneWidth = (width: number) => width < COMPACT_PHONE_WIDTH;

export const isLandscapeTablet = (width: number, height: number) => (
  width >= LANDSCAPE_TABLET_WIDTH && width > height
);

export const compactTextProps = {
  numberOfLines: 1,
  ellipsizeMode: 'tail' as const,
};
