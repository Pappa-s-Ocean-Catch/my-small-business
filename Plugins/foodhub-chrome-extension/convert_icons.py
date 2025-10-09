#!/usr/bin/env python3
"""
Convert SVG icon to PNG files for Chrome extension
"""

import os
import sys
from PIL import Image, ImageDraw
import io

def create_icon(size):
    """Create an icon with the specified size"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    center_x = size // 2
    center_y = size // 2
    radius = int(size * 0.4)
    
    # Draw background circle with gradient effect
    # For simplicity, we'll use a solid color with the gradient colors
    draw.ellipse([center_x - radius, center_y - radius, 
                  center_x + radius, center_y + radius], 
                 fill=(102, 126, 234, 255))  # #667eea
    
    # Draw white border
    border_width = max(1, size // 32)
    draw.ellipse([center_x - radius, center_y - radius, 
                  center_x + radius, center_y + radius], 
                 outline=(255, 255, 255, 255), width=border_width)
    
    # Draw robot head (white rectangle)
    head_width = int(size * 0.4)
    head_height = int(size * 0.3)
    head_x = center_x - head_width // 2
    head_y = center_y - head_height // 2 - int(size * 0.05)
    
    draw.rectangle([head_x, head_y, head_x + head_width, head_y + head_height], 
                   fill=(255, 255, 255, 255))
    
    # Draw eyes
    eye_size = max(2, size // 16)
    eye_y = head_y + int(head_height * 0.3)
    left_eye_x = head_x + int(head_width * 0.25)
    right_eye_x = head_x + int(head_width * 0.75)
    
    draw.ellipse([left_eye_x - eye_size, eye_y - eye_size, 
                  left_eye_x + eye_size, eye_y + eye_size], 
                 fill=(102, 126, 234, 255))
    draw.ellipse([right_eye_x - eye_size, eye_y - eye_size, 
                  right_eye_x + eye_size, eye_y + eye_size], 
                 fill=(102, 126, 234, 255))
    
    # Draw mouth
    mouth_width = int(head_width * 0.3)
    mouth_height = max(1, size // 32)
    mouth_x = center_x - mouth_width // 2
    mouth_y = head_y + int(head_height * 0.7)
    
    draw.rectangle([mouth_x, mouth_y, mouth_x + mouth_width, mouth_y + mouth_height], 
                   fill=(102, 126, 234, 255))
    
    # Draw antenna
    antenna_height = int(size * 0.1)
    antenna_width = max(1, size // 32)
    draw.rectangle([center_x - antenna_width//2, head_y, 
                    center_x + antenna_width//2, head_y - antenna_height], 
                   fill=(255, 255, 255, 255))
    
    # Antenna ball
    ball_size = max(1, size // 32)
    draw.ellipse([center_x - ball_size, head_y - antenna_height - ball_size, 
                  center_x + ball_size, head_y - antenna_height + ball_size], 
                 fill=(255, 255, 255, 255))
    
    # Draw food items (small circles)
    food_size = max(2, size // 16)
    food_y = center_y + int(size * 0.2)
    
    # Green food
    draw.ellipse([center_x - int(size * 0.3) - food_size, food_y - food_size, 
                  center_x - int(size * 0.3) + food_size, food_y + food_size], 
                 fill=(76, 175, 80, 255))  # #4CAF50
    
    # Orange food
    draw.ellipse([center_x + int(size * 0.3) - food_size, food_y - food_size, 
                  center_x + int(size * 0.3) + food_size, food_y + food_size], 
                 fill=(255, 152, 0, 255))  # #FF9800
    
    # Red food
    red_food_size = int(food_size * 0.8)
    draw.ellipse([center_x - red_food_size, center_y + int(size * 0.3) - red_food_size, 
                  center_x + red_food_size, center_y + int(size * 0.3) + red_food_size], 
                 fill=(244, 67, 54, 255))  # #F44336
    
    return img

def main():
    """Generate all required icon sizes"""
    sizes = [16, 48, 128]
    
    print("Generating Chrome extension icons...")
    
    for size in sizes:
        try:
            # Create icon
            icon = create_icon(size)
            
            # Save as PNG
            filename = f"icons/icon{size}.png"
            icon.save(filename, "PNG")
            print(f"✅ Created {filename} ({size}x{size})")
            
        except Exception as e:
            print(f"❌ Error creating icon{size}.png: {e}")
            return 1
    
    print("\n🎉 All icons generated successfully!")
    print("You can now load the Chrome extension.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
