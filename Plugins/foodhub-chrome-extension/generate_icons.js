#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple PNG generator using base64 encoded PNG data
function createSimpleIcon(size) {
    // This creates a simple colored square as a fallback
    // In a real implementation, you'd use a proper image library
    
    // For now, let's create a simple HTML file that can generate the icons
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator</title>
</head>
<body>
    <canvas id="canvas" width="${size}" height="${size}" style="border: 1px solid #ccc;"></canvas>
    <br>
    <button onclick="downloadIcon()">Download icon${size}.png</button>
    
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const size = ${size};
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.4;
        
        // Background circle
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // White border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, size / 32);
        ctx.stroke();
        
        // Robot head
        const headWidth = size * 0.4;
        const headHeight = size * 0.3;
        const headX = centerX - headWidth / 2;
        const headY = centerY - headHeight / 2 - size * 0.05;
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX, headY, headWidth, headHeight);
        
        // Eyes
        const eyeSize = Math.max(2, size / 16);
        const eyeY = headY + headHeight * 0.3;
        const leftEyeX = headX + headWidth * 0.25;
        const rightEyeX = headX + headWidth * 0.75;
        
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(rightEyeX, eyeY, eyeSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Mouth
        const mouthWidth = headWidth * 0.3;
        const mouthHeight = Math.max(1, size / 32);
        const mouthX = centerX - mouthWidth / 2;
        const mouthY = headY + headHeight * 0.7;
        
        ctx.fillStyle = '#667eea';
        ctx.fillRect(mouthX, mouthY, mouthWidth, mouthHeight);
        
        // Antenna
        const antennaHeight = size * 0.1;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, size / 32);
        ctx.beginPath();
        ctx.moveTo(centerX, headY);
        ctx.lineTo(centerX, headY - antennaHeight);
        ctx.stroke();
        
        // Antenna ball
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX, headY - antennaHeight, Math.max(1, size / 32), 0, 2 * Math.PI);
        ctx.fill();
        
        // Food items
        const foodSize = Math.max(2, size / 16);
        const foodY = centerY + size * 0.2;
        
        // Green food
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(centerX - size * 0.3, foodY, foodSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Orange food
        ctx.fillStyle = '#FF9800';
        ctx.beginPath();
        ctx.arc(centerX + size * 0.3, foodY, foodSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Red food
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(centerX, centerY + size * 0.3, foodSize * 0.8, 0, 2 * Math.PI);
        ctx.fill();
        
        function downloadIcon() {
            const link = document.createElement('a');
            link.download = 'icon${size}.png';
            link.href = canvas.toDataURL();
            link.click();
        }
    </script>
</body>
</html>`;
    
    return html;
}

// Generate HTML files for each icon size
const sizes = [16, 48, 128];

console.log('🎨 Generating icon creation pages...');

sizes.forEach(size => {
    const html = createSimpleIcon(size);
    const filename = `icon${size}_generator.html`;
    fs.writeFileSync(filename, html);
    console.log(`✅ Created ${filename} for ${size}x${size} icon`);
});

console.log('\n📋 Instructions:');
console.log('1. Open each HTML file in your browser');
console.log('2. Click "Download iconX.png" button');
console.log('3. Save the files in the icons/ folder');
console.log('4. Rename them to icon16.png, icon48.png, icon128.png');

// Create a combined generator
const combinedHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>FoodHub Extension Icon Generator</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .icon-container { display: inline-block; margin: 20px; text-align: center; }
        canvas { border: 1px solid #ccc; margin: 10px; }
        button { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #45a049; }
    </style>
</head>
<body>
    <h1>FoodHub Extension Icon Generator</h1>
    <p>Click the download buttons to save each icon:</p>
    
    ${sizes.map(size => `
        <div class="icon-container">
            <canvas id="canvas${size}" width="${size}" height="${size}"></canvas>
            <br>
            <button onclick="downloadIcon(${size})">Download icon${size}.png</button>
        </div>
    `).join('')}
    
    <script>
        ${sizes.map(size => `
            // Generate icon${size}
            const canvas${size} = document.getElementById('canvas${size}');
            const ctx${size} = canvas${size}.getContext('2d');
            const size${size} = ${size};
            const centerX${size} = size${size} / 2;
            const centerY${size} = size${size} / 2;
            const radius${size} = size${size} * 0.4;
            
            // Background circle
            const gradient${size} = ctx${size}.createLinearGradient(0, 0, size${size}, size${size});
            gradient${size}.addColorStop(0, '#667eea');
            gradient${size}.addColorStop(1, '#764ba2');
            
            ctx${size}.fillStyle = gradient${size};
            ctx${size}.beginPath();
            ctx${size}.arc(centerX${size}, centerY${size}, radius${size}, 0, 2 * Math.PI);
            ctx${size}.fill();
            
            // White border
            ctx${size}.strokeStyle = '#fff';
            ctx${size}.lineWidth = Math.max(1, size${size} / 32);
            ctx${size}.stroke();
            
            // Robot head
            const headWidth${size} = size${size} * 0.4;
            const headHeight${size} = size${size} * 0.3;
            const headX${size} = centerX${size} - headWidth${size} / 2;
            const headY${size} = centerY${size} - headHeight${size} / 2 - size${size} * 0.05;
            
            ctx${size}.fillStyle = '#fff';
            ctx${size}.fillRect(headX${size}, headY${size}, headWidth${size}, headHeight${size});
            
            // Eyes
            const eyeSize${size} = Math.max(2, size${size} / 16);
            const eyeY${size} = headY${size} + headHeight${size} * 0.3;
            const leftEyeX${size} = headX${size} + headWidth${size} * 0.25;
            const rightEyeX${size} = headX${size} + headWidth${size} * 0.75;
            
            ctx${size}.fillStyle = '#667eea';
            ctx${size}.beginPath();
            ctx${size}.arc(leftEyeX${size}, eyeY${size}, eyeSize${size}, 0, 2 * Math.PI);
            ctx${size}.fill();
            
            ctx${size}.beginPath();
            ctx${size}.arc(rightEyeX${size}, eyeY${size}, eyeSize${size}, 0, 2 * Math.PI);
            ctx${size}.fill();
            
            // Mouth
            const mouthWidth${size} = headWidth${size} * 0.3;
            const mouthHeight${size} = Math.max(1, size${size} / 32);
            const mouthX${size} = centerX${size} - mouthWidth${size} / 2;
            const mouthY${size} = headY${size} + headHeight${size} * 0.7;
            
            ctx${size}.fillStyle = '#667eea';
            ctx${size}.fillRect(mouthX${size}, mouthY${size}, mouthWidth${size}, mouthHeight${size});
            
            // Antenna
            const antennaHeight${size} = size${size} * 0.1;
            ctx${size}.strokeStyle = '#fff';
            ctx${size}.lineWidth = Math.max(1, size${size} / 32);
            ctx${size}.beginPath();
            ctx${size}.moveTo(centerX${size}, headY${size});
            ctx${size}.lineTo(centerX${size}, headY${size} - antennaHeight${size});
            ctx${size}.stroke();
            
            // Antenna ball
            ctx${size}.fillStyle = '#fff';
            ctx${size}.beginPath();
            ctx${size}.arc(centerX${size}, headY${size} - antennaHeight${size}, Math.max(1, size${size} / 32), 0, 2 * Math.PI);
            ctx${size}.fill();
            
            // Food items
            const foodSize${size} = Math.max(2, size${size} / 16);
            const foodY${size} = centerY${size} + size${size} * 0.2;
            
            // Green food
            ctx${size}.fillStyle = '#4CAF50';
            ctx${size}.beginPath();
            ctx${size}.arc(centerX${size} - size${size} * 0.3, foodY${size}, foodSize${size}, 0, 2 * Math.PI);
            ctx${size}.fill();
            
            // Orange food
            ctx${size}.fillStyle = '#FF9800';
            ctx${size}.beginPath();
            ctx${size}.arc(centerX${size} + size${size} * 0.3, foodY${size}, foodSize${size}, 0, 2 * Math.PI);
            ctx${size}.fill();
            
            // Red food
            ctx${size}.fillStyle = '#F44336';
            ctx${size}.beginPath();
            ctx${size}.arc(centerX${size}, centerY${size} + size${size} * 0.3, foodSize${size} * 0.8, 0, 2 * Math.PI);
            ctx${size}.fill();
        `).join('')}
        
        function downloadIcon(size) {
            const canvas = document.getElementById('canvas' + size);
            const link = document.createElement('a');
            link.download = 'icon' + size + '.png';
            link.href = canvas.toDataURL();
            link.click();
        }
    </script>
</body>
</html>`;

fs.writeFileSync('icon_generator.html', combinedHtml);
console.log('✅ Created combined icon_generator.html');

console.log('\n🚀 Next steps:');
console.log('1. Open icon_generator.html in your browser');
console.log('2. Download all three icons (16px, 48px, 128px)');
console.log('3. Save them in the icons/ folder with the correct names');
console.log('4. Load the Chrome extension!');
