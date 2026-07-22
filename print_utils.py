<<<<<<< HEAD
# print_utils.py
import io
import base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
import random
import cv2

def generate_print_image(engraving_base64, params):
    """
    Генерирует 3D-подобное изображение стеллы с гравировкой и текстурой
    """
    # Декодируем гравировку
    engraving_data = base64.b64decode(engraving_base64)
    engraving_img = Image.open(io.BytesIO(engraving_data))
    
    # A4 пропорции (210x297 мм) при 300 DPI
    page_width = 2480
    page_height = 3508
    
    # Создаем фон
    page = Image.new('RGB', (page_width, page_height), (30, 30, 35))
    draw = ImageDraw.Draw(page)
    
    # Параметры стеллы
    stela_width = 1200   # мм
    stela_height = 600   # мм
    
    # Получаем параметры
    user_scale = min(float(params.get('scale', 0.8)), 1.0)
    user_scale = max(user_scale, 0.1)
    
    crop_top = float(params.get('crop_top', 2)) / 100
    crop_bottom = float(params.get('crop_bottom', 2)) / 100
    crop_left = float(params.get('crop_left', 2)) / 100
    crop_right = float(params.get('crop_right', 2)) / 100
    
    offset_x = float(params.get('offset_x', 0))
    offset_y = float(params.get('offset_y', 0))
    stone_type = params.get('stone', 'classic')
    texture_path = params.get('texture', '')
    mode = params.get('mode', 'engraving')
    shape = params.get('shape', 'none')
    
    # --- РАСЧЕТ РАЗМЕРОВ НА СТРАНИЦЕ ---
    margin = 80
    max_page_width = page_width - margin * 2
    max_page_height = page_height - margin * 2
    
    # Считаем масштаб чтобы стелла поместилась (вертикально)
    scale_x = max_page_width / stela_width
    scale_y = max_page_height / stela_height
    fit_scale = min(scale_x, scale_y) * 0.80
    
    # Размеры стеллы
    stela_px_w = int(stela_width * fit_scale)
    stela_px_h = int(stela_height * fit_scale)
    
    # Позиция стеллы (по центру)
    stela_x = (page_width - stela_px_w) // 2
    stela_y = (page_height - stela_px_h) // 2
    
    # --- СОЗДАЕМ 3D-ЭФФЕКТ ---
    # Создаем изображение стеллы с тенью и объемом
    stela_img = Image.new('RGBA', (stela_px_w, stela_px_h), (0, 0, 0, 0))
    stela_draw = ImageDraw.Draw(stela_img)
    
    # 1. Рисуем стеллу с 3D-эффектом (перспектива)
    # Левая грань (тень)
    shadow_offset = 15
    stela_draw.rectangle(
        [shadow_offset, shadow_offset, stela_px_w, stela_px_h],
        fill=(0, 0, 0, 60)
    )
    
    # Основная стелла
    stela_color = get_stone_color(stone_type)
    stela_draw.rectangle(
        [0, 0, stela_px_w, stela_px_h],
        fill=stela_color + (255,)
    )
    
    # 2. Накладываем текстуру если есть
    if texture_path and texture_path != '':
        texture_img = load_texture_from_path(texture_path, stela_px_w, stela_px_h)
        if texture_img:
            # Накладываем текстуру с прозрачностью
            texture_img = texture_img.convert('RGBA')
            # Смешиваем с базовым цветом
            stela_img = Image.alpha_composite(
                stela_img, 
                texture_img
            )
    
    # 3. Добавляем гранитную структуру (если нет текстуры)
    if not texture_path:
        # Добавляем зернистость
        stela_array = np.array(stela_img)
        for _ in range(500):
            x = random.randint(5, stela_px_w - 5)
            y = random.randint(5, stela_px_h - 5)
            brightness = random.randint(20, 80)
            if random.random() > 0.5:
                brightness = -brightness
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    if 0 <= x+dx < stela_px_w and 0 <= y+dy < stela_px_h:
                        for c in range(3):
                            val = stela_array[y+dy, x+dx, c] + brightness // 3
                            stela_array[y+dy, x+dx, c] = max(0, min(255, val))
        stela_img = Image.fromarray(stela_array, 'RGBA')
    
    # 4. Добавляем верхнюю грань для 3D-эффекта
    top_height = int(stela_px_h * 0.03)
    top_gradient = Image.new('RGBA', (stela_px_w, top_height), (0, 0, 0, 0))
    top_draw = ImageDraw.Draw(top_gradient)
    for i in range(top_height):
        alpha = int(60 * (1 - i / top_height))
        top_draw.rectangle(
            [0, i, stela_px_w, i + 1],
            fill=(255, 255, 255, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, top_gradient)
    
    # 5. Добавляем правую грань (объем)
    right_width = int(stela_px_w * 0.02)
    right_gradient = Image.new('RGBA', (right_width, stela_px_h), (0, 0, 0, 0))
    right_draw = ImageDraw.Draw(right_gradient)
    for i in range(right_width):
        alpha = int(60 * (1 - i / right_width))
        right_draw.rectangle(
            [i, 0, i + 1, stela_px_h],
            fill=(0, 0, 0, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, right_gradient)
    
    # 6. Добавляем нижнюю грань (тень)
    bottom_height = int(stela_px_h * 0.02)
    bottom_gradient = Image.new('RGBA', (stela_px_w, bottom_height), (0, 0, 0, 0))
    bottom_draw = ImageDraw.Draw(bottom_gradient)
    for i in range(bottom_height):
        alpha = int(40 * (1 - i / bottom_height))
        bottom_draw.rectangle(
            [0, i, stela_px_w, i + 1],
            fill=(0, 0, 0, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, bottom_gradient)
    
    # --- ОБРАБОТКА ГРАВИРОВКИ ---
    # Применяем отступы
    if crop_top + crop_bottom < 0.99 and crop_left + crop_right < 0.99:
        img_w, img_h = engraving_img.size
        crop_x = int(img_w * crop_left)
        crop_y = int(img_h * crop_top)
        crop_w = int(img_w * (1 - crop_left - crop_right))
        crop_h = int(img_h * (1 - crop_top - crop_bottom))
        if crop_w > 10 and crop_h > 10:
            engraving_img = engraving_img.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
    
    # Расчет размера гравировки
    base_grav_w = stela_px_w * 0.85
    base_grav_h = stela_px_h * 0.85
    
    grav_w = int(base_grav_w * user_scale)
    grav_h = int(base_grav_h * user_scale)
    
    # Ограничения
    max_grav_w = stela_px_w * 0.92
    max_grav_h = stela_px_h * 0.92
    grav_w = min(grav_w, max_grav_w)
    grav_h = min(grav_h, max_grav_h)
    grav_w = max(grav_w, int(stela_px_w * 0.2))
    grav_h = max(grav_h, int(stela_px_h * 0.2))
    
    # Масштабируем гравировку
    engraving_img.thumbnail((grav_w, grav_h), Image.Resampling.LANCZOS)
    grav_w_final = engraving_img.width
    grav_h_final = engraving_img.height
    
    # Форма (рамка)
    if shape and shape != 'none':
        engraving_img = apply_shape_mask(engraving_img, shape)
    
    # Позиция на стеле
    max_offset_x = (stela_px_w - grav_w_final) // 2
    max_offset_y = (stela_px_h - grav_h_final) // 2
    
    offset_x_px = int(offset_x * max_offset_x * 0.3)
    offset_y_px = int(offset_y * max_offset_y * 0.3)
    
    offset_x_px = max(-max_offset_x, min(max_offset_x, offset_x_px))
    offset_y_px = max(-max_offset_y, min(max_offset_y, offset_y_px))
    
    grav_x = (stela_px_w - grav_w_final) // 2 + offset_x_px
    grav_y = (stela_px_h - grav_h_final) // 2 + offset_y_px
    
    # --- НАКЛАДЫВАЕМ ГРАВИРОВКУ НА СТЕЛЛУ ---
    if mode == 'engraving':
        # Для гравировки - делаем эффект вырезания
        grav_effect = create_engraving_effect(engraving_img, stela_img, grav_x, grav_y)
        stela_img = Image.alpha_composite(stela_img, grav_effect)
    else:
        # Для фото - наклеиваем как декаль
        if engraving_img.mode == 'RGBA':
            stela_img.paste(engraving_img, (grav_x, grav_y), engraving_img)
        else:
            stela_img.paste(engraving_img, (grav_x, grav_y))
    
    # --- ДОБАВЛЯЕМ РАМКУ И ПОДПИСИ ---
    # Рамка стеллы
    stela_draw = ImageDraw.Draw(stela_img)
    stela_draw.rectangle(
        [0, 0, stela_px_w - 1, stela_px_h - 1],
        outline=(100, 100, 100, 200),
        width=2
    )
    
    # Внутренняя рамка
    inner_margin = 10
    stela_draw.rectangle(
        [inner_margin, inner_margin, stela_px_w - inner_margin - 1, stela_px_h - inner_margin - 1],
        outline=(150, 150, 150, 100),
        width=1
    )
    
    # --- ВСТАВЛЯЕМ СТЕЛЛУ НА СТРАНИЦУ ---
    page.paste(stela_img, (stela_x, stela_y), stela_img)
    
    # --- ДОБАВЛЯЕМ ПОДПИСИ НА СТРАНИЦЕ ---
    page_draw = ImageDraw.Draw(page)
    
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
    
    # Заголовок
    page_draw.text(
        (page_width // 2, 50),
        "ЭСКИЗ СТЕЛЛЫ",
        fill=(200, 200, 200),
        font=font_large,
        anchor="mt"
    )
    
    # Подпись с размерами
    size_text = f"{stela_width} × {stela_height} мм"
    page_draw.text(
        (page_width // 2, 100),
        size_text,
        fill=(150, 150, 150),
        font=font_medium,
        anchor="mt"
    )
    
    # Подпись внизу
    page_draw.text(
        (page_width // 2, page_height - 30),
        "Предварительный эскиз • Окончательный вид может отличаться",
        fill=(100, 100, 100),
        font=font_medium,
        anchor="mb"
    )
    
    # Конвертируем в PNG
    output = io.BytesIO()
    page.save(output, format='PNG', quality=95, optimize=True)
    output.seek(0)
    
    return output

def get_stone_color(stone_type):
    """Возвращает цвет камня"""
    colors = {
        'classic': (160, 160, 160),
        'dark': (65, 65, 70),
        'light': (210, 210, 205),
        'marble': (225, 220, 215),
        'basalt': (50, 50, 55)
    }
    return colors.get(stone_type, (160, 160, 160))

def load_texture_from_path(texture_path, width, height):
    """Загружает текстуру по пути"""
    try:
        import os
        # Пытаемся найти файл текстуры
        base_dir = os.path.dirname(__file__)
        texture_dir = os.path.join(base_dir, 'textures')
        
        # Ищем файл
        full_path = os.path.join(texture_dir, texture_path)
        if not os.path.exists(full_path):
            # Пробуем другие варианты
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                test_path = full_path + ext
                if os.path.exists(test_path):
                    full_path = test_path
                    break
        
        if os.path.exists(full_path):
            texture = Image.open(full_path)
            texture = texture.convert('RGBA')
            # Масштабируем
            texture = texture.resize((width, height), Image.Resampling.LANCZOS)
            # Делаем полупрозрачным для смешивания
            texture_array = np.array(texture)
            # Увеличиваем прозрачность для лучшего смешивания
            if texture_array.shape[2] == 4:
                texture_array[:, :, 3] = texture_array[:, :, 3] * 0.7
            return Image.fromarray(texture_array, 'RGBA')
    except Exception as e:
        print(f"Ошибка загрузки текстуры: {e}")
    return None

def apply_shape_mask(img, shape_type):
    """Применяет маску формы к изображению"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    width, height = img.size
    mask = Image.new('L', (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    
    cx, cy = width // 2, height // 2
    size = min(width, height)
    
    if shape_type == 'circle':
        mask_draw.ellipse([0, 0, width, height], fill=255)
    elif shape_type == 'oval':
        mask_draw.ellipse([0, 0, width, height], fill=255)
    elif shape_type == 'square':
        sq_size = size * 0.8
        mask_draw.rectangle([cx - sq_size//2, cy - sq_size//2, cx + sq_size//2, cy + sq_size//2], fill=255)
    elif shape_type == 'rounded':
        r = 30
        mask_draw.rounded_rectangle([0, 0, width, height], radius=r, fill=255)
    else:
        return img
    
    # Применяем маску
    img_array = np.array(img)
    mask_array = np.array(mask)
    img_array[:, :, 3] = mask_array
    return Image.fromarray(img_array, 'RGBA')

def create_engraving_effect(engraving_img, stela_img, x, y):
    """Создает эффект гравировки (вырезания в камне)"""
    # Конвертируем в RGBA
    if engraving_img.mode != 'RGBA':
        engraving_img = engraving_img.convert('RGBA')
    
    # Получаем массив
    grav_array = np.array(engraving_img)
    
    # Создаем эффект глубины
    # 1. Делаем изображение темнее (как вырезанное)
    for c in range(3):
        grav_array[:, :, c] = grav_array[:, :, c] * 0.4 + 30
    
    # 2. Добавляем тень для объема
    # Создаем сдвинутую копию для тени
    shadow = np.zeros_like(grav_array)
    shadow[:, :, 3] = grav_array[:, :, 3] * 0.5  # Прозрачность тени
    
    # Сдвигаем тень вниз-вправо
    shadow_shift = 3
    shadow_rolled = np.roll(shadow, shadow_shift, axis=0)
    shadow_rolled = np.roll(shadow_rolled, shadow_shift, axis=1)
    
    # Объединяем тень и гравировку
    result = np.zeros_like(grav_array)
    # Тень
    for c in range(4):
        result[:, :, c] = shadow_rolled[:, :, c]
    # Гравировка поверх
    for c in range(4):
        mask = grav_array[:, :, 3] > 0
        result[:, :, c][mask] = grav_array[:, :, c][mask]
    
    # 3. Добавляем свечение вокруг гравировки (эффект ореола)
    if int(params.get('halo', 35)) > 0:
        # Создаем маску для ореола
        halo_mask = np.zeros((grav_array.shape[0], grav_array.shape[1]), dtype=np.float32)
        halo_mask[grav_array[:, :, 3] > 0] = 1.0
        
        # Размываем маску
        from scipy.ndimage import gaussian_filter
        halo_mask = gaussian_filter(halo_mask, sigma=10)
        
        # Добавляем светлый ореол
        halo_color = np.array([200, 200, 200])
        for c in range(3):
            result[:, :, c] = result[:, :, c] + halo_mask * halo_color[c] * 0.15
            result[:, :, c] = np.clip(result[:, :, c], 0, 255)
    
    return Image.fromarray(result, 'RGBA')

# Добавляем импорт scipy если доступен
try:
    from scipy.ndimage import gaussian_filter
except ImportError:
    def gaussian_filter(arr, sigma):
        """Простая имитация размытия если scipy недоступен"""
        # Упрощенная версия - просто размываем через PIL
        from PIL import ImageFilter
        img = Image.fromarray((arr * 255).astype(np.uint8))
        img = img.filter(ImageFilter.GaussianBlur(radius=sigma))
=======
# print_utils.py
import io
import base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
import random
import cv2

def generate_print_image(engraving_base64, params):
    """
    Генерирует 3D-подобное изображение стеллы с гравировкой и текстурой
    """
    # Декодируем гравировку
    engraving_data = base64.b64decode(engraving_base64)
    engraving_img = Image.open(io.BytesIO(engraving_data))
    
    # A4 пропорции (210x297 мм) при 300 DPI
    page_width = 2480
    page_height = 3508
    
    # Создаем фон
    page = Image.new('RGB', (page_width, page_height), (30, 30, 35))
    draw = ImageDraw.Draw(page)
    
    # Параметры стеллы
    stela_width = 1200   # мм
    stela_height = 600   # мм
    
    # Получаем параметры
    user_scale = min(float(params.get('scale', 0.8)), 1.0)
    user_scale = max(user_scale, 0.1)
    
    crop_top = float(params.get('crop_top', 2)) / 100
    crop_bottom = float(params.get('crop_bottom', 2)) / 100
    crop_left = float(params.get('crop_left', 2)) / 100
    crop_right = float(params.get('crop_right', 2)) / 100
    
    offset_x = float(params.get('offset_x', 0))
    offset_y = float(params.get('offset_y', 0))
    stone_type = params.get('stone', 'classic')
    texture_path = params.get('texture', '')
    mode = params.get('mode', 'engraving')
    shape = params.get('shape', 'none')
    
    # --- РАСЧЕТ РАЗМЕРОВ НА СТРАНИЦЕ ---
    margin = 80
    max_page_width = page_width - margin * 2
    max_page_height = page_height - margin * 2
    
    # Считаем масштаб чтобы стелла поместилась (вертикально)
    scale_x = max_page_width / stela_width
    scale_y = max_page_height / stela_height
    fit_scale = min(scale_x, scale_y) * 0.80
    
    # Размеры стеллы
    stela_px_w = int(stela_width * fit_scale)
    stela_px_h = int(stela_height * fit_scale)
    
    # Позиция стеллы (по центру)
    stela_x = (page_width - stela_px_w) // 2
    stela_y = (page_height - stela_px_h) // 2
    
    # --- СОЗДАЕМ 3D-ЭФФЕКТ ---
    # Создаем изображение стеллы с тенью и объемом
    stela_img = Image.new('RGBA', (stela_px_w, stela_px_h), (0, 0, 0, 0))
    stela_draw = ImageDraw.Draw(stela_img)
    
    # 1. Рисуем стеллу с 3D-эффектом (перспектива)
    # Левая грань (тень)
    shadow_offset = 15
    stela_draw.rectangle(
        [shadow_offset, shadow_offset, stela_px_w, stela_px_h],
        fill=(0, 0, 0, 60)
    )
    
    # Основная стелла
    stela_color = get_stone_color(stone_type)
    stela_draw.rectangle(
        [0, 0, stela_px_w, stela_px_h],
        fill=stela_color + (255,)
    )
    
    # 2. Накладываем текстуру если есть
    if texture_path and texture_path != '':
        texture_img = load_texture_from_path(texture_path, stela_px_w, stela_px_h)
        if texture_img:
            # Накладываем текстуру с прозрачностью
            texture_img = texture_img.convert('RGBA')
            # Смешиваем с базовым цветом
            stela_img = Image.alpha_composite(
                stela_img, 
                texture_img
            )
    
    # 3. Добавляем гранитную структуру (если нет текстуры)
    if not texture_path:
        # Добавляем зернистость
        stela_array = np.array(stela_img)
        for _ in range(500):
            x = random.randint(5, stela_px_w - 5)
            y = random.randint(5, stela_px_h - 5)
            brightness = random.randint(20, 80)
            if random.random() > 0.5:
                brightness = -brightness
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    if 0 <= x+dx < stela_px_w and 0 <= y+dy < stela_px_h:
                        for c in range(3):
                            val = stela_array[y+dy, x+dx, c] + brightness // 3
                            stela_array[y+dy, x+dx, c] = max(0, min(255, val))
        stela_img = Image.fromarray(stela_array, 'RGBA')
    
    # 4. Добавляем верхнюю грань для 3D-эффекта
    top_height = int(stela_px_h * 0.03)
    top_gradient = Image.new('RGBA', (stela_px_w, top_height), (0, 0, 0, 0))
    top_draw = ImageDraw.Draw(top_gradient)
    for i in range(top_height):
        alpha = int(60 * (1 - i / top_height))
        top_draw.rectangle(
            [0, i, stela_px_w, i + 1],
            fill=(255, 255, 255, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, top_gradient)
    
    # 5. Добавляем правую грань (объем)
    right_width = int(stela_px_w * 0.02)
    right_gradient = Image.new('RGBA', (right_width, stela_px_h), (0, 0, 0, 0))
    right_draw = ImageDraw.Draw(right_gradient)
    for i in range(right_width):
        alpha = int(60 * (1 - i / right_width))
        right_draw.rectangle(
            [i, 0, i + 1, stela_px_h],
            fill=(0, 0, 0, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, right_gradient)
    
    # 6. Добавляем нижнюю грань (тень)
    bottom_height = int(stela_px_h * 0.02)
    bottom_gradient = Image.new('RGBA', (stela_px_w, bottom_height), (0, 0, 0, 0))
    bottom_draw = ImageDraw.Draw(bottom_gradient)
    for i in range(bottom_height):
        alpha = int(40 * (1 - i / bottom_height))
        bottom_draw.rectangle(
            [0, i, stela_px_w, i + 1],
            fill=(0, 0, 0, alpha)
        )
    stela_img = Image.alpha_composite(stela_img, bottom_gradient)
    
    # --- ОБРАБОТКА ГРАВИРОВКИ ---
    # Применяем отступы
    if crop_top + crop_bottom < 0.99 and crop_left + crop_right < 0.99:
        img_w, img_h = engraving_img.size
        crop_x = int(img_w * crop_left)
        crop_y = int(img_h * crop_top)
        crop_w = int(img_w * (1 - crop_left - crop_right))
        crop_h = int(img_h * (1 - crop_top - crop_bottom))
        if crop_w > 10 and crop_h > 10:
            engraving_img = engraving_img.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
    
    # Расчет размера гравировки
    base_grav_w = stela_px_w * 0.85
    base_grav_h = stela_px_h * 0.85
    
    grav_w = int(base_grav_w * user_scale)
    grav_h = int(base_grav_h * user_scale)
    
    # Ограничения
    max_grav_w = stela_px_w * 0.92
    max_grav_h = stela_px_h * 0.92
    grav_w = min(grav_w, max_grav_w)
    grav_h = min(grav_h, max_grav_h)
    grav_w = max(grav_w, int(stela_px_w * 0.2))
    grav_h = max(grav_h, int(stela_px_h * 0.2))
    
    # Масштабируем гравировку
    engraving_img.thumbnail((grav_w, grav_h), Image.Resampling.LANCZOS)
    grav_w_final = engraving_img.width
    grav_h_final = engraving_img.height
    
    # Форма (рамка)
    if shape and shape != 'none':
        engraving_img = apply_shape_mask(engraving_img, shape)
    
    # Позиция на стеле
    max_offset_x = (stela_px_w - grav_w_final) // 2
    max_offset_y = (stela_px_h - grav_h_final) // 2
    
    offset_x_px = int(offset_x * max_offset_x * 0.3)
    offset_y_px = int(offset_y * max_offset_y * 0.3)
    
    offset_x_px = max(-max_offset_x, min(max_offset_x, offset_x_px))
    offset_y_px = max(-max_offset_y, min(max_offset_y, offset_y_px))
    
    grav_x = (stela_px_w - grav_w_final) // 2 + offset_x_px
    grav_y = (stela_px_h - grav_h_final) // 2 + offset_y_px
    
    # --- НАКЛАДЫВАЕМ ГРАВИРОВКУ НА СТЕЛЛУ ---
    if mode == 'engraving':
        # Для гравировки - делаем эффект вырезания
        grav_effect = create_engraving_effect(engraving_img, stela_img, grav_x, grav_y)
        stela_img = Image.alpha_composite(stela_img, grav_effect)
    else:
        # Для фото - наклеиваем как декаль
        if engraving_img.mode == 'RGBA':
            stela_img.paste(engraving_img, (grav_x, grav_y), engraving_img)
        else:
            stela_img.paste(engraving_img, (grav_x, grav_y))
    
    # --- ДОБАВЛЯЕМ РАМКУ И ПОДПИСИ ---
    # Рамка стеллы
    stela_draw = ImageDraw.Draw(stela_img)
    stela_draw.rectangle(
        [0, 0, stela_px_w - 1, stela_px_h - 1],
        outline=(100, 100, 100, 200),
        width=2
    )
    
    # Внутренняя рамка
    inner_margin = 10
    stela_draw.rectangle(
        [inner_margin, inner_margin, stela_px_w - inner_margin - 1, stela_px_h - inner_margin - 1],
        outline=(150, 150, 150, 100),
        width=1
    )
    
    # --- ВСТАВЛЯЕМ СТЕЛЛУ НА СТРАНИЦУ ---
    page.paste(stela_img, (stela_x, stela_y), stela_img)
    
    # --- ДОБАВЛЯЕМ ПОДПИСИ НА СТРАНИЦЕ ---
    page_draw = ImageDraw.Draw(page)
    
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
    
    # Заголовок
    page_draw.text(
        (page_width // 2, 50),
        "ЭСКИЗ СТЕЛЛЫ",
        fill=(200, 200, 200),
        font=font_large,
        anchor="mt"
    )
    
    # Подпись с размерами
    size_text = f"{stela_width} × {stela_height} мм"
    page_draw.text(
        (page_width // 2, 100),
        size_text,
        fill=(150, 150, 150),
        font=font_medium,
        anchor="mt"
    )
    
    # Подпись внизу
    page_draw.text(
        (page_width // 2, page_height - 30),
        "Предварительный эскиз • Окончательный вид может отличаться",
        fill=(100, 100, 100),
        font=font_medium,
        anchor="mb"
    )
    
    # Конвертируем в PNG
    output = io.BytesIO()
    page.save(output, format='PNG', quality=95, optimize=True)
    output.seek(0)
    
    return output

def get_stone_color(stone_type):
    """Возвращает цвет камня"""
    colors = {
        'classic': (160, 160, 160),
        'dark': (65, 65, 70),
        'light': (210, 210, 205),
        'marble': (225, 220, 215),
        'basalt': (50, 50, 55)
    }
    return colors.get(stone_type, (160, 160, 160))

def load_texture_from_path(texture_path, width, height):
    """Загружает текстуру по пути"""
    try:
        import os
        # Пытаемся найти файл текстуры
        base_dir = os.path.dirname(__file__)
        texture_dir = os.path.join(base_dir, 'textures')
        
        # Ищем файл
        full_path = os.path.join(texture_dir, texture_path)
        if not os.path.exists(full_path):
            # Пробуем другие варианты
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                test_path = full_path + ext
                if os.path.exists(test_path):
                    full_path = test_path
                    break
        
        if os.path.exists(full_path):
            texture = Image.open(full_path)
            texture = texture.convert('RGBA')
            # Масштабируем
            texture = texture.resize((width, height), Image.Resampling.LANCZOS)
            # Делаем полупрозрачным для смешивания
            texture_array = np.array(texture)
            # Увеличиваем прозрачность для лучшего смешивания
            if texture_array.shape[2] == 4:
                texture_array[:, :, 3] = texture_array[:, :, 3] * 0.7
            return Image.fromarray(texture_array, 'RGBA')
    except Exception as e:
        print(f"Ошибка загрузки текстуры: {e}")
    return None

def apply_shape_mask(img, shape_type):
    """Применяет маску формы к изображению"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    width, height = img.size
    mask = Image.new('L', (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    
    cx, cy = width // 2, height // 2
    size = min(width, height)
    
    if shape_type == 'circle':
        mask_draw.ellipse([0, 0, width, height], fill=255)
    elif shape_type == 'oval':
        mask_draw.ellipse([0, 0, width, height], fill=255)
    elif shape_type == 'square':
        sq_size = size * 0.8
        mask_draw.rectangle([cx - sq_size//2, cy - sq_size//2, cx + sq_size//2, cy + sq_size//2], fill=255)
    elif shape_type == 'rounded':
        r = 30
        mask_draw.rounded_rectangle([0, 0, width, height], radius=r, fill=255)
    else:
        return img
    
    # Применяем маску
    img_array = np.array(img)
    mask_array = np.array(mask)
    img_array[:, :, 3] = mask_array
    return Image.fromarray(img_array, 'RGBA')

def create_engraving_effect(engraving_img, stela_img, x, y):
    """Создает эффект гравировки (вырезания в камне)"""
    # Конвертируем в RGBA
    if engraving_img.mode != 'RGBA':
        engraving_img = engraving_img.convert('RGBA')
    
    # Получаем массив
    grav_array = np.array(engraving_img)
    
    # Создаем эффект глубины
    # 1. Делаем изображение темнее (как вырезанное)
    for c in range(3):
        grav_array[:, :, c] = grav_array[:, :, c] * 0.4 + 30
    
    # 2. Добавляем тень для объема
    # Создаем сдвинутую копию для тени
    shadow = np.zeros_like(grav_array)
    shadow[:, :, 3] = grav_array[:, :, 3] * 0.5  # Прозрачность тени
    
    # Сдвигаем тень вниз-вправо
    shadow_shift = 3
    shadow_rolled = np.roll(shadow, shadow_shift, axis=0)
    shadow_rolled = np.roll(shadow_rolled, shadow_shift, axis=1)
    
    # Объединяем тень и гравировку
    result = np.zeros_like(grav_array)
    # Тень
    for c in range(4):
        result[:, :, c] = shadow_rolled[:, :, c]
    # Гравировка поверх
    for c in range(4):
        mask = grav_array[:, :, 3] > 0
        result[:, :, c][mask] = grav_array[:, :, c][mask]
    
    # 3. Добавляем свечение вокруг гравировки (эффект ореола)
    if int(params.get('halo', 35)) > 0:
        # Создаем маску для ореола
        halo_mask = np.zeros((grav_array.shape[0], grav_array.shape[1]), dtype=np.float32)
        halo_mask[grav_array[:, :, 3] > 0] = 1.0
        
        # Размываем маску
        from scipy.ndimage import gaussian_filter
        halo_mask = gaussian_filter(halo_mask, sigma=10)
        
        # Добавляем светлый ореол
        halo_color = np.array([200, 200, 200])
        for c in range(3):
            result[:, :, c] = result[:, :, c] + halo_mask * halo_color[c] * 0.15
            result[:, :, c] = np.clip(result[:, :, c], 0, 255)
    
    return Image.fromarray(result, 'RGBA')

# Добавляем импорт scipy если доступен
try:
    from scipy.ndimage import gaussian_filter
except ImportError:
    def gaussian_filter(arr, sigma):
        """Простая имитация размытия если scipy недоступен"""
        # Упрощенная версия - просто размываем через PIL
        from PIL import ImageFilter
        img = Image.fromarray((arr * 255).astype(np.uint8))
        img = img.filter(ImageFilter.GaussianBlur(radius=sigma))
>>>>>>> 8e734ba9ce21e78239c78bba23747082f52e579a
        return np.array(img) / 255.0