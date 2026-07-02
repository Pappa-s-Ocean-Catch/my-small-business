import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';

type Props = {
  value: string;
  size: number;
};

export function ReceiptQrCode({ value, size }: Props) {
  const cells = React.useMemo(() => {
    try {
      return QRCode.create(value, { errorCorrectionLevel: 'M', margin: 0 }).modules;
    } catch (error) {
      console.error('Failed to create QR code', error);
      return null;
    }
  }, [value]);

  if (!cells) return null;

  const count = cells.size;
  const cellSize = size / count;
  const rects: React.ReactNode[] = [];

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!cells.get(row, col)) continue;
      rects.push(
        <Rect
          key={`${row}-${col}`}
          x={col * cellSize}
          y={row * cellSize}
          width={cellSize}
          height={cellSize}
          fill="#000"
        />
      );
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" />
      {rects}
    </Svg>
  );
}
