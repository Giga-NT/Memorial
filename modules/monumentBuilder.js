// modules/monumentBuilder.js

import * as THREE from 'three';
import { Rectangle } from '../steleTypes.js';
import { createCustomSteleMesh } from '../customSteleLoader.js';
import { loadPBRMaterial, getTextureTypeFromMaterial, loadFlowerbedTexture } from './textures.min.js';
// ⭐ ПРАВИЛЬНЫЙ ИМПОРТ ИЗ sceneBuilders.js
import { 
    createUnifiedTextureWithJoints, 
    createPathBetweenGraveAndFence 
} from './sceneBuilders.js';
import { createFenceGroup } from './fenceBuilder.js';
// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

const stoneMaterials = {
    granite: { color: 0x1a1a1a, roughness: 0.2, metalness: 0.05 },
    black_galaxy: { color: 0x111111, roughness: 0.15, metalness: 0.08 },
    ninimyaki: { color: 0x1a2a1a, roughness: 0.25, metalness: 0.03 },
    marble: { color: 0xf5f5f5, roughness: 0.15, metalness: 0.02 },
    red_granite: { color: 0x8b0000, roughness: 0.25, metalness: 0.05 },
    beige_granite: { color: 0xd4b896, roughness: 0.2, metalness: 0.03 },
    gray_granite: { color: 0x808080, roughness: 0.2, metalness: 0.04 }
};

const fenceMaterials = {
    black_metal: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.9 })
};

const decalGeometryCache = new Map();
const GLOBAL_SECTION_WIDTH = 0.25;

function getDecalGeometry(width, height) {
    const key = `${width.toFixed(3)}x${height.toFixed(3)}`;
    if (!decalGeometryCache.has(key)) {
        decalGeometryCache.set(key, new THREE.PlaneGeometry(width, height));
    }
    return decalGeometryCache.get(key);
}

function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        if (mat.bumpMap) mat.bumpMap.dispose();
                        if (mat.normalMap) mat.normalMap.dispose();
                        if (mat.roughnessMap) mat.roughnessMap.dispose();
                        if (mat.metalnessMap) mat.metalnessMap.dispose();
                        mat.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    if (child.material.bumpMap) child.material.bumpMap.dispose();
                    if (child.material.normalMap) child.material.normalMap.dispose();
                    if (child.material.roughnessMap) child.material.roughnessMap.dispose();
                    if (child.material.metalnessMap) child.material.metalnessMap.dispose();
                    child.material.dispose();
                }
            }
        }
    });
    while(obj.children.length > 0) {
        const child = obj.children[0];
        obj.remove(child);
    }
}

function sanitizeText(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;',
        '\\': '&#x5C;',
        '(': '&#40;',
        ')': '&#41;',
        '[': '&#91;',
        ']': '&#93;',
        '{': '&#123;',
        '}': '&#125;',
        ';': '&#59;',
        '+': '&#43;',
        '-': '&#45;',
        '*': '&#42;'
    };
    let result = String(str);
    result = result.replace(/[&<>"'`=/\\()\[\]{};+\-*]/g, function(s) {
        return map[s] || s;
    });
    return result.slice(0, 5000);
}

function mmToMeters(mm) { return mm / 1000; }

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУР ДЛЯ ДЕКАЛЕЙ
// ============================================================

function createFrontTexture(params) {
    const isMobile = window.innerWidth < 768;
    const canvasSize = isMobile ? 512 : 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = params.textColor || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 4 : 8;
    
    const offsetX = (params.textOffsetX || 0) * canvas.width * 0.4;
    const offsetY = (params.textOffsetY || 0) * canvas.height * 0.4;
    
    let currentY = 80 + offsetY;
    const fontFamily = params.fontFamily || 'Arial, sans-serif';
    
    if (params.fullName && params.fullName.trim()) {
        const safeFullName = sanitizeText(params.fullName);
        const fontSize = (params.nameFontSize || 48) * (isMobile ? 0.8 : 1.5);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        
        const rawLines = safeFullName.split(/\r?\n/);
        const allLines = [];
        rawLines.forEach(line => {
            if (line.includes('/')) {
                const subLines = line.split('/');
                subLines.forEach(sub => {
                    if (sub.trim()) allLines.push(sub.trim());
                });
            } else {
                if (line.trim()) allLines.push(line.trim());
            }
        });
        
        allLines.forEach(line => {
            ctx.fillText(line, canvas.width/2 + offsetX, currentY);
            currentY += (params.nameFontSize || 48) * (isMobile ? 0.9 : 1.8);
        });
        currentY += isMobile ? 12 : 25;
    }
    
    if (params.dates && params.dates.trim()) {
        const safeDates = sanitizeText(params.dates);
        const fontSize = (params.datesFontSize || 32) * (isMobile ? 0.8 : 1.3);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.fillText(safeDates, canvas.width/2 + offsetX, currentY);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function createBackTexture(params) {
    const isMobile = window.innerWidth < 768;
    const canvasSize = isMobile ? 512 : 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = params.textColor || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 3 : 6;
    
    const offsetX = (params.epitaphOffsetX || 0) * canvas.width * 0.4;
    const offsetY = (params.epitaphOffsetY || 0) * canvas.height * 0.4;
    
    let currentY = 80 + offsetY;
    const fontFamily = params.fontFamily || 'Arial, sans-serif';
    
    if (params.epitaph && params.epitaph.trim()) {
        const safeEpitaph = sanitizeText(params.epitaph);
        const lines = safeEpitaph.split(/\r?\n|\//);
        const fontSize = (params.epitaphFontSize || 40) * (isMobile ? 0.8 : 1.2);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        
        lines.forEach(line => {
            if (line.trim()) {
                ctx.fillText(line.trim(), canvas.width/2 + offsetX, currentY);
                currentY += (params.epitaphFontSize || 40) * (isMobile ? 0.9 : 1.5);
            }
        });
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// ============================================================
// ⭐ СОЗДАНИЕ ОСНОВАНИЯ
// ============================================================

export async function createBase(params) {
    const { graveWidth, graveLength, baseHeight, material, flowerWidth, flowerLength } = params;
    
    const baseGeo = new THREE.BoxGeometry(graveWidth, baseHeight, graveLength);
    const baseTexture = await createUnifiedTextureWithJoints(
        graveWidth, graveLength, baseHeight, material, flowerWidth, flowerLength
    );
    const baseMat = new THREE.MeshStandardMaterial({
        map: baseTexture,
        roughness: 0.6,
        metalness: 0.05,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    
    return baseMesh;
}

// ============================================================
// ⭐ СОЗДАНИЕ ЦВЕТНИКА
// ============================================================

export async function createFlowerbed(params) {
    const { flowerWidth, flowerLength, flowerbedType, baseHeight } = params;
    
    if (!params.flowerEnabled) return null;
    if (!flowerWidth || !flowerLength || flowerWidth < 0.05 || flowerLength < 0.05) return null;
    
    const isTileSelected = flowerbedType && flowerbedType.startsWith('tile_');
    if (isTileSelected) return null;
    
    const flowerBedGeo = new THREE.PlaneGeometry(flowerWidth, flowerLength);
    const flowerbedTexture = await loadFlowerbedTexture(flowerbedType || 'grass');
    
    let flowerMat;
    if (flowerbedTexture) {
        flowerMat = new THREE.MeshStandardMaterial({
            map: flowerbedTexture,
            roughness: 0.7,
            metalness: 0.05
        });
    } else {
        const fallbackColors = {
            grass: 0x4caf50, gravel: 0x888888, marble_chips: 0xf5f5f5,
            red_gravel: 0xcd5c5c, blue_gravel: 0x4682b4, black_gravel: 0x333333,
            sand: 0xf4e4a0, flowers: 0x7cb342, moss: 0x5d8c3e
        };
        flowerMat = new THREE.MeshStandardMaterial({ 
            color: fallbackColors[flowerbedType] || 0x4caf50, 
            roughness: 0.8 
        });
    }
    
    const flowerBed = new THREE.Mesh(flowerBedGeo, flowerMat);
    flowerBed.rotation.x = -Math.PI / 2;
    flowerBed.position.set(0, baseHeight + 0.005, 0);
    flowerBed.receiveShadow = true;
    
    return flowerBed;
}

// ============================================================
// ⭐ СОЗДАНИЕ ДЕКАЛЕЙ
// ============================================================
// modules/monumentBuilder.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ФУНКЦИЯ createDecals

export function createDecals(params, steleObj) {
    if (!steleObj) {
        console.warn('⚠️ createDecals: steleObj не передан');
        return null;
    }
    
    const decalsGroup = new THREE.Group();
    decalsGroup.name = 'decalsContainer';
    
    try {
        // Вычисляем bounding box стелы
        const boundingBox = new THREE.Box3().setFromObject(steleObj);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        
        const frontZ = boundingBox.max.z + 0.015;
        const backZ = boundingBox.min.z - 0.015;
        
        const width = params.width || 0.6;
        const height = params.height || 1.2;
        const depth = params.depth || 0.08;
        
        console.log(`📐 createDecals: ширина=${width}, высота=${height}, глубина=${depth}, center.y=${center.y.toFixed(3)}`);
        


        // ============================================================
        // 2. ФОТО
        // ============================================================
        if (params.textureUrl) {
            console.log('📸 Загружаем фото для основного');
            const loader = new THREE.TextureLoader();
            loader.load(params.textureUrl, (tex) => {
                console.log('📸 Текстура фото загружена');
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                
                let w, h;
                const shape = params.photoShape || 'oval';
                if (shape === 'custom') {
                    w = mmToMeters(params.photoWidthMm || 100);
                    h = mmToMeters(params.photoHeightMm || 140);
                } else {
                    const presetSizes = {
                        'oval': { w: 0.22, h: 0.28 },
                        'circle': { w: 0.24, h: 0.24 },
                        'square': { w: 0.22, h: 0.22 }
                    };
                    const size = presetSizes[shape] || presetSizes.oval;
                    w = size.w;
                    h = size.h;
                }
                
                const scale = params.photoScale || 1.0;
                const finalW = w * scale;
                const finalH = h * scale;
                
                let geometry;
                if (shape === 'circle') {
                    geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, 32);
                } else if (shape === 'oval') {
                    geometry = new THREE.CircleGeometry(0.5, 32);
                    geometry.scale(finalW, finalH, 1);
                } else {
                    geometry = new THREE.PlaneGeometry(finalW, finalH);
                }
                
                const photoMat = new THREE.MeshBasicMaterial({
                    map: tex,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    alphaTest: 0.05
                });
                const photoMesh = new THREE.Mesh(geometry, photoMat);
                
                const photoX = params.photoOffsetX || 0;
                const photoY = center.y + (params.photoOffsetY || 0);
                photoMesh.position.set(photoX, photoY, frontZ - 0.013);
                photoMesh.renderOrder = 11;
                
                // ⭐ ФЛАГИ ДЛЯ ПЕРЕТАСКИВАНИЯ
                photoMesh.userData.isDraggable = true;
                photoMesh.userData.type = 'photo';
                photoMesh.userData.limitX = width / 2 - finalW / 2;
                photoMesh.userData.limitY = height / 2 - finalH / 2;
                photoMesh.userData.steleCenterY = center.y;
                photoMesh.userData.photoIndex = 0;
                photoMesh.userData.isMainPhoto = true;
                photoMesh.userData._foundType = 'main';
                
                decalsGroup.add(photoMesh);
                console.log(`📸 Фото добавлено: позиция (${photoX.toFixed(3)}, ${photoY.toFixed(3)}), размер ${finalW.toFixed(3)}x${finalH.toFixed(3)}`);
            });
        }
        
        // ============================================================
        // 3. ГРАВИРОВКИ (перед) - С ПОДДЕРЖКОЙ МАСШТАБА
        // ============================================================
        // ⭐ Проверяем оба возможных поля для гравировок
        const frontEngravings = params.engravingsFront || params.engravings || [];
        const backEngravings = params.engravingsBack || params.backEngravings || [];
        
        console.log(`📊 ГРАВИРОВКИ ДЛЯ createDecals:`, {
            front: frontEngravings.length,
            back: backEngravings.length,
            frontData: frontEngravings.map(e => ({ 
                type: e.type, 
                scale: e.scale, 
                size: e.size,
                hasSize: e.size !== undefined
            })),
            backData: backEngravings.map(e => ({ 
                type: e.type, 
                scale: e.scale, 
                size: e.size,
                hasSize: e.size !== undefined
            }))
        });
        
        // Гравировки спереди
        if (frontEngravings.length > 0) {
            console.log(`🖼️ Создаем ${frontEngravings.length} гравировок спереди`);
            
            frontEngravings.forEach((eng, index) => {
                // Проверяем URL
                if (!eng.url) {
                    console.warn(`⚠️ Гравировка ${eng.type || index} без URL, пропускаем`);
                    return;
                }
                
                const loader = new THREE.TextureLoader();
                
                // Обработчик загрузки текстуры
                const onTextureLoaded = (tex) => {
                    try {
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        
                        // ⭐⭐⭐ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: используем size, если есть, иначе scale ⭐⭐⭐
                        const baseSize = 0.22;
                        // Сначала проверяем eng.size (из UI), потом eng.scale (из JSON), потом 1.0
                        const scaleFactor = (eng.size !== undefined) ? eng.size : (eng.scale || 1.0);
                        const sizeM = baseSize * scaleFactor;
                        
                        console.log(`  ✅ Гравировка "${eng.type}" (перед #${index}): масштаб=${scaleFactor.toFixed(2)}, размер=${sizeM.toFixed(4)}m`);
                        
                        const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                        const material = new THREE.MeshBasicMaterial({
                            map: tex,
                            transparent: true,
                            side: THREE.DoubleSide,
                            depthWrite: false,
                            alphaTest: 0.05
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        
                        // Позиция с учетом смещений
                        const offsetX = eng.x || 0;
                        const offsetY = eng.y || 0;
                        mesh.position.set(
                            offsetX,
                            center.y + offsetY,
                            frontZ - 0.014
                        );
                        mesh.renderOrder = 10;
                        
                        // ⭐ userData для идентификации и отладки
                        mesh.userData.isEngraving = true;
                        mesh.userData.type = eng.type || 'unknown';
                        mesh.userData.scale = scaleFactor;
                        mesh.userData.size = sizeM;
                        mesh.userData.index = index;
                        mesh.userData.side = 'front';
                        mesh.userData.id = eng.id || `eng_front_${index}`;
                        mesh.userData.originalEng = { ...eng };
                        
                        decalsGroup.add(mesh);
                    } catch (err) {
                        console.error(`❌ Ошибка создания гравировки ${eng.type}:`, err);
                    }
                };
                
                // Обработчик ошибки загрузки
                const onError = (err) => {
                    console.warn(`⚠️ Не удалось загрузить гравировку ${eng.type}:`, err);
                    // Создаем заглушку - квадрат с цветом
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 128;
                        canvas.height = 128;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, 128, 128);
                        ctx.fillStyle = '#888888';
                        ctx.font = 'bold 60px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('?', 64, 68);
                        const fallbackTex = new THREE.CanvasTexture(canvas);
                        onTextureLoaded(fallbackTex);
                    } catch (e) {
                        console.error('❌ Не удалось создать заглушку:', e);
                    }
                };
                
                // Загружаем текстуру
                if (eng.url && eng.url.startsWith('data:')) {
                    // Data URL - загружаем напрямую
                    loader.load(eng.url, onTextureLoaded, undefined, onError);
                } else {
                    // Обычный URL
                    loader.load(eng.url, onTextureLoaded, undefined, onError);
                }
            });
        }
        
        // ============================================================
        // 4. ТЕКСТ СЗАДИ (Эпитафия)
        // ============================================================
        if (params.epitaph && params.epitaph.trim()) {
            const texture = createBackTexture(params);
            if (texture) {
                const textWidth = width * 0.85;
                const textHeight = height * 0.85;
                const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
                const textMat = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    alphaTest: 0.05
                });
                const textMesh = new THREE.Mesh(textGeo, textMat);
                
                const epitaphOffsetX = (params.epitaphOffsetX || 0) * width * 0.5;
                const epitaphOffsetY = (params.epitaphOffsetY || 0) * height * 0.5;
                
                textMesh.position.set(
                    epitaphOffsetX,
                    center.y + epitaphOffsetY,
                    backZ + 0.014
                );
                textMesh.rotation.y = Math.PI;
                textMesh.renderOrder = 9;
                textMesh.userData.type = 'backText';
                decalsGroup.add(textMesh);
                console.log('✅ Текст сзади создан');
            }
        }
        
        // ============================================================
        // 5. ГРАВИРОВКИ (зад) - С ПОДДЕРЖКОЙ МАСШТАБА
        // ============================================================
        if (backEngravings.length > 0) {
            console.log(`🖼️ Создаем ${backEngravings.length} гравировок сзади`);
            
            backEngravings.forEach((eng, index) => {
                if (!eng.url) {
                    console.warn(`⚠️ Гравировка (зад) ${eng.type || index} без URL, пропускаем`);
                    return;
                }
                
                const loader = new THREE.TextureLoader();
                
                const onTextureLoaded = (tex) => {
                    try {
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        
                        // ⭐⭐⭐ ИСПРАВЛЕНИЕ: используем size, если есть ⭐⭐⭐
                        const baseSize = 0.22;
                        const scaleFactor = (eng.size !== undefined) ? eng.size : (eng.scale || 1.0);
                        const sizeM = baseSize * scaleFactor;
                        
                        console.log(`  ✅ Гравировка "${eng.type}" (зад #${index}): масштаб=${scaleFactor.toFixed(2)}, размер=${sizeM.toFixed(4)}m`);
                        
                        const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                        const material = new THREE.MeshBasicMaterial({
                            map: tex,
                            transparent: true,
                            side: THREE.DoubleSide,
                            depthWrite: false,
                            alphaTest: 0.05
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        
                        const offsetX = eng.x || 0;
                        const offsetY = eng.y || 0;
                        mesh.position.set(
                            offsetX,
                            center.y + offsetY,
                            backZ + 0.014
                        );
                        mesh.rotation.y = Math.PI;
                        mesh.renderOrder = 10;
                        
                        mesh.userData.isEngraving = true;
                        mesh.userData.type = eng.type || 'unknown';
                        mesh.userData.scale = scaleFactor;
                        mesh.userData.size = sizeM;
                        mesh.userData.index = index;
                        mesh.userData.side = 'back';
                        mesh.userData.id = eng.id || `eng_back_${index}`;
                        mesh.userData.originalEng = { ...eng };
                        
                        decalsGroup.add(mesh);
                    } catch (err) {
                        console.error(`❌ Ошибка создания гравировки (зад) ${eng.type}:`, err);
                    }
                };
                
                const onError = (err) => {
                    console.warn(`⚠️ Не удалось загрузить гравировку (зад) ${eng.type}:`, err);
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 128;
                        canvas.height = 128;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, 128, 128);
                        ctx.fillStyle = '#888888';
                        ctx.font = 'bold 60px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('?', 64, 68);
                        const fallbackTex = new THREE.CanvasTexture(canvas);
                        onTextureLoaded(fallbackTex);
                    } catch (e) {
                        console.error('❌ Не удалось создать заглушку:', e);
                    }
                };
                
                if (eng.url && eng.url.startsWith('data:')) {
                    loader.load(eng.url, onTextureLoaded, undefined, onError);
                } else {
                    loader.load(eng.url, onTextureLoaded, undefined, onError);
                }
            });
        }
        
        console.log(`📦 decalsGroup создан, детей: ${decalsGroup.children.length}`);
        return decalsGroup;
        
    } catch (error) {
        console.error('❌ Ошибка создания декалей:', error);
        console.error('Stack:', error.stack);
        return null;
    }
}


export async function createStele(params, decalsGroup) {
    const { 
        steleType, width, height, depth, material,
        graveLength, baseHeight
    } = params;
    
    const group = new THREE.Group();
    let steleObj;
    
    console.log(`🔨 Создаем стелу типа: ${steleType}, размер: ${width}x${height}x${depth}`);
    
    if (steleType === 'rectangle') {
        steleObj = Rectangle.createMesh(width, height, depth, material);
        steleObj.position.y = baseHeight + (height / 2);
        steleObj.position.z = -(graveLength / 2 - depth / 2 - 0.05);
        group.add(steleObj);
        console.log('✅ Прямоугольная стела создана');
        
        if (decalsGroup) {
            const decals = createDecals(params, steleObj);
            if (decals) {
                while(decals.children.length > 0) {
                    const child = decals.children[0];
                    decals.remove(child);
                    decalsGroup.add(child);
                }
                console.log('✅ Декали добавлены для прямоугольной стелы');
            }
        }
        
    } else if (steleType && steleType.startsWith('custom_stl')) {
        steleObj = createCustomSteleMesh(
            steleType, 
            width, 
            height, 
            depth, 
            material, 
            'vertical', 
            decalsGroup,
            false
        );
        steleObj.position.y = baseHeight + (height / 2);
        steleObj.position.z = -(graveLength / 2 - depth / 2 - 0.05);
        group.add(steleObj);
        console.log(`✅ Кастомная стела ${steleType} создана`);
        
        // ⭐ ИСПРАВЛЕНИЕ: Всегда вызываем createPhotoDirect, если есть фото
        // Она сама решит: обновить позицию существующего или создать новое
        if (params.textureUrl) {
            createPhotoDirect(params, decalsGroup);
        }

    } else {
        // Другие типы
        steleObj = createSteleMesh(steleType, width, height, depth);
        const materialType = getTextureTypeFromMaterial(material);
        const pbrMaterial = await loadPBRMaterial(materialType);
        steleObj.traverse((child) => {
            if (child.isMesh) {
                if (pbrMaterial) {
                    child.material = pbrMaterial.clone();
                } else {
                    child.material = new THREE.MeshStandardMaterial({ 
                        ...stoneMaterials[material], 
                        roughness: 0.3 
                    });
                }
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        steleObj.position.y = baseHeight + (height / 2);
        steleObj.position.z = -(graveLength / 2 - depth / 2 - 0.05);
        group.add(steleObj);
        console.log('✅ Обычная стела создана');
        
        if (decalsGroup) {
            const decals = createDecals(params, steleObj);
            if (decals) {
                while(decals.children.length > 0) {
                    const child = decals.children[0];
                    decals.remove(child);
                    decalsGroup.add(child);
                }
                console.log('✅ Декали добавлены для обычной стелы');
            }
        }
    }
    
    return group;
}

// ⭐ ПРЯМОЕ СОЗДАНИЕ ИЛИ ОБНОВЛЕНИЕ ПОЗИЦИИ ФОТО (ФИНАЛЬНАЯ ВЕРСИЯ С ФИКСАЦИЕЙ)
function createPhotoDirect(params, decalsGroup) {
    if (!params.textureUrl) return;
    
    // ⭐ ИЩЕМ СУЩЕСТВУЮЩЕЕ ФОТО
    let existingPhoto = null;
    let mainDecalsGroup = null;
    if (window.monumentGroup) {
        window.monumentGroup.children.forEach(child => {
            if (child.name === 'mainDecalsGroup') {
                mainDecalsGroup = child;
            }
        });
    }
    if (mainDecalsGroup) {
        for (const child of mainDecalsGroup.children) {
            if (child.userData && child.userData.type === 'photo') {
                existingPhoto = child;
                break;
            }
        }
    }
    
    // ⭐ ЕСЛИ ФОТО УЖЕ ЕСТЬ - ПЕРЕМЕЩАЕМ ЕГО И ФИКСИРУЕМ КООРДИНАТЫ
    if (existingPhoto) {
        console.log('📸 Фото уже существует, перемещаем в новую позицию');
        
        let newX = 0;
        let newY = 0.6;
        if (window.state) {
            if (window.state.photoAbsoluteX !== undefined) newX = window.state.photoAbsoluteX;
            if (window.state.photoAbsoluteY !== undefined) newY = window.state.photoAbsoluteY;
        }
        
        // ЖЁСТКО ПЕРЕМЕЩАЕМ ФОТО
        existingPhoto.position.x = newX;
        existingPhoto.position.y = newY;
        
        // ЗАПИСЫВАЕМ ЭТИ ЖЕ КООРДИНАТЫ В STATE И ОБНУЛЯЕМ ВСЕ ОФФСЕТЫ
        if (window.state) {
            window.state.photoAbsoluteX = newX;
            window.state.photoAbsoluteY = newY;
            window.state.photoOffsetX = 0;
            window.state.photoOffsetY = 0;
            if (window.state.photoDragOffsetX !== undefined) window.state.photoDragOffsetX = 0;
            if (window.state.photoDragOffsetY !== undefined) window.state.photoDragOffsetY = 0;
        }
        
        console.log(`📸 Фото перемещено на (${newX.toFixed(3)}, ${newY.toFixed(3)})`);
        
        // ⭐ ВОТ ЗДЕСЬ МЫ ФИКСИРУЕМ ПОЗИЦИЮ ПОСЛЕ ЗАГРУЗКИ ТЕКСТУРЫ!
        // Если у фото есть материал, значит текстура уже загружена и масштаб применён.
        // Перезаписываем координаты, чтобы они не сбились.
        if (existingPhoto.material && existingPhoto.material.map) {
            existingPhoto.position.x = newX;
            existingPhoto.position.y = newY;
            console.log(`📸 Жёсткая фиксация после загрузки текстуры: (${newX.toFixed(3)}, ${newY.toFixed(3)})`);
        }
        
        return; // Выходим
    }
    
    // ⭐ ЕСЛИ ФОТО НЕТ - СОЗДАЕМ НОВОЕ (ОСТАЛЬНОЙ КОД БЕЗ ИЗМЕНЕНИЙ)
    if (!mainDecalsGroup) {
        if (window.monumentGroup) {
            window.monumentGroup.children.forEach(child => {
                if (child.name === 'mainDecalsGroup') {
                    mainDecalsGroup = child;
                }
            });
        }
    }
    const targetGroup = mainDecalsGroup || decalsGroup;
    if (!targetGroup) {
        console.warn('⚠️ Нет decalsGroup для фото');
        return;
    }
    
    console.log('📸 Создаем фото напрямую в:', targetGroup.name || 'target');
    
    let w = 0.22;
    let h = 0.28;
    const shape = params.photoShape || 'oval';
    if (shape === 'custom') {
        w = mmToMeters(params.photoWidthMm || 100);
        h = mmToMeters(params.photoHeightMm || 140);
    } else {
        const presetSizes = { 
            'oval':   { w: 0.22, h: 0.28 }, 
            'circle': { w: 0.24, h: 0.24 }, 
            'square': { w: 0.22, h: 0.22 } 
        };
        const size = presetSizes[shape] || presetSizes.oval;
        w = size.w;
        h = size.h;
    }
    const scale = params.photoScale || 1.0;
    const finalW = w * scale;
    const finalH = h * scale;
    
    let geometry;
    if (shape === 'circle') {
        geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, 32);
    } else if (shape === 'oval') {
        geometry = new THREE.CircleGeometry(0.5, 32);
        geometry.scale(finalW, finalH, 1);
    } else {
        geometry = new THREE.PlaneGeometry(finalW, finalH);
    }
    
    const tempMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const photoMesh = new THREE.Mesh(geometry, tempMat);
    
    let photoX = 0;
    let photoY = 0.6;
    let frontZ = -0.7;
    
    if (window.monumentGroup) {
        window.monumentGroup.traverse((child) => {
            if (child.type === 'Group' && child.children.length > 0 && child.name !== 'mainDecalsGroup') {
                let hasMesh = false;
                child.children.forEach(c => { if (c.isMesh && c.geometry) hasMesh = true; });
                if (hasMesh) {
                    try {
                        const boundingBox = new THREE.Box3().setFromObject(child);
                        frontZ = boundingBox.max.z + 0.015;
                    } catch(e) {}
                }
            }
        });
    }
    
    if (window.state) {
        if (window.state.photoAbsoluteX !== undefined) photoX = window.state.photoAbsoluteX;
        if (window.state.photoAbsoluteY !== undefined) photoY = window.state.photoAbsoluteY;
        console.log('📸 Восстанавливаем абсолютную позицию из state:', photoX, photoY);
    }
    
    photoMesh.position.set(photoX, photoY, frontZ - 0.013);
    photoMesh.renderOrder = 11;
    
    photoMesh.userData = {
        isDraggable: true,
        type: 'photo',
        limitX: params.width / 2,
        limitY: params.height / 2,
        steleCenterY: 0.6,
        photoIndex: 0,
        isMainPhoto: true,
        _foundType: 'main'
    };
    
    targetGroup.add(photoMesh);
    if (window.multiMonumentManager) {
        window.multiMonumentManager.mainPhotoMesh = photoMesh;
        console.log('📸 Ссылка на фото сохранена в multiMonumentManager');
    }
    
    console.log('📸 userData ДО загрузки текстуры:', photoMesh.userData);
    
    const loader = new THREE.TextureLoader();
    loader.load(params.textureUrl, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        photoMesh.material = new THREE.MeshBasicMaterial({ 
            map: tex, 
            transparent: true, 
            side: THREE.DoubleSide, 
            depthWrite: false, 
            alphaTest: 0.05 
        });
        
        // ⭐ САМОЕ ВАЖНОЕ: ПЕРЕЗАПИСЫВАЕМ ПОЗИЦИЮ ПОСЛЕ ЗАГРУЗКИ ТЕКСТУРЫ
        // Это фикс от смещения при изменении масштаба
        if (window.state) {
            const finalX = window.state.photoAbsoluteX || photoX;
            const finalY = window.state.photoAbsoluteY || photoY;
            photoMesh.position.x = finalX;
            photoMesh.position.y = finalY;
            console.log(`📸 Жёсткая фиксация позиции после загрузки текстуры: (${finalX.toFixed(3)}, ${finalY.toFixed(3)})`);
        }
        
        console.log('📸 Текстура фото загружена, userData сохранен:', photoMesh.userData);
    });
    
    console.log('📸 Фото основного ДОБАВЛЕНО в', targetGroup.name || 'target', '! Детей теперь:', targetGroup.children.length);
	// ⭐ ЗАЩИТА ОТ СБРОСА: Если state уже содержит координаты, они останутся.
	// Этот блок предотвращает сброс photoAbsoluteX/Y каким-либо другим менеджером.
	if (window.state && window.state.photoAbsoluteX === undefined && window.state.photoAbsoluteY === undefined) {
		// Если координат нет, ставим дефолт (только при первом создании)
		window.state.photoAbsoluteX = photoX;
		window.state.photoAbsoluteY = photoY;
	} else if (window.state) {
		// Если координаты уже есть, ОСТАВЛЯЕМ ИХ КАК ЕСТЬ.
		// Мы не перезаписываем их здесь, чтобы не сбить уже сохранённые.
		console.log('🛡️ Защита: photoAbsoluteX/Y уже есть, оставляем без изменений.');
	}
}



// ============================================================
// ⭐ СОЗДАНИЕ ДОРОЖКИ
// ============================================================

function createSimplePavingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, 256, 256);
    
    const tileSize = 40;
    const gap = 3;
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            const x = col * (tileSize + gap) + (row % 2) * (tileSize/2);
            const y = row * (tileSize + gap);
            const brightness = 140 + Math.random() * 80;
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.fillRect(x, y, tileSize, tileSize);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// ============================================================
// ⭐ ОБНОВЛЕНИЕ ОСНОВНОГО ПАМЯТНИКА
// ============================================================

export async function updateMainMonument(
    state,
    monumentGroup,
    decalsGroup
) {
    console.log(
        '🪦 === ОБНОВЛЕНИЕ ОСНОВНОГО ПАМЯТНИКА ==='
    );

    // ============================================================
    // 1. ПАРАМЕТРЫ
    // ============================================================

    const params = {

        graveWidth:
            state.graveWidth !== undefined
                ? Number(state.graveWidth)
                : 0.9,

        graveLength:
            state.graveLength !== undefined
                ? Number(state.graveLength)
                : 1.5,

        baseHeight:
            state.baseHeight !== undefined
                ? Number(state.baseHeight)
                : 0.15,

        material:
            state.material || 'granite',

        flowerEnabled:
            state.flowerEnabled !== undefined
                ? state.flowerEnabled
                : true,

        flowerWidth:
            state.flowerWidth !== undefined
                ? Number(state.flowerWidth)
                : 0.6,

        flowerLength:
            state.flowerLength !== undefined
                ? Number(state.flowerLength)
                : 0.9,

        flowerbedType:
            state.flowerbedType || 'grass',

        steleType:
            state.steleType ||
            state.steleModel ||
            'custom_stl_monument',

        width:
            state.width !== undefined
                ? Number(state.width)
                : 0.6,

        height:
            state.height !== undefined
                ? Number(state.height)
                : 1.2,

        depth:
            state.depth !== undefined
                ? Number(state.depth)
                : 0.1,

        fullName:
            state.fullName || '',

        dates:
            state.dates || '',

        epitaph:
            state.epitaph || '',

        textColor:
            state.textColor || '#FFFFFF',

        fontFamily:
            state.fontFamily ||
            'Arial, sans-serif',

        nameFontSize:
            state.nameFontSize !== undefined
                ? Number(state.nameFontSize)
                : 48,

        datesFontSize:
            state.datesFontSize !== undefined
                ? Number(state.datesFontSize)
                : 32,

        epitaphFontSize:
            state.epitaphFontSize !== undefined
                ? Number(state.epitaphFontSize)
                : 40,

        textOffsetX:
            state.textOffsetX || 0,

        textOffsetY:
            state.textOffsetY || 0,

        epitaphOffsetX:
            state.epitaphOffsetX || 0,

        epitaphOffsetY:
            state.epitaphOffsetY || 0,

        textureUrl:
            state.textureUrl || null,

        photoShape:
            state.photoShape || 'oval',

        photoScale:
            state.photoScale !== undefined
                ? Number(state.photoScale)
                : 1,

        photoWidthMm:
            state.photoWidthMm !== undefined
                ? Number(state.photoWidthMm)
                : 100,

        photoHeightMm:
            state.photoHeightMm !== undefined
                ? Number(state.photoHeightMm)
                : 140,

        photoOffsetX:
            state.photoOffsetX || 0,

        photoOffsetY:
            state.photoOffsetY || 0,

        // ========================================================
        // ГРАВИРОВКИ
        // ========================================================

        engravingsFront:
            state.engravingsFront ||
            state.engravings ||
            [],

        engravingsBack:
            state.engravingsBack ||
            state.backEngravings ||
            [],

        // ========================================================
        // 🔥 ОГРАДКА
        // ========================================================

        fenceEnabled:
            state.fenceEnabled !== undefined
                ? state.fenceEnabled
                : true,

        fenceWidth:
            state.fenceWidth !== undefined
                ? Number(state.fenceWidth)
                : 1.5,

        fenceLength:
            state.fenceLength !== undefined
                ? Number(state.fenceLength)
                : 2.5,

        fenceType:
            state.fenceType !== undefined
                ? String(state.fenceType)
                : 'pipe',

        fenceHeight:
            state.fenceHeight !== undefined
                ? Number(state.fenceHeight)
                : 0.6,

        fenceMaterial:
            state.fenceMaterial !== undefined
                ? String(state.fenceMaterial)
                : 'steel',

        fenceGateSide:
            state.fenceGateSide !== undefined
                ? String(state.fenceGateSide)
                : 'none',

        gateWidth:
            state.gateWidth !== undefined
                ? Number(state.gateWidth)
                : 0.8,

        fenceOffsetX:
            state.fenceOffsetX !== undefined
                ? Number(state.fenceOffsetX)
                : 0,

        fenceOffsetZ:
            state.fenceOffsetZ !== undefined
                ? Number(state.fenceOffsetZ)
                : 0,

        // ========================================================
        // ДОРОЖКА
        // ========================================================

        pathEnabled:
            state.pathEnabled !== undefined
                ? state.pathEnabled
                : true,

        pathWidth:
            state.pathWidth !== undefined
                ? Number(state.pathWidth)
                : 0.5,

        pathMaterial:
            state.pathMaterial || 'tile_gray',

        pathTileSize:
            state.pathTileSize !== undefined
                ? Number(state.pathTileSize)
                : 0.3,

        pathJointColor:
            state.pathJointColor || '#666666',

        pathTileLayout:
            state.pathTileLayout || 'brick'
    };

    // ============================================================
    // 🔥 ПРОВЕРКА ОГРАДКИ ПЕРЕД СОЗДАНИЕМ
    // ============================================================

    console.log(
        '🚧 ПАРАМЕТРЫ ОГРАДКИ ПЕРЕД createFenceGroup:',
        {
            enabled: params.fenceEnabled,
            width: params.fenceWidth,
            length: params.fenceLength,
            type: params.fenceType,
            height: params.fenceHeight,
            material: params.fenceMaterial,
            gateSide: params.fenceGateSide,
            gateWidth: params.gateWidth,
            offsetX: params.fenceOffsetX,
            offsetZ: params.fenceOffsetZ
        }
    );

    // ============================================================
    // 2. ГРАВИРОВКИ
    // ============================================================

    console.log(
        '📊 ГРАВИРОВКИ ИЗ STATE:',
        {
            engravingsFront:
                state?.engravingsFront,

            engravingsFrontLength:
                state?.engravingsFront?.length || 0,

            engravings:
                state?.engravings,

            engravingsLength:
                state?.engravings?.length || 0,

            engravingsBack:
                state?.engravingsBack,

            backEngravings:
                state?.backEngravings
        }
    );

    // ============================================================
    // 3. ОЧИЩАЕМ ОСНОВНОЙ ПАМЯТНИК
    // ============================================================

    clearMainMonument(monumentGroup);

    // ============================================================
    // 4. ФОТО НЕ УДАЛЯЕМ
    // ============================================================

    if (decalsGroup) {

        const photo = [];
        const toRemove = [];

        decalsGroup.children.forEach(child => {

            if (
                child.userData &&
                child.userData.type === 'photo'
            ) {
                photo.push(child);
            } else {
                toRemove.push(child);
            }

        });

        toRemove.forEach(child => {

            if (child.geometry) {
                child.geometry.dispose();
            }

            if (child.material) {

                if (Array.isArray(child.material)) {
                    child.material.forEach(
                        mat => mat?.dispose()
                    );
                } else {
                    child.material.dispose();
                }
            }

            decalsGroup.remove(child);

        });

        photo.forEach(p => {

            if (!decalsGroup.children.includes(p)) {
                decalsGroup.add(p);
            }

        });

        console.log(
            '🧹 Декали очищены, фото сохранено'
        );
    }

    // ============================================================
    // 5. ОСНОВАНИЕ
    // ============================================================

    const base =
        await createBase(params);

    if (base) {
        monumentGroup.add(base);
        console.log(
            '✅ Основание добавлено'
        );
    }

    // ============================================================
    // 6. ЦВЕТНИК
    // ============================================================

    const flowerbed =
        await createFlowerbed(params);

    if (flowerbed) {

        monumentGroup.add(
            flowerbed
        );

        console.log(
            '✅ Цветник добавлен'
        );
    }

    // ============================================================
    // 7. СТЕЛА
    // ============================================================

    console.log(
        '🔨 Вызываем createStele:',
        {
            steleType: params.steleType,
            width: params.width,
            height: params.height,
            depth: params.depth
        }
    );

    const steleGroup =
        await createStele(
            params,
            decalsGroup
        );

    if (steleGroup) {

        monumentGroup.add(
            steleGroup
        );

        console.log(
            '✅ Стела добавлена в сцену'
        );
    }

    // ============================================================
    // 8. 🔥 ОГРАДКА
    // ============================================================

    // Удаляем ВСЕ старые оградки
    // чтобы старая 1.5 × 2.5 не оставалась.

    const oldFences =
        monumentGroup.children.filter(
            child =>
                child.userData?.isFence === true
        );

    oldFences.forEach(fence => {

        fence.traverse(child => {

            if (child.geometry) {
                child.geometry.dispose();
            }

            if (child.material) {

                if (Array.isArray(child.material)) {

                    child.material.forEach(
                        mat => mat?.dispose()
                    );

                } else {

                    child.material.dispose();

                }
            }

        });

        monumentGroup.remove(
            fence
        );

    });

    console.log(
        `🧹 Старых оградок удалено: ${oldFences.length}`
    );

    // Создаём новую оградку
    // непосредственно из params.

    if (params.fenceEnabled) {

        console.log(
            '🚧 СОЗДАЁМ ОГРАДКУ:',
            {
                width: params.fenceWidth,
                length: params.fenceLength,
                type: params.fenceType
            }
        );

        const fence =
            createFenceGroup(params);

        if (fence) {

            fence.position.set(
                Number(params.fenceOffsetX) || 0,
                0,
                Number(params.fenceOffsetZ) || 0
            );

            monumentGroup.add(
                fence
            );

            console.log(
                '✅ ОГРАДКА ДОБАВЛЕНА:',
                {
                    width: params.fenceWidth,
                    length: params.fenceLength,
                    type: params.fenceType
                }
            );

        } else {

            console.warn(
                '⚠️ createFenceGroup() вернула null'
            );

        }

    } else {

        console.log(
            '⏭️ Оградка отключена'
        );

    }

    // ============================================================
    // 9. ДОРОЖКА
    // ============================================================

    const path =
        await createPathBetweenGraveAndFence(
            params
        );

    if (path) {

        path.position.y =
            0.001;

        path.position.x =
            Number(params.fenceOffsetX) || 0;

        path.position.z =
            Number(params.fenceOffsetZ) || 0;

        monumentGroup.add(
            path
        );

        console.log(
            '✅ Дорожка добавлена'
        );
    }

    // ============================================================
    // 10. ФИНАЛЬНАЯ ПРОВЕРКА
    // ============================================================

    const finalFence =
        monumentGroup.children.find(
            child =>
                child.userData?.isFence === true
        );

    console.log(
        '🏁 ИТОГОВАЯ ОГРАДКА В ОСНОВНОЙ ГРУППЕ:',
        finalFence
            ? {
                exists: true,
                width: params.fenceWidth,
                length: params.fenceLength,
                type: params.fenceType
            }
            : {
                exists: false
            }
    );

    console.log(
        '✅ Основной памятник обновлен'
    );
}
// ============================================================
// ⭐ ОБНОВЛЕНИЕ ДУБЛЕРА
// ============================================================

export async function updateDuplicator(index, monuments, monumentGroup) {
    console.log(`📋 === ОБНОВЛЕНИЕ ДУБЛЕРА #${index + 1} ===`);
    
    const mon = monuments[index];
    if (!mon) return;
    
    const data = mon.data;
    const group = mon.group;
    
    // 1. Очищаем группу
    while(group.children.length > 0) {
        const child = group.children[0];
        disposeObject3D(child);
        group.remove(child);
    }
    
    // 2. Собираем параметры из данных дублера
    const params = {
        graveWidth: data.graveWidth || 0.9,
        graveLength: data.graveLength || 1.5,
        baseHeight: data.baseHeight || 0.15,
        material: data.material || 'granite',
        flowerEnabled: data.flowerEnabled !== undefined ? data.flowerEnabled : true,
        flowerWidth: data.flowerWidth || 0.6,
        flowerLength: data.flowerLength || 0.9,
        flowerbedType: data.flowerbedType || 'grass',
        steleType: data.steleType || 'custom_stl_monument',
        width: data.width || 0.6,
        height: data.height || 1.2,
        depth: data.depth || 0.08,
        fullName: data.fullName || '',
        dates: data.dates || '',
        epitaph: data.epitaph || '',
        textColor: data.textColor || '#FFFFFF',
        fontFamily: data.fontFamily || 'Arial, sans-serif',
        nameFontSize: data.nameFontSize || 48,
        datesFontSize: data.datesFontSize || 32,
        epitaphFontSize: data.epitaphFontSize || 40,
        textOffsetX: data.textOffsetX || 0,
        textOffsetY: data.textOffsetY || 0,
        epitaphOffsetX: data.epitaphOffsetX || 0,
        epitaphOffsetY: data.epitaphOffsetY || 0,
        textureUrl: data.textureUrl || null,
        photoShape: data.photoShape || 'oval',
        photoScale: data.photoScale || 1.0,
        photoWidthMm: data.photoWidthMm || 100,
        photoHeightMm: data.photoHeightMm || 140,
        photoOffsetX: data.photoOffsetX || 0,
        photoOffsetY: data.photoOffsetY || 0,
        engravingsFront: data.engravingsFront || [],
        engravingsBack: data.engravingsBack || [],
        fenceEnabled: data.fenceEnabled !== undefined ? data.fenceEnabled : true,
        fenceWidth: data.fenceWidth || 1.5,
        fenceLength: data.fenceLength || 2.5,
        fenceType: data.fenceType || 'pipe',
        fenceHeight: data.fenceHeight || 0.6,
        fenceMaterial: data.fenceMaterial || 'steel',
        fenceGateSide: data.fenceGateSide || 'none',
        gateWidth: data.gateWidth || 0.8,
        fenceOffsetX: data.fenceOffsetX || 0,
        fenceOffsetZ: data.fenceOffsetZ || 0,
        pathEnabled: data.pathEnabled !== undefined ? data.pathEnabled : true,
        pathWidth: data.pathWidth || 0.5,
        pathMaterial: data.pathMaterial || 'tile_gray',
        pathTileSize: data.pathTileSize || 0.3,
        pathJointColor: data.pathJointColor || '#666666',
        pathTileLayout: data.pathTileLayout || 'brick'
    };
    
    // 3. Создаем элементы внутри группы
    const base = await createBase(params);
    group.add(base);
    
    const flowerbed = await createFlowerbed(params);
    if (flowerbed) group.add(flowerbed);
    
    const stele = await createStele(params);
    group.add(stele);
    
    const fence = createFenceGroup(params);
    if (fence) {
        const shiftX = params.fenceOffsetX || 0;
        const shiftZ = params.fenceOffsetZ || 0;
        fence.position.set(shiftX, 0, shiftZ);
        group.add(fence);
    }
    
    const path = await createPathGroup(params);
    if (path) {
        const shiftX = params.fenceOffsetX || 0;
        const shiftZ = params.fenceOffsetZ || 0;
        path.position.set(shiftX, 0, shiftZ);
        group.add(path);
    }
    
    console.log(`✅ Дублер #${index + 1} обновлен`);
}

// ============================================================
// ⭐ ПОЛНОЕ ОБНОВЛЕНИЕ СЦЕНЫ
// ============================================================

export async function updateFullScene(state, monumentGroup, decalsGroup, manager) {
    console.log('🔄 === ПОЛНОЕ ОБНОВЛЕНИЕ СЦЕНЫ ===');
    
    // 1. Очищаем всё
    clearAllScene(monumentGroup);
    
    // 2. Создаем основной
    await updateMainMonument(state, monumentGroup, decalsGroup);
    
    // 3. Создаем все дублеры
    if (manager && manager.monuments) {
        for (let i = 0; i < manager.monuments.length; i++) {
            await updateDuplicator(i, manager.monuments, monumentGroup);
        }
    }
    
    console.log('✅ Полное обновление завершено');
}

// ============================================================
// ⭐ ФУНКЦИИ ОЧИСТКИ
// ============================================================
export function clearMainMonument(monumentGroup) {
    // ⭐ СОХРАНЯЕМ ФОТО ПЕРЕД ОЧИСТКОЙ
    let savedPhoto = null;
    let mainDecalsGroup = null;
    
    monumentGroup.children.forEach(child => {
        if (child.name === 'mainDecalsGroup') {
            mainDecalsGroup = child;
        }
    });
    
    if (mainDecalsGroup) {
        mainDecalsGroup.children.forEach(decal => {
            if (decal.userData && decal.userData.type === 'photo') {
                savedPhoto = decal;
                console.log('📸 Фото сохранено перед очисткой');
            }
        });
    }
    
    const childrenToRemove = [];
    monumentGroup.children.forEach(child => {
        if (child.userData && child.userData.isMonumentGroup) return;
        if (child.name === 'mainDecalsGroup') {
            const toRemove = [];
            child.children.forEach(decal => {
                // ⭐ НЕ УДАЛЯЕМ ФОТО
                if (decal === savedPhoto) {
                    console.log('📸 Фото пропущено при очистке');
                    return;
                }
                toRemove.push(decal);
            });
            toRemove.forEach(decal => {
                disposeObject3D(decal);
                child.remove(decal);
            });
            return;
        }
        if (child === window.furnitureGroup) return;
        childrenToRemove.push(child);
    });
    childrenToRemove.forEach(obj => {
        disposeObject3D(obj);
        monumentGroup.remove(obj);
    });
}

export function clearAllScene(monumentGroup) {
    while(monumentGroup.children.length > 0) {
        const child = monumentGroup.children[0];
        disposeObject3D(child);
        monumentGroup.remove(child);
    }
}