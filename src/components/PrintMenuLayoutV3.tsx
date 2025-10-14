'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaMapMarkerAlt, FaGlobe } from 'react-icons/fa';
import { useEffect, useRef } from 'react';

interface PrintMenuLayoutV3Props {
  children: React.ReactNode;
  pageTitle: string;
  subtitle?: string;
}

export default function PrintMenuLayoutV3({ children, pageTitle, subtitle }: PrintMenuLayoutV3Props) {
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        if (mounted && qrRef.current) {
          await QRCode.toCanvas(qrRef.current, storeInfo.website, {
            width: 120,
            margin: 1,
            color: { dark: '#111827', light: '#ffffff' },
          });
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="print-menu-v3">
      <header className="v3-hero">
        <div className="v3-hero-left">
          <h1 className="v3-title">{pageTitle}</h1>
          {subtitle && <div className="v3-subtitle">{subtitle}</div>}
          <div className="v3-meta">
            <div className="v3-meta-item"><FaMapMarkerAlt className="v3-icon" /><span>{storeInfo.address}</span></div>
            <div className="v3-meta-item"><FaGlobe className="v3-icon" /><span>{storeInfo.website}</span></div>
          </div>
        </div>
        <div className="v3-hero-right">
          <canvas ref={qrRef} width={120} height={120} />
        </div>
      </header>

      <main className="v3-main">{children}</main>

      <footer className="v3-footer">EFTPOS AVAILABLE • DINE IN AVAILABLE</footer>
    </div>
  );
}


