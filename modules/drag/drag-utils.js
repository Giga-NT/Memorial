// modules/drag/drag-utils.js
// ============================================================
// УТИЛИТЫ ДЛЯ DRAG-AND-DROP
// ============================================================

import * as THREE from 'three';

/**
 * Получить позицию события (мышь или тач)
 */
export function getEventPosition(event, renderer) {
    let clientX, clientY;
    
    if (event.touches) {
        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return null;
        clientX = touch.clientX;
        clientY = touch.clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
    };
}

/**
 * Найти кастомную стелу в monumentGroup
 */
export function findCustomStele(monumentGroup) {
    if (!monumentGroup) {
        console.warn('⚠️ findCustomStele: monumentGroup отсутствует');
        return null;
    }

    let steleObj = null;

    monumentGroup.traverse((obj) => {
        if (
            obj.userData &&
            obj.userData.isCustomStele === true &&
            obj.userData.modelRef
        ) {
            steleObj = obj;
        }
    });

    if (steleObj) {
        console.log('✅ findCustomStele: кастомная стела найдена:', {
            name: steleObj.name,
            type: steleObj.type,
            position: steleObj.position.toArray(),
            userData: steleObj.userData
        });
    } else {
        console.warn('⚠️ findCustomStele: кастомная стела не найдена');
    }

    return steleObj;
}

/**
 * Найти прямоугольную стелу в monumentGroup
 */
// modules/drag/drag-utils.js

export function findRectangleStele(monumentGroup) {
    console.log('🔍 Ищем прямоугольную стелу...');
    
    // ⭐ СНАЧАЛА ПРОВЕРЯЕМ СОХРАНЁННУЮ ССЫЛКУ
    if (window._currentRectangleStele) {
        const stele = window._currentRectangleStele;
        // Проверяем, что стела всё ещё в сцене
        if (stele.parent) {
            try {
                const box = new THREE.Box3().setFromObject(stele);
                const size = new THREE.Vector3();
                box.getSize(size);
                // ⭐ ПРОВЕРЯЕМ, ЧТО ЭТО ИМЕННО ОСНОВНАЯ СТЕЛА (ширина > 0.3, высота > 0.8)
                if (size.x > 0.3 && size.y > 0.8) {
                    console.log('✅ Нашли основную стелу по сохранённой ссылке:', {
                        width: size.x,
                        height: size.y,
                        depth: size.z
                    });
                    return stele;
                } else {
                    console.warn('⚠️ Сохранённый объект не является основной стелой (слишком маленький):', {
                        width: size.x,
                        height: size.y
                    });
                    window._currentRectangleStele = null;
                }
            } catch(e) {
                console.warn('⚠️ Ошибка получения размеров:', e);
                window._currentRectangleStele = null;
            }
        } else {
            window._currentRectangleStele = null;
        }
    }
    
    if (!monumentGroup) {
        console.warn('⚠️ monumentGroup не найден');
        return null;
    }
    
    // ⭐ ИЩЕМ ОСНОВНУЮ СТЕЛУ ПО BoxGeometry
    let steleObj = null;
    let maxArea = 0;
    
    console.log(`🔍 Поиск в monumentGroup, детей: ${monumentGroup.children.length}`);
    
    monumentGroup.children.forEach((child, index) => {
        // Проверяем BoxGeometry
        if (child.geometry && child.geometry.type === 'BoxGeometry') {
            try {
                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3();
                box.getSize(size);
                const area = size.x * size.y * size.z;
                
                // ⭐ ЛОГИРУЕМ ВСЕ BoxGeometry
                console.log(`  [${index}] BoxGeometry: ${size.x.toFixed(3)}x${size.y.toFixed(3)}x${size.z.toFixed(3)}, площадь ${area.toFixed(3)}`);
                
                // ⭐ ИЩЕМ ОСНОВНУЮ СТЕЛУ (ширина > 0.3, высота > 0.8, самая большая)
                if (size.x > 0.3 && size.y > 0.8 && area > maxArea) {
                    maxArea = area;
                    steleObj = child;
                    console.log(`  ✅ Найдена основная стела: ${size.x.toFixed(2)}x${size.y.toFixed(2)}`);
                }
            } catch(e) {
                console.warn(`  [${index}] Ошибка получения размеров:`, e);
            }
        }
    });
    
    if (steleObj) {
        console.log('✅ Найдена основная прямоугольная стела!');
        window._currentRectangleStele = steleObj;
        const box = new THREE.Box3().setFromObject(steleObj);
        const size = new THREE.Vector3();
        box.getSize(size);
        console.log(`  Размеры: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
        console.log(`  Позиция: (${steleObj.position.x.toFixed(3)}, ${steleObj.position.y.toFixed(3)}, ${steleObj.position.z.toFixed(3)})`);
    } else {
        console.warn('⚠️ Основная прямоугольная стела не найдена!');
        // Выводим все BoxGeometry для отладки
        console.log('📋 Все BoxGeometry в сцене:');
        monumentGroup.children.forEach((child, i) => {
            if (child.geometry && child.geometry.type === 'BoxGeometry') {
                try {
                    const box = new THREE.Box3().setFromObject(child);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    console.log(`  [${i}] ${size.x.toFixed(3)}x${size.y.toFixed(3)}x${size.z.toFixed(3)}`);
                } catch(e) {}
            }
        });
    }
    
    return steleObj;
}

/**
 * Получить центр стелы
 */
export function getSteleCenter(steleObj) {
    if (!steleObj) return { y: 0 };
    const box = new THREE.Box3().setFromObject(steleObj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { x: center.x, y: center.y, z: center.z };
}

/**
 * Создать текстуру для ФИО/дат с учётом смещения
 */

// modules/drag/drag-utils.js
// Замените функцию createFrontTextureWithOffset на эту:

export function createFrontTextureWithOffset(state, offsetX, offsetY, steleWidth, steleHeight) {
    // ⭐ ИСПОЛЬЗУЕМ ПРОПОРЦИИ СТЕЛЫ
    const isMobile = window.innerWidth < 768;
    const baseSize = isMobile ? 512 : 1024;
    
    // ⭐ ВЫСЧИТЫВАЕМ РАЗМЕРЫ ТЕКСТУРЫ С УЧЁТОМ ПРОПОРЦИЙ СТЕЛЫ
    const aspectRatio = steleHeight / steleWidth;
    let canvasWidth, canvasHeight;
    
    if (aspectRatio > 1) {
        // Вертикальная стела (высота > ширины)
        canvasHeight = baseSize;
        canvasWidth = Math.round(baseSize / aspectRatio);
    } else {
        // Горизонтальная стела
        canvasWidth = baseSize;
        canvasHeight = Math.round(baseSize * aspectRatio);
    }
    
    // ⭐ МИНИМАЛЬНЫЙ РАЗМЕР
    canvasWidth = Math.max(canvasWidth, 256);
    canvasHeight = Math.max(canvasHeight, 256);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    console.log(`🎨 createFrontTextureWithOffset: canvas=${canvasWidth}x${canvasHeight}, offset=(${offsetX.toFixed(3)}, ${offsetY.toFixed(3)})`);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 4 : 8;
    
    // Сбор строк
    let linesArray = [];
    if (state.fullName.trim()) {
        const rawLines = state.fullName.split(/\r?\n/);
        rawLines.forEach(line => {
            if (line.includes('/')) {
                line.split('/').forEach(sub => {
                    if (sub.trim()) linesArray.push(sub.trim());
                });
            } else {
                if (line.trim()) linesArray.push(line.trim());
            }
        });
    }
    if (state.dates.trim()) {
        linesArray.push(state.dates.trim());
    }
    
    if (linesArray.length === 0) {
        return new THREE.CanvasTexture(canvas);
    }
    
    // Определяем шрифт
    let fontFamily = state.fontFamily;
    const fontMap = {
        'Yermak': 'Yermak',
        'Bodega Script': 'Bodega Script',
        'Brusher': 'Brusher',
        'Drevnerusskij': 'Drevnerusskij',
        'Drina': 'Drina',
        'DS-BroadBrush': 'DS-BroadBrush',
        'Federico': 'Federico',
        'Feofan': 'Feofan',
        'Figurny': 'Figurny',
        'Pochaevsk': 'Pochaevsk',
        'Remeslo': 'Remeslo',
        'Tsarevich': 'Tsarevich'
    };
    for (const [key, value] of Object.entries(fontMap)) {
        if (fontFamily.includes(key)) {
            fontFamily = value;
            break;
        }
    }
    
    // ⭐ РАСЧЁТ РАЗМЕРА ШРИФТА
    const padding = 0.03 * Math.min(canvasWidth, canvasHeight);
    const availableHeight = canvasHeight - padding * 2;
    let fontSize = availableHeight / linesArray.length * 0.85;
    
    // Максимальный размер
    const maxFontSize = canvasHeight / (linesArray.length + 0.5);
    fontSize = Math.min(fontSize, maxFontSize);
    fontSize = Math.max(fontSize, canvasHeight / 12);
    
    // Проверка по ширине
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    let maxWidth = 0;
    linesArray.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) maxWidth = metrics.width;
    });
    
    const maxAllowedWidth = canvasWidth * 0.92;
    if (maxWidth > maxAllowedWidth) {
        fontSize = fontSize * (maxAllowedWidth / maxWidth);
    }
    
    // Смещение в пикселях
    const pixelsPerMeter = Math.min(canvasWidth, canvasHeight) / 1.5;
    const pixelOffsetX = offsetX * pixelsPerMeter;
    const pixelOffsetY = offsetY * pixelsPerMeter;
    
    console.log(`  Размер шрифта: ${fontSize.toFixed(1)}px, строк: ${linesArray.length}`);
    
    // Рисуем строки
    const totalTextHeight = linesArray.length * fontSize * 1.15;
    const startY = (canvasHeight - totalTextHeight) / 2 + fontSize * 0.6;
    
    linesArray.forEach((line, index) => {
        const y = startY + index * fontSize * 1.15 + pixelOffsetY;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.fillText(line, canvas.width/2 + pixelOffsetX, y);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    console.log(`✅ Текстура создана: ${canvas.width}x${canvas.height}`);
    return texture;
}

/**
 * Создать текстуру для эпитафии с учётом смещения
 */
export function createBackTextureWithOffset(state, offsetX, offsetY) {
    const canvas = document.createElement('canvas');
    const isMobile = window.innerWidth < 768;
    const canvasSize = isMobile ? 512 : 1024;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 3 : 6;
    
    const pixelsPerMeter = canvasSize / 1.2;
    const pixelOffsetX = offsetX * pixelsPerMeter;
    const pixelOffsetY = offsetY * pixelsPerMeter;
    
    let currentY = 80 + pixelOffsetY;
    
    if (state.epitaph.trim()) {
        const lines = state.epitaph.split(/\r?\n|\//);
        let fontFamily = state.fontFamily;
        if (fontFamily.includes('Yermak')) fontFamily = 'Yermak';
        else if (fontFamily.includes('Bodega Script')) fontFamily = 'Bodega Script';
        else if (fontFamily.includes('Brusher')) fontFamily = 'Brusher';
        else if (fontFamily.includes('Drevnerusskij')) fontFamily = 'Drevnerusskij';
        else if (fontFamily.includes('Drina')) fontFamily = 'Drina';
        else if (fontFamily.includes('DS-BroadBrush')) fontFamily = 'DS-BroadBrush';
        else if (fontFamily.includes('Federico')) fontFamily = 'Federico';
        else if (fontFamily.includes('Feofan')) fontFamily = 'Feofan';
        else if (fontFamily.includes('Figurny')) fontFamily = 'Figurny';
        else if (fontFamily.includes('Pochaevsk')) fontFamily = 'Pochaevsk';
        else if (fontFamily.includes('Remeslo')) fontFamily = 'Remeslo';
        else if (fontFamily.includes('Tsarevich')) fontFamily = 'Tsarevich';
        
        const fontSize = state.epitaphFontSize * (isMobile ? 0.8 : 1.2);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        
        lines.forEach(line => {
            if (line.trim()) {
                ctx.fillText(line.trim(), canvas.width/2 + pixelOffsetX, currentY);
                currentY += state.epitaphFontSize * (isMobile ? 0.9 : 1.5);
            }
        });
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Показать тост (с fallback, если window.showToast не определён)
 */
export function showToast(message, type) {
    // ⭐ Если есть глобальный showToast - используем его
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    // ⭐ Иначе создаём свой собственный тост
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#00a896' : '#333'};
        color: white;
        padding: 14px 28px;
        border-radius: 14px;
        z-index: 10000;
        font-size: 15px;
        font-weight: 500;
        transition: opacity 0.3s;
        opacity: 1;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: 90%;
        text-align: center;
        pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 2000);
}