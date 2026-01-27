'use client';

import { storeInfo } from '@/data/print-menu-data';
import { FaMapMarkerAlt, FaPhone, FaClock } from 'react-icons/fa';
import { Icon } from '@/components/Icon';

interface PrintMenuLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  showHeader?: boolean;
}

function formatHours(hours: string): string {
  return hours.replace(/^TRADING HOURS:\s*/i, 'OPEN 7 DAYS: ');
}

function formatPhoneNumbers(phone: string): string {
  const numbers = phone.match(/\d+/g) ?? [];
  if (numbers.length === 0) return phone;

  const formatted = numbers.map((n) => {
    if (n.length === 8) return `${n.slice(0, 4)} ${n.slice(4)}`;
    if (n.length === 10) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
    return n;
  });

  return formatted.join(' or ');
}

function getPhoneParts(phone: string): { primary?: string; secondary?: string } {
  const numbers = phone.match(/\d+/g) ?? [];
  const format = (n: string): string => {
    if (n.length === 8) return `${n.slice(0, 4)} ${n.slice(4)}`;
    if (n.length === 10) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
    return n;
  };
  return {
    primary: numbers[0] ? format(numbers[0]) : undefined,
    secondary: numbers[1] ? format(numbers[1]) : undefined,
  };
}

export default function PrintMenuLayout({
  children,
  pageTitle,
  showHeader = true
}: PrintMenuLayoutProps) {
  // pageTitle is intentionally used by the content pages (children);
  // the header is a consistent brand header for all print menus.
  void pageTitle;

  const hoursText = formatHours(storeInfo.hours);
  const phoneParts = getPhoneParts(storeInfo.phone);
  const fallbackPhoneText = formatPhoneNumbers(storeInfo.phone);

  return (
    <div className="print-menu-container">
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
                <div className="menu-hero-subtitle">FISH, CHIPS &amp; BURGERS</div>
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
                    fallbackPhoneText
                  )}
                </span>
              </div>
            </div>
          </div>
        </header>
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
