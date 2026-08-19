#!/usr/bin/env python3
"""Process case PNG files - remove gray background and keep transparency like skins"""

from PIL import Image
import os

cases_dir = "/Users/a1/Desktop/ZeonGGStore/public/cases"
case_files = {
    "chamelion-case.png": "chamelion",
    "fable-case.png": "fable",
    "furious-case.png": "furious",
    "impire-case.png": "impire",
}

def remove_background_by_color_range(image_path, output_path, case_name):
    """Remove background from case image using edge detection and alpha control"""
    print(f"Processing {case_name}...")
    
    # Open image
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # Get pixels data
    pixels = img.load()
    
    # Sample the background color from corners
    background_colors = []
    
    # Sample from corners
    sample_points = [
        (0, 0), (width-1, 0), (0, height-1), (width-1, height-1),
    ]
    
    for x, y in sample_points:
        r, g, b, a = pixels[x, y]
        background_colors.append((r, g, b))
    
    # Calculate average background color
    avg_r = sum(c[0] for c in background_colors) / len(background_colors)
    avg_g = sum(c[1] for c in background_colors) / len(background_colors)
    avg_b = sum(c[2] for c in background_colors) / len(background_colors)
    
    print(f"  → Detected background color: RGB({int(avg_r)}, {int(avg_g)}, {int(avg_b)})")
    
    # First pass: identify background and shadows
    tolerance = 60  # Higher tolerance for main background
    shadow_tolerance = 35
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Saturation-based check - grayish colors
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            saturation = 0 if max_c == 0 else (max_c - min_c) / max_c
            
            # If it's a grayish color or very close to background
            is_gray_bg = saturation < 0.15  # Very low saturation = gray
            is_exact_bg = (abs(r - avg_r) < tolerance and 
                          abs(g - avg_g) < tolerance and 
                          abs(b - avg_b) < tolerance)
            
            # Shadow colors (darker than background but still grayish)
            is_shadow = (is_gray_bg and saturation < 0.10 and
                        max_c < avg_r - shadow_tolerance)
            
            if is_exact_bg or is_gray_bg or is_shadow:
                pixels[x, y] = (r, g, b, 0)  # Make transparent
    
    # For impire case, shift content upward
    if case_name == "impire":
        print(f"  → Shifting {case_name} case content upward...")
        new_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        new_img.paste(img, (0, -15), img)
        img = new_img
    
    # Save with transparency
    img.save(output_path, "PNG")
    print(f"  ✓ Saved to {output_path}")

# Process all case files
for filename, case_name in case_files.items():
    file_path = os.path.join(cases_dir, filename)
    if os.path.exists(file_path):
        remove_background_by_color_range(file_path, file_path, case_name)
    else:
        print(f"WARNING: {filename} not found")

print("\nDone! All case PNG files processed with background removal.")
