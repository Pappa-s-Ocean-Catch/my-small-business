'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaMapMarkerAlt, FaPhone, FaGlobe } from 'react-icons/fa';
import { useEffect, useRef } from 'react';

interface PrintMenuLayoutV2Props {
  children: React.ReactNode;
  pageTitle: string;
  showHeader?: boolean;
  subtitle?: string;
}

export default function PrintMenuLayoutV2({
  children,
  pageTitle,
  showHeader = true,
  subtitle,
}: PrintMenuLayoutV2Props) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function generateQrCode() {
      try {
        const QRCode = (await import('qrcode')).default;
        const urlToEncode: string = storeInfo.website;
        if (qrCanvasRef.current && isMounted) {
          await QRCode.toCanvas(qrCanvasRef.current, urlToEncode, {
            width: 120,
            margin: 1,
            color: { dark: '#111827', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
        }
      } catch {
        // Silent; keep layout stable if QR fails
      }
    }
    generateQrCode();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="print-menu-v2">
      {showHeader && (
        <header className="v2-header">
          <div className="v2-header-left">
            <h1 className="v2-title">{pageTitle}</h1>
            {subtitle && <p className="v2-subtitle">{subtitle}</p>}
            <div className="v2-contact">
              <div className="v2-contact-item">
                <FaMapMarkerAlt className="v2-icon" />
                <span>{storeInfo.address}</span>
              </div>
              <div className="v2-contact-item">
                <FaPhone className="v2-icon" />
                <span>{storeInfo.phone}</span>
              </div>
              <div className="v2-contact-item">
                <FaGlobe className="v2-icon" />
                <span>{storeInfo.website}</span>
              </div>
            </div>
          </div>
          <div className="v2-header-right">
            <canvas ref={qrCanvasRef} width={120} height={120} />
            <div className="v2-hours">MON-SUN 11AM-8:30PM • FRI-9PM</div>
          </div>
        </header>
      )}

      <main className="v2-main">{children}</main>

      <footer className="v2-footer">EFTPOS AVAILABLE • DINE IN AVAILABLE</footer>
    </div>
  );
}


