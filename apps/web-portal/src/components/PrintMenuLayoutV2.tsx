'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaMapMarkerAlt, FaPhone, FaClock } from 'react-icons/fa';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';

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
  // pageTitle/subtitle are intentionally used by the content pages; header stays consistent.
  void pageTitle;
  void subtitle;

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hoursText = storeInfo.hours.replace(/^TRADING HOURS:\s*/i, 'OPEN 7 DAYS: ');
  const phoneParts = (() => {
    const numbers = storeInfo.phone.match(/\d+/g) ?? [];
    const format = (n: string): string => {
      if (n.length === 8) return `${n.slice(0, 4)} ${n.slice(4)}`;
      if (n.length === 10) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
      return n;
    };
    return {
      primary: numbers[0] ? format(numbers[0]) : undefined,
      secondary: numbers[1] ? format(numbers[1]) : undefined,
    };
  })();

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
        <header className="print-menu-header menu-hero">
          <div className="menu-hero-inner">
            <div className="menu-hero-left">
              <div className="menu-hero-logo-wrap">
                <img
                  src="/logo.png"
                  alt="Pappa's Ocean Catch logo"
                  width={140}
                  height={140}
                  className="menu-hero-logo"
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="menu-hero-titles">
                <div className="menu-hero-name">PAPPA&apos;S OCEAN CATCH</div>
                <div className="menu-hero-subtitle">FISH, CHIPS &amp; VALUE PACKS</div>
                <div className="menu-hero-slogan">Serving fresh and high quality food</div>
              </div>
            </div>

            <div className="menu-hero-right">
              <div className="menu-hero-meta">
                <div className="menu-hero-meta-item">
                  <Icon icon={FaMapMarkerAlt} className="menu-hero-meta-icon" />
                  <span>{storeInfo.address}</span>
                </div>
                <div className="menu-hero-meta-item">
                  <Icon icon={FaClock} className="menu-hero-meta-icon" />
                  <span>{hoursText}</span>
                </div>
              </div>

              <div className="menu-hero-phone-pill" aria-label="Phone orders">
                <Icon icon={FaPhone} className="menu-hero-phone-icon" />
                <span className="menu-hero-phone-text">
                  {phoneParts.primary ? (
                    <>
                      <span className="menu-hero-phone-primary">{phoneParts.primary}</span>
                      {phoneParts.secondary && (
                        <>
                          <span className="menu-hero-phone-sep">or</span>
                          <span className="menu-hero-phone-secondary">{phoneParts.secondary}</span>
                        </>
                      )}
                    </>
                  ) : (
                    storeInfo.phone
                  )}
                </span>
              </div>

              <div className="menu-hero-qr" aria-label="Website QR code">
                <canvas ref={qrCanvasRef} width={120} height={120} />
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="v2-main">{children}</main>

      <footer className="v2-footer">EFTPOS AVAILABLE • DINE IN AVAILABLE</footer>
    </div>
  );
}


