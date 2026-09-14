'use client';

import { FaDownload, FaPrint } from 'react-icons/fa';
import { useState } from 'react';
import { Icon } from '@/components/Icon';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export default function PrintButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = async () => {
    setIsLoading(true);
    try {
      // Use html2canvas to capture the page as PNG
      const html2canvas = (await import('html2canvas')).default;

      // Try to find the appropriate container (menu3 uses different class)
      const element = document.querySelector('.print-menu-container') ||
        document.querySelector('.menu3-clean-container') ||
        document.querySelector('.promotional-menu-container') ||
        document.querySelector('.print-menu-v2') ||
        document.querySelector('.print-menu-v3');

      if (element) {
        const target = element as HTMLElement;

        const width = Math.max(1, Math.ceil(target.scrollWidth || target.getBoundingClientRect().width));
        const height = Math.max(1, Math.ceil(target.scrollHeight || target.getBoundingClientRect().height));

        // Adaptive scale: huge posters can take a very long time at scale=2.
        const pixels = width * height;
        let scale = 6;
        // if (pixels > 10_000_000) scale = 1.5;
        // if (pixels > 18_000_000) scale = 1;
        // if (pixels > 28_000_000) scale = 0.75;

        // Let the UI render the "Generating..." state before heavy work starts.
        await new Promise((r) => window.setTimeout(r, 0));

        const canvas = await withTimeout(
          html2canvas(target, {
            scale,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            removeContainer: true,
            windowWidth: width,
            windowHeight: height,
            onclone: (doc) => {
              doc.querySelector('.print-button-container')?.remove();
            },
          }),
          60_000,
          'PNG generation timed out. Try again (or reduce page complexity / zoom out).'
        );

        // Convert canvas to blob and download
        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png');
        });

        if (!blob) {
          throw new Error('Failed to encode PNG (canvas.toBlob returned null).');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `menu-A0-150DPI-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        console.error('No container element found');
        alert('Error: Could not find menu container. Please try again.');
      }
    } catch (error) {
      console.error('Error generating PNG:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error generating PNG: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="print-button-container">
      <button
        onClick={handlePrint}
        className="print-btn print-btn-primary"
        title="Print Menu"
      >
        <Icon icon={FaPrint} className="btn-icon" />
        <span>Print</span>
      </button>

      <button
        onClick={handleDownloadPNG}
        disabled={isLoading}
        className="print-btn print-btn-secondary"
        title="Download as PNG"
      >
        <Icon icon={FaDownload} className="btn-icon" />
        <span>{isLoading ? 'Generating...' : 'Save PNG'}</span>
      </button>
    </div>
  );
}