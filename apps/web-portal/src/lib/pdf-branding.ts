import jsPDF from 'jspdf';
import { BrandSettings } from './brand-settings';

export async function addBrandingHeader(
  doc: jsPDF, 
  brandSettings: BrandSettings,
  title: string,
  subtitle?: string
): Promise<jsPDF> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPosition = 20;

  // Calculate header height for logo positioning
  const headerHeight = 60; // Total height for business name + slogan
  let logoHeight = 0;
  let logoWidth = 0;

  // Load logo if available
  if (brandSettings.logo_url) {
    console.log('📄 PDF Branding - Loading logo:', brandSettings.logo_url);
    try {
      // Create an image element to load the logo
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = brandSettings.logo_url!;
      });

      console.log('📄 PDF Branding - Logo loaded successfully, dimensions:', img.width, 'x', img.height);
      
      // Calculate logo dimensions (max 50px height to fit header)
      logoHeight = Math.min(50, img.height);
      logoWidth = (img.width / img.height) * logoHeight;
      
      // Position logo on the right side
      const logoX = pageWidth - margin - logoWidth;
      const logoY = yPosition + (headerHeight - logoHeight) / 2; // Center vertically in header
      doc.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
      
      console.log('📄 PDF Branding - Logo added to PDF at position:', logoX, logoY);
    } catch (error) {
      console.warn('📄 PDF Branding - Failed to load logo for PDF:', error);
    }
  } else {
    console.log('📄 PDF Branding - No logo URL provided');
  }

  // Add business name (big text on the left)
  console.log('📄 PDF Branding - Adding business name:', brandSettings.business_name);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(brandSettings.business_name, margin, yPosition + 15);
  
  // Add slogan if available (smaller text on second line)
  if (brandSettings.slogan) {
    console.log('📄 PDF Branding - Adding slogan:', brandSettings.slogan);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(brandSettings.slogan, margin, yPosition + 30);
  } else {
    console.log('📄 PDF Branding - No slogan provided');
  }

  // Move to after the header
  yPosition += headerHeight + 10;

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
  
  // Header section (business name + slogan + logo)
  height += 60; // Fixed header height for business name and slogan
  
  // Title section
  height += 25; // Title height + spacing
  
  if (hasSubtitle) {
    height += 15; // Subtitle height + spacing
  }
  
  height += 15; // Line + spacing
  
  return height;
}
