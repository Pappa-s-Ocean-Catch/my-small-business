export function usesLandscapeTabletOrderDetailLayout(width: number, height: number): boolean {
  return width >= 920 && width > height;
}

export function usesIconOnlyOrderDetailActions(width: number): boolean {
  return width < 600;
}
