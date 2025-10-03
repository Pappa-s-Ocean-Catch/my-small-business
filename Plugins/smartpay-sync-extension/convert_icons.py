#!/usr/bin/env python3
"""
Convert SVG to PNG icons for Chrome extension
"""

import os
import subprocess
import sys

def convert_svg_to_png(svg_path, png_path, size):
    """Convert SVG to PNG using rsvg-convert or inkscape"""
    try:
        # Try rsvg-convert first (faster)
        cmd = ['rsvg-convert', '-w', str(size), '-h', str(size), '-o', png_path, svg_path]
        subprocess.run(cmd, check=True)
        print(f"Created {png_path} using rsvg-convert")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            # Try inkscape as fallback
            cmd = ['inkscape', '--export-type=png', f'--export-filename={png_path}', f'--export-width={size}', f'--export-height={size}', svg_path]
            subprocess.run(cmd, check=True)
            print(f"Created {png_path} using inkscape")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"Neither rsvg-convert nor inkscape found. Please install one of them.")
            return False

def create_simple_png(size, filename):
    """Create a simple PNG using Python PIL if available"""
    try:
        from PIL import Image, ImageDraw
        
        # Create image with transparent background
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw gradient background circle
        for i in range(size//2):
            alpha = int(255 * (1 - i / (size//2)))
            color = (79, 70, 229, alpha)  # Blue gradient
            draw.ellipse([i, i, size-i, size-i], fill=color)
        
        # Draw credit card
        card_width = int(size * 0.5)
        card_height = int(size * 0.3)
        card_x = (size - card_width) // 2
        card_y = (size - card_height) // 2
        
        # Card background
        draw.rectangle([card_x, card_y, card_x + card_width, card_y + card_height], fill='white')
        
        # Card stripe
        stripe_height = int(card_height * 0.2)
        draw.rectangle([card_x + 2, card_y + 2, card_x + card_width - 2, card_y + stripe_height], fill='#6B7280')
        
        # Card number lines
        line_height = max(1, size // 32)
        draw.rectangle([card_x + 2, card_y + card_height//2, card_x + card_width//2, card_y + card_height//2 + line_height], fill='#9CA3AF')
        draw.rectangle([card_x + 2, card_y + card_height*3//4, card_x + card_width//3, card_y + card_height*3//4 + line_height], fill='#9CA3AF')
        
        # Sync arrows
        arrow_size = size // 8
        # Left arrow
        draw.polygon([(size//4, size//4), (size//4 + arrow_size, size//4 + arrow_size), (size//4, size//4 + arrow_size*2)], fill='white')
        # Right arrow  
        draw.polygon([(size*3//4, size//4), (size*3//4 - arrow_size, size//4 + arrow_size), (size*3//4, size//4 + arrow_size*2)], fill='white')
        
        img.save(filename)
        print(f"Created {filename} using PIL")
        return True
    except ImportError:
        print("PIL not available")
        return False

def main():
    svg_path = "icons/icon.svg"
    
    if not os.path.exists(svg_path):
        print(f"SVG file {svg_path} not found!")
        return
    
    # Create icons directory if it doesn't exist
    os.makedirs("icons", exist_ok=True)
    
    # Convert to different sizes
    sizes = [16, 48, 128]
    success = False
    
    for size in sizes:
        png_path = f"icons/icon{size}.png"
        
        # Try SVG conversion first
        if convert_svg_to_png(svg_path, png_path, size):
            success = True
        else:
            # Fallback to PIL
            if create_simple_png(size, png_path):
                success = True
    
    if success:
        print("✅ All icons created successfully!")
    else:
        print("❌ Failed to create icons. Please install rsvg-convert, inkscape, or PIL")

if __name__ == "__main__":
    main()
