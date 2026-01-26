'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaMapMarkerAlt, FaPhone, FaClock } from 'react-icons/fa';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';

interface PrintMenuLayoutV3Props {
  children: React.ReactNode;
  pageTitle: string;
  subtitle?: string;
}

export default function PrintMenuLayoutV3({ children, pageTitle, subtitle }: PrintMenuLayoutV3Props) {
  // pageTitle/subtitle are intentionally used by the content pages; header stays consistent.
  void pageTitle;
  void subtitle;

  const qrRef = useRef<HTMLCanvasElement | null>(null);

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
      } catch { }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="print-menu-v3">
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
              <canvas ref={qrRef} width={120} height={120} />
            </div>
          </div>
        </div>
      </header>

      <main className="v3-main">{children}</main>

      <footer className="v3-footer">EFTPOS AVAILABLE • DINE IN AVAILABLE</footer>
    </div>
  );
}


