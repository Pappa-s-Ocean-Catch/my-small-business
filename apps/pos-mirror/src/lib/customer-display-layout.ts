export type CustomerDisplayLayout = {
  compact: boolean;
  gutter: number;
  rowMinHeight: number;
  totalPanelWidth: number;
  totalFontSize: number;
};

export function getCustomerDisplayLayout({ width, height }: { width: number; height: number }): CustomerDisplayLayout {
  const compact = height < 480 || width < 720;

  return compact
    ? { compact, gutter: 16, rowMinHeight: 64, totalPanelWidth: 230, totalFontSize: 40 }
    : { compact, gutter: 32, rowMinHeight: 88, totalPanelWidth: 360, totalFontSize: 56 };
}
