export default function MenuRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#fff8f0] text-neutral-900">
        {children}
      </body>
    </html>
  );
}


