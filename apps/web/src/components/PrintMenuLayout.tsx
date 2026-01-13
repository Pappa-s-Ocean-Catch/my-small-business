'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaCoffee, FaMapMarkerAlt, FaPhone, FaGlobe } from 'react-icons/fa';
import { useEffect, useRef } from 'react';

interface PrintMenuLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  showHeader?: boolean;
}

export default function PrintMenuLayout({ 
  children, 
  pageTitle, 
  showHeader = true 
}: PrintMenuLayoutProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function generateQrCode() {
      try {
        const QRCode = (await import('qrcode')).default;
        const urlToEncode: string = storeInfo.website;
        if (qrCanvasRef.current && urlToEncode && isMounted) {
          await QRCode.toCanvas(qrCanvasRef.current, urlToEncode, {
            width: 140,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
        }
      } catch (err) {
        // If QR generation fails, we leave the placeholder empty
        // so the header layout remains stable.
        console.error('QR generation failed', err);
      }
    }
    generateQrCode();
    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <div className="print-menu-container">
      {showHeader && (
        <header className="print-menu-header">
          <div className="header-content">
            <FaCoffee className="coffee-icon left" />
            <div className="store-info">
              <h1 className="store-name">PAPPA&apos;S OCEAN CATCH</h1>
              <p className="store-tagline">BURGERS • FISH AND CHIPS</p>
              <div className="contact-info">
                <div className="contact-item">
                  <FaMapMarkerAlt className="contact-icon" />
                  <span>{storeInfo.address}</span>
                </div>
                <div className="contact-item phone-promotion">
                  <FaPhone className="contact-icon" />
                  <span className="phone-text">{storeInfo.phone}</span>
                </div>
                <div className="contact-item website-link">
                  <FaGlobe className="contact-icon" />
                  <span className="website-text">
                    {storeInfo.website}
                  </span>
                </div>
              </div>
            </div>
            <div className="header-right-section">
              <FaCoffee className="coffee-icon right" />
              <div className="qr-code-placeholder">
                <canvas ref={qrCanvasRef} width={140} height={140} />
                <div className="qr-code-subtitle">Scan to Order</div>
              </div>
            </div>
          </div>
        </header>
      )}
      
      {showHeader && (
        <div className="trading-hours">
          <div className="hours-content">
            <span className="hours-label">TRADING HOURS</span>
            <span className="hours-time">MON-SUN 11AM-8:30PM • FRI-9PM</span>
          </div>
        </div>
      )}
      
      <main className="print-menu-main">
        {children}
      </main>
      
      <footer className="print-menu-footer">
        <div className="footer-content">
          EFTPOS AVAILABLE • DINE IN AVAILABLE
        </div>
      </footer>
    </div>
  );
}
