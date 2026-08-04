import { isCompactPhoneWidth } from './responsive';

export const shouldUseVerticalLiveOrderCards = (verticalCardsEnabled: boolean, width: number) => (
  verticalCardsEnabled
);

export const shouldUseLiveOrderCardRail = (verticalCardsEnabled: boolean, width: number) => (
  verticalCardsEnabled && !isCompactPhoneWidth(width)
);
