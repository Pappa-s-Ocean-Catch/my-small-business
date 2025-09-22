export default function MenuScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#fff8f0] text-neutral-900">
        {/* Standalone layout: intentionally no header, nav, or footer */}
        {children}
      </body>
    </html>
  );
}


