#!/usr/bin/env python3
from PIL import Image
import os
from pathlib import Path
import numpy as np

# Обрабатываем все PNG файлы в папке cases
cases_dir = Path('/Users/a1/Desktop/ZeonGGStore/public/cases')

png_files = list(cases_dir.glob('*.png'))

for img_file in png_files:
    print(f"Обрабатываю: {img_file.name}")
    
    img = Image.open(img_file)
    
    # Конвертируем в RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Конвертируем в numpy массив
    img_array = np.array(img, dtype=np.float32)
    
    # Получаем RGB каналы
    r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
    alpha = img_array[:,:,3]
    
    # Ищем пиксели которые серые (R, G, B очень близки)
    diff_rg = np.abs(r - g)
    diff_gb = np.abs(g - b)
    diff_rb = np.abs(r - b)
    
    # Пиксель считается серым если все компоненты очень близки (< 40)
    is_gray = (diff_rg < 40) & (diff_gb < 40) & (diff_rb < 40)
    
    brightness = (r + g + b) / 3
    
    # Удаляем серые пиксели с яркостью > 110 (это явно фон)
    # Но сохраняем цветные пиксели даже если они светлые
    is_background = (brightness > 110) & is_gray
    
    # Делаем прозрачными только серые пиксели фона
    alpha[is_background] = 0
    
    # Собираем обратно в uint8
    img_array[:,:,3] = alpha
    result_img = Image.fromarray(img_array.astype(np.uint8), 'RGBA')
    
    # Сохраняем как PNG
    result_img.save(img_file, 'PNG')
    print(f"✓ Сохранён: {img_file}")

print("\nОбработка завершена!")
