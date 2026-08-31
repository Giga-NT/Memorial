import * as THREE from 'three';
import { loadPBRMaterial, getTextureTypeFromMaterial, loadFlowerbedTexture } from './textures.min.js';

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ТЕКСТУР
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
    const isMobile = window.innerWidth < 768;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const intensity = isMobile ? 4 : 6;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * intensity;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
}

function addStoneTextureToCanvas(ctx, width, height) {
    const isMobile = window.innerWidth < 768;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const intensity = isMobile ? 12 : 15;
    for (let i = 0; i < data.length; i += 4) {
        const noise1 = (Math.random() - 0.5) * intensity;
        const grainX = Math.floor(Math.random() * 10);
        const grainY = Math.floor(Math.random() * 10);
        const grainNoise = (grainX + grainY) / 20 - 0.5;
        const totalNoise = noise1 + grainNoise * 20;
        data[i] = Math.max(0, Math.min(255, data[i] + totalNoise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + totalNoise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + totalNoise));
    }
    ctx.putImageData(imageData, 0, 0);
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУРЫ ДЛЯ ОСНОВАНИЯ
// ============================================================

export async function createUnifiedTextureWithJoints(
    graveWidth,
    graveLength,
    height,
    materialType,
    flowerWidth,
    flowerLength
) {
    const isMobile = window.innerWidth < 768;
    const texWidth = isMobile ? 1024 : 4096;
    const texHeight = isMobile ? 1024 : 4096;
    const canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let baseImage = null;
    try {
        const textureType = getTextureTypeFromMaterial(materialType);
        const pbrMaterial = await loadPBRMaterial(textureType);
        if (pbrMaterial && pbrMaterial.map && pbrMaterial.map.image) {
            baseImage = pbrMaterial.map.image;
        }
    } catch(e) {
        // Если не удалось загрузить текстуру - используем цвет
    }
    
    if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, texWidth, texHeight);
        addLightNoise(ctx, texWidth, texHeight);
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
        ctx.fillRect(0, 0, texWidth, texHeight);
        addStoneTextureToCanvas(ctx, texWidth, texHeight);
    }
    
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
    
    const scaleX = texWidth / graveWidth;
    const scaleY = texHeight / graveLength;
    
    let flowerLeft = 0, flowerRight = 0, flowerTop = 0, flowerBottom = 0;
    let hasFlower = flowerWidth > 0 && flowerLength > 0;
    if (hasFlower) {
        const halfW = flowerWidth / 2;
        const halfL = flowerLength / 2;
        flowerLeft = (-halfW) * scaleX + texWidth / 2;
        flowerRight = (halfW) * scaleX + texWidth / 2;
        flowerTop = (-halfL) * scaleY + texHeight / 2;
        flowerBottom = (halfL) * scaleY + texHeight / 2;
    }
    
    const cols = Math.ceil(graveWidth / TILE_WIDTH);
    for (let col = 1; col < cols; col++) {
        const x = (col * TILE_WIDTH - graveWidth / 2) * scaleX + texWidth / 2;
        const inFlowerZone = hasFlower && x > flowerLeft && x < flowerRight;
        if (!inFlowerZone) {
            drawJointWithShadow(ctx, x, 0, x, texHeight, jointColor, jointShadow, isMobile ? 2 : 3);
        } else {
            drawJointWithShadow(ctx, x, 0, x, flowerTop, jointColor, jointShadow, isMobile ? 2 : 3);
            drawJointWithShadow(ctx, x, flowerBottom, x, texHeight, jointColor, jointShadow, isMobile ? 2 : 3);
        }
    }
    
    const rows = Math.ceil(graveLength / TILE_HEIGHT);
    for (let row = 1; row < rows; row++) {
        const y = (row * TILE_HEIGHT - graveLength / 2) * scaleY + texHeight / 2;
        const inFlowerZone = hasFlower && y > flowerTop && y < flowerBottom;
        if (!inFlowerZone) {
            drawJointWithShadow(ctx, 0, y, texWidth, y, jointColor, jointShadow, isMobile ? 2 : 3);
        } else {
            drawJointWithShadow(ctx, 0, y, flowerLeft, y, jointColor, jointShadow, isMobile ? 2 : 3);
            drawJointWithShadow(ctx, flowerRight, y, texWidth, y, jointColor, jointShadow, isMobile ? 2 : 3);
        }
    }
    
    ctx.strokeStyle = jointColor;
    ctx.lineWidth = isMobile ? 4 : 6;
    ctx.beginPath();
    ctx.moveTo(3, 3);
    if (hasFlower) {
        ctx.lineTo(flowerLeft, 3);
        ctx.moveTo(flowerRight, 3);
        ctx.lineTo(texWidth - 3, 3);
    } else {
        ctx.lineTo(texWidth - 3, 3);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(3, texHeight - 3);
    if (hasFlower) {
        ctx.lineTo(flowerLeft, texHeight - 3);
        ctx.moveTo(flowerRight, texHeight - 3);
        ctx.lineTo(texWidth - 3, texHeight - 3);
    } else {
        ctx.lineTo(texWidth - 3, texHeight - 3);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(3, 3);
    if (hasFlower) {
        ctx.lineTo(3, flowerTop);
        ctx.moveTo(3, flowerBottom);
        ctx.lineTo(3, texHeight - 3);
    } else {
        ctx.lineTo(3, texHeight - 3);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(texWidth - 3, 3);
    if (hasFlower) {
        ctx.lineTo(texWidth - 3, flowerTop);
        ctx.moveTo(texWidth - 3, flowerBottom);
        ctx.lineTo(texWidth - 3, texHeight - 3);
    } else {
        ctx.lineTo(texWidth - 3, texHeight - 3);
    }
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = !isMobile;
    texture.anisotropy = isMobile ? 1 : 4;
    return texture;
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУРЫ БРУСЧАТКИ
// ============================================================

export function createPavingTexture(tileSize, tileType, jointColor) {
    const isMobile = window.innerWidth < 768;
    const texWidth = isMobile ? 256 : 512;
    const texHeight = isMobile ? 256 : 512;
    const canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext('2d');
    
    const tileColors = {
        'tile_black': '#2a2a2a',
        'tile_gray': '#8a8a8a',
        'tile_beige': '#c4b89a',
        'tile_dark': '#3a3a3a',
        'tile_light': '#c8c8c8',
        'tile_marble': '#e8e8e0',
        'tile_red': '#8b2a2a',
        'tile_brown': '#6b4a3a',
        'tile_blue': '#3a5a7a',
        'tile_green': '#4a7a4a',
    };
    
    const baseColor = tileColors[tileType] || '#8a8a8a';
    const joint = jointColor || '#666666';
    const tilePx = isMobile ? 48 : 80;
    const jointPx = isMobile ? 3 : 4;
    const totalPx = tilePx + jointPx;
    const cols = Math.ceil(texWidth / totalPx) + 1;
    const rows = Math.ceil(texHeight / totalPx) + 1;
    
    ctx.fillStyle = joint;
    ctx.fillRect(0, 0, texWidth, texHeight);
    
    let row = 0;
    let col = 0;
    let resolveTexture = null;
    const promise = new Promise((resolve) => {
        resolveTexture = resolve;
        function drawNextTile() {
            if (row >= rows) {
                const texture = new THREE.CanvasTexture(canvas);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = isMobile ? 1 : 2;
                resolveTexture(texture);
                return;
            }
            const offset = (row % 2 === 0) ? 0 : tilePx / 2;
            const x = col * totalPx + offset;
            const y = row * totalPx;
            if (x <= texWidth && y <= texHeight) {
                const brightness = 0.85 + Math.random() * 0.3;
                const color = new THREE.Color(baseColor);
                const r = Math.round(Math.min(255, color.r * 255 * brightness));
                const g = Math.round(Math.min(255, color.g * 255 * brightness));
                const b = Math.round(Math.min(255, color.b * 255 * brightness));
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                const radius = isMobile ? 1 : 2;
                const px = x;
                const py = y;
                const w = tilePx;
                const h = tilePx;
                ctx.beginPath();
                ctx.moveTo(px + radius, py);
                ctx.lineTo(px + w - radius, py);
                ctx.quadraticCurveTo(px + w, py, px + w, py + radius);
                ctx.lineTo(px + w, py + h - radius);
                ctx.quadraticCurveTo(px + w, py + h, px + w - radius, py + h);
                ctx.lineTo(px + radius, py + h);
                ctx.quadraticCurveTo(px, py + h, px, py + h - radius);
                ctx.lineTo(px, py + radius);
                ctx.quadraticCurveTo(px, py, px + radius, py);
                ctx.closePath();
                ctx.fill();
                addStoneNoiseToTile(ctx, px, py, w, h);
                const grad = ctx.createLinearGradient(px, py, px, py + h);
                grad.addColorStop(0, 'rgba(0,0,0,0.08)');
                grad.addColorStop(0.5, 'rgba(0,0,0,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.08)');
                ctx.fillStyle = grad;
                ctx.fillRect(px, py, w, h);
            }
            col++;
            if (col >= cols) {
                col = 0;
                row++;
            }
            if ((row * cols + col) % 5 === 0) {
                requestAnimationFrame(drawNextTile);
            } else {
                drawNextTile();
            }
        }
        requestAnimationFrame(drawNextTile);
    });
    return promise;
}

function addStoneNoiseToTile(ctx, x, y, w, h) {
    if (w < 2 || h < 2) return;
    try {
        let imageData;
        try {
            imageData = ctx.getImageData(
                Math.round(x), 
                Math.round(y), 
                Math.round(w), 
                Math.round(h),
                { willReadFrequently: true }
            );
        } catch(e) {
            imageData = ctx.getImageData(
                Math.round(x), 
                Math.round(y), 
                Math.round(w), 
                Math.round(h)
            );
        }
        const data = imageData.data;
        const intensity = window.innerWidth < 768 ? 6 : 10;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
        }
        ctx.putImageData(imageData, Math.round(x), Math.round(y));
    } catch(e) {}
}

// ============================================================
// ⭐ СОЗДАНИЕ ДОРОЖКИ
// ============================================================

export async function createPathBetweenGraveAndFence(params) {
    const { 
        pathEnabled, pathWidth, pathMaterial, pathTileSize, pathJointColor, pathTileLayout,
        fenceWidth, fenceLength 
    } = params;
    
    if (!pathEnabled) return null;
    
    const totalWidth = fenceWidth || 1.5;
    const totalLength = fenceLength || 2.5;
    const extra = 0.01;
    const outerHalfW = totalWidth / 2 + extra;
    const outerHalfL = totalLength / 2 + extra;
    
    const shape = new THREE.Shape();
    shape.moveTo(-outerHalfW, -outerHalfL);
    shape.lineTo(outerHalfW, -outerHalfL);
    shape.lineTo(outerHalfW, outerHalfL);
    shape.lineTo(-outerHalfW, outerHalfL);
    shape.closePath();
    
    const geometry = new THREE.ShapeGeometry(shape);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    
    if (pos && uv) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        if (rangeX > 0 && rangeY > 0) {
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                uv.setXY(i, (x - minX) / rangeX, (y - minY) / rangeY);
            }
            uv.needsUpdate = true;
        }
    }
    
    let material;
    const isTile = pathMaterial && pathMaterial.startsWith('tile_');
    
    if (isTile) {
        const texturePromise = createPavingTexture(
            pathTileSize || 0.3,
            pathMaterial,
            pathJointColor || '#666666'
        );
        const tileSize = pathTileSize || 0.3;
        const repeatX = totalWidth / tileSize;
        const repeatY = totalLength / tileSize;
        const texture = await texturePromise;
        if (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatX, repeatY);
        }
        material = new THREE.MeshStandardMaterial({
            map: texture || null,
            roughness: 0.6,
            metalness: 0.05,
            side: THREE.DoubleSide,
        });
    } else {
        const fallbackColors = {
            'gravel': 0x888888,
            'grass': 0x4caf50,
            'sand': 0xf4e4a0,
            'marble_chips': 0xf5f5f5,
            'flowers': 0x7cb342,
        };
        let texture = null;
        if (['grass', 'gravel', 'marble_chips', 'sand', 'flowers'].includes(pathMaterial)) {
            texture = await loadFlowerbedTexture(pathMaterial);
        }
        material = new THREE.MeshStandardMaterial({
            map: texture || null,
            color: texture ? null : (fallbackColors[pathMaterial] || 0x888888),
            roughness: 0.7,
            metalness: 0.05,
            side: THREE.DoubleSide,
        });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.09;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.isPath = true;
    
    return mesh;
}