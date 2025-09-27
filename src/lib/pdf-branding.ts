import jsPDF from 'jspdf';

export interface BrandSettings {
  business_name: string;
  logo_url: string | null;
  slogan: string | null;
}

export async function addBrandingHeader(
  doc: jsPDF, 
  brandSettings: BrandSettings,
  title: string,
  subtitle?: string
): Promise<jsPDF> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPosition = 20;

  // Add logo if available
  if (brandSettings.logo_url) {
    try {
      // Create an image element to load the logo
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = brandSettings.logo_url!;
      });

      // Add logo (max 40px height)
      const logoHeight = 40;
      const logoWidth = (img.width / img.height) * logoHeight;
      doc.addImage(img, 'PNG', margin, yPosition, logoWidth, logoHeight);
      
      yPosition += logoHeight + 10;
    } catch (error) {
      console.warn('Failed to load logo for PDF:', error);
    }
  }

  // Add business name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(brandSettings.business_name, margin, yPosition);
  yPosition += 8;

  // Add slogan if available
  if (brandSettings.slogan) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(brandSettings.slogan, margin, yPosition);
    yPosition += 15;
  } else {
    yPosition += 10;
  }

  // Add title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title, margin, yPosition);
  yPosition += 8;

  // Add subtitle if provided
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, yPosition);
    yPosition += 15;
  } else {
    yPosition += 10;
  }

  // Add a horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  return doc;
}

export function getBrandingHeaderHeight(brandSettings: BrandSettings, hasSubtitle: boolean = false): number {
  let height = 20; // Base margin
  
  if (brandSettings.logo_url) {
    height += 50; // Logo height + spacing
  } else {
    height += 10; // Just spacing
  }
  
  if (brandSettings.slogan) {
    height += 15; // Slogan height + spacing
  }
  
  height += 25; // Title height + spacing
  
  if (hasSubtitle) {
    height += 15; // Subtitle height + spacing
  }
  
  height += 15; // Line + spacing
  
  return height;
}
