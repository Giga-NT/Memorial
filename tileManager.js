// tileManager.js - ПЛИТКА 300×600 ПО ПЕРИМЕТРУ
import * as THREE from 'three';

const TILE_WIDTH = 0.3;   // 300 мм
const TILE_LENGTH = 0.6;  // 600 мм

export class TileManager {
    constructor(scene, monumentGroup) {
        this.scene = scene;
        this.monumentGroup = monumentGroup;
        this.tileGroup = new THREE.Group();
        this.monumentGroup.add(this.tileGroup);
        
        this.offsetX = 0;
        this.offsetY = 0;
        this.offsetZ = 0;
        
        this.currentTexture = null;
        this.currentMesh = null;
    }

    setPosition(x, y, z) {
        this.offsetX = x || 0;
        this.offsetY = y || 0;
        this.offsetZ = z || 0;
        this.tileGroup.position.set(this.offsetX, this.offsetY, this.offsetZ);
    }

    updateTileLayout(flowerWidth, flowerLength, options = {}) {
        this.clearTiles();
        
        const settings = {
            tileColor: options.color || '#9e9e9e',
            gapColor: options.gapColor || '#333333',
            centerColor: options.centerColor || '#4caf50',
            centerType: options.centerType || 'grass',
            pattern: options.pattern || 'straight',
        };
        
        // Рассчитываем количество плиток (кратно 0.3м)
        const innerCols = Math.max(2, Math.round(flowerWidth / TILE_WIDTH));
        const innerRows = Math.max(2, Math.round(flowerLength / TILE_WIDTH));
        
        // Всего с бордюром
        const cols = innerCols + 2;
        const rows = innerRows + 2;
        
        // Реальные размеры
        const totalWidth = cols * TILE_WIDTH;
        const totalLength = rows * TILE_WIDTH;
        
        const texture = this.createTileTexture(cols, rows, innerCols, innerRows, settings);
        
        const geo = new THREE.PlaneGeometry(totalWidth, totalLength);
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.4,
            metalness: 0.05,
            side: THREE.DoubleSide,
        });
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, 0.026, 0);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        
        this.currentMesh = mesh;
        this.tileGroup.add(mesh);
        this.tileGroup.position.set(this.offsetX, 0, this.offsetZ);
        
        const perimeterTiles = 2 * cols + 2 * rows - 4;
        
        return {
            cols, rows,
            totalTiles: cols * rows,
            perimeterTiles,
            innerTiles: innerCols * innerRows,
            adjustedWidth: totalWidth,
            adjustedLength: totalLength,
            flowerWidth: innerCols * TILE_WIDTH,
            flowerLength: innerRows * TILE_WIDTH,
        };
    }

    createTileTexture(cols, rows, innerCols, innerRows, settings) {
        const texWidth = 2048;
        const texHeight = 2048;
        
        const canvas = document.createElement('canvas');
        canvas.width = texWidth;
        canvas.height = texHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const totalWidth = cols * TILE_WIDTH;
        const totalLength = rows * TILE_WIDTH;
        
        const scaleX = texWidth / totalWidth;
        const scaleY = texHeight / totalLength;
        
        // 1. ФОН (ЦВЕТ ШВОВ)
        ctx.fillStyle = settings.gapColor;
        ctx.fillRect(0, 0, texWidth, texHeight);
        
        // 2. РИСУЕМ ПЛИТКИ 300×600 ПО ПЕРИМЕТРУ
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const isPerimeter = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
                if (!isPerimeter) continue;
                
                // Определяем ориентацию плитки
                let tileW = TILE_WIDTH;   // 300мм
                let tileL = TILE_LENGTH;  // 600мм
                
                // Для верхнего и нижнего ряда — плитка лежит горизонтально (600мм вдоль ширины)
                if (row === 0 || row === rows - 1) {
                    // Проверяем, влезает ли плитка 600мм
                    const remainingWidth = totalWidth - (col * TILE_WIDTH);
                    if (remainingWidth < TILE_LENGTH) {
                        // Не влезает 600мм, используем 300мм
                        tileL = TILE_WIDTH;
                    }
                }
                
                // Позиция плитки
                const x = col * TILE_WIDTH + TILE_WIDTH / 2 - totalWidth / 2;
                const y = row * TILE_WIDTH + TILE_WIDTH / 2 - totalLength / 2;
                
                // Преобразуем в пиксели
                const px = x * scaleX + texWidth / 2;
                const py = y * scaleY + texHeight / 2;
                const pw = TILE_WIDTH * scaleX - 3;  // ширина плитки
                const ph = TILE_WIDTH * scaleY - 3;  // высота плитки (ячейка сетки)
                
                // Рисуем плитку
                ctx.fillStyle = settings.tileColor;
                ctx.fillRect(px - pw/2, py - ph/2, pw, ph);
                
                // Добавляем текстуру камня
                this.addStoneTexture(ctx, px - pw/2, py - ph/2, pw, ph);
            }
        }
        
        // 3. ШВЫ (СЕТКА 300×300)
        ctx.strokeStyle = settings.gapColor;
        ctx.lineWidth = 2;
        
        // Вертикальные линии
        for (let col = 1; col < cols; col++) {
            const x = col * TILE_WIDTH;
            const px = x * scaleX;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, texHeight);
            ctx.stroke();
        }
        
        // Горизонтальные линии
        for (let row = 1; row < rows; row++) {
            const y = row * TILE_WIDTH;
            const py = y * scaleY;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(texWidth, py);
            ctx.stroke();
        }
        
        // 4. ЦВЕТНИК ВНУТРИ
        if (innerCols > 0 && innerRows > 0) {
            const innerWidth = innerCols * TILE_WIDTH;
            const innerLength = innerRows * TILE_WIDTH;
            
            const px = texWidth / 2;
            const py = texHeight / 2;
            const pw = innerWidth * scaleX;
            const ph = innerLength * scaleY;
            
            ctx.fillStyle = settings.centerColor;
            ctx.fillRect(px - pw/2, py - ph/2, pw, ph);
            
            this.addCenterTexture(ctx, px - pw/2, py - ph/2, pw, ph, settings.centerType);
            
            // Рамка вокруг цветника
            ctx.strokeStyle = settings.gapColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(px - pw/2, py - ph/2, pw, ph);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = 4;
        
        this.currentTexture = texture;
        return texture;
    }

    addStoneTexture(ctx, x, y, w, h) {
        if (w < 2 || h < 2) return;
        try {
            const imageData = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 20;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
                data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
            }
            ctx.putImageData(imageData, Math.round(x), Math.round(y));
        } catch(e) {}
    }

    addCenterTexture(ctx, x, y, w, h, type) {
        if (w < 2 || h < 2) return;
        try {
            const imageData = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                if (type === 'grass') {
                    data[i] = 60 + Math.random() * 60;
                    data[i+1] = 120 + Math.random() * 80;
                    data[i+2] = 30 + Math.random() * 40;
                } else if (type === 'gravel' || type === 'marble_chips') {
                    const gray = 150 + Math.random() * 80;
                    data[i] = gray;
                    data[i+1] = gray;
                    data[i+2] = gray;
                } else if (type === 'sand') {
                    data[i] = 200 + Math.random() * 55;
                    data[i+1] = 180 + Math.random() * 50;
                    data[i+2] = 100 + Math.random() * 50;
                } else if (type === 'flowers') {
                    if (Math.random() > 0.8) {
                        data[i] = 255; data[i+1] = 100; data[i+2] = 100;
                    } else {
                        data[i] = 60 + Math.random() * 60;
                        data[i+1] = 120 + Math.random() * 80;
                        data[i+2] = 30 + Math.random() * 40;
                    }
                }
            }
            ctx.putImageData(imageData, Math.round(x), Math.round(y));
        } catch(e) {}
    }

    clearTiles() {
        while(this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
        this.currentTexture = null;
        this.currentMesh = null;
    }
}

