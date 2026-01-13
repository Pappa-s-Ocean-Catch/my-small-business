'use client';

import { FaDownload, FaPrint } from 'react-icons/fa';
import { useState } from 'react';

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
        const canvas = await html2canvas(element as HTMLElement, {
          scale: 2, // High quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: element.scrollWidth,
          height: element.scrollHeight,
        });
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `menu-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, 'image/png', 0.95);
      } else {
        console.error('No container element found');
        alert('Error: Could not find menu container. Please try again.');
      }
    } catch (error) {
      console.error('Error generating PNG:', error);
      alert('Error generating PNG. Please try again.');
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
        <FaPrint className="btn-icon" />
        <span>Print</span>
      </button>
      
      <button
        onClick={handleDownloadPNG}
        disabled={isLoading}
        className="print-btn print-btn-secondary"
        title="Download as PNG"
      >
        <FaDownload className="btn-icon" />
        <span>{isLoading ? 'Generating...' : 'Save PNG'}</span>
      </button>
    </div>
  );
}
