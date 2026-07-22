<<<<<<< HEAD
# pdf_generator.py - Генерация PDF отчетов

from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.units import mm, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import io
import base64
from PIL import Image as PILImage
from datetime import datetime

def generate_order_pdf(project, engraving_image_b64=None, mask_image_b64=None):
    """Генерация PDF с заказом"""
    
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
    
    # === СТРАНИЦА 1: ЭСКИЗ ===
    story.append(Paragraph("📋 Эскиз памятника", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    # Добавляем изображение
    if engraving_image_b64:
        try:
            img_data = base64.b64decode(engraving_image_b64)
            img = PILImage.open(io.BytesIO(img_data))
            
            # Сохраняем во временный файл
            temp_img = io.BytesIO()
            img.save(temp_img, format='PNG')
            temp_img.seek(0)
            
            # Добавляем в PDF
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
    
    # === СТРАНИЦА 2: ПАРАМЕТРЫ ===
    story.append(Paragraph("📋 Детали заказа", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    # Данные заказчика
    story.append(Paragraph("👤 Заказчик", styles['CustomHeading']))
    data = [
        ["ФИО:", project.client_name or "—"],
        ["Телефон:", project.client_phone or "—"],
        ["Email:", project.client_email or "—"],
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
    
    # Параметры памятника
    story.append(Paragraph("🗿 Параметры памятника", styles['CustomHeading']))
    mode_names = {'engraving': 'Гравировка', 'photo': 'Фото-декаль'}
    shape_names = {'none': 'Без формы', 'circle': 'Круг', 'oval': 'Овал', 'square': 'Квадрат', 'rounded': 'Скругленный'}
    stone_names = {'classic': 'Классический', 'dark': 'Темный', 'light': 'Светлый', 'marble': 'Мрамор', 'basalt': 'Базальт'}
    
    params_data = [
        ["Режим:", mode_names.get(project.mode, project.mode)],
        ["Форма:", shape_names.get(project.shape, project.shape)],
        ["Камень:", stone_names.get(project.stone, project.stone)],
        ["Текстура:", project.texture or "Нет"],
        ["Масштаб:", f"{project.scale:.2f}"],
        ["Смещение X:", f"{project.offset_x:.2f}"],
        ["Смещение Y:", f"{project.offset_y:.2f}"],
        ["Смещение Z:", f"{project.offset_z:.2f}"],
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
    
    # Параметры обработки
    story.append(Paragraph("🎨 Параметры обработки", styles['CustomHeading']))
    process_data = [
        ["Глубина:", f"{project.depth:.2f}"],
        ["Ореол:", str(project.halo)],
        ["Контраст:", f"{project.contrast:.1f}"],
        ["Яркость:", str(project.brightness)],
    ]
    if project.mode == 'photo':
        process_data.append(["Режим фото:", "Цветной" if project.photo_mode == 'color' else "Ч/Б"])
        process_data.append(["Яркость фото:", str(project.photo_brightness)])
        process_data.append(["Контраст фото:", f"{project.photo_contrast:.2f}"])
    
    t3 = Table(process_data, colWidths=[40*mm, 90*mm])
    t3.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t3)
    story.append(Spacer(1, 5*mm))
    
    # Отступы
    story.append(Paragraph("✂️ Отступы от края", styles['CustomHeading']))
    crop_data = [
        ["Сверху:", f"{project.crop_top:.1f}%"],
        ["Снизу:", f"{project.crop_bottom:.1f}%"],
        ["Слева:", f"{project.crop_left:.1f}%"],
        ["Справа:", f"{project.crop_right:.1f}%"],
    ]
    t4 = Table(crop_data, colWidths=[40*mm, 90*mm])
    t4.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t4)
    story.append(Spacer(1, 5*mm))
    
    # Подписи
    story.append(Paragraph("✅ Согласие", styles['CustomHeading']))
    story.append(Paragraph(
        "Я ознакомился(ась) с эскизом и согласен(на) с расположением и качеством гравировки",
        styles['CustomNormal']
    ))
    story.append(Spacer(1, 10*mm))
    
    # Подписи в две колонки
    from reportlab.platypus import Table as RLTable
    
    signatures_data = [
        ["ИСПОЛНИТЕЛЬ", "ЗАКАЗЧИК"],
        ["ООО \"Память\"", ""],
        ["__________________", "__________________"],
        ["(подпись)", "(подпись)"],
    ]
    t5 = RLTable(signatures_data, colWidths=[70*mm, 70*mm])
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
    
    # Сборка PDF
    doc.build(story)
    buffer.seek(0)
=======
# pdf_generator.py - Генерация PDF отчетов

from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.units import mm, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import io
import base64
from PIL import Image as PILImage
from datetime import datetime

def generate_order_pdf(project, engraving_image_b64=None, mask_image_b64=None):
    """Генерация PDF с заказом"""
    
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
    
    # === СТРАНИЦА 1: ЭСКИЗ ===
    story.append(Paragraph("📋 Эскиз памятника", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    # Добавляем изображение
    if engraving_image_b64:
        try:
            img_data = base64.b64decode(engraving_image_b64)
            img = PILImage.open(io.BytesIO(img_data))
            
            # Сохраняем во временный файл
            temp_img = io.BytesIO()
            img.save(temp_img, format='PNG')
            temp_img.seek(0)
            
            # Добавляем в PDF
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
    
    # === СТРАНИЦА 2: ПАРАМЕТРЫ ===
    story.append(Paragraph("📋 Детали заказа", styles['CustomTitle']))
    story.append(Spacer(1, 5*mm))
    
    # Данные заказчика
    story.append(Paragraph("👤 Заказчик", styles['CustomHeading']))
    data = [
        ["ФИО:", project.client_name or "—"],
        ["Телефон:", project.client_phone or "—"],
        ["Email:", project.client_email or "—"],
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
    
    # Параметры памятника
    story.append(Paragraph("🗿 Параметры памятника", styles['CustomHeading']))
    mode_names = {'engraving': 'Гравировка', 'photo': 'Фото-декаль'}
    shape_names = {'none': 'Без формы', 'circle': 'Круг', 'oval': 'Овал', 'square': 'Квадрат', 'rounded': 'Скругленный'}
    stone_names = {'classic': 'Классический', 'dark': 'Темный', 'light': 'Светлый', 'marble': 'Мрамор', 'basalt': 'Базальт'}
    
    params_data = [
        ["Режим:", mode_names.get(project.mode, project.mode)],
        ["Форма:", shape_names.get(project.shape, project.shape)],
        ["Камень:", stone_names.get(project.stone, project.stone)],
        ["Текстура:", project.texture or "Нет"],
        ["Масштаб:", f"{project.scale:.2f}"],
        ["Смещение X:", f"{project.offset_x:.2f}"],
        ["Смещение Y:", f"{project.offset_y:.2f}"],
        ["Смещение Z:", f"{project.offset_z:.2f}"],
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
    
    # Параметры обработки
    story.append(Paragraph("🎨 Параметры обработки", styles['CustomHeading']))
    process_data = [
        ["Глубина:", f"{project.depth:.2f}"],
        ["Ореол:", str(project.halo)],
        ["Контраст:", f"{project.contrast:.1f}"],
        ["Яркость:", str(project.brightness)],
    ]
    if project.mode == 'photo':
        process_data.append(["Режим фото:", "Цветной" if project.photo_mode == 'color' else "Ч/Б"])
        process_data.append(["Яркость фото:", str(project.photo_brightness)])
        process_data.append(["Контраст фото:", f"{project.photo_contrast:.2f}"])
    
    t3 = Table(process_data, colWidths=[40*mm, 90*mm])
    t3.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t3)
    story.append(Spacer(1, 5*mm))
    
    # Отступы
    story.append(Paragraph("✂️ Отступы от края", styles['CustomHeading']))
    crop_data = [
        ["Сверху:", f"{project.crop_top:.1f}%"],
        ["Снизу:", f"{project.crop_bottom:.1f}%"],
        ["Слева:", f"{project.crop_left:.1f}%"],
        ["Справа:", f"{project.crop_right:.1f}%"],
    ]
    t4 = Table(crop_data, colWidths=[40*mm, 90*mm])
    t4.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f8f0')),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t4)
    story.append(Spacer(1, 5*mm))
    
    # Подписи
    story.append(Paragraph("✅ Согласие", styles['CustomHeading']))
    story.append(Paragraph(
        "Я ознакомился(ась) с эскизом и согласен(на) с расположением и качеством гравировки",
        styles['CustomNormal']
    ))
    story.append(Spacer(1, 10*mm))
    
    # Подписи в две колонки
    from reportlab.platypus import Table as RLTable
    
    signatures_data = [
        ["ИСПОЛНИТЕЛЬ", "ЗАКАЗЧИК"],
        ["ООО \"Память\"", ""],
        ["__________________", "__________________"],
        ["(подпись)", "(подпись)"],
    ]
    t5 = RLTable(signatures_data, colWidths=[70*mm, 70*mm])
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
    
    # Сборка PDF
    doc.build(story)
    buffer.seek(0)
>>>>>>> 8e734ba9ce21e78239c78bba23747082f52e579a
    return buffer