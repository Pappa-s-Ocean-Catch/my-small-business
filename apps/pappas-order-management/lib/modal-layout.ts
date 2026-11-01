/** Shared sizing for input, choice and confirmation modals. Detail screens are full-screen. */
export function getModalLayout(width: number, height: number, insets = { top: 0, bottom: 0 }) {
  const compact = width < 600 || height < 480;
  return {
    compact,
    width: compact ? width : width * 0.75,
    maxHeight: Math.max(0, height - insets.top - insets.bottom - (compact ? 0 : 48)),
  };
}
