const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Color scheme: Blue background with white text
const backgroundColor = '#2563eb'; // Blue
const textColor = '#ffffff'; // White

async function createImage(size, filename, text, fontSize = null) {
  const actualFontSize = fontSize || size * 0.4;
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size * 0.2}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${actualFontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">${text}</text>
</svg>`;

  const buffer = Buffer.from(svg);
  
  await sharp(buffer)
    .png()
    .toFile(path.join(assetsDir, filename));
  
  console.log(`✓ Created ${filename} (${size}x${size}px)`);
}

async function createSplashImage() {
  // Splash screen is typically 2048x2048 or 2732x2732 for iOS
  const size = 2048;
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${size * 0.12}" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">Pappas</text>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.08}" fill="${textColor}" text-anchor="middle" dominant-baseline="central">Order Management</text>
</svg>`;

  const buffer = Buffer.from(svg);
  
  await sharp(buffer)
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  
  console.log(`✓ Created splash.png (${size}x${size}px)`);
}

async function generateAssets() {
  console.log('Generating app assets...\n');
  
  try {
    // App icon (1024x1024px)
    await createImage(1024, 'icon.png', 'PO');
    
    // Android adaptive icon (1024x1024px)
    await createImage(1024, 'adaptive-icon.png', 'PO');
    
    // Web favicon (48x48px, but we'll make it 512x512 for better quality)
    await createImage(512, 'favicon.png', 'PO', 200);
    
    // Splash screen
    await createSplashImage();
    
    console.log('\n✅ All assets generated successfully!');
    console.log('\nAssets created in:', assetsDir);
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

generateAssets();
