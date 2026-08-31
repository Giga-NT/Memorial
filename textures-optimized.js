// textures-optimized.js
import * as THREE from 'three';

// Кэш текстур
const textureCache = new Map();

// Оптимизированная загрузка текстур с приоритетом
export async function loadTextureOptimized(url, priority = 'normal') {
    // Проверяем кэш
    if (textureCache.has(url)) {
        return textureCache.get(url);
    }
    
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        
        // Настройки качества в зависимости от приоритета
        const quality = getQualitySettings();
        
        loader.load(
            url,
            (texture) => {
                // Оптимизация текстуры
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                texture.anisotropy = quality.anisotropy;
                
                // Уменьшаем размер для мобильных
                if (quality.maxTextureSize < 2048) {
                    texture.image = resizeTexture(texture.image, quality.maxTextureSize);
                }
                
                textureCache.set(url, texture);
                resolve(texture);
            },
            undefined,
            reject
        );
    });
}

// Получение настроек качества
function getQualitySettings() {
    const isMobile = window.innerWidth < 768;
    const isSlowNetwork = navigator.connection?.effectiveType === 'slow-2g' || 
                         navigator.connection?.effectiveType === '2g';
    
    return {
        anisotropy: isMobile ? 1 : 4,
        maxTextureSize: isMobile ? 1024 : 2048,
        mipmaps: !isMobile,
        quality: isSlowNetwork ? 'low' : (isMobile ? 'medium' : 'high')
    };
}

// Ресайз текстуры
function resizeTexture(image, maxSize) {
    if (image.width <= maxSize && image.height <= maxSize) return image;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let width = image.width;
    let height = image.height;
    
    if (width > height) {
        height = Math.round(height * (maxSize / width));
        width = maxSize;
    } else {
        width = Math.round(width * (maxSize / height));
        height = maxSize;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    
    return canvas;
}

// Предзагрузка критических текстур
export async function preloadCriticalTextures() {
    const critical = [
        './textures/gabbro/color.webp',
        './textures/flowerbeds/grass.webp'
    ];
    
    const promises = critical.map(url => loadTextureOptimized(url, 'high'));
    await Promise.all(promises);
}

// Очистка кэша текстур
export function clearTextureCache() {
    textureCache.forEach((texture) => {
        if (texture.dispose) texture.dispose();
    });
    textureCache.clear();
}