import { COMPACT_PHONE_WIDTH, LANDSCAPE_TABLET_WIDTH, isCompactPhoneWidth } from './responsive';

const LIVE_ORDER_CARD_RAIL_PADDING = 12;
const LIVE_ORDER_CARD_RAIL_GAP = 12;

export const shouldUseVerticalLiveOrderCards = (verticalCardsEnabled: boolean, width: number) => (
  verticalCardsEnabled
);

export const shouldUseLiveOrderCardRail = (verticalCardsEnabled: boolean, width: number, height: number) => (
  verticalCardsEnabled && !isCompactPhoneWidth(width) && width > height
);

export const getLiveOrderCardRailColumnCount = (width: number, height: number) => {
  if (width < COMPACT_PHONE_WIDTH || width <= height) return 1;
  return width >= LANDSCAPE_TABLET_WIDTH ? 3 : 2;
};

export const getLiveOrderCardRailWidth = (width: number, height: number) => {
  const columns = getLiveOrderCardRailColumnCount(width, height);
  const gutters = LIVE_ORDER_CARD_RAIL_PADDING * 2 + LIVE_ORDER_CARD_RAIL_GAP * (columns - 1);
  return Math.floor((width - gutters) / columns);
};

export const shouldUseCompactLiveOrderCards = (
  verticalCardsEnabled: boolean,
  width: number,
  height: number,
) => (
  verticalCardsEnabled &&
  !isCompactPhoneWidth(width) &&
  width > height &&
  height <= 640
);
