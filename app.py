# app.py - БЕЗ БД, НО С 3D МОДЕЛЯМИ (ДЛЯ VERCEL/GITHUB)

from flask import Flask, request, render_template, jsonify, send_file, redirect, url_for, flash, session
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import datetime
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import os
import io
import base64
import random
import time
import uuid
import traceback
import glob
import json
import sys
import requests
from werkzeug.utils import secure_filename

# ============================================
# НАСТРОЙКА ПРИЛОЖЕНИЯ
# ============================================

app = Flask(__name__)
app.config['SECRET_KEY'] = 'stela-secret-key-2024'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

CORS(app)
bcrypt = Bcrypt(app)

# ============================================
# ВРЕМЕННОЕ ХРАНИЛИЩЕ (ВМЕСТО БД)
# ============================================

projects = {}
project_counter = 0

# Демо-пользователи (в памяти)
USERS = {
    'admin': {
        'password': bcrypt.generate_password_hash('admin123').decode('utf-8'),
        'full_name': 'Администратор',
        'role': 'admin'
    },
    'manager': {
        'password': bcrypt.generate_password_hash('manager123').decode('utf-8'),
        'full_name': 'Менеджер',
        'role': 'manager'
    }
}

# ============================================
# НАСТРОЙКА ДЛЯ 3D МОДЕЛЕЙ
# ============================================

UPLOAD_MODELS_PATH = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'models')
os.makedirs(UPLOAD_MODELS_PATH, exist_ok=True)

ALLOWED_MODEL_EXTENSIONS = {'stl', 'obj', 'gltf', 'glb', '3mf', 'ply'}

def allowed_model_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_MODEL_EXTENSIONS

# ============================================
# КЭШ И КОНСТАНТЫ
# ============================================

enhanced_cache = {}
texture_cache = {}
TEXTURES_PATH = os.path.join(os.path.dirname(__file__), 'textures')

if not os.path.exists(TEXTURES_PATH):
    os.makedirs(TEXTURES_PATH)

# ============================================
# ФУНКЦИИ РАБОТЫ С ТЕКСТУРАМИ
# ============================================

def get_available_textures():
    textures = []
    if not os.path.exists(TEXTURES_PATH):
        return textures
    
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp', '*.bmp']:
        for file in glob.glob(os.path.join(TEXTURES_PATH, ext)):
            rel_path = os.path.relpath(file, TEXTURES_PATH)
            rel_path_url = rel_path.replace('\\', '/')
            textures.append({
                'id': rel_path_url,
                'name': os.path.basename(file),
                'path': file,
                'category': 'root',
                'display_name': os.path.basename(file),
                'preview': f"/texture/{rel_path_url}"
            })
    
    for root, dirs, files in os.walk(TEXTURES_PATH):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp')):
                rel_path = os.path.relpath(os.path.join(root, file), TEXTURES_PATH)
                rel_path_url = rel_path.replace('\\', '/')
                category = os.path.basename(root) if root != TEXTURES_PATH else 'root'
                textures.append({
                    'id': rel_path_url,
                    'name': file,
                    'path': os.path.join(root, file),
                    'category': category,
                    'display_name': f"{category}/{file}" if category != 'root' else file,
                    'preview': f"/texture/{rel_path_url}"
                })
    
    textures.sort(key=lambda x: (x['category'], x['name']))
    return textures

def load_texture(texture_path, target_size=None):
    try:
        cache_key = f"{texture_path}_{target_size[0]}_{target_size[1]}" if target_size else texture_path
        if cache_key in texture_cache:
            return texture_cache[cache_key].copy()
        
        img = Image.open(texture_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        if target_size:
            img = img.resize(target_size, Image.Resampling.LANCZOS)
        
        img_array = np.array(img)
        texture_cache[cache_key] = img_array.copy()
        return img_array
    except Exception as e:
        print(f"❌ Ошибка загрузки текстуры {texture_path}: {e}")
        if target_size:
            return np.ones((target_size[1], target_size[0], 3), dtype=np.uint8) * 128
        return np.ones((512, 512, 3), dtype=np.uint8) * 128

def apply_texture_to_stela(engraving_with_alpha, texture_path, stone_style='classic'):
    h, w = engraving_with_alpha.shape[:2]
    texture = load_texture(texture_path, (w, h))
    
    granite = create_granite_texture(h, w, stone_style)
    granite_rgb = np.stack([granite, granite, granite], axis=2)
    
    background = (texture.astype(np.float32) * 0.7 + granite_rgb.astype(np.float32) * 0.3).astype(np.uint8)
    mask = engraving_with_alpha[:, :, 3] / 255.0
    
    result = np.zeros((h, w, 3), dtype=np.uint8)
    for c in range(3):
        result[:, :, c] = (background[:, :, c] * (1 - mask) + 
                           engraving_with_alpha[:, :, c] * mask).astype(np.uint8)
    
    result_with_alpha = np.zeros((h, w, 4), dtype=np.uint8)
    result_with_alpha[:, :, 0:3] = result
    result_with_alpha[:, :, 3] = engraving_with_alpha[:, :, 3]
    
    return result_with_alpha

def create_granite_texture(h, w, style='classic'):
    if style == 'classic':
        granite = np.random.normal(130, 30, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 50, 200)
        for _ in range(30):
            x1 = random.randint(0, w)
            y1 = random.randint(0, h)
            x2 = x1 + random.randint(-200, 200)
            y2 = y1 + random.randint(-200, 200)
            cv2.line(granite, (x1, y1), (x2, y2), random.randint(70, 150), random.randint(1, 4))
    elif style == 'dark':
        granite = np.random.normal(60, 20, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 20, 120)
        for _ in range(30):
            x1 = random.randint(0, w)
            y1 = random.randint(0, h)
            x2 = x1 + random.randint(-150, 150)
            y2 = y1 + random.randint(-150, 150)
            cv2.line(granite, (x1, y1), (x2, y2), random.randint(30, 80), random.randint(1, 3))
    elif style == 'light':
        granite = np.random.normal(200, 20, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 150, 240)
        for _ in range(20):
            x1 = random.randint(0, w)
            y1 = random.randint(0, h)
            x2 = x1 + random.randint(-250, 250)
            y2 = y1 + random.randint(-250, 250)
            cv2.line(granite, (x1, y1), (x2, y2), random.randint(160, 200), random.randint(1, 3))
    elif style == 'marble':
        granite = np.random.normal(210, 15, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 170, 240)
        for _ in range(12):
            x1 = random.randint(0, w)
            y1 = random.randint(0, h)
            x2 = x1 + random.randint(-300, 300)
            y2 = y1 + random.randint(-300, 300)
            cv2.line(granite, (x1, y1), (x2, y2), random.randint(190, 225), random.randint(2, 6))
    elif style == 'basalt':
        granite = np.random.normal(45, 15, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 15, 90)
        for _ in range(25):
            x1 = random.randint(0, w)
            y1 = random.randint(0, h)
            x2 = x1 + random.randint(-100, 100)
            y2 = y1 + random.randint(-100, 100)
            cv2.line(granite, (x1, y1), (x2, y2), random.randint(25, 60), random.randint(1, 2))
    else:
        granite = np.random.normal(130, 30, (h, w)).astype(np.uint8)
        granite = np.clip(granite, 50, 200)
    
    return granite

def enhance_engraving_contrast(img_array, mask):
    img_float = img_array.astype(np.float32)
    img_norm = (img_float - np.min(img_float)) / (np.max(img_float) - np.min(img_float) + 1)
    img_norm = np.power(img_norm, 0.7)
    img_norm = 1 - np.power(1 - img_norm, 1.2)
    img_enhanced = (img_norm * 255).astype(np.uint8)
    img_enhanced = cv2.bitwise_and(img_enhanced, img_enhanced, mask=mask)
    return img_enhanced

def remove_background_smart(img_array, brightness_boost=0):
    if brightness_boost != 0:
        img_array = np.clip(img_array.astype(np.float32) + brightness_boost, 0, 255).astype(np.uint8)
    
    blurred = cv2.GaussianBlur(img_array, (5, 5), 0)
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    if np.mean(mask) > 128:
        mask = 255 - mask
    
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        mask = np.zeros_like(mask)
        cv2.drawContours(mask, [largest], -1, 255, -1)
    
    mask = cv2.GaussianBlur(mask, (15, 15), 0)
    result = cv2.bitwise_and(img_array, img_array, mask=mask.astype(np.uint8))
    
    return result, mask

def create_engraving_from_enhanced(enhanced_bytes, depth=0.9, halo=35, contrast=3.0, brightness=0, stone='classic',
                                   crop_top=0, crop_bottom=0, crop_left=0, crop_right=0, texture_path=None):
    print(f"🔄 Создание гравировки...")
    start = time.time()
    
    img = Image.open(io.BytesIO(enhanced_bytes))
    
    has_alpha = img.mode == 'RGBA' or img.mode == 'LA'
    
    if has_alpha:
        if img.mode == 'RGBA':
            r, g, b, a = img.split()
            mask_from_alpha = np.array(a)
            img_gray = Image.merge('RGB', (r, g, b)).convert('L')
        else:
            img_gray, a = img.split()
            mask_from_alpha = np.array(a)
            img_gray = img_gray.convert('L')
        print("✅ Использую альфа-канал как маску")
    else:
        img_gray = img.convert('L')
        mask_from_alpha = None
        print("⚠️ Нет альфа-канала")
    
    enhancer = ImageEnhance.Contrast(img_gray)
    img_gray = enhancer.enhance(min(contrast * 1.5, 5.0))
    img_gray = img_gray.filter(ImageFilter.SHARPEN)
    img_gray = img_gray.filter(ImageFilter.SHARPEN)
    
    img_array = np.array(img_gray)
    h, w = img_array.shape
    
    top_px = int(h * crop_top / 100)
    bottom_px = int(h * crop_bottom / 100)
    left_px = int(w * crop_left / 100)
    right_px = int(w * crop_right / 100)
    
    y1 = top_px
    y2 = h - bottom_px
    x1 = left_px
    x2 = w - right_px
    
    if y2 <= y1 or x2 <= x1:
        y1, y2, x1, x2 = 0, h, 0, w
    
    cropped_img = img_array[y1:y2, x1:x2]
    cropped_h, cropped_w = cropped_img.shape
    
    print(f"📐 Размер: {cropped_w}x{cropped_h}")
    
    if mask_from_alpha is not None:
        alpha_cropped = mask_from_alpha[y1:y2, x1:x2]
        _, object_mask = cv2.threshold(alpha_cropped, 30, 255, cv2.THRESH_BINARY)
        object_mask = cv2.GaussianBlur(object_mask, (7, 7), 0)
        masked_array = cv2.bitwise_and(cropped_img, cropped_img, mask=object_mask)
        masked_array = enhance_engraving_contrast(masked_array, object_mask)
    else:
        masked_array, object_mask = remove_background_smart(cropped_img, brightness)
    
    granite = create_granite_texture(cropped_h, cropped_w, stone)
    object_mask_norm = object_mask.astype(np.float32) / 255.0
    depth_map = (255 - masked_array).astype(np.float32) / 255.0
    depth_map = np.power(depth_map, 0.8)
    depth_map = depth_map * depth * 1.2
    depth_map = np.clip(depth_map, 0, 1.0)
    result = granite.astype(np.float32) * (1 - depth_map * 0.95 * object_mask_norm)
    result = np.clip(result, 0, 255)
    
    if halo > 0:
        halo_kernel = max(31, int(halo * 0.8))
        if halo_kernel % 2 == 0:
            halo_kernel += 1
        if halo_kernel < 3:
            halo_kernel = 3
        halo_mask = cv2.GaussianBlur(object_mask, (halo_kernel, halo_kernel), 0).astype(np.float32) / 255.0
        halo_mask = halo_mask * (halo / 50.0)
        result = np.clip(result + halo_mask * 30, 0, 255)
    
    result = result.astype(np.uint8)
    result = cv2.equalizeHist(result)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    result = clahe.apply(result)
    
    result_with_alpha = np.zeros((cropped_h, cropped_w, 4), dtype=np.uint8)
    result_with_alpha[:, :, 0] = result
    result_with_alpha[:, :, 1] = result
    result_with_alpha[:, :, 2] = result
    result_with_alpha[:, :, 3] = object_mask
    
    if texture_path and os.path.exists(texture_path):
        print(f"🔄 Накладываю текстуру: {texture_path}")
        result_with_alpha = apply_texture_to_stela(result_with_alpha, texture_path, stone)
    
    result_img = Image.fromarray(result_with_alpha, 'RGBA')
    result_img = result_img.filter(ImageFilter.SHARPEN)
    
    output = io.BytesIO()
    result_img.save(output, format='PNG', optimize=True)
    output.seek(0)
    
    mask_img = Image.fromarray(object_mask.astype(np.uint8), 'L')
    mask_output = io.BytesIO()
    mask_img.save(mask_output, format='PNG')
    mask_output.seek(0)
    
    print(f"✅ Гравировка создана за {time.time()-start:.2f} сек")
    return output, mask_output

def create_photo_decal(enhanced_bytes, crop_top=0, crop_bottom=0, crop_left=0, crop_right=0,
                       photo_brightness=0, photo_contrast=1.0, photo_mode='color', texture_path=None):
    print(f"🔄 Создание фото-декали (режим: {photo_mode})...")
    start = time.time()
    
    img = Image.open(io.BytesIO(enhanced_bytes))
    
    has_alpha = img.mode == 'RGBA' or img.mode == 'LA'
    
    if has_alpha:
        if img.mode == 'RGBA':
            r, g, b, a = img.split()
            mask_from_alpha = np.array(a)
            img_rgb = Image.merge('RGB', (r, g, b))
        else:
            img_gray, a = img.split()
            mask_from_alpha = np.array(a)
            img_rgb = img_gray.convert('RGB')
        print("✅ Использую альфа-канал как маску")
    else:
        img_rgb = img.convert('RGB')
        mask_from_alpha = None
        print("⚠️ Нет альфа-канала")
    
    if photo_mode == 'bw':
        img_gray = img_rgb.convert('L')
        if photo_contrast != 1.0:
            enhancer = ImageEnhance.Contrast(img_gray)
            img_gray = enhancer.enhance(photo_contrast)
        if photo_brightness != 0:
            enhancer = ImageEnhance.Brightness(img_gray)
            img_gray = enhancer.enhance(1.0 + photo_brightness / 50.0)
        img_gray = img_gray.filter(ImageFilter.SHARPEN)
        img_array = np.array(img_gray)
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
        print("📷 Режим: Черно-белый")
    else:
        if photo_contrast != 1.0:
            enhancer = ImageEnhance.Contrast(img_rgb)
            img_rgb = enhancer.enhance(photo_contrast)
        if photo_brightness != 0:
            enhancer = ImageEnhance.Brightness(img_rgb)
            img_rgb = enhancer.enhance(1.0 + photo_brightness / 50.0)
        img_rgb = img_rgb.filter(ImageFilter.SHARPEN)
        img_array = np.array(img_rgb)
        print("📷 Режим: Цветной")
    
    h, w = img_array.shape[:2]
    
    top_px = int(h * crop_top / 100)
    bottom_px = int(h * crop_bottom / 100)
    left_px = int(w * crop_left / 100)
    right_px = int(w * crop_right / 100)
    
    y1 = top_px
    y2 = h - bottom_px
    x1 = left_px
    x2 = w - right_px
    
    if y2 <= y1 or x2 <= x1:
        y1, y2, x1, x2 = 0, h, 0, w
    
    cropped_img = img_array[y1:y2, x1:x2]
    cropped_h, cropped_w = cropped_img.shape[:2]
    
    print(f"📐 Размер фото: {cropped_w}x{cropped_h}")
    
    if mask_from_alpha is not None:
        alpha_cropped = mask_from_alpha[y1:y2, x1:x2]
        _, object_mask = cv2.threshold(alpha_cropped, 30, 255, cv2.THRESH_BINARY)
        object_mask = cv2.GaussianBlur(object_mask, (7, 7), 0)
    else:
        if photo_mode == 'bw':
            gray = cropped_img[:, :, 0]
        else:
            gray = cv2.cvtColor(cropped_img, cv2.COLOR_RGB2GRAY)
        
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if np.mean(mask) > 128:
            mask = 255 - mask
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            mask = np.zeros_like(mask)
            cv2.drawContours(mask, [largest], -1, 255, -1)
        object_mask = cv2.GaussianBlur(mask, (7, 7), 0)
    
    result_with_alpha = np.zeros((cropped_h, cropped_w, 4), dtype=np.uint8)
    result_with_alpha[:, :, 0] = cropped_img[:, :, 0]
    result_with_alpha[:, :, 1] = cropped_img[:, :, 1]
    result_with_alpha[:, :, 2] = cropped_img[:, :, 2]
    result_with_alpha[:, :, 3] = object_mask
    
    if texture_path and os.path.exists(texture_path):
        print(f"🔄 Накладываю текстуру: {texture_path}")
        result_with_alpha = apply_texture_to_stela(result_with_alpha, texture_path, 'classic')
    
    result_img = Image.fromarray(result_with_alpha, 'RGBA')
    
    output = io.BytesIO()
    result_img.save(output, format='PNG', optimize=True)
    output.seek(0)
    
    mask_img = Image.fromarray(object_mask.astype(np.uint8), 'L')
    mask_output = io.BytesIO()
    mask_img.save(mask_output, format='PNG')
    mask_output.seek(0)
    
    print(f"✅ Фото-декаль создана за {time.time()-start:.2f} сек")
    return output, mask_output

def generate_order_pdf(project, engraving_image_b64=None):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#2E7D32'),
        spaceAfter=6*mm
    ))
    styles.add(ParagraphStyle(
        name='CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2E7D32'),
        spaceAfter=3*mm
    ))
    styles.add(ParagraphStyle(
        name='CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name='CustomSmall',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.grey
    ))
    
    story = []
    
    story.append(Paragraph("📋 Эскиз памятника", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    if engraving_image_b64:
        try:
            img_data = base64.b64decode(engraving_image_b64)
            img = Image.open(io.BytesIO(img_data))
            temp_img = io.BytesIO()
            img.save(temp_img, format='PNG')
            temp_img.seek(0)
            img_width = 140*mm
            img_height = 180*mm
            from reportlab.platypus import Image as RLImage
            pdf_img = RLImage(temp_img, width=img_width, height=img_height)
            story.append(pdf_img)
            story.append(Spacer(1, 3*mm))
            story.append(Paragraph("* Изображение является предварительным эскизом", styles['CustomSmall']))
        except Exception as e:
            print(f"❌ Ошибка вставки изображения: {e}")
            story.append(Paragraph("⚠️ Изображение не загружено", styles['CustomNormal']))
    
    story.append(PageBreak())
    
    story.append(Paragraph("📋 Детали заказа", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    story.append(Paragraph("👤 Заказчик", styles['CustomHeading']))
    data = [
        ["ФИО:", project.get('client_name', "—")],
        ["Телефон:", project.get('client_phone', "—")],
        ["Email:", project.get('client_email', "—")],
        ["Дата:", datetime.now().strftime("%d.%m.%Y %H:%M")],
    ]
    t = Table(data, colWidths=[40*mm, 90*mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 5*mm))
    
    story.append(Paragraph("🗿 Параметры памятника", styles['CustomHeading']))
    mode_names = {'engraving': 'Гравировка', 'photo': 'Фото-декаль'}
    shape_names = {'none': 'Без формы', 'circle': 'Круг', 'oval': 'Овал', 'square': 'Квадрат', 'rounded': 'Скругленный'}
    stone_names = {'classic': 'Классический', 'dark': 'Темный', 'light': 'Светлый', 'marble': 'Мрамор', 'basalt': 'Базальт'}
    
    params_data = [
        ["Режим:", mode_names.get(project.get('mode', 'engraving'), project.get('mode', 'engraving'))],
        ["Форма:", shape_names.get(project.get('shape', 'none'), project.get('shape', 'none'))],
        ["Камень:", stone_names.get(project.get('stone', 'classic'), project.get('stone', 'classic'))],
        ["Текстура:", project.get('texture', "Нет")],
        ["Масштаб:", f"{project.get('scale', 0.8):.2f}"],
    ]
    t2 = Table(params_data, colWidths=[40*mm, 90*mm])
    t2.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t2)
    story.append(Spacer(1, 5*mm))
    
    story.append(Paragraph("✅ Согласие", styles['CustomHeading']))
    story.append(Paragraph(
        "Я ознакомился(ась) с эскизом и согласен(на) с расположением и качеством гравировки",
        styles['CustomNormal']
    ))
    story.append(Spacer(1, 10*mm))
    
    signatures_data = [
        ["ИСПОЛНИТЕЛЬ", "ЗАКАЗЧИК"],
        ["ООО \"Память\"", ""],
        ["__________________", "__________________"],
        ["(подпись)", "(подпись)"],
    ]
    t5 = Table(signatures_data, colWidths=[70*mm, 70*mm])
    t5.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('SPAN', (0,1), (0,1)),
        ('SPAN', (1,1), (1,1)),
        ('FONTNAME', (0,0), (0,0), 'Helvetica-Bold'),
        ('FONTNAME', (1,0), (1,0), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,0), (0,0), colors.HexColor('#2E7D32')),
        ('TEXTCOLOR', (1,0), (1,0), colors.HexColor('#2E7D32')),
    ]))
    story.append(t5)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def send_order_email(project):
    try:
        subject = f"📋 Заказ #{project.get('id', 'Новый')} - {project.get('client_name', 'Новый заказ')}"
        
        body = f"""
📋 НОВЫЙ ЗАКАЗ #{project.get('id', 'Новый')}
{'='*50}

👤 КЛИЕНТ:
ФИО: {project.get('client_name', 'Не указано')}
Телефон: {project.get('client_phone', 'Не указано')}
Email: {project.get('client_email', 'Не указано')}

🗿 ПАРАМЕТРЫ:
Режим: {'Гравировка' if project.get('mode') == 'engraving' else 'Фото-декаль'}
Камень: {project.get('stone', 'Классический')}
Форма: {project.get('shape', 'Без формы')}
Масштаб: {project.get('scale', '0.8')}

📅 {datetime.now().strftime('%d.%m.%Y %H:%M')}
{'='*50}
        """
        
        try:
            php_url = 'http://localhost:5000/send_mail.php'
            data = {
                'subject': subject,
                'message': body,
                'client_name': project.get('client_name'),
                'client_phone': project.get('client_phone'),
                'client_email': project.get('client_email')
            }
            response = requests.post(php_url, json=data, timeout=5)
            if response.status_code == 200:
                result = response.json()
                return result.get('success', False)
        except Exception as e:
            print(f"⚠️ PHP скрипт не доступен: {e}")
        
        print("📌 Заказ сохранен в памяти")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка отправки: {e}")
        return False

# ============================================
# МАРШРУТЫ АВТОРИЗАЦИИ
# ============================================

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username in USERS and bcrypt.check_password_hash(USERS[username]['password'], password):
            session['user'] = {
                'username': username,
                'full_name': USERS[username]['full_name'],
                'role': USERS[username]['role']
            }
            flash('✅ Добро пожаловать!', 'success')
            return redirect(url_for('index'))
        else:
            flash('❌ Неверное имя пользователя или пароль', 'danger')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        full_name = request.form.get('full_name', '').strip()
        
        if not username or not password:
            flash('❌ Заполните все поля', 'danger')
            return render_template('register.html')
        
        if username in USERS:
            flash('❌ Логин уже занят', 'danger')
            return render_template('register.html')
        
        USERS[username] = {
            'password': bcrypt.generate_password_hash(password).decode('utf-8'),
            'full_name': full_name or username,
            'role': 'user'
        }
        
        flash('✅ Регистрация успешна! Войдите в систему', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/guest')
def guest_mode():
    session['is_guest'] = True
    return render_template('index.html', user=None, is_guest=True)

@app.route('/profile')
def profile():
    user = session.get('user')
    if not user:
        return redirect(url_for('login'))
    return render_template('profile.html', user=user)

# ============================================
# ОСНОВНЫЕ МАРШРУТЫ
# ============================================

@app.route('/')
def index():
    user = session.get('user')
    return render_template('index.html', user=user)

@app.route('/static/<path:filename>')
def serve_static(filename):
    from flask import send_from_directory
    return send_from_directory('static', filename)

@app.route('/images/<path:filename>')
def serve_images(filename):
    from flask import send_from_directory
    return send_from_directory('static/images', filename)

# ============================================
# API МАРШРУТЫ ДЛЯ ТЕКСТУР
# ============================================

@app.route('/textures', methods=['GET'])
def get_textures():
    textures = get_available_textures()
    return jsonify({'textures': textures})

@app.route('/texture/<path:texture_path>', methods=['GET'])
def get_texture_file(texture_path):
    full_path = os.path.join(TEXTURES_PATH, texture_path)
    if os.path.exists(full_path):
        return send_file(full_path)
    return jsonify({'error': 'Texture not found'}), 404

# ============================================
# API МАРШРУТЫ ДЛЯ ЗАГРУЗКИ И ОБРАБОТКИ
# ============================================

@app.route('/upload', methods=['POST'])
def upload():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Нет файла'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'Файл не выбран'}), 400
        
        session_id = str(uuid.uuid4())
        image_data = file.read()
        enhanced_cache[session_id] = image_data
        
        img = Image.open(io.BytesIO(image_data))
        if img.mode == 'RGBA':
            preview = img.convert('RGB')
        else:
            preview = img
        
        preview_bytes = io.BytesIO()
        preview.save(preview_bytes, format='JPEG', quality=85)
        preview_bytes.seek(0)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'enhanced': base64.b64encode(preview_bytes.getvalue()).decode('utf-8')
        })
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process():
    try:
        session_id = request.form.get('session_id')
        if not session_id or session_id not in enhanced_cache:
            return jsonify({'error': 'Сессия не найдена'}), 400
        
        enhanced_bytes = enhanced_cache[session_id]
        mode = request.form.get('mode', 'engraving')
        texture_id = request.form.get('texture', '')
        
        crop_top = float(request.form.get('crop_top', 2))
        crop_bottom = float(request.form.get('crop_bottom', 2))
        crop_left = float(request.form.get('crop_left', 2))
        crop_right = float(request.form.get('crop_right', 2))
        
        texture_path = None
        if texture_id:
            textures = get_available_textures()
            for t in textures:
                if t['id'] == texture_id:
                    texture_path = t['path']
                    break
        
        if mode == 'engraving':
            depth = float(request.form.get('depth', 0.9))
            halo = int(request.form.get('halo', 35))
            contrast = float(request.form.get('contrast', 3.0))
            brightness = int(request.form.get('brightness', 0))
            stone = request.form.get('stone', 'classic')
            
            engraving_output, mask_output = create_engraving_from_enhanced(
                enhanced_bytes, depth=depth, halo=halo, contrast=contrast,
                brightness=brightness, stone=stone,
                crop_top=crop_top, crop_bottom=crop_bottom,
                crop_left=crop_left, crop_right=crop_right,
                texture_path=texture_path
            )
        else:
            photo_brightness = int(request.form.get('photo_brightness', 0))
            photo_contrast = float(request.form.get('photo_contrast', 1.0))
            photo_mode = request.form.get('photo_mode', 'color')
            
            engraving_output, mask_output = create_photo_decal(
                enhanced_bytes,
                crop_top=crop_top, crop_bottom=crop_bottom,
                crop_left=crop_left, crop_right=crop_right,
                photo_brightness=photo_brightness,
                photo_contrast=photo_contrast,
                photo_mode=photo_mode,
                texture_path=texture_path
            )
        
        return jsonify({
            'success': True,
            'engraving': base64.b64encode(engraving_output.getvalue()).decode('utf-8'),
            'mask': base64.b64encode(mask_output.getvalue()).decode('utf-8')
        })
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ============================================
# API МАРШРУТЫ ДЛЯ ПРОЕКТОВ (БЕЗ БД)
# ============================================

@app.route('/api/projects')
def get_projects():
    return jsonify({
        'success': True,
        'projects': list(projects.values())
    })

@app.route('/api/project/<int:project_id>')
def get_project(project_id):
    project = projects.get(project_id)
    if not project:
        return jsonify({'success': False, 'error': 'Проект не найден'}), 404
    return jsonify({'success': True, 'project': project})

@app.route('/api/project/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    if project_id in projects:
        del projects[project_id]
        return jsonify({'success': True, 'message': 'Проект удален'})
    return jsonify({'success': False, 'error': 'Проект не найден'}), 404

@app.route('/api/project/<int:project_id>/pdf')
def download_pdf(project_id):
    try:
        project = projects.get(project_id)
        if not project:
            return jsonify({'error': 'Проект не найден'}), 404
        
        pdf_buffer = generate_order_pdf(project, project.get('engraving_image'))
        
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f'заказ_{project_id}_{datetime.now().strftime("%Y%m%d")}.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        print(f"❌ Ошибка PDF: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ============================================
# API: ОФОРМЛЕНИЕ ЗАКАЗА
# ============================================

@app.route('/api/order/create', methods=['POST'])
def create_order():
    try:
        data = request.get_json()
        
        if not data.get('client_name') or not data.get('client_phone'):
            return jsonify({
                'success': False, 
                'error': 'Укажите ФИО и телефон заказчика'
            }), 400
        
        global project_counter
        project_counter += 1
        
        project = {
            'id': project_counter,
            'client_name': data.get('client_name'),
            'client_phone': data.get('client_phone'),
            'client_email': data.get('client_email', ''),
            'notes': data.get('notes', ''),
            'mode': data.get('mode', 'engraving'),
            'shape': data.get('shape', 'none'),
            'stone': data.get('stone', 'classic'),
            'texture': data.get('texture', ''),
            'blur': float(data.get('blur', 3)),
            'depth': float(data.get('depth', 0.9)),
            'halo': int(data.get('halo', 35)),
            'contrast': float(data.get('contrast', 3.0)),
            'brightness': int(data.get('brightness', 0)),
            'scale': float(data.get('scale', 0.8)),
            'offset_x': float(data.get('offset_x', 0)),
            'offset_y': float(data.get('offset_y', 0)),
            'offset_z': float(data.get('offset_z', -0.1)),
            'crop_top': float(data.get('crop_top', 2)),
            'crop_bottom': float(data.get('crop_bottom', 2)),
            'crop_left': float(data.get('crop_left', 2)),
            'crop_right': float(data.get('crop_right', 2)),
            'photo_mode': data.get('photo_mode', 'color'),
            'photo_brightness': int(data.get('photo_brightness', 0)),
            'photo_contrast': float(data.get('photo_contrast', 1.0)),
            'engraving_image': data.get('engraving_image'),
            'mask_image': data.get('mask_image'),
            'status': 'ready',
            'created_at': datetime.now().isoformat()
        }
        
        projects[project_counter] = project
        
        email_sent = send_order_email(project)
        
        return jsonify({
            'success': True,
            'project_id': project_counter,
            'email_sent': email_sent,
            'message': 'Заказ сохранен' + (' и отправлен на почту' if email_sent else '')
        })
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/guest/order/create', methods=['POST'])
def guest_create_order():
    try:
        data = request.get_json()
        
        if not data.get('client_name') or not data.get('client_phone'):
            return jsonify({
                'success': False, 
                'error': 'Укажите ФИО и телефон заказчика'
            }), 400
        
        global project_counter
        project_counter += 1
        
        project = {
            'id': project_counter,
            'client_name': data.get('client_name'),
            'client_phone': data.get('client_phone'),
            'client_email': data.get('client_email', ''),
            'notes': data.get('notes', ''),
            'mode': data.get('mode', 'engraving'),
            'shape': data.get('shape', 'none'),
            'stone': data.get('stone', 'classic'),
            'texture': data.get('texture', ''),
            'blur': float(data.get('blur', 3)),
            'depth': float(data.get('depth', 0.9)),
            'halo': int(data.get('halo', 35)),
            'contrast': float(data.get('contrast', 3.0)),
            'brightness': int(data.get('brightness', 0)),
            'scale': float(data.get('scale', 0.8)),
            'offset_x': float(data.get('offset_x', 0)),
            'offset_y': float(data.get('offset_y', 0)),
            'offset_z': float(data.get('offset_z', -0.1)),
            'crop_top': float(data.get('crop_top', 2)),
            'crop_bottom': float(data.get('crop_bottom', 2)),
            'crop_left': float(data.get('crop_left', 2)),
            'crop_right': float(data.get('crop_right', 2)),
            'photo_mode': data.get('photo_mode', 'color'),
            'photo_brightness': int(data.get('photo_brightness', 0)),
            'photo_contrast': float(data.get('photo_contrast', 1.0)),
            'engraving_image': data.get('engraving_image'),
            'mask_image': data.get('mask_image'),
            'status': 'ready',
            'created_at': datetime.now().isoformat()
        }
        
        projects[project_counter] = project
        
        email_sent = send_order_email(project)
        
        return jsonify({
            'success': True,
            'project_id': project_counter,
            'email_sent': email_sent,
            'message': 'Заказ сохранен' + (' и отправлен на почту' if email_sent else '')
        })
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# API МАРШРУТЫ ДЛЯ 3D МОДЕЛЕЙ
# ============================================

@app.route('/api/models/upload', methods=['POST'])
def upload_model():
    try:
        if 'model' not in request.files:
            return jsonify({'error': 'Нет файла'}), 400
        
        file = request.files['model']
        if file.filename == '':
            return jsonify({'error': 'Файл не выбран'}), 400
        
        if not allowed_model_file(file.filename):
            return jsonify({'error': 'Неподдерживаемый формат. Используйте: STL, OBJ, GLTF, GLB, 3MF, PLY'}), 400
        
        filename = secure_filename(file.filename)
        timestamp = int(time.time())
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(UPLOAD_MODELS_PATH, unique_filename)
        file.save(filepath)
        
        return jsonify({
            'success': True,
            'message': f'Модель {filename} загружена',
            'model': {
                'filename': unique_filename,
                'original_name': filename,
                'url': f"/static/uploads/models/{unique_filename}"
            }
        })
        
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/list', methods=['GET'])
def list_models():
    try:
        models = []
        for f in os.listdir(UPLOAD_MODELS_PATH):
            if any(f.lower().endswith(ext) for ext in ALLOWED_MODEL_EXTENSIONS):
                models.append({
                    'filename': f,
                    'url': f"/static/uploads/models/{f}",
                    'size': os.path.getsize(os.path.join(UPLOAD_MODELS_PATH, f))
                })
        return jsonify({'success': True, 'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/delete/<filename>', methods=['DELETE'])
def delete_model(filename):
    try:
        filepath = os.path.join(UPLOAD_MODELS_PATH, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({'success': True, 'message': 'Модель удалена'})
        return jsonify({'error': 'Файл не найден'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# ЗАПУСК ПРИЛОЖЕНИЯ
# ============================================

# ДЛЯ VERCEL — ЭКСПОРТ ПРИЛОЖЕНИЯ
application = app

if __name__ == '__main__':
    print("🚀 Запуск сервера гравировки (БЕЗ БД)")
    print(f"📁 Текстуры из: {TEXTURES_PATH}")
    print(f"📁 3D модели сохраняются в: {UPLOAD_MODELS_PATH}")
    print("="*50)
    print("Демо-доступ:")
    print("  👤 admin / admin123 (администратор)")
    print("  👤 manager / manager123 (менеджер)")
    print("📧 Заказы отправляются на: gipsogen2008@gmail.com")
    print("="*50)
    app.run(debug=False, host='0.0.0.0', port=5000)
