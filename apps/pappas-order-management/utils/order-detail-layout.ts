export function usesLandscapeTabletOrderDetailLayout(width: number, height: number): boolean {
  return width >= 920 && width > height;
}
