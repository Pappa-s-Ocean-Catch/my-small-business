'use client';

import { CartProvider } from '@/contexts/CartContext';

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
