// textures.js - МАКСИМАЛЬНО ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
import * as THREE from 'three';

// ============================================================
// 1. ПРОВЕРКА ПОДДЕРЖКИ WebP
// ============================================================

function supportsWebP() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('image/webp') === 0;
    } catch {
        return false;
    }
}

const USE_WEBP = supportsWebP();
console.log(`📸 WebP: ${USE_WEBP ? '✅ поддерживается' : '❌ не поддерживается'}`);

// ============================================================
// 2. КОНФИГ ПУТЕЙ (с WebP приоритетом)
// ============================================================

const getTexturePath = (basePath, useWebP = USE_WEBP) => {
    if (useWebP) {
        const webpPath = basePath.replace(/\.(jpg|png)$/, '.webp');
        // Проверяем существование WebP (опционально)
        return webpPath;
    }
    return basePath;
};

const texturePaths = {
    granite: { color: './textures/gabbro/color.webp' },
    marble: { color: './textures/marble/color.webp' },
    red_granite: { color: './textures/red_granite/color.webp' },
    beige_granite: { color: './textures/beige_granite/color.webp' },
    gray_granite: { color: './textures/gray_granite/gray-polished-granite_albedo.webp' },
    black_galaxy: { color: './textures/black_galaxy/color.webp' },
    ninimyaki: { color: './textures/ninimyaki/color.webp' }
};

// ============================================================
// 3. ОПРЕДЕЛЕНИЕ КАЧЕСТВА УСТРОЙСТВА
// ============================================================

function getDeviceQuality() {
    const isMobile = window.innerWidth < 768;
    const isSlowNetwork = navigator.connection?.effectiveType === 'slow-2g' || 
                         navigator.connection?.effectiveType === '2g';
    const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    
    if (isSlowNetwork || isLowMemory) return 'low';
    if (isMobile) return 'medium';
    return 'high';
}

const DEVICE_QUALITY = getDeviceQuality();
console.log(`📱 Качество устройства: ${DEVICE_QUALITY}`);

// ============================================================
// 4. КЭШ МАТЕРИАЛОВ (с оптимизацией)
// ============================================================

const materialCache = new Map();
const MAX_MATERIAL_CACHE = 10;

export async function loadPBRMaterial(materialType) {
    const config = texturePaths[materialType];
    if (!config) {
        console.warn(`Текстура для ${materialType} не найдена`);
        return new THREE.MeshStandardMaterial({ 
            color: 0x808080, 
            roughness: 0.3, 
            metalness: 0.1 
        });
    }
    
    const cacheKey = materialType;
    if (materialCache.has(cacheKey)) {
        console.log(`📦 Материал ${materialType} из кэша`);
        return materialCache.get(cacheKey).clone();
    }
    
    return new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        console.log(`📥 Загрузка текстуры: ${config.color}`);
        
        loader.load(config.color, 
            (colorMap) => {
                console.log(`✅ Текстура ${materialType} загружена`);
                
                // Оптимизация текстуры в зависимости от устройства
                const anisotropy = DEVICE_QUALITY === 'high' ? 4 : (DEVICE_QUALITY === 'medium' ? 2 : 1);
                
                colorMap.wrapS = THREE.RepeatWrapping;
                colorMap.wrapT = THREE.RepeatWrapping;
                colorMap.repeat.set(1, 1.5);
                colorMap.anisotropy = anisotropy;
                colorMap.minFilter = THREE.LinearMipmapLinearFilter;
                colorMap.magFilter = THREE.LinearFilter;
                colorMap.generateMipmaps = DEVICE_QUALITY !== 'low';
                
                let roughness = 0.25;
                let metalness = 0.1;
                if (materialType === 'marble') {
                    roughness = 0.15;
                    metalness = 0.05;
                } else if (materialType === 'black_galaxy') {
                    metalness = 0.2;
                }
                
                const material = new THREE.MeshStandardMaterial({
                    map: colorMap,
                    roughness: roughness,
                    metalness: metalness,
                    emissive: 0x111111,
                    side: THREE.DoubleSide
                });
                
                // Кэшируем с ограничением
                if (materialCache.size >= MAX_MATERIAL_CACHE) {
                    const firstKey = materialCache.keys().next().value;
                    const oldMat = materialCache.get(firstKey);
                    if (oldMat && oldMat.map) oldMat.map.dispose();
                    materialCache.delete(firstKey);
                }
                materialCache.set(cacheKey, material.clone());
                resolve(material);
            },
            undefined,
            (error) => {
                console.error(`❌ Ошибка загрузки ${materialType}:`, error);
                resolve(new THREE.MeshStandardMaterial({ 
                    color: 0x666666, 
                    roughness: 0.3, 
                    metalness: 0.1 
                }));
            }
        );
    });
}

// ============================================================
// 5. КЭШ ТЕКСТУР ЦВЕТНИКОВ
// ============================================================

const flowerbedTextures = {
    grass: './textures/flowerbeds/grass-1.webp',
    gravel: './textures/flowerbeds/gravel.webp',
    marble_chips: './textures/flowerbeds/marble_chips.webp',
    red_gravel: './textures/flowerbeds/red_gravel.webp',
    blue_gravel: './textures/flowerbeds/blue_gravel.webp',
    black_gravel: './textures/flowerbeds/black_gravel.webp',
    sand: './textures/flowerbeds/sand.webp',
    flowers: './textures/flowerbeds/flowers.webp',
    moss: './textures/flowerbeds/moss.webp'
};

const flowerbedTextureCache = new Map();

export async function loadFlowerbedTexture(type) {
    const texturePath = flowerbedTextures[type];
    if (!texturePath) {
        console.warn(`Текстура для ${type} не найдена`);
        return null;
    }
    
    if (flowerbedTextureCache.has(type)) {
        return flowerbedTextureCache.get(type);
    }
    
    return new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        console.log(`📥 Загрузка текстуры цветника: ${texturePath}`);
        
        loader.load(texturePath, 
            (texture) => {
                const repeat = DEVICE_QUALITY === 'low' ? 1 : 2;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(repeat, repeat);
                texture.anisotropy = DEVICE_QUALITY === 'high' ? 2 : 1;
                flowerbedTextureCache.set(type, texture);
                console.log(`✅ Текстура цветника ${type} загружена`);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error(`❌ Ошибка загрузки ${type}:`, error);
                resolve(null);
            }
        );
    });
}

export async function loadGrassTexture() {
    const texturePath = getTexturePath('./textures/flowerbeds/grass-1.webp');
    
    return new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        console.log(`📥 Загрузка текстуры травы: ${texturePath}`);
        
        loader.load(texturePath, 
            (texture) => {
                const repeat = DEVICE_QUALITY === 'low' ? 2 : 3;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(repeat, repeat);
                texture.anisotropy = DEVICE_QUALITY === 'high' ? 2 : 1;
                console.log(`✅ Текстура травы загружена`);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error(`❌ Ошибка загрузки травы:`, error);
                resolve(null);
            }
        );
    });
}

// ============================================================
// 6. КЭШ ТЕКСТУР ОСНОВАНИЯ (ОПТИМИЗИРОВАННЫЙ)
// ============================================================

const baseTextureCache = new Map();
const MAX_CACHE_SIZE = 3; // Уменьшено для экономии памяти

export async function createUnifiedTextureWithJoints(
    graveWidth,
    graveLength,
    height,
    materialType,
    flowerWidth,
    flowerLength
) {
    const cacheKey = `${materialType}_${graveWidth.toFixed(2)}_${graveLength.toFixed(2)}_${flowerWidth.toFixed(2)}_${flowerLength.toFixed(2)}`;
    
    if (baseTextureCache.has(cacheKey)) {
        console.log(`📦 Текстура основания из кэша`);
        return baseTextureCache.get(cacheKey);
    }
    
    console.log(`🔄 Создание текстуры основания`);
    
    // ⭐ РАЗМЕР В ЗАВИСИМОСТИ ОТ УСТРОЙСТВА
    let texSize = 2048;
    if (DEVICE_QUALITY === 'low') texSize = 1024;
    else if (DEVICE_QUALITY === 'medium') texSize = 1536;
    
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // БАЗОВАЯ ТЕКСТУРА
    let baseImage = null;
    try {
        const textureType = getTextureTypeFromMaterial(materialType);
        const pbrMaterial = await loadPBRMaterial(textureType);
        if (pbrMaterial && pbrMaterial.map && pbrMaterial.map.image) {
            baseImage = pbrMaterial.map.image;
        }
    } catch(e) {}
    
    if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, texSize, texSize);
        addLightNoise(ctx, texSize, texSize);
    } else {
        const materialColors = {
            'granite': '#1a1a1a',
            'black_galaxy': '#111111',
            'ninimyaki': '#1a2a1a',
            'marble': '#e8e8e8',
            'red_granite': '#8b0000',
            'beige_granite': '#d4b896',
            'gray_granite': '#808080',
        };
        ctx.fillStyle = materialColors[materialType] || '#1a1a1a';
        ctx.fillRect(0, 0, texSize, texSize);
        addStoneTextureToCanvas(ctx, texSize, texSize);
    }
    
    // ШВЫ (упрощённые для производительности)
    const TILE_WIDTH = 0.3;
    const TILE_HEIGHT = 0.6;
    
    let avgBrightness = 0.5;
    try {
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
            sum += brightness;
        }
        avgBrightness = sum / (data.length / 4) / 255;
    } catch(e) {}
    
    let jointColor, jointShadow;
    if (avgBrightness > 0.5) {
        jointColor = '#333333';
        jointShadow = '#666666';
    } else {
        jointColor = '#cccccc';
        jointShadow = '#999999';
    }
    
    const scaleX = texSize / graveWidth;
    const scaleY = texSize / graveLength;
    
    let flowerLeft = 0, flowerRight = 0, flowerTop = 0, flowerBottom = 0;
    let hasFlower = flowerWidth > 0 && flowerLength > 0;
    
    if (hasFlower) {
        const halfW = flowerWidth / 2;
        const halfL = flowerLength / 2;
        flowerLeft = (-halfW) * scaleX + texSize / 2;
        flowerRight = (halfW) * scaleX + texSize / 2;
        flowerTop = (-halfL) * scaleY + texSize / 2;
        flowerBottom = (halfL) * scaleY + texSize / 2;
    }
    
    // Вертикальные швы
    const cols = Math.ceil(graveWidth / TILE_WIDTH);
    for (let col = 1; col < cols; col++) {
        const x = (col * TILE_WIDTH - graveWidth / 2) * scaleX + texSize / 2;
        const inFlowerZone = hasFlower && x > flowerLeft && x < flowerRight;
        
        if (!inFlowerZone) {
            drawJointWithShadow(ctx, x, 0, x, texSize, jointColor, jointShadow, 1);
        } else {
            drawJointWithShadow(ctx, x, 0, x, flowerTop, jointColor, jointShadow, 1);
            drawJointWithShadow(ctx, x, flowerBottom, x, texSize, jointColor, jointShadow, 1);
        }
    }
    
    // Горизонтальные швы
    const rows = Math.ceil(graveLength / TILE_HEIGHT);
    for (let row = 1; row < rows; row++) {
        const y = (row * TILE_HEIGHT - graveLength / 2) * scaleY + texSize / 2;
        const inFlowerZone = hasFlower && y > flowerTop && y < flowerBottom;
        
        if (!inFlowerZone) {
            drawJointWithShadow(ctx, 0, y, texSize, y, jointColor, jointShadow, 1);
        } else {
            drawJointWithShadow(ctx, 0, y, flowerLeft, y, jointColor, jointShadow, 1);
            drawJointWithShadow(ctx, flowerRight, y, texSize, y, jointColor, jointShadow, 1);
        }
    }
    
    // Рамка
    ctx.strokeStyle = jointColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, texSize - 4, texSize - 4);
    
    // СОЗДАЁМ ТЕКСТУРУ
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = DEVICE_QUALITY !== 'low';
    texture.anisotropy = DEVICE_QUALITY === 'high' ? 2 : 1;
    
    // СОХРАНЯЕМ В КЭШ
    if (baseTextureCache.size >= MAX_CACHE_SIZE) {
        const firstKey = baseTextureCache.keys().next().value;
        const oldTexture = baseTextureCache.get(firstKey);
        if (oldTexture && oldTexture.dispose) oldTexture.dispose();
        baseTextureCache.delete(firstKey);
    }
    
    baseTextureCache.set(cacheKey, texture);
    console.log(`✅ Текстура основания сохранена в кэш`);
    
    return texture;
}

// ============================================================
// 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function drawJointWithShadow(ctx, x1, y1, x2, y2, color, shadowColor, width) {
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 + 1);
    ctx.lineTo(x2 + 1, y2 + 1);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function addLightNoise(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 3;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
}

function addStoneTextureToCanvas(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 8;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
}

// ============================================================
// 8. ОБЩИЙ КЭШ И ОЧИСТКА
// ============================================================

export function getTextureTypeFromMaterial(material) {
    const mapping = {
        'granite': 'granite',
        'black_galaxy': 'black_galaxy',
        'ninimyaki': 'ninimyaki',
        'marble': 'marble',
        'red_granite': 'red_granite',
        'beige_granite': 'beige_granite',
        'gray_granite': 'gray_granite'
    };
    return mapping[material] || 'granite';
}

export function clearTextureCache() {
    materialCache.forEach(m => {
        if (m && m.map && m.map.dispose) m.map.dispose();
        if (m && m.dispose) m.dispose();
    });
    materialCache.clear();
    
    flowerbedTextureCache.forEach(t => { if (t && t.dispose) t.dispose(); });
    flowerbedTextureCache.clear();
    
    baseTextureCache.forEach(t => { if (t && t.dispose) t.dispose(); });
    baseTextureCache.clear();
    
    console.log('🧹 Все кэши текстур очищены');
}

// ============================================================
// 9. ЭКСПОРТ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================

export const CONFIG = {
    USE_WEBP,
    DEVICE_QUALITY,
    supportsWebP,
    getDeviceQuality
};

console.log(`📊 Оптимизация текстур активирована (качество: ${DEVICE_QUALITY})`);

