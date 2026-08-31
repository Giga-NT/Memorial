// proceduralTextures.js
import * as THREE from 'three';

// Простая реализация шума Перлина для более естественных узоров
class PerlinNoise {
    constructor() {
        this.gradients = {};
        this.memory = {};
    }
    
    dotProduct(ix, iy, x, y) {
        let dx = x - ix;
        let dy = y - iy;
        let key = ix + ',' + iy;
        let grad = this.gradients[key];
        if (!grad) {
            let angle = Math.random() * Math.PI * 2;
            grad = [Math.cos(angle), Math.sin(angle)];
            this.gradients[key] = grad;
        }
        return dx * grad[0] + dy * grad[1];
    }
    
    smooth(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    noise(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);
        let fx = x - ix;
        let fy = y - iy;
        
        let v1 = this.dotProduct(ix, iy, x, y);
        let v2 = this.dotProduct(ix + 1, iy, x, y);
        let v3 = this.dotProduct(ix, iy + 1, x, y);
        let v4 = this.dotProduct(ix + 1, iy + 1, x, y);
        
        let u = this.smooth(fx);
        let v = this.smooth(fy);
        
        let i1 = this.lerp(v1, v2, u);
        let i2 = this.lerp(v3, v4, u);
        
        return (this.lerp(i1, i2, v) + 1) / 2;
    }
    
    fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return value / maxValue;
    }
}

const perlin = new PerlinNoise();

// Генерация гранитной текстуры (улучшенная)
function generateGraniteTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Параметры гранита
    const scale = 0.02;
    const grainScale = 0.15;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Базовый шум для текстуры
            let baseNoise = perlin.fbm(x * scale, y * scale, 5, 0.5, 2.0);
            
            // Мелкая зернистость
            let grainNoise = perlin.noise(x * grainScale, y * grainScale);
            
            // Крупные вкрапления кварца
            let quartzNoise = perlin.fbm(x * 0.008, y * 0.008, 3, 0.6, 2.5);
            
            // Тёмные минералы (биотит)
            let darkNoise = perlin.fbm(x * 0.012, y * 0.012, 3, 0.5, 2.2);
            
            // Расчёт цвета
            let r, g, b;
            
            // Базовый тёмно-серый
            let baseValue = 25 + baseNoise * 30;
            
            // Вкрапления кварца (светлые пятна)
            if (quartzNoise > 0.75) {
                const intensity = 180 + (quartzNoise - 0.75) * 200;
                r = intensity;
                g = intensity;
                b = intensity;
            }
            // Тёмные вкрапления (биотит)
            else if (darkNoise > 0.8) {
                r = 30;
                g = 25;
                b = 35;
            }
            // Металлические искры
            else if (grainNoise > 0.92) {
                const sparkle = 200 + Math.random() * 55;
                r = sparkle;
                g = sparkle * 0.9;
                b = sparkle * 0.8;
            }
            // Основной камень
            else {
                const variation = (grainNoise - 0.5) * 20;
                r = Math.min(255, Math.max(0, baseValue + variation));
                g = Math.min(255, Math.max(0, baseValue + variation * 0.9));
                b = Math.min(255, Math.max(0, baseValue + variation * 0.8));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    texture.needsUpdate = true;
    return texture;
}

// Генерация мраморной текстуры (улучшенная)
function generateMarbleTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    const scale = 0.008;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Синусоидальные прожилки для мрамора
            let vein1 = Math.sin(x * 0.015) * Math.cos(y * 0.012);
            let vein2 = Math.sin(x * 0.025 + y * 0.02) * 0.7;
            let vein3 = perlin.noise(x * 0.01, y * 0.01);
            
            let marblePattern = (vein1 + vein2) * 0.6 + vein3 * 0.4;
            
            // Сдвиг и нормализация
            marblePattern = (marblePattern + 1) / 2;
            
            // Базовый белый цвет
            let brightness = 235;
            
            // Прожилки (серые/золотистые)
            if (marblePattern < 0.3) {
                const darken = 40 + marblePattern * 100;
                const val = Math.max(180, brightness - darken);
                data[i] = val;
                data[i + 1] = val * 0.95;
                data[i + 2] = val * 0.9;
            }
            // Лёгкие голубоватые прожилки
            else if (marblePattern > 0.7 && marblePattern < 0.75) {
                data[i] = 210;
                data[i + 1] = 215;
                data[i + 2] = 230;
            }
            // Основной белый
            else {
                const variation = (Math.random() - 0.5) * 8;
                const val = Math.min(255, Math.max(240, brightness + variation));
                data[i] = val;
                data[i + 1] = val * 0.98;
                data[i + 2] = val * 0.95;
            }
            
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 3);
    return texture;
}

// Генерация красного гранита
function generateRedGraniteTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    const scale = 0.02;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            let noise = perlin.fbm(x * scale, y * scale, 4, 0.5, 2.0);
            let quartz = perlin.fbm(x * 0.008, y * 0.008, 3, 0.6, 2.2);
            let dark = perlin.fbm(x * 0.015, y * 0.015, 3, 0.5, 2.0);
            
            // Базовый красный
            let r = 120 + noise * 50;
            let g = 30 + noise * 20;
            let b = 30 + noise * 15;
            
            // Кварцевые вкрапления
            if (quartz > 0.78) {
                const brightness = 200 + (quartz - 0.78) * 200;
                r = brightness;
                g = brightness * 0.85;
                b = brightness * 0.7;
            }
            // Тёмные вкрапления
            else if (dark > 0.82) {
                r = 60;
                g = 20;
                b = 20;
            }
            // Лёгкая вариация
            else {
                const variation = (Math.random() - 0.5) * 15;
                r = Math.min(255, Math.max(60, r + variation));
                g = Math.min(180, Math.max(20, g + variation * 0.5));
                b = Math.min(160, Math.max(20, b + variation * 0.5));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    return texture;
}

// Генерация бежевого гранита
function generateBeigeGraniteTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    const scale = 0.02;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            let noise = perlin.fbm(x * scale, y * scale, 4, 0.5, 2.0);
            let darkSpots = perlin.fbm(x * 0.01, y * 0.01, 3, 0.6, 2.2);
            
            // Базовый бежевый
            let r = 180 + noise * 40;
            let g = 150 + noise * 35;
            let b = 110 + noise * 30;
            
            // Тёмные включения
            if (darkSpots > 0.8) {
                r *= 0.7;
                g *= 0.6;
                b *= 0.5;
            }
            
            // Светлые вкрапления
            if (noise > 0.75) {
                const bright = 40;
                r = Math.min(255, r + bright);
                g = Math.min(240, g + bright * 0.8);
                b = Math.min(210, b + bright * 0.6);
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    return texture;
}

// Генерация серого гранита
function generateGrayGraniteTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    const scale = 0.02;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            let noise = perlin.fbm(x * scale, y * scale, 4, 0.5, 2.0);
            let quartz = perlin.fbm(x * 0.008, y * 0.008, 3, 0.6, 2.2);
            let dark = perlin.fbm(x * 0.012, y * 0.012, 3, 0.5, 2.0);
            
            // Базовый серый
            let value = 100 + noise * 50;
            
            // Кварцевые вкрапления
            if (quartz > 0.78) {
                const bright = 150 + (quartz - 0.78) * 200;
                value = bright;
            }
            // Тёмные вкрапления
            else if (dark > 0.82) {
                value = 50;
            }
            // Лёгкая вариация
            else {
                const variation = (Math.random() - 0.5) * 15;
                value = Math.min(180, Math.max(60, value + variation));
            }
            
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    return texture;
}

// Генерация чёрного гранита "Галактика"
function generateGalaxyGraniteTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Базовый чёрный
            let value = 15 + Math.random() * 10;
            
            // Блестящие вкрапления (звёздный эффект)
            if (Math.random() < 0.008) {
                const brightness = 200 + Math.random() * 55;
                value = brightness;
            }
            
            data[i] = value;
            data[i + 1] = value * 0.95;
            data[i + 2] = value * 0.9;
            data[i + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    return texture;
}

// Экспорт функций
export const proceduralTextures = {
    granite: generateGraniteTexture,
    marble: generateMarbleTexture,
    red_granite: generateRedGraniteTexture,
    beige_granite: generateBeigeGraniteTexture,
    gray_granite: generateGrayGraniteTexture,
    black_galaxy: generateGalaxyGraniteTexture,
    ninimyaki: generateGraniteTexture
};

// Функция получения материала с процедурной текстурой
export function getProceduralMaterial(materialType) {
    const textureMap = {
        granite: generateGraniteTexture,
        marble: generateMarbleTexture,
        red_granite: generateRedGraniteTexture,
        beige_granite: generateBeigeGraniteTexture,
        gray_granite: generateGrayGraniteTexture,
        black_galaxy: generateGalaxyGraniteTexture,
        ninimyaki: generateGraniteTexture
    };
    
    const generator = textureMap[materialType] || generateGraniteTexture;
    const texture = generator(1024, 1024);
    
    // Настройка повторения текстуры
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 5);
    
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.25,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // Специальные настройки
    if (materialType === 'marble') {
        material.roughness = 0.15;
        material.metalness = 0.05;
    } else if (materialType === 'black_galaxy') {
        material.roughness = 0.2;
        material.metalness = 0.18;
    }
    
    return material;
}