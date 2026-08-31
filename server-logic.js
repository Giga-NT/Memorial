// ==================== ИМПОРТЫ ====================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Основные файлы (не обфусцированы)
import { steleTypes, getSteleTypesList, createSteleMesh, Rectangle } from './steleTypes.js';
import { 
    customModels, 
    loadCustomStele, 
    createCustomSteleMesh, 
    loadModelList, 
    getModelList,
    positionDecalsOnCustomStele,
    updateCurrentCustomSteleMaterial
} from './customSteleLoader.js';

// ⭐ ОБФУСЦИРОВАННЫЕ МОДУЛИ (заменили на .min.js)
import { getQualitySettings, CONFIG } from './performance-optimized.js';
import { preloadCriticalTextures } from './textures-optimized.js';
import { loadPBRMaterial } from './textures.js';
import { TileManager } from './tileManager.js';

// ⭐ МОДУЛИ (обфусцированные .min.js)
import { EngravingsManager } from './modules/engravings.min.js';
import { PhotoManager } from './modules/photo.min.js';
import { EpitaphManager } from './modules/epitaph.min.js';
import { Furniture3DManager } from './modules/furniture3D.min.js';

// ============================================================
// ⭐ ОПРЕДЕЛЕНИЕ УСТРОЙСТВА
// ============================================================
const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
const isLowEndDevice = isMobile || navigator.hardwareConcurrency < 4;

console.log(`📱 Устройство: ${isMobile ? 'Мобильное' : 'Десктоп'}`);
console.log(`⚡ Производительность: ${isLowEndDevice ? 'Низкая' : 'Высокая'}`);

// ============================================================
// ⭐ НАСТРОЙКИ КАЧЕСТВА ДЛЯ МОБИЛЬНЫХ
// ============================================================
const QUALITY = {
    // Размеры текстур для мобильных
    textureSize: isMobile ? 512 : 1024,
    // Для очень слабых устройств
    textureSizeLow: isLowEndDevice ? 256 : 512,
    // Качество теней
    shadowMapSize: isMobile ? 512 : 1024,
    // Разрешение рендеринга
    renderScale: isMobile ? 0.75 : 1.0,
    // Количество полигонов (если есть LOD)
    lodLevel: isMobile ? 1 : 0,
};

// ============================================================
// ⭐ ИНИЦИАЛИЗАЦИЯ СЦЕНЫ С ОПТИМИЗАЦИЕЙ
// ============================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Для мобильных - светлый фон без тумана (экономит ресурсы)
if (isMobile) {
    scene.background = new THREE.Color(0xf0f2f5);
    scene.fog = null;
} else {
    scene.background = new THREE.Color(0xf0f2f5);
    scene.fog = new THREE.Fog(0xf0f2f5, 5, 20);
}

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.5, 2, 3.5);

// ⭐ ОПТИМИЗИРОВАННЫЙ РЕНДЕРЕР
const renderer = new THREE.WebGLRenderer({ 
    antialias: !isMobile, // На мобильных отключаем сглаживание для скорости
    powerPreference: "high-performance",
    alpha: false, // Экономит память
    stencil: false, // Отключаем, если не нужен
    depth: true,
});

// Применяем масштабирование для мобильных
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Тени - на мобильных отключаем или уменьшаем
if (isMobile) {
    renderer.shadowMap.enabled = false;
} else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

container.appendChild(renderer.domElement);

// ============================================================
// ⭐ СВЕТ (ОПТИМИЗИРОВАННЫЙ)
// ============================================================
const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 0.8 : 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, isMobile ? 1.0 : 1.2);
dirLight.position.set(5, 10, 7);
if (!isMobile) {
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
    dirLight.shadow.radius = 2;
    dirLight.shadow.bias = -0.001;
}
scene.add(dirLight);

// ============================================================
// ⭐ УПРАВЛЕНИЕ
// ============================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);
// На мобильных ограничиваем для производительности
if (isMobile) {
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
}

// ============================================================
// ⭐ ЗЕМЛЯ (ОПТИМИЗИРОВАННАЯ)
// ============================================================
const groundGeo = new THREE.CircleGeometry(isMobile ? 8 : 12, isMobile ? 16 : 32);

// Загружаем текстуру травы (маленькую для мобильных)
let grassTexture = null;

async function loadGrassTextureOptimized() {
    try {
        const response = await fetch('./textures/grass.jpg');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => { img.onload = resolve; });
        
        // Создаём текстуру нужного размера
        const canvas = document.createElement('canvas');
        const size = isMobile ? 256 : 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        return texture;
    } catch(e) {
        console.warn('⚠️ Не удалось загрузить текстуру травы');
        return null;
    }
}

let groundMat;
const tempGrassTex = await loadGrassTextureOptimized();

if (tempGrassTex) {
    groundMat = new THREE.MeshStandardMaterial({ 
        map: tempGrassTex, 
        roughness: 0.8,
        metalness: 0.05
    });
} else {
    groundMat = new THREE.MeshStandardMaterial({ color: 0x5c8f5c, roughness: 1 });
}

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
if (!isMobile) ground.receiveShadow = true;
scene.add(ground);

// ============================================================
// ⭐ ГРУППЫ
// ============================================================
let monumentGroup = new THREE.Group();
scene.add(monumentGroup);

window.furniture3DManager = null;

let furnitureGroup = new THREE.Group();
scene.add(furnitureGroup);

let decalsGroup = new THREE.Group();
monumentGroup.add(decalsGroup);

let tileManager = null;
let showEnvironment = true;

// ============================================================
// ⭐ КЭШ МАТЕРИАЛОВ С УМЕНЬШЕННЫМИ ТЕКСТУРАМИ
// ============================================================
const materialCache = new Map();

async function getCachedMaterial(materialType) {
    const cacheKey = `${materialType}_${QUALITY.textureSize}`;
    if (materialCache.has(cacheKey)) {
        return materialCache.get(cacheKey);
    }
    
    // Загружаем PBR материал с уменьшенными текстурами
    const material = await loadPBRMaterial(materialType);
    
    // Уменьшаем текстуры если это возможно
    if (material && material.map) {
        // Если есть возможность уменьшить текстуру
        const originalImage = material.map.image;
        if (originalImage && originalImage.width > QUALITY.textureSize) {
            const canvas = document.createElement('canvas');
            canvas.width = QUALITY.textureSize;
            canvas.height = QUALITY.textureSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(originalImage, 0, 0, QUALITY.textureSize, QUALITY.textureSize);
            const newTexture = new THREE.CanvasTexture(canvas);
            newTexture.wrapS = material.map.wrapS;
            newTexture.wrapT = material.map.wrapT;
            newTexture.repeat = material.map.repeat;
            newTexture.minFilter = THREE.LinearFilter;
            newTexture.magFilter = THREE.LinearFilter;
            material.map = newTexture;
        }
    }
    
    materialCache.set(cacheKey, material);
    return material;
}

// ============================================================
// ⭐ БЕЗОПАСНОСТЬ
// ============================================================
function sanitizeText(str) {
    if (!str) return '';
    const element = document.createElement('div');
    element.innerText = str;
    return element.innerHTML;
}

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

function lazyLoadFont(fontName) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `data:text/css,@font-face{font-family:'${fontName}';src:url('./fonts/${fontName}.ttf')format('truetype');font-display:swap;}`;
    document.head.appendChild(link);
}

document.getElementById('fontFamily')?.addEventListener('change', (e) => {
    const font = e.target.value;
    if (['Yermak', 'Pochaevsk', 'Tsarevich', 'Feofan', 'Drina', 'Brusher', 'Figurny', 'Remeslo'].includes(font)) {
        lazyLoadFont(font);
    }
});

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x+r, y);
        this.lineTo(x+w-r, y);
        this.quadraticCurveTo(x+w, y, x+w, y+r);
        this.lineTo(x+w, y+h-r);
        this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        this.lineTo(x+r, y+h);
        this.quadraticCurveTo(x, y+h, x, y+h-r);
        this.lineTo(x, y+r);
        this.quadraticCurveTo(x, y, x+r, y);
        return this;
    };
}

const decalGeometryCache = new Map();
function getDecalGeometry(width, height) {
    const key = `${width.toFixed(3)}x${height.toFixed(3)}`;
    if (!decalGeometryCache.has(key)) {
        decalGeometryCache.set(key, new THREE.PlaneGeometry(width, height));
    }
    return decalGeometryCache.get(key);
}

function toggleEnvironment(show) {
    showEnvironment = show;
    console.log('🌳 Окружение:', show ? 'Показать' : 'Скрыть');
}

function mmToMeters(mm) { return mm / 1000; }

// ============================================================
// ⭐ УПРАВЛЕНИЕ МЕБЕЛЬЮ 3D
// ============================================================
let furniture3DManager = null;

function initFurniture3D() {
    if (!window.furniture3DManager) {
        window.furniture3DManager = new Furniture3DManager(scene, camera, renderer, monumentGroup, controls);
    }
    return window.furniture3DManager;
}

setTimeout(() => {
    initFurniture3D();
}, isMobile ? 2000 : 1000);

// ============================================================
// ⭐ МАТЕРИАЛЫ
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

// ============================================================
// ⭐ ТЕКСТУРНЫЙ КЭШ
// ============================================================
const textureCache = {
    front: null,
    back: null,
    lastFrontData: null,
    lastBackData: null,
    invalidateFront() { this.lastFrontData = null; },
    invalidateBack() { this.lastBackData = null; },
    needsFrontUpdate(data) {
        if (!this.lastFrontData) return true;
        return JSON.stringify(this.lastFrontData) !== JSON.stringify(data);
    },
    needsBackUpdate(data) {
        if (!this.lastBackData) return true;
        return JSON.stringify(this.lastBackData) !== JSON.stringify(data);
    }
};

// ============================================================
// ⭐ ПЕРЕМЕННЫЕ
// ============================================================
let loadedFenceModel = null,
    isFenceLoaded = false,
    loadedSteleModel = null,
    currentMode = 'rect',
    fence3DModel = null, 
    venzelModel = null,
    castingModel = null,
    isVenzelLoaded = false,
    isCastingLoaded = false;

const GLOBAL_SECTION_WIDTH = 0.25;

// ============================================================
// ⭐ TILE MANAGER
// ============================================================
function getTileManager() {
    if (!tileManager) {
        tileManager = new TileManager(scene, monumentGroup);
    }
    return tileManager;
}

function resetTileManager() {
    if (tileManager) {
        tileManager.clearTiles();
        if (tileManager.tileGroup) {
            monumentGroup.remove(tileManager.tileGroup);
        }
        tileManager = null;
    }
}

function updateTileInfo() {
    const tileInfoEl = document.getElementById('tileInfo');
    if (!tileInfoEl) return;
    
    const cols = Math.ceil(state.flowerWidth / 0.3);
    const rows = Math.ceil(state.flowerLength / 0.6);
    const finalCols = cols % 2 === 0 ? cols + 1 : cols;
    const finalRows = rows % 2 === 0 ? rows + 1 : rows;
    const perimeterTiles = 2 * finalCols + 2 * finalRows - 4;
    const totalTiles = finalCols * finalRows;
    const actualWidth = finalCols * 0.3;
    const actualLength = finalRows * 0.6;
    
    tileInfoEl.innerHTML = `
        📊 Плиток по периметру: ${perimeterTiles}
        <span style="display:block;font-size:11px;color:#666;margin-top:4px;">
            Сетка: ${finalCols}×${finalRows} (${totalTiles} плиток) | 
            Размер: ${actualWidth.toFixed(1)}×${actualLength.toFixed(1)} м
        </span>
    `;
}

// ============================================================
// ⭐ КОНФИГ ДЕКАЛЕЙ
// ============================================================
const decalConfigs = {
    'custom_stl': {
        orientation: 'vertical',
        textOffsetY: 0.1,
        photoOffsetY: 0.15,
        engravingOffsetY: 0.25,
        epitaphOffsetY: -0.1,
        backEngravingOffsetY: -0.1,
        textScale: 0.85,
        photoScale: 1.0,
        engravingScale: 1.0,
    },
    'custom_stl2': {
        orientation: 'vertical',
        textOffsetY: 0.1,
        photoOffsetY: 0.15,
        engravingOffsetY: -0.15,
        epitaphOffsetY: -0.2,
        backEngravingOffsetY: -0.2,
        textScale: 0.7,
        photoScale: 0.9,
        engravingScale: 0.9,
    },
    'custom_stl4': {
        orientation: 'horizontal',
        textOffsetY: 0.0,
        photoOffsetY: 0.0,
        engravingOffsetY: 0.0,
        epitaphOffsetY: 0.0,
        backEngravingOffsetY: 0.0,
        textScale: 0.7,
        photoScale: 0.8,
        engravingScale: 0.8,
        zOffset: 0.0,
    },
    'custom_stl3': {
        orientation: 'vertical',
        textOffsetY: 0.0,
        photoOffsetY: 0.1,
        engravingOffsetY: 0.15,
        epitaphOffsetY: -0.2,
        backEngravingOffsetY: -0.2,
        textScale: 0.8,
        photoScale: 0.9,
        engravingScale: 0.9,
    }
};

let frontDecalPosition = new THREE.Vector3(-0.05, 0.74, -0.76),
    backDecalPosition = new THREE.Vector3(-0.07, 0.64, -0.69),
    photoDecalPosition = new THREE.Vector3(-0.07, 0.64, -0.65);

// ============================================================
// ⭐ СОСТОЯНИЕ
// ============================================================
const state = {
    width: 0.6, height: 1.2, depth: 0.1, textureUrl: null, material: 'granite',
    fullName: "Иванов Иван Иванович", dates: "01.01.1950 — 01.01.2026",
    epitaph: "Светлая память\nо дорогих людях", textColor: '#FFFFFF',
    flowerbedType: 'grass', photoScale: 1.0, photoOffsetX: 0, photoOffsetY: 0,
    isDraggingPhoto: false, enableMoveMode: false,
    fontFamily: "Arial, sans-serif", nameFontSize: 24, datesFontSize: 24, epitaphFontSize: 24,
    photoShape: 'oval', photoWidthMm: 100, photoHeightMm: 140,
    fenceHeight: 0.6, fenceType: 'pipe',
    fenceMaterial: 'steel', fenceOffset: 0.50, fenceGateSide: 'back', gateWidth: 0.8,
    modelScale: 1.0, modelPosY: 0.31, modelMaterial: 'original', modelFontFamily: "Arial, sans-serif",
    modelFrontText: "Светлая память!\nПока получается неплохо", modelFrontFontSize: 36, frontDecalSize: 0.85,
    modelBackName: "Иванов И.И.", modelBackDates: "1950 - 2026", modelBackFontSize: 48, backDecalSize: 0.65,
    frontPosX: -0.05, frontPosY: 0.74, frontPosZ: -0.76, backPosX: -0.07, backPosY: 0.64, backPosZ: -0.69,
    modelPhotoUrl: null, modelPhotoShape: 'oval', modelPhotoWidthMm: 141, modelPhotoHeightMm: 166,
    photoPosX: -0.07, photoPosY: 0.64, photoPosZ: -0.65, photoScale3d: 1.0,
    engravings: [], 
    backEngravings: [],
    activeEngravingSide: 'front',
    isDraggingEngraving: false,
    draggedEngravingId: null,
    steleType: 'rectangle',
    enableMoveEngraving: false,
    epitaphOffsetX: 0,
    epitaphOffsetY: 0,
    enableMoveEpitaph: false,
    frontTextureCache: null,
    backTextureCache: null,
    frontTextureNeedsUpdate: true,
    backTextureNeedsUpdate: true,
    textOffsetX: 0,
    textOffsetY: 0,
    epitaphBlockOffsetX: 0,
    epitaphBlockOffsetY: 0,
    engravingType: '',
    engravingUrl: null,
    engravingOffsetX: 0,
    engravingOffsetY: 0.15,
    engravingScale: 1.0,
    engravingBackType: '',
    engravingBackUrl: null,
    engravingBackOffsetX: 0,
    engravingBackOffsetY: 0.20,
    engravingBackScale: 1.0,
    engravingsFront: [],
    engravingsBack: [],
    graveWidth: 0.9,
    graveLength: 1.5,
    baseHeight: 0.15,
    flowerWidth: 0.6,
    flowerLength: 0.9,
    flowerEnabled: true,
    flowerPosX: 0,
    flowerPosZ: 0,
    pathEnabled: true,
    pathWidth: 0.5,
    pathMaterial: 'tile_gray',
    pathColor: '#888888',
    pathTileSize: 0.3,
    pathJointColor: '#666666',
    pathTileLayout: 'brick',
};

window.positionDecalsOnCustomStele = positionDecalsOnCustomStele;
window.decalsGroup = decalsGroup;
window.state = state;

// ============================================================
// ⭐ ГРАВИРОВКИ (ОБЪЕДИНЁННЫЙ КОНФИГ)
// ============================================================
let nextEngravingId = 1;
let engravingsConfig = {};
let currentEditingEngraving = null;
let currentEditingSide = null;

async function loadEngravingsConfig() {
    try {
        const response = await fetch('./engravings/engravings.json');
        const data = await response.json();
        data.engravings.forEach(eng => {
            engravingsConfig[eng.id] = {
                name: eng.name,
                file: eng.file,
                defaultScale: eng.defaultScale || 1.0,
                defaultOffsetY: eng.defaultOffsetY || 0.35
            };
        });
        populateEngravingsSelect(data.engravings);
        console.log('✅ Гравировки загружены из JSON:', Object.keys(engravingsConfig).length);
    } catch (error) {
        console.error('❌ Ошибка загрузки гравировок:', error);
        engravingsConfig = {
            cross: { name: "✝️ Крест", file: "./engravings/cross.png", defaultScale: 1.0, defaultOffsetY: 0.35 }
        };
    }
}

function populateEngravingsSelect(engravingsList) {
    const mainSelect = document.getElementById('engravingSelect');
    if (mainSelect) {
        mainSelect.innerHTML = '<option value="">-- Без гравировки --</option>';
        engravingsList.forEach(eng => {
            const option = document.createElement('option');
            option.value = eng.id;
            option.textContent = eng.name;
            if (eng.defaultScale) option.dataset.defaultScale = eng.defaultScale;
            if (eng.defaultOffsetY) option.dataset.defaultOffsetY = eng.defaultOffsetY;
            mainSelect.appendChild(option);
        });
    }
    
    const frontSelect = document.getElementById('addEngravingFrontSelect');
    if (frontSelect) {
        frontSelect.innerHTML = '<option value="">-- Выберите гравировку --</option>';
        engravingsList.forEach(eng => {
            const option = document.createElement('option');
            option.value = eng.id;
            option.textContent = eng.name;
            frontSelect.appendChild(option);
        });
    }
    
    const backSelect = document.getElementById('addEngravingBackSelect');
    if (backSelect) {
        backSelect.innerHTML = '<option value="">-- Выберите гравировку --</option>';
        engravingsList.forEach(eng => {
            const option = document.createElement('option');
            option.value = eng.id;
            option.textContent = eng.name;
            backSelect.appendChild(option);
        });
    }
}

function addEngravingToFront(type) {
    if (!type || !engravingsConfig[type]) return;
    const newEngraving = {
        id: nextEngravingId++,
        type: type,
        url: engravingsConfig[type].file,
        x: (state.engravingsFront.length * 0.12) - 0.2,
        y: 0.15 + (state.engravingsFront.length * 0.18),
        scale: engravingsConfig[type].defaultScale || 1.0,
        rotation: 0
    };
    state.engravingsFront.push(newEngraving);
    updateEngravingsFrontList();
    throttledUpdate();
    showToast(`Добавлена гравировка: ${engravingsConfig[type].name}`, 'success');
}

function addEngravingToBack(type) {
    if (!type || !engravingsConfig[type]) return;
    const newEngraving = {
        id: nextEngravingId++,
        type: type,
        url: engravingsConfig[type].file,
        x: (state.engravingsBack.length * 0.12) - 0.2,
        y: 0.20 + (state.engravingsBack.length * 0.18),
        scale: engravingsConfig[type].defaultScale || 1.0,
        rotation: 0
    };
    state.engravingsBack.push(newEngraving);
    updateEngravingsBackList();
    throttledUpdate();
    showToast(`Добавлена гравировка на заднюю сторону: ${engravingsConfig[type].name}`, 'success');
}

function removeEngravingFromFront(id) {
    const index = state.engravingsFront.findIndex(e => e.id === id);
    if (index !== -1) {
        const removed = state.engravingsFront.splice(index, 1)[0];
        showToast(`Удалена гравировка: ${engravingsConfig[removed.type]?.name || removed.type}`, 'success');
        updateEngravingsFrontList();
        throttledUpdate();
    }
}

function removeEngravingFromBack(id) {
    const index = state.engravingsBack.findIndex(e => e.id === id);
    if (index !== -1) {
        const removed = state.engravingsBack.splice(index, 1)[0];
        showToast(`Удалена гравировка с задней стороны: ${engravingsConfig[removed.type]?.name || removed.type}`, 'success');
        updateEngravingsBackList();
        throttledUpdate();
    }
}

function openEngravingEditorFront(id) {
    const eng = state.engravingsFront.find(e => e.id === id);
    if (!eng) return;
    currentEditingEngraving = eng;
    currentEditingSide = 'front';
    currentEditingEngraving._backupX = eng.x;
    currentEditingEngraving._backupY = eng.y;
    currentEditingEngraving._backupScale = eng.scale;
    document.getElementById('editorX').value = eng.x;
    document.getElementById('editorY').value = eng.y;
    document.getElementById('editorScale').value = eng.scale;
    document.getElementById('editorXVal').textContent = eng.x.toFixed(2);
    document.getElementById('editorYVal').textContent = eng.y.toFixed(2);
    document.getElementById('editorScaleVal').textContent = eng.scale.toFixed(2);
    document.getElementById('editorModalTitle').textContent = `✏️ Редактирование: ${engravingsConfig[eng.type]?.name || eng.type}`;
    document.getElementById('engravingEditorModal').style.display = 'flex';
}

function openEngravingEditorBack(id) {
    const eng = state.engravingsBack.find(e => e.id === id);
    if (!eng) return;
    currentEditingEngraving = eng;
    currentEditingSide = 'back';
    currentEditingEngraving._backupX = eng.x;
    currentEditingEngraving._backupY = eng.y;
    currentEditingEngraving._backupScale = eng.scale;
    document.getElementById('editorX').value = eng.x;
    document.getElementById('editorY').value = eng.y;
    document.getElementById('editorScale').value = eng.scale;
    document.getElementById('editorXVal').textContent = eng.x.toFixed(2);
    document.getElementById('editorYVal').textContent = eng.y.toFixed(2);
    document.getElementById('editorScaleVal').textContent = eng.scale.toFixed(2);
    document.getElementById('editorModalTitle').textContent = `✏️ Редактирование: ${engravingsConfig[eng.type]?.name || eng.type}`;
    document.getElementById('engravingEditorModal').style.display = 'flex';
}

function saveEngravingEditor() {
    if (!currentEditingEngraving) return;
    delete currentEditingEngraving._backupX;
    delete currentEditingEngraving._backupY;
    delete currentEditingEngraving._backupScale;
    if (currentEditingSide === 'front') {
        updateEngravingsFrontList();
    } else {
        updateEngravingsBackList();
    }
    closeEngravingEditor();
    throttledUpdate();
    showToast('Гравировка обновлена', 'success');
}

function previewEngravingChange() {
    if (!currentEditingEngraving) return;
    currentEditingEngraving.x = parseFloat(document.getElementById('editorX').value);
    currentEditingEngraving.y = parseFloat(document.getElementById('editorY').value);
    currentEditingEngraving.scale = parseFloat(document.getElementById('editorScale').value);
    document.getElementById('editorXVal').textContent = currentEditingEngraving.x.toFixed(2);
    document.getElementById('editorYVal').textContent = currentEditingEngraving.y.toFixed(2);
    document.getElementById('editorScaleVal').textContent = currentEditingEngraving.scale.toFixed(2);
    if (currentEditingSide === 'front') {
        updateEngravingsFrontList();
    } else {
        updateEngravingsBackList();
    }
    throttledUpdate();
}

function closeEngravingEditor() {
    if (currentEditingEngraving) {
        if (currentEditingEngraving._backupX !== undefined) {
            currentEditingEngraving.x = currentEditingEngraving._backupX;
            currentEditingEngraving.y = currentEditingEngraving._backupY;
            currentEditingEngraving.scale = currentEditingEngraving._backupScale;
            delete currentEditingEngraving._backupX;
            delete currentEditingEngraving._backupY;
            delete currentEditingEngraving._backupScale;
            if (currentEditingSide === 'front') {
                updateEngravingsFrontList();
            } else {
                updateEngravingsBackList();
            }
            throttledUpdate();
        }
    }
    document.getElementById('engravingEditorModal').style.display = 'none';
    currentEditingEngraving = null;
    currentEditingSide = null;
}

function updateEngravingsFrontList() {
    const container = document.getElementById('engravingsFrontList');
    if (!container) return;
    if (state.engravingsFront.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет гравировок</div>';
        return;
    }
    container.innerHTML = '';
    state.engravingsFront.forEach(eng => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(0,168,150,0.2); border-radius: 6px; padding: 8px; margin-bottom: 6px;';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${engravingsConfig[eng.type]?.name || eng.type}</strong>
                    <div style="font-size: 10px; color: #aaa;">X: ${eng.x.toFixed(2)} | Y: ${eng.y.toFixed(2)} | Масштаб: ${eng.scale.toFixed(1)}</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="edit-engraving-front" data-id="${eng.id}" style="background: #3498db; width: auto; padding: 4px 8px; margin: 0; border-radius: 4px; cursor: pointer;">✏️</button>
                    <button class="remove-engraving-front" data-id="${eng.id}" style="background: #e74c3c; width: auto; padding: 4px 8px; margin: 0; border-radius: 4px; cursor: pointer;">🗑️</button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
    document.querySelectorAll('.remove-engraving-front').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            removeEngravingFromFront(id);
        });
    });
    document.querySelectorAll('.edit-engraving-front').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            openEngravingEditorFront(id);
        });
    });
}

function updateEngravingsBackList() {
    const container = document.getElementById('engravingsBackList');
    if (!container) return;
    if (state.engravingsBack.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет гравировок</div>';
        return;
    }
    container.innerHTML = '';
    state.engravingsBack.forEach(eng => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(231,76,60,0.2); border-radius: 6px; padding: 8px; margin-bottom: 6px;';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${engravingsConfig[eng.type]?.name || eng.type}</strong>
                    <div style="font-size: 10px; color: #aaa;">X: ${eng.x.toFixed(2)} | Y: ${eng.y.toFixed(2)} | Масштаб: ${eng.scale.toFixed(1)}</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="edit-engraving-back" data-id="${eng.id}" style="background: #3498db; width: auto; padding: 4px 8px; margin: 0; border-radius: 4px; cursor: pointer;">✏️</button>
                    <button class="remove-engraving-back" data-id="${eng.id}" style="background: #e74c3c; width: auto; padding: 4px 8px; margin: 0; border-radius: 4px; cursor: pointer;">🗑️</button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
    document.querySelectorAll('.remove-engraving-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            removeEngravingFromBack(id);
        });
    });
    document.querySelectorAll('.edit-engraving-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            openEngravingEditorBack(id);
        });
    });
}

const addEngravingFrontBtn = document.getElementById('addEngravingFrontBtn');
const addEngravingFrontSelect = document.getElementById('addEngravingFrontSelect');
if (addEngravingFrontBtn && addEngravingFrontSelect) {
    addEngravingFrontBtn.addEventListener('click', () => {
        const selectedType = addEngravingFrontSelect.value;
        if (selectedType) {
            addEngravingToFront(selectedType);
            addEngravingFrontSelect.value = '';
        } else {
            showToast('Выберите гравировку', 'error');
        }
    });
}

const addEngravingBackBtn = document.getElementById('addEngravingBackBtn');
const addEngravingBackSelect = document.getElementById('addEngravingBackSelect');
if (addEngravingBackBtn && addEngravingBackSelect) {
    addEngravingBackBtn.addEventListener('click', () => {
        const selectedType = addEngravingBackSelect.value;
        if (selectedType) {
            addEngravingToBack(selectedType);
            addEngravingBackSelect.value = '';
        } else {
            showToast('Выберите гравировку', 'error');
        }
    });
}

const editorModal = document.getElementById('engravingEditorModal');
const editorX = document.getElementById('editorX');
const editorY = document.getElementById('editorY');
const editorScale = document.getElementById('editorScale');
const editorXVal = document.getElementById('editorXVal');
const editorYVal = document.getElementById('editorYVal');
const editorScaleVal = document.getElementById('editorScaleVal');
const editorSaveBtn = document.getElementById('editorSaveBtn');
const editorCancelBtn = document.getElementById('editorCancelBtn');

if (editorX) {
    editorX.addEventListener('input', () => {
        editorXVal.textContent = parseFloat(editorX.value).toFixed(2);
        previewEngravingChange();
    });
}
if (editorY) {
    editorY.addEventListener('input', () => {
        editorYVal.textContent = parseFloat(editorY.value).toFixed(2);
        previewEngravingChange();
    });
}
if (editorScale) {
    editorScale.addEventListener('input', () => {
        editorScaleVal.textContent = parseFloat(editorScale.value).toFixed(2);
        previewEngravingChange();
    });
}
if (editorSaveBtn) {
    editorSaveBtn.addEventListener('click', saveEngravingEditor);
}
if (editorCancelBtn) {
    editorCancelBtn.addEventListener('click', closeEngravingEditor);
}
if (editorModal) {
    editorModal.addEventListener('click', (e) => {
        if (e.target === editorModal) closeEngravingEditor();
    });
}

const engravingBackSelect = document.getElementById('engravingBackSelect');
if (engravingBackSelect) {
    engravingBackSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        state.engravingBackType = selectedType;
        if (selectedType && engravingsConfig[selectedType]) {
            state.engravingBackUrl = engravingsConfig[selectedType].file;
        } else {
            state.engravingBackUrl = null;
        }
        throttledUpdate();
        showToast(selectedType ? `Гравировка на заднюю сторону: ${engravingsConfig[selectedType]?.name || selectedType}` : 'Гравировка на задней стороне отключена', 'success');
    });
}

const engravingBackScaleRange = document.getElementById('engravingBackScale');
if (engravingBackScaleRange) {
    engravingBackScaleRange.addEventListener('input', (e) => { 
        state.engravingBackScale = parseFloat(e.target.value); 
        document.getElementById('engravingBackScaleVal').textContent = state.engravingBackScale.toFixed(1);
        throttledUpdate(); 
    });
}

const engravingBackOffsetXRange = document.getElementById('engravingBackOffsetXRange');
if (engravingBackOffsetXRange) {
    engravingBackOffsetXRange.addEventListener('input', (e) => { 
        state.engravingBackOffsetX = parseFloat(e.target.value); 
        document.getElementById('engravingBackOffsetXVal').textContent = state.engravingBackOffsetX.toFixed(2);
        throttledUpdate(); 
    });
}

const engravingBackOffsetYRange = document.getElementById('engravingBackOffsetYRange');
if (engravingBackOffsetYRange) {
    engravingBackOffsetYRange.addEventListener('input', (e) => { 
        state.engravingBackOffsetY = parseFloat(e.target.value); 
        document.getElementById('engravingBackOffsetYVal').textContent = state.engravingBackOffsetY.toFixed(2);
        throttledUpdate(); 
    });
}

loadEngravingsConfig();

// ============================================================
// ⭐ ОСНОВНЫЕ ФУНКЦИИ
// ============================================================
function getMaterialHex(k) { 
    const c = stoneMaterials[k].color; 
    return '#' + c.toString(16).padStart(6, '0'); 
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУР (С УМЕНЬШЕННЫМ РАЗМЕРОМ ДЛЯ МОБИЛЬНЫХ)
// ============================================================
function createTextDecal(text, fontSize, color, fontFamily) {
    const canvas = document.createElement('canvas');
    // Уменьшаем размер для мобильных
    const size = isMobile ? 256 : 512;
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = (canvas.height - totalHeight) / 2 + lineHeight / 2;
    const scale = isMobile ? 0.6 : 1.0;
    const actualFontSize = fontSize * scale;
    lines.forEach((line, index) => {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = isMobile ? 3 : 6;
        ctx.shadowOffsetX = isMobile ? 1 : 2;
        ctx.shadowOffsetY = isMobile ? 1 : 2;
        ctx.font = `bold ${actualFontSize}px ${fontFamily}`;
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
        ctx.shadowColor = 'transparent';
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function createDecalMesh(texture, width, height) {
    const geometry = getDecalGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true, 
        depthTest: true, 
        depthWrite: false, 
        side: THREE.DoubleSide, 
        alphaTest: 0.1 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    return mesh;
}

function createEngravingDecalGroup(engraving) {
    if (!engraving || engraving.type === 'none') return null;
    const canvas = document.createElement('canvas');
    const size = isMobile ? 256 : 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = engraving.color || '#FFFFFF';
    ctx.strokeStyle = engraving.color || '#FFFFFF';
    ctx.lineWidth = isMobile ? 15 : 30;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = size / 2;
    const cy = size / 2;
    const scale = engraving.size || 1.0;
    const s = size / 512;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale * s, scale * s);
    if (engraving.type === 'cross') {
        ctx.beginPath();
        ctx.moveTo(0, -100); ctx.lineTo(0, 100);
        ctx.moveTo(-70, -40); ctx.lineTo(70, -40);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-50, 60); ctx.lineTo(50, 60);
        ctx.stroke();
    } else if (engraving.type === 'dove') {
        ctx.beginPath();
        ctx.moveTo(-80, 0);
        ctx.bezierCurveTo(-40, -60, 40, -60, 80, 0);
        ctx.bezierCurveTo(40, 40, -40, 40, -80, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(70, -30, 25, 0, Math.PI * 2);
        ctx.fill();
    } else if (engraving.type === 'heart') {
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.bezierCurveTo(50, -20, 50, -80, 0, -80);
        ctx.bezierCurveTo(-50, -80, -50, -20, 0, 30);
        ctx.fill();
    } else if (engraving.type === 'flower') {
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.ellipse(0, -60, 20, 40, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
    } else if (engraving.type === 'angel') {
        ctx.beginPath();
        ctx.arc(0, -40, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-60, 0); ctx.lineTo(60, 0);
        ctx.lineTo(80, 60); ctx.lineTo(-80, 60);
        ctx.fill();
    }
    ctx.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const sizeM = 0.18 * scale;
    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { isEngravingDecal: true, id: engraving.id, type: engraving.type };
    mesh.renderOrder = 10;
    return mesh;
}

function createPhotoDecal() {
    if (!state.modelPhotoUrl) return null;
    const texture = new THREE.TextureLoader().load(state.modelPhotoUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    let widthMeters = mmToMeters(state.modelPhotoWidthMm);
    let heightMeters = mmToMeters(state.modelPhotoHeightMm);
    if (!widthMeters || isNaN(widthMeters) || widthMeters === 0) widthMeters = 0.141;
    if (!heightMeters || isNaN(heightMeters) || heightMeters === 0) heightMeters = 0.166;
    const shape = state.modelPhotoShape;
    const scale3d = state.photoScale3d || 1.0;
    const finalWidth = widthMeters * scale3d;
    const finalHeight = heightMeters * scale3d;
    let geometry, frameGeometry;
    if (shape === 'circle') {
        const size = Math.min(finalWidth, finalHeight);
        geometry = new THREE.CircleGeometry(size / 2, isMobile ? 32 : 64);
        frameGeometry = new THREE.CircleGeometry(size / 2 + 0.01, isMobile ? 32 : 64);
    } else if (shape === 'oval') {
        geometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
        geometry.scale(finalWidth, finalHeight, 1);
        frameGeometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
        frameGeometry.scale(finalWidth + 0.02, finalHeight + 0.02, 1);
    } else {
        geometry = new THREE.PlaneGeometry(finalWidth, finalHeight);
        frameGeometry = new THREE.PlaneGeometry(finalWidth + 0.02, finalHeight + 0.02);
    }
    const group = new THREE.Group();
    const photoMat = new THREE.MeshStandardMaterial({ 
        map: texture, 
        transparent: true, 
        side: THREE.DoubleSide, 
        roughness: 0.4, 
        metalness: 0.05 
    });
    const photoMesh = new THREE.Mesh(geometry, photoMat);
    photoMesh.renderOrder = 2;
    group.add(photoMesh);
    const frameMat = new THREE.MeshStandardMaterial({ 
        color: 0xD4AF37, 
        metalness: 0.85, 
        roughness: 0.3, 
        side: THREE.DoubleSide 
    });
    const frameMesh = new THREE.Mesh(frameGeometry, frameMat);
    frameMesh.position.z = -0.003;
    frameMesh.renderOrder = 1;
    group.add(frameMesh);
    photoDecalPosition.set(state.photoPosX, state.photoPosY, state.photoPosZ);
    group.position.copy(photoDecalPosition);
    group.lookAt(new THREE.Vector3(photoDecalPosition.x, photoDecalPosition.y, photoDecalPosition.z + 1));
    return group;
}

function drawSingleEngravingOnCanvas(ctx, x, y, engraving) {
    if (!engraving || engraving.type === 'none') return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = engraving.color || '#FFFFFF';
    ctx.strokeStyle = engraving.color || '#FFFFFF';
    ctx.lineWidth = 3;
    if (engraving.type === 'cross') {
        const size = 40;
        ctx.beginPath();
        ctx.moveTo(0, -size); ctx.lineTo(0, size);
        ctx.moveTo(-size * 0.6, -size * 0.2); ctx.lineTo(size * 0.6, -size * 0.2);
        ctx.stroke();
    } else if (engraving.type === 'flower') {
        const r = 20;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, r);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillRect(-20, -20, 40, 40);
    }
    ctx.restore();
}

function createEngravingMesh(engraving) {
    if (!engraving || engraving.type === 'none') return null;
    const canvas = document.createElement('canvas');
    const size = isMobile ? 256 : 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = engraving.color || '#FFFFFF';
    ctx.strokeStyle = engraving.color || '#FFFFFF';
    ctx.lineWidth = isMobile ? 10 : 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = size / 2;
    const cy = size / 2;
    const scale = engraving.size || 1.0;
    const s = size / 512;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale * s, scale * s);
    if (engraving.type === 'cross') {
        ctx.beginPath();
        ctx.moveTo(0, -100); ctx.lineTo(0, 80);
        ctx.moveTo(-70, -40); ctx.lineTo(70, -40);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-50, 60); ctx.lineTo(50, 60);
        ctx.stroke();
    } else if (engraving.type === 'dove') {
        ctx.beginPath();
        ctx.moveTo(-80, 0);
        ctx.bezierCurveTo(-40, -60, 40, -60, 80, 0);
        ctx.bezierCurveTo(40, 40, -40, 40, -80, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(70, -30, 25, 0, Math.PI * 2);
        ctx.fill();
    } else if (engraving.type === 'heart') {
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.bezierCurveTo(50, -20, 50, -80, 0, -80);
        ctx.bezierCurveTo(-50, -80, -50, -20, 0, 30);
        ctx.fill();
    } else if (engraving.type === 'flower') {
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.ellipse(0, -60, 20, 40, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
    } else if (engraving.type === 'angel') {
        ctx.beginPath();
        ctx.arc(0, -40, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-60, 0); ctx.lineTo(60, 0);
        ctx.lineTo(80, 60); ctx.lineTo(-80, 60);
        ctx.fill();
    } else {
        ctx.fillRect(-50, -50, 100, 100);
    }
    ctx.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sizeM = 0.2 * scale;
    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true, 
        side: THREE.DoubleSide, 
        depthWrite: false,
        alphaTest: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { isEngraving: true, id: engraving.id };
    mesh.renderOrder = 10;
    return mesh;
}

function updateDecalsForCustomStele(steleMesh) {
    while(decalsGroup.children.length > 0) {
        const child = decalsGroup.children[0];
        disposeObject3D(child);
        decalsGroup.remove(child);
    }
    if (!steleMesh) return;
    const boundingBox = new THREE.Box3().setFromObject(steleMesh);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const frontZ = boundingBox.max.z + 0.015;
    const backZ = boundingBox.min.z - 0.015;
    if (state.fullName.trim() || state.dates.trim()) {
        let texture;
        if (state.frontTextureNeedsUpdate || !state.frontTextureCache) {
            texture = createFrontTexture();
            state.frontTextureCache = texture;
            state.frontTextureNeedsUpdate = false;
        } else {
            texture = state.frontTextureCache;
            texture.needsUpdate = true;
        }
        const textWidth = state.width * 0.85;
        const textHeight = state.height * 0.85;
        const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.set(0, center.y, frontZ - 0.014);
        textMesh.renderOrder = 9;
        decalsGroup.add(textMesh);
    }
    if (state.textureUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(state.textureUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            let w, h;
            if (state.photoShape === 'custom') {
                w = mmToMeters(state.photoWidthMm) || 0.2;
                h = mmToMeters(state.photoHeightMm) || 0.2;
            } else {
                const presetSizes = { 
                    'oval':   { w: 0.22, h: 0.28 }, 
                    'circle': { w: 0.24, h: 0.24 }, 
                    'square': { w: 0.22, h: 0.22 } 
                };
                const size = presetSizes[state.photoShape] || presetSizes.oval;
                w = size.w; h = size.h;
            }
            const scale = state.photoScale || 1.0;
            const finalW = w * scale;
            const finalH = h * scale;
            let geometry;
            if (state.photoShape === 'circle') {
                geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, isMobile ? 32 : 64);
            } else if (state.photoShape === 'oval') {
                geometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                geometry.scale(finalW, finalH, 1);
            } else {
                geometry = new THREE.PlaneGeometry(finalW, finalH);
            }
            const photoMat = new THREE.MeshBasicMaterial({ 
                map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
            });
            const photoMesh = new THREE.Mesh(geometry, photoMat);
            const photoX = state.photoOffsetX || 0; 
            const photoY = center.y + (state.photoOffsetY || 0); 
            photoMesh.position.set(photoX, photoY, frontZ - 0.013);
            photoMesh.renderOrder = 11;
            decalsGroup.add(photoMesh);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
            let frameGeometry;
            if (state.photoShape === 'circle') {
                frameGeometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2 + 0.008, isMobile ? 32 : 64);
            } else if (state.photoShape === 'oval') {
                frameGeometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                frameGeometry.scale(finalW + 0.015, finalH + 0.015, 1);
            } else {
                frameGeometry = new THREE.PlaneGeometry(finalW + 0.015, finalH + 0.015);
            }
            const frameMesh = new THREE.Mesh(frameGeometry, frameMat);
            frameMesh.position.set(photoX, photoY, frontZ - 0.014);
            frameMesh.renderOrder = 10;
            decalsGroup.add(frameMesh);
        });
    }
    if (state.engravingUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(state.engravingUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            const sizeM = 0.22 * (state.engravingScale || 1.0);
            const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
            const engravingMat = new THREE.MeshBasicMaterial({ 
                map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
            });
            const engravingMesh = new THREE.Mesh(geometry, engravingMat);
            const engravingX = state.engravingOffsetX || 0;
            const engravingY = center.y + (state.engravingOffsetY || 0) + 0.25;
            engravingMesh.position.set(engravingX, engravingY, frontZ - 0.014);
            engravingMesh.renderOrder = 10;
            decalsGroup.add(engravingMesh);
        });
    }
    if (state.epitaph.trim()) {
        let texture;
        if (state.backTextureNeedsUpdate || !state.backTextureCache) {
            texture = createBackTexture();
            state.backTextureCache = texture;
            state.backTextureNeedsUpdate = false;
        } else {
            texture = state.backTextureCache;
            texture.needsUpdate = true;
        }
        const textWidth = state.width * 0.85;
        const textHeight = state.height * 0.85;
        const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.set(0, center.y + 0.1, backZ + 0.014);
        textMesh.rotation.y = Math.PI;
        textMesh.renderOrder = 9;
        decalsGroup.add(textMesh);
    }
    if (state.engravingBackUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(state.engravingBackUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            const sizeM = 0.22 * (state.engravingBackScale || 1.0);
            const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
            const engravingMat = new THREE.MeshBasicMaterial({ 
                map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
            });
            const engravingMesh = new THREE.Mesh(geometry, engravingMat);
            const engravingX = state.engravingBackOffsetX || 0;
            const engravingY = center.y + (state.engravingBackOffsetY || 0);
            engravingMesh.position.set(engravingX, engravingY, backZ - 0.014);
            engravingMesh.rotation.y = Math.PI;
            engravingMesh.renderOrder = 10;
            decalsGroup.add(engravingMesh);
        });
    }
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        state.engravingsFront.forEach(eng => {
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const sizeM = 0.22 * (eng.scale || 1.0);
                const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                const material = new THREE.MeshBasicMaterial({ 
                    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(eng.x || 0, center.y + (eng.y || 0), frontZ - 0.014);
                mesh.renderOrder = 10;
                decalsGroup.add(mesh);
            });
        });
    }
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        state.engravingsBack.forEach(eng => {
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const sizeM = 0.22 * (eng.scale || 1.0);
                const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                const material = new THREE.MeshBasicMaterial({ 
                    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(eng.x || 0, center.y + (eng.y || 0), backZ + 0.014);
                mesh.rotation.y = Math.PI;
                mesh.renderOrder = 10;
                decalsGroup.add(mesh);
            });
        });
    }
}

function updateDecals() {
    while(decalsGroup.children.length > 0) { 
        const child = decalsGroup.children[0]; 
        disposeObject3D(child); 
        decalsGroup.remove(child); 
    }
    if (currentMode !== '3d' || !loadedSteleModel) return;
    frontDecalPosition.set(state.frontPosX, state.frontPosY, state.frontPosZ);
    backDecalPosition.set(state.backPosX, state.backPosY, state.backPosZ);
    if (state.modelFrontText.trim()) {
        const t = createTextDecal(state.modelFrontText, state.modelFrontFontSize, state.textColor, state.modelFontFamily);
        const d = createDecalMesh(t, state.frontDecalSize, state.frontDecalSize * 0.5);
        d.position.copy(frontDecalPosition);
        d.lookAt(new THREE.Vector3(frontDecalPosition.x, frontDecalPosition.y, frontDecalPosition.z - 1));
        decalsGroup.add(d);
    }
    const backText = `${state.modelBackName}\n${state.modelBackDates}`;
    if (backText.trim()) {
        const t = createTextDecal(backText, state.modelBackFontSize, state.textColor, state.modelFontFamily);
        const d = createDecalMesh(t, state.backDecalSize, state.backDecalSize * 0.5);
        d.position.copy(backDecalPosition);
        d.lookAt(new THREE.Vector3(backDecalPosition.x, backDecalPosition.y, backDecalPosition.z + 1));
        decalsGroup.add(d);
    }
    const pg = createPhotoDecal();
    if (pg) decalsGroup.add(pg);
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУР (С УМЕНЬШЕННЫМ РАЗМЕРОМ)
// ============================================================
function createFrontTexture() {
    const canvasSize = isMobile ? 512 : 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 4 : 8;
    const offsetX = state.textOffsetX * canvas.width;
    const offsetY = state.textOffsetY * canvas.height;
    let currentY = isMobile ? 40 : 80 + offsetY;
    if (state.fullName.trim()) {
        const safeFullName = sanitizeText(state.fullName);
        let fontFamily = state.fontFamily;
        if (fontFamily.includes('Yermak')) fontFamily = 'Yermak';
        if (fontFamily.includes('Bodega Script')) fontFamily = 'Bodega Script';
        if (fontFamily.includes('Brusher')) fontFamily = 'Brusher';
        if (fontFamily.includes('Drevnerusskij')) fontFamily = 'Drevnerusskij';
        if (fontFamily.includes('Drina')) fontFamily = 'Drina';
        if (fontFamily.includes('DS-BroadBrush')) fontFamily = 'DS-BroadBrush';
        if (fontFamily.includes('Federico')) fontFamily = 'Federico';
        if (fontFamily.includes('Feofan')) fontFamily = 'Feofan';
        if (fontFamily.includes('Figurny')) fontFamily = 'Figurny';
        if (fontFamily.includes('Pochaevsk')) fontFamily = 'Pochaevsk';
        if (fontFamily.includes('Remeslo')) fontFamily = 'Remeslo';
        if (fontFamily.includes('Tsarevich')) fontFamily = 'Tsarevich';
        const fontSize = state.nameFontSize * (isMobile ? 0.8 : 1.5);
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
            currentY += state.nameFontSize * (isMobile ? 0.9 : 1.8);
        });
        currentY += isMobile ? 12 : 25;
    }
    if (state.dates.trim()) {
        const safeDates = sanitizeText(state.dates);
        let fontFamily = state.fontFamily;
        if (fontFamily.includes('Yermak')) {
            fontFamily = 'Yermak';
        }
        const fontSize = state.datesFontSize * (isMobile ? 0.8 : 1.3);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.fillText(safeDates, canvas.width/2 + offsetX, currentY);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    state.frontTextureNeedsUpdate = false;
    return texture;
}

function createBackTexture() {
    const canvasSize = isMobile ? 512 : 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 3 : 6;
    const textAreaWidthM = state.width * 0.6;
    const textAreaHeightM = state.height * 0.6;
    const pxPerMeterX = canvas.width / textAreaWidthM;
    const pxPerMeterY = canvas.height / textAreaHeightM;
    const offsetXPx = state.epitaphOffsetX * pxPerMeterX;
    const offsetYPx = state.epitaphOffsetY * pxPerMeterY;
    let currentY = isMobile ? 40 : 80 + offsetYPx;
    if (state.epitaph.trim()) {
        const safeEpitaph = sanitizeText(state.epitaph);
        const lines = safeEpitaph.split(/\r?\n|\//);
        let fontFamily = state.fontFamily;
        if (fontFamily.includes('Yermak')) fontFamily = 'Yermak';
        if (fontFamily.includes('Bodega Script')) fontFamily = 'Bodega Script';
        if (fontFamily.includes('Brusher')) fontFamily = 'Brusher';
        if (fontFamily.includes('Drevnerusskij')) fontFamily = 'Drevnerusskij';
        if (fontFamily.includes('Drina')) fontFamily = 'Drina';
        if (fontFamily.includes('DS-BroadBrush')) fontFamily = 'DS-BroadBrush';
        if (fontFamily.includes('Federico')) fontFamily = 'Federico';
        if (fontFamily.includes('Feofan')) fontFamily = 'Feofan';
        if (fontFamily.includes('Figurny')) fontFamily = 'Figurny';
        if (fontFamily.includes('Pochaevsk')) fontFamily = 'Pochaevsk';
        if (fontFamily.includes('Remeslo')) fontFamily = 'Remeslo';
        if (fontFamily.includes('Tsarevich')) fontFamily = 'Tsarevich';
        const fontSize = state.epitaphFontSize * (isMobile ? 0.8 : 1.2);
        lines.forEach(line => {
            if (line.trim()) {
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.fillText(line.trim(), canvas.width/2 + offsetXPx, currentY);
                currentY += state.epitaphFontSize * (isMobile ? 0.9 : 1.5);
            }
        });
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    state.backTextureNeedsUpdate = false;
    return texture;
}

// ============================================================
// ⭐ ЗАГРУЗКА МОДЕЛЕЙ
// ============================================================
const gltfLoader = new GLTFLoader();
document.getElementById('loading-msg').style.display = 'block';

function loadFence3DModel() {
    gltfLoader.load('./11.glb', (gltf) => {
        fence3DModel = gltf.scene;
        console.log('✅ 3D модель оградки 11.glb загружена');
        fence3DModel.traverse((child) => { 
            if (child.isMesh) { 
                child.castShadow = !isMobile; 
                child.receiveShadow = !isMobile; 
            } 
        });
        updateFence3DMaterials();
        document.getElementById('loading-msg').style.display = 'none';
        throttledUpdate();
    }, undefined, (error) => { 
        console.error('Ошибка загрузки 3D модели:', error); 
        document.getElementById('loading-msg').style.display = 'none'; 
    });
}

function loadVenzelModel() {
    gltfLoader.load('./models/розетка2.glb', (gltf) => {
        venzelModel = gltf.scene;
        isVenzelLoaded = true;
        console.log('✅ Модель вензеля загружена');
        venzelModel.traverse((child) => { 
            if (child.isMesh) { 
                child.castShadow = !isMobile; 
                child.receiveShadow = !isMobile; 
            } 
        });
        throttledUpdate();
    }, undefined, (error) => { 
        console.error('Ошибка загрузки модели вензеля:', error); 
    });
}

function loadCastingModel() {
    gltfLoader.load('./fence_section.glb', (gltf) => {
        castingModel = gltf.scene;
        isCastingLoaded = true;
        console.log('✅ Модель литья fence_section.glb загружена');
        castingModel.traverse((child) => { 
            if (child.isMesh) { 
                child.castShadow = !isMobile; 
                child.receiveShadow = !isMobile; 
            } 
        });
        throttledUpdate();
    }, undefined, (error) => { 
        console.error('Ошибка загрузки fence_section.glb:', error); 
    });
}

function updateFence3DMaterials() {
    if (!fence3DModel) return;
    const material = fenceMaterials[state.fenceMaterial];
    fence3DModel.traverse((child) => {
        if (child.isMesh) {
            if (child.material) { 
                if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose()); 
                else child.material.dispose(); 
            }
            child.material = material.clone();
            child.castShadow = !isMobile;
            child.receiveShadow = !isMobile;
        }
    });
}

function loadSteleModel(file) {
    if (loadedSteleModel) { 
        disposeObject3D(loadedSteleModel); 
        monumentGroup.remove(loadedSteleModel); 
        loadedSteleModel = null; 
    }
    while(decalsGroup.children.length > 0) { 
        const child = decalsGroup.children[0]; 
        disposeObject3D(child); 
        decalsGroup.remove(child); 
    }
    const url = URL.createObjectURL(file);
    const loadingMsg = document.getElementById('loading-msg');
    loadingMsg.style.display = 'block'; 
    loadingMsg.innerText = 'Загрузка модели стелы...';
    gltfLoader.load(url, (gltf) => {
        loadedSteleModel = gltf.scene;
        if (state.modelMaterial !== 'original') {
            const matProps = stoneMaterials[state.modelMaterial];
            const newMaterial = new THREE.MeshStandardMaterial(matProps);
            loadedSteleModel.traverse((child) => { 
                if (child.isMesh) { 
                    if (child.material) child.material.dispose(); 
                    child.material = newMaterial.clone(); 
                    child.castShadow = !isMobile; 
                    child.receiveShadow = !isMobile; 
                } 
            });
        } else { 
            loadedSteleModel.traverse((child) => { 
                if (child.isMesh) { 
                    child.castShadow = !isMobile; 
                    child.receiveShadow = !isMobile; 
                } 
            }); 
        }
        updateSteleModelPosition(); 
        monumentGroup.add(loadedSteleModel); 
        updateDecals(); 
        throttledUpdate();
        loadingMsg.style.display = 'none'; 
        URL.revokeObjectURL(url);
    }, undefined, (error) => { 
        console.error(error); 
        loadingMsg.innerText = 'Ошибка загрузки модели!'; 
        setTimeout(() => loadingMsg.style.display = 'none', 3000); 
        URL.revokeObjectURL(url); 
    });
}

function updateSteleModelPosition() {
    if (!loadedSteleModel) return;
    const baseH = 0.2; 
    const baseL = state.flowerLength;
    const stelePosZ = -(baseL / 2 - state.depth / 2 - 0.05);
    loadedSteleModel.position.set(0, baseH + state.modelPosY, stelePosZ);
    loadedSteleModel.scale.set(state.modelScale, state.modelScale, state.modelScale);
}

// ============================================================
// ⭐ ЛОГИКА ЗАБОРА
// ============================================================
function placeSmallSection(position, direction, modelSource, is3DModel = false) {
    if (!modelSource) return;
    const clone = modelSource.clone();
    const material = fenceMaterials[state.fenceMaterial];
    clone.traverse((child) => {
        if (child.isMesh) {
            if (child.material) child.material.dispose();
            child.material = material.clone();
            child.castShadow = !isMobile;
        }
    });
    const scaleY = state.fenceHeight / 0.5; 
    clone.scale.set(1.0, scaleY, 1.0);
    clone.position.copy(position);
    clone.position.y = (state.fenceHeight / 2);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), 
        direction
    );
    clone.quaternion.copy(quaternion);
    if (is3DModel) {
        clone.rotateY(Math.PI / 2); 
    }
    monumentGroup.add(clone);
}

function createProfileBars(pStart, pEnd) {
    const material = fenceMaterials[state.fenceMaterial];
    const radius = 0.015;
    const topStart = new THREE.Vector3(pStart.x, state.fenceHeight - 0.05, pStart.z);
    const topEnd = new THREE.Vector3(pEnd.x, state.fenceHeight - 0.05, pEnd.z);
    createBar(topStart, topEnd, radius, material);
    const botStart = new THREE.Vector3(pStart.x, 0.05, pStart.z);
    const botEnd = new THREE.Vector3(pEnd.x, 0.05, pEnd.z);
    createBar(botStart, botEnd, radius, material);
}

function createBar(p1, p2, radius, material) {
    const dist = p1.distanceTo(p2);
    if (dist < 0.01) return;
    const geo = new THREE.CylinderGeometry(radius, radius, dist, isMobile ? 6 : 8);
    const mesh = new THREE.Mesh(geo, material);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.lookAt(p2);
    mesh.rotateX(Math.PI / 2);
    mesh.castShadow = !isMobile;
    monumentGroup.add(mesh);
}

function createChainSection(pStart, pEnd) {
    const linkGeo = new THREE.TorusGeometry(0.04, 0.008, isMobile ? 6 : 8, isMobile ? 12 : 16);
    const segmentDist = pStart.distanceTo(pEnd);
    const count = Math.floor(segmentDist / 0.08);
    const material = fenceMaterials[state.fenceMaterial];
    for(let k=0; k<count; k++) {
        const t = k / count;
        const sag = Math.sin(t * Math.PI) * 0.05;
        const lx = pStart.x + (pEnd.x - pStart.x) * t;
        const lz = pStart.z + (pEnd.z - pStart.z) * t;
        const ly = state.fenceHeight - 0.05 - sag;
        const link = new THREE.Mesh(linkGeo, material);
        link.position.set(lx, ly, lz);
        link.rotation.y = -Math.atan2(pEnd.z - pStart.z, pEnd.x - pStart.x);
        link.castShadow = !isMobile;
        monumentGroup.add(link);
    }
}

function createPipeSection(pStart, pEnd) {
    const material = fenceMaterials[state.fenceMaterial];
    const radius = 0.015;
    const topStart = new THREE.Vector3(pStart.x, state.fenceHeight - 0.08, pStart.z);
    const topEnd = new THREE.Vector3(pEnd.x, state.fenceHeight - 0.08, pEnd.z);
    createBar(topStart, topEnd, radius, material);
    const botStart = new THREE.Vector3(pStart.x, 0.12, pStart.z);
    const botEnd = new THREE.Vector3(pEnd.x, 0.12, pEnd.z);
    createBar(botStart, botEnd, radius, material);
}

function createSolidSide(pStart, pEnd, sideName) {
    const totalLength = pStart.distanceTo(pEnd);
    if (totalLength < 0.3) return;
    const direction = pEnd.clone().sub(pStart).normalize();
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08), fenceMaterials[state.fenceMaterial]);
    leftPost.position.copy(pStart);
    leftPost.position.y = state.fenceHeight / 2;
    leftPost.castShadow = !isMobile;
    monumentGroup.add(leftPost);
    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08), fenceMaterials[state.fenceMaterial]);
    rightPost.position.copy(pEnd);
    rightPost.position.y = state.fenceHeight / 2;
    rightPost.castShadow = !isMobile;
    monumentGroup.add(rightPost);
    if (state.fenceType === 'casting') {
        let numSections = Math.round(totalLength / 1.0); 
        if (numSections < 1) numSections = 1;
        const actualSectionWidth = totalLength / numSections;
        const heightScale = state.fenceHeight / 0.5; 
        for (let i = 0; i < numSections; i++) {
            const sectionStart = pStart.clone().add(direction.clone().multiplyScalar(i * actualSectionWidth));
            const sectionEnd = pStart.clone().add(direction.clone().multiplyScalar((i + 1) * actualSectionWidth));
            placeSectionModel(sectionStart, sectionEnd, heightScale, false);
        }
        return; 
    }
    let stepWidth = GLOBAL_SECTION_WIDTH; 
    let numSections = Math.floor(totalLength / stepWidth); 
    const remainder = totalLength - (numSections * stepWidth);
    if (remainder > (stepWidth * 0.3)) {
        numSections++;
    }
    if (numSections < 1) numSections = 1;
    const actualStep = totalLength / numSections;
    if (state.fenceType === 'venzel' || state.fenceType === 'model_3d') {
        createProfileBars(pStart, pEnd);
    }
    for (let i = 0; i < numSections; i++) {
        const centerPos = pStart.clone().add(direction.clone().multiplyScalar((i * actualStep) + (actualStep / 2)));
        if (state.fenceType === 'venzel') {
             placeSmallSection(centerPos, direction, venzelModel, false);
        } 
        else if (state.fenceType === 'model_3d') {
            placeSmallSection(centerPos, direction, fence3DModel, true);
        } 
        else if (state.fenceType === 'pipe') {
             createPipeSection(pStart, pEnd);
             break; 
        } 
        else if (state.fenceType === 'chain') {
             createChainSection(pStart, pEnd);
            break; 
        }
    }
}

function placeSectionModel(pStart, pEnd, heightScale, is3DModel = false) {
    let sourceModel;
    if (state.fenceType === 'casting') {
        sourceModel = castingModel;
    } else if (is3DModel) {
        sourceModel = fence3DModel;
    } else {
        sourceModel = loadedFenceModel;
    }
    if (!sourceModel) {
        console.warn("Модель для placeSectionModel не загружена!", state.fenceType);
        return;
    }
    const clone = sourceModel.clone();
    const material = fenceMaterials[state.fenceMaterial];
    clone.traverse((child) => {
        if (child.isMesh) {
            if (child.material) child.material.dispose();
            child.material = material.clone();
            child.castShadow = !isMobile;
            child.receiveShadow = !isMobile;
        }
    });
    const midPoint = pStart.clone().add(pEnd).multiplyScalar(0.5);
    const distance = pStart.distanceTo(pEnd);
    const modelBaseWidth = 1.0; 
    clone.scale.set(distance / modelBaseWidth, heightScale/1.5, 1.0);
    clone.position.copy(midPoint);
    clone.position.y = (state.fenceHeight / 4);
    const direction = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), 
        direction
    );
    clone.quaternion.copy(quaternion);
    if (is3DModel) {
        clone.rotateY(Math.PI / 2); 
    }
    monumentGroup.add(clone);
}

function createSideWithGate(pStart, pEnd, sideName) {
    const totalLength = pStart.distanceTo(pEnd);
    const gateWidth = parseFloat(state.gateWidth) || 0.8;
    if (gateWidth >= totalLength) {
        createSolidSide(pStart, pEnd, sideName);
        return;
    }
    const remainingLength = totalLength - gateWidth;
    const halfRemaining = remainingLength / 2;
    const direction = pEnd.clone().sub(pStart).normalize();
    const gateStartPoint = pStart.clone().add(direction.clone().multiplyScalar(halfRemaining));
    const gateEndPoint = gateStartPoint.clone().add(direction.clone().multiplyScalar(gateWidth));
    if (halfRemaining > 0.2) {
        createSolidSide(pStart, gateStartPoint, sideName + '_left');
    } else if (halfRemaining > 0.05) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, state.fenceHeight, 0.06), fenceMaterials[state.fenceMaterial]);
        post.position.copy(gateStartPoint);
        post.position.y = state.fenceHeight / 2;
        post.castShadow = !isMobile;
        monumentGroup.add(post);
    }
    if (halfRemaining > 0.2) {
        createSolidSide(gateEndPoint, pEnd, sideName + '_right');
    } else if (halfRemaining > 0.05) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, state.fenceHeight, 0.06), fenceMaterials[state.fenceMaterial]);
        post.position.copy(gateEndPoint);
        post.position.y = state.fenceHeight / 2;
        post.castShadow = !isMobile;
        monumentGroup.add(post);
    }
    const gatePostGeo = new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08);
    const gp1 = new THREE.Mesh(gatePostGeo, fenceMaterials[state.fenceMaterial]);
    gp1.position.copy(gateStartPoint);
    gp1.position.y = state.fenceHeight / 2;
    gp1.castShadow = !isMobile;
    monumentGroup.add(gp1);
    const gp2 = new THREE.Mesh(gatePostGeo, fenceMaterials[state.fenceMaterial]);
    gp2.position.copy(gateEndPoint);
    gp2.position.y = state.fenceHeight / 2;
    gp2.castShadow = !isMobile;
    monumentGroup.add(gp2);
}

function createFence(fW, fL, baseH) {
    if (state.fenceType === 'none' && state.fenceGateSide === 'none') return;
    const offset = state.fenceOffset;
    const halfW = (fW / 2) + offset;
    const halfL = (fL / 2) + offset;
    const corners = [
        new THREE.Vector3(-halfW, 0, -halfL),
        new THREE.Vector3(halfW, 0, -halfL),
        new THREE.Vector3(halfW, 0, halfL),
        new THREE.Vector3(-halfW, 0, halfL)
    ];
    const sides = [
        { start: corners[0], end: corners[1], name: 'front', idx: 0 },
        { start: corners[1], end: corners[2], name: 'right', idx: 1 },
        { start: corners[2], end: corners[3], name: 'back', idx: 2 },
        { start: corners[3], end: corners[0], name: 'left', idx: 3 }
    ];
    for (let s = 0; s < sides.length; s++) {
        const side = sides[s];
        let isGateSide = false;
        if (state.fenceGateSide === 'front' && s === 0) isGateSide = true;
        if (state.fenceGateSide === 'right' && s === 1) isGateSide = true;
        if (state.fenceGateSide === 'back' && s === 2) isGateSide = true;
        if (state.fenceGateSide === 'left' && s === 3) isGateSide = true;
        if (isGateSide && state.fenceGateSide !== 'none') {
            createSideWithGate(side.start, side.end, side.name);
        } else {
            createSolidSide(side.start, side.end, side.name);
        }
    }
}

// ============================================================
// ⭐ ФУНКЦИИ ПРИВЯЗКИ К РАЗМЕРУ ПЛИТКИ
// ============================================================
const TILE_SIZE = 0.3;

function snapToTile(value) {
    return Math.round(value / 0.3) * 0.3;
}

// ============================================================
// ⭐ ТЕКСТУРЫ (ОПТИМИЗИРОВАННЫЕ)
// ============================================================
async function createBottomTexture(materialType) {
    const texWidth = isMobile ? 256 : 512;
    const texHeight = isMobile ? 256 : 512;
    const canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext('2d');
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
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

async function createUnifiedTextureWithJoints(
    graveWidth,
    graveLength,
    height,
    materialType,
    flowerWidth,
    flowerLength
) {
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
    } catch(e) {}
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

async function createSideTexture(graveWidth, graveLength, height, materialType) {
    const texWidth = isMobile ? 1024 : 2048;
    const texHeight = isMobile ? 512 : 1024;
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
    } catch(e) {}
    if (baseImage) {
        const imgAspect = baseImage.width / baseImage.height;
        const canvasAspect = texWidth / texHeight;
        let drawWidth, drawHeight;
        let offsetX = 0, offsetY = 0;
        if (imgAspect > canvasAspect) {
            drawWidth = texWidth;
            drawHeight = texWidth / imgAspect;
            offsetY = (texHeight - drawHeight) / 2;
        } else {
            drawHeight = texHeight;
            drawWidth = texHeight * imgAspect;
            offsetX = (texWidth - drawWidth) / 2;
        }
        ctx.drawImage(baseImage, offsetX, offsetY, drawWidth, drawHeight);
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
// ⭐ ДОРОЖКА
// ============================================================
async function createPathBetweenGraveAndFence(graveWidth, graveLength, state) {
    if (!state.pathEnabled) return null;
    const pathWidth = state.pathWidth || 0.5;
    const outerHalfW = graveWidth / 2 + pathWidth;
    const outerHalfL = graveLength / 2 + pathWidth;
    const innerHalfW = graveWidth / 2;
    const innerHalfL = graveLength / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-outerHalfW, -outerHalfL);
    shape.lineTo(outerHalfW, -outerHalfL);
    shape.lineTo(outerHalfW, outerHalfL);
    shape.lineTo(-outerHalfW, outerHalfL);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-innerHalfW, -innerHalfL);
    hole.lineTo(innerHalfW, -innerHalfL);
    hole.lineTo(innerHalfW, innerHalfL);
    hole.lineTo(-innerHalfW, innerHalfL);
    hole.closePath();
    shape.holes.push(hole);
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
                uv.setXY(i, 
                    (x - minX) / rangeX,
                    (y - minY) / rangeY
                );
            }
            uv.needsUpdate = true;
        }
    }
    let material;
    const isTile = state.pathMaterial && state.pathMaterial.startsWith('tile_');
    if (isTile) {
        const texturePromise = createPavingTexture(
            state.pathTileSize || 0.3,
            state.pathMaterial,
            state.pathJointColor || '#666666'
        );
        const totalWidth = graveWidth + pathWidth * 2;
        const totalLength = graveLength + pathWidth * 2;
        const tileSize = state.pathTileSize || 0.3;
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
        if (['grass', 'gravel', 'marble_chips', 'sand', 'flowers'].includes(state.pathMaterial)) {
            texture = await loadFlowerbedTexture(state.pathMaterial);
        }
        material = new THREE.MeshStandardMaterial({
            map: texture || null,
            color: texture ? null : (fallbackColors[state.pathMaterial] || 0x888888),
            roughness: 0.7,
            metalness: 0.05,
            side: THREE.DoubleSide,
        });
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.001;
    mesh.receiveShadow = !isMobile;
    mesh.castShadow = false;
    return mesh;
}

// ============================================================
// ⭐ ТЕКСТУРА БРУСЧАТКИ (ОПТИМИЗИРОВАННАЯ)
// ============================================================
function createPavingTexture(tileSize, tileType, jointColor) {
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
        const intensity = isMobile ? 6 : 10;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
        }
        ctx.putImageData(imageData, Math.round(x), Math.round(y));
    } catch(e) {}
}

function addTileShadow(ctx, x, y, w, h) {
    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
    gradient.addColorStop(0.3, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    const gradient2 = ctx.createLinearGradient(x, y, x, y + h);
    gradient2.addColorStop(0, 'rgba(0,0,0,0.05)');
    gradient2.addColorStop(0.3, 'rgba(0,0,0,0)');
    gradient2.addColorStop(0.7, 'rgba(0,0,0,0)');
    gradient2.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = gradient2;
    ctx.fillRect(x, y, w, h);
}

async function createTileTexture(width, length, tileSize, tileColor, jointColor) {
    const texWidth = isMobile ? 1024 : 2048;
    const texHeight = isMobile ? 1024 : 2048;
    const canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = jointColor || '#444444';
    ctx.fillRect(0, 0, texWidth, texHeight);
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(length / tileSize);
    const scaleX = texWidth / width;
    const scaleY = texHeight / length;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = (col * tileSize + tileSize / 2 - width / 2) * scaleX + texWidth / 2;
            const y = (row * tileSize + tileSize / 2 - length / 2) * scaleY + texHeight / 2;
            const w = tileSize * scaleX - 3;
            const h = tileSize * scaleY - 3;
            ctx.fillStyle = tileColor || '#888888';
            ctx.fillRect(x - w/2, y - h/2, w, h);
            addStoneNoiseToTile(ctx, x - w/2, y - h/2, w, h);
        }
    }
    ctx.strokeStyle = jointColor || '#444444';
    ctx.lineWidth = 2;
    for (let col = 1; col < cols; col++) {
        const x = (col * tileSize - width / 2) * scaleX + texWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, texHeight);
        ctx.stroke();
    }
    for (let row = 1; row < rows; row++) {
        const y = (row * tileSize - length / 2) * scaleY + texHeight / 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(texWidth, y);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = !isMobile;
    return texture;
}

// ============================================================
// ⭐ ОБНОВЛЁННАЯ ФУНКЦИЯ updateScene()
// ============================================================
let sceneUpdateTimeout = null;
let isSceneUpdating = false;

async function updateScene() {
    // Предотвращаем множественные обновления
    if (isSceneUpdating) {
        return;
    }
    isSceneUpdating = true;
    
    try {
        const childrenToRemove = [];
        monumentGroup.children.forEach(child => {
            if (child !== loadedSteleModel && child !== decalsGroup && child !== furnitureGroup) {
                childrenToRemove.push(child);
            }
        });
        childrenToRemove.forEach(obj => {
            disposeObject3D(obj);
            monumentGroup.remove(obj);
        });

        let graveWidth = state.graveWidth;
        let graveLength = state.graveLength;
        const baseH = state.baseHeight;
        let flowerWidth = state.flowerEnabled ? state.flowerWidth : 0;
        let flowerLength = state.flowerEnabled ? state.flowerLength : 0;
        
        if (flowerWidth > graveWidth - 0.3) {
            flowerWidth = Math.max(0.3, graveWidth - 0.3);
            state.flowerWidth = flowerWidth;
            document.getElementById('flowerWidth').value = flowerWidth;
            document.getElementById('flowerWidthVal').textContent = flowerWidth.toFixed(2) + ' м';
        }
        if (flowerLength > graveLength - 0.3) {
            flowerLength = Math.max(0.3, graveLength - 0.3);
            state.flowerLength = flowerLength;
            document.getElementById('flowerLength').value = flowerLength;
            document.getElementById('flowerLengthVal').textContent = flowerLength.toFixed(2) + ' м';
        }
        
        const offsetX = (graveWidth - flowerWidth) / 2;
        const offsetZ = (graveLength - flowerLength) / 2;
        const offsetInfo = document.getElementById('offsetInfo');
        if (offsetInfo) {
            offsetInfo.textContent = 
                `${offsetX.toFixed(2)} м (по ширине) × ${offsetZ.toFixed(2)} м (по длине)`;
        }
        const graveArea = document.getElementById('graveArea');
        if (graveArea) {
            graveArea.textContent = (graveWidth * graveLength).toFixed(2);
        }
        const isTileSelected = state.flowerbedType && state.flowerbedType.startsWith('tile_');
        
        // 2. ОСНОВАНИЕ
        const baseGeo = new THREE.BoxGeometry(graveWidth, baseH, graveLength);
        const flowerW = state.flowerEnabled ? state.flowerWidth : 0;
        const flowerL = state.flowerEnabled ? state.flowerLength : 0;
        const baseTexture = await createUnifiedTextureWithJoints(
            graveWidth,
            graveLength,
            baseH,
            state.material,
            flowerW,
            flowerL
        );
        const baseMat = new THREE.MeshStandardMaterial({
            map: baseTexture,
            roughness: 0.6,
            metalness: 0.05,
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = baseH / 2;
        baseMesh.castShadow = !isMobile;
        baseMesh.receiveShadow = !isMobile;
        monumentGroup.add(baseMesh);
        
        // 3. ДОРОЖКА
        const pathMesh = await createPathBetweenGraveAndFence(graveWidth, graveLength, state);
        if (pathMesh) {
            monumentGroup.add(pathMesh);
        }
        
        // 4. ЦВЕТНИК
        if (state.flowerEnabled && flowerWidth > 0.05 && flowerLength > 0.05) {
            if (!isTileSelected) {
                const flowerBedGeo = new THREE.PlaneGeometry(flowerWidth, flowerLength);
                const flowerbedTexture = await loadFlowerbedTexture(state.flowerbedType);
                const flowerColor = state.flowerColor || '#4caf50';
                let flowerMat;
                if (flowerbedTexture) {
                    flowerMat = new THREE.MeshStandardMaterial({
                        map: flowerbedTexture,
                        roughness: 0.7,
                        metalness: 0.05
                    });
                } else {
                    const fallbackColors = {
                        grass: 0x4caf50,
                        gravel: 0x888888,
                        marble_chips: 0xf5f5f5,
                        red_gravel: 0xcd5c5c,
                        blue_gravel: 0x4682b4,
                        black_gravel: 0x333333,
                        sand: 0xf4e4a0,
                        flowers: 0x7cb342,
                        moss: 0x5d8c3e
                    };
                    flowerMat = new THREE.MeshStandardMaterial({ 
                        color: fallbackColors[state.flowerbedType] || flowerColor, 
                        roughness: 0.8 
                    });
                }
                const flowerBed = new THREE.Mesh(flowerBedGeo, flowerMat);
                flowerBed.rotation.x = -Math.PI / 2;
                flowerBed.position.set(0, baseH + 0.005, 0);
                flowerBed.receiveShadow = !isMobile;
                monumentGroup.add(flowerBed);
            } else {
                const manager = getTileManager();
                const materialColors = {
                    'granite': '#1a1a1a',
                    'black_galaxy': '#111111',
                    'ninimyaki': '#1a2a1a',
                    'marble': '#f5f5f5',
                    'red_granite': '#8b0000',
                    'beige_granite': '#d4b896',
                    'gray_granite': '#808080',
                };
                const tileColor = materialColors[state.material] || '#1a1a1a';
                const tileColors = {
                    'tile_gray': '#9e9e9e',
                    'tile_dark': '#424242',
                    'tile_light': '#d4d4d4',
                    'tile_marble': '#f5f5f0',
                    'tile_beige': '#d4c4a8',
                    'tile_red': '#8b1a1a',
                    'tile_black': '#1a1a1a',
                };
                const finalTileColor = tileColors[state.flowerbedType] || tileColor;
                const layout = document.getElementById('tileLayout')?.value || 'auto';
                const direction = document.getElementById('tileDirection')?.value || 'lengthwise';
                const fillCenter = document.getElementById('tileFillCenter')?.checked !== false;
                const gridInfo = manager.updateTileLayout(flowerWidth, flowerLength, {
                    tileColor: finalTileColor,
                    gapColor: '#444444',
                    layout: layout,
                    direction: direction,
                    fillCenter: fillCenter,
                    centerColor: '#4caf50',
                    centerType: 'grass',
                    perimeterOnly: true
                });
                manager.setPosition(0, baseH + 0.005, 0);
                updateTileInfo(flowerWidth, flowerLength);
            }
        }

        // 5. СТЕЛА
        let steleObj;
        if (state.steleType === 'rectangle') {
            steleObj = Rectangle.createMesh(state.width, state.height, state.depth, state.material);
            monumentGroup.add(steleObj);
            steleObj.position.y = baseH + (state.height / 2);
            steleObj.position.z = -(graveLength / 2 - state.depth / 2 - 0.05);
            while(decalsGroup.children.length > 0) {
                const child = decalsGroup.children[0];
                disposeObject3D(child);
                decalsGroup.remove(child);
            }
            const center = steleObj.position;
            const frontZ = center.z + state.depth / 2 + 0.015;
            const backZ = center.z - state.depth / 2 - 0.015;
            if (state.fullName.trim() || state.dates.trim()) {
                const texture = createFrontTexture();
                const textWidth = state.width + 0.2;
                const textHeight = state.height + 0.2;
                const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
                const textMat = new THREE.MeshBasicMaterial({ 
                    map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
                });
                const textMesh = new THREE.Mesh(textGeo, textMat);
                textMesh.position.set(0, center.y, frontZ - 0.015);
                textMesh.renderOrder = 9;
                decalsGroup.add(textMesh);
            }
            if (state.textureUrl) {
                const loader = new THREE.TextureLoader();
                loader.load(state.textureUrl, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    let w, h;
                    if (state.photoShape === 'custom') {
                        w = mmToMeters(state.photoWidthMm) || 0.2;
                        h = mmToMeters(state.photoHeightMm) || 0.2;
                    } else {
                        const presetSizes = { 
                            'oval':   { w: 0.22, h: 0.28 }, 
                            'circle': { w: 0.24, h: 0.24 }, 
                            'square': { w: 0.22, h: 0.22 } 
                        };
                        const size = presetSizes[state.photoShape] || presetSizes.oval;
                        w = size.w;
                        h = size.h;
                    }
                    const scale = state.photoScale || 1.0;
                    const finalW = w * scale;
                    const finalH = h * scale;
                    let geometry;
                    if (state.photoShape === 'circle') {
                        geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, isMobile ? 32 : 64);
                    } else if (state.photoShape === 'oval') {
                        geometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                        geometry.scale(finalW, finalH, 1);
                    } else {
                        geometry = new THREE.PlaneGeometry(finalW, finalH);
                    }
                    const photoMat = new THREE.MeshBasicMaterial({ 
                        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
                    });
                    const photoMesh = new THREE.Mesh(geometry, photoMat);
                    const photoX = state.photoOffsetX || 0; 
                    const photoY = center.y + (state.photoOffsetY || 0); 
                    photoMesh.position.set(photoX, photoY, frontZ - 0.013);
                    photoMesh.renderOrder = 11;
                    decalsGroup.add(photoMesh);
                    const frameMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
                    let frameGeometry;
                    if (state.photoShape === 'circle') {
                        frameGeometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2 + 0.008, isMobile ? 32 : 64);
                    } else if (state.photoShape === 'oval') {
                        frameGeometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                        frameGeometry.scale(finalW + 0.015, finalH + 0.015, 1);
                    } else {
                        frameGeometry = new THREE.PlaneGeometry(finalW + 0.015, finalH + 0.015);
                    }
                    const frameMesh = new THREE.Mesh(frameGeometry, frameMat);
                    frameMesh.position.set(photoX, photoY, frontZ - 0.014);
                    frameMesh.renderOrder = 10;
                    decalsGroup.add(frameMesh);
                });
            }
            if (state.engravingUrl) {
                const loader = new THREE.TextureLoader();
                loader.load(state.engravingUrl, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    const sizeM = 0.22 * (state.engravingScale || 1.0);
                    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                    const engravingMat = new THREE.MeshBasicMaterial({ 
                        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                    });
                    const engravingMesh = new THREE.Mesh(geometry, engravingMat);
                    const engravingX = state.engravingOffsetX || 0;
                    const engravingY = center.y + (state.engravingOffsetY || 0) + 0.3;
                    engravingMesh.position.set(engravingX, engravingY - 0.5, frontZ - 0.014);
                    engravingMesh.renderOrder = 10;
                    decalsGroup.add(engravingMesh);
                });
            }
            if (state.epitaph.trim()) {
                const texture = createBackTexture();
                const textWidth = state.width + 0.2;
                const textHeight = state.height + 0.2;
                const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
                const textMat = new THREE.MeshBasicMaterial({ 
                    map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
                });
                const textMesh = new THREE.Mesh(textGeo, textMat);
                textMesh.position.set(0, center.y, backZ + 0.014);
                textMesh.rotation.y = Math.PI;
                textMesh.renderOrder = 9;
                decalsGroup.add(textMesh);
            }
            if (state.engravingBackUrl) {
                const loader = new THREE.TextureLoader();
                loader.load(state.engravingBackUrl, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    const sizeM = 0.22 * (state.engravingBackScale || 1.0);
                    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                    const engravingMat = new THREE.MeshBasicMaterial({ 
                        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                    });
                    const engravingMesh = new THREE.Mesh(geometry, engravingMat);
                    const engravingX = state.engravingBackOffsetX || 0;
                    const engravingY = center.y + (state.engravingBackOffsetY || 0);
                    engravingMesh.position.set(engravingX, engravingY, backZ + 0.014);
                    engravingMesh.rotation.y = Math.PI;
                    engravingMesh.renderOrder = 10;
                    decalsGroup.add(engravingMesh);
                });
            }
            if (state.engravingsFront && state.engravingsFront.length > 0) {
                state.engravingsFront.forEach(eng => {
                    const loader = new THREE.TextureLoader();
                    loader.load(eng.url, (tex) => {
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        const sizeM = 0.22 * (eng.scale || 1.0);
                        const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                        const material = new THREE.MeshBasicMaterial({ 
                            map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.set(eng.x || 0, center.y + (eng.y || 0), frontZ - 0.014);
                        mesh.renderOrder = 10;
                        decalsGroup.add(mesh);
                    });
                });
            }
            if (state.engravingsBack && state.engravingsBack.length > 0) {
                state.engravingsBack.forEach(eng => {
                    const loader = new THREE.TextureLoader();
                    loader.load(eng.url, (tex) => {
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        const sizeM = 0.22 * (eng.scale || 1.0);
                        const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                        const material = new THREE.MeshBasicMaterial({ 
                            map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.set(eng.x || 0, center.y + (eng.y || 0), backZ + 0.014);
                        mesh.rotation.y = Math.PI;
                        mesh.renderOrder = 10;
                        decalsGroup.add(mesh);
                    });
                });
            }
        } else if (state.steleType && state.steleType.startsWith('custom_stl')) {
            steleObj = createCustomSteleMesh(
                state.steleType, 
                state.width, 
                state.height, 
                state.depth, 
                state.material
            );
            steleObj.position.y = baseH + (state.height / 2);
            steleObj.position.z = -(graveLength / 2 - state.depth / 2 - 0.05);
            monumentGroup.add(steleObj);
            (async () => {
                let loaded = false;
                let attempts = 0;
                const maxAttempts = isMobile ? 150 : 100;
                while (!loaded && attempts < maxAttempts) {
                    if (steleObj.userData && steleObj.userData.isLoaded) {
                        loaded = true;
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }
                if (loaded) {
                    console.log('✅ Модель загружена, размещаем декали');
                    while(decalsGroup.children.length > 0) {
                        const child = decalsGroup.children[0];
                        disposeObject3D(child);
                        decalsGroup.remove(child);
                    }
                    positionDecalsOnCustomStele(steleObj, decalsGroup, state);
                } else {
                    console.warn('⚠️ Модель не загрузилась за ' + (isMobile ? 7.5 : 5) + ' секунд');
                }
            })();
        } else {
            steleObj = createSteleMesh(state.steleType, state.width, state.height, state.depth);
            const materialType = getTextureTypeFromMaterial(state.material);
            const pbrMaterial = await loadPBRMaterial(materialType);
            steleObj.traverse((child) => {
                if (child.isMesh) {
                    if (pbrMaterial) {
                        child.material = pbrMaterial.clone();
                    } else {
                        child.material = new THREE.MeshStandardMaterial({ 
                            ...stoneMaterials[state.material], 
                            roughness: 0.3 
                        });
                    }
                    child.castShadow = !isMobile;
                    child.receiveShadow = !isMobile;
                }
            });
            monumentGroup.add(steleObj);
            steleObj.position.y = baseH + (state.height / 2);
            steleObj.position.z = -(graveLength / 2 - state.depth / 2 - 0.05);
            updateDecalsForCustomStele(steleObj);
        }

        // 6. ОГРАДКА
        createFence(graveWidth, graveLength, baseH);
        
        // 7. РАСЧЕТ СТОИМОСТИ
        calculatePrice();
        
    } catch (error) {
        console.error('❌ Ошибка обновления сцены:', error);
    } finally {
        isSceneUpdating = false;
    }
}

const throttledUpdate = throttle(() => { updateScene(); }, isMobile ? 200 : 100);

// ============================================================
// ⭐ ЗАГРУЗКА МОДЕЛЕЙ (ОТЛОЖЕННАЯ ДЛЯ МОБИЛЬНЫХ)
// ============================================================
if (isMobile) {
    setTimeout(() => {
        loadFence3DModel();
        loadVenzelModel();
        loadCastingModel();
    }, 3000);
} else {
    loadFence3DModel();
    loadVenzelModel();
    loadCastingModel();
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
const steleTypeSelect = document.getElementById('steleTypeSelect');
if (steleTypeSelect) {
    steleTypeSelect.addEventListener('change', (e) => {
        state.steleType = e.target.value;
        if (state.steleType.startsWith('custom_stl')) {
            const selectedOption = e.target.selectedOptions[0];
            if (selectedOption.dataset.defaultWidth) {
                state.width = parseFloat(selectedOption.dataset.defaultWidth);
                state.height = parseFloat(selectedOption.dataset.defaultHeight);
                state.depth = parseFloat(selectedOption.dataset.defaultDepth || 0.08);
                const widthRange = document.getElementById('widthRange');
                const heightRange = document.getElementById('heightRange');
                if (widthRange) widthRange.value = state.width;
                if (heightRange) heightRange.value = state.height;
                if (document.getElementById('widthVal')) document.getElementById('widthVal').textContent = state.width.toFixed(1) + ' м';
                if (document.getElementById('heightVal')) document.getElementById('heightVal').textContent = state.height.toFixed(1) + ' м';
            }
        }
        throttledUpdate();
    });
}

const widthRange = document.getElementById('widthRange');
const heightRange = document.getElementById('heightRange');
if (widthRange) widthRange.addEventListener('input', (e) => { 
    state.width = parseFloat(e.target.value); 
    document.getElementById('widthVal').textContent = state.width.toFixed(1) + ' м'; 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});
if (heightRange) heightRange.addEventListener('input', (e) => { 
    state.height = parseFloat(e.target.value); 
    document.getElementById('heightVal').textContent = state.height.toFixed(1) + ' м'; 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});

const textureUpload = document.getElementById('textureUpload');
if (textureUpload) textureUpload.addEventListener('change', (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = (evt) => { 
            state.textureUrl = evt.target.result; 
            state.modelPhotoUrl = evt.target.result; 
            textureCache.invalidateFront(); 
            throttledUpdate(); 
        }; 
        reader.readAsDataURL(file); 
    } 
});

const engravingSelect = document.getElementById('engravingSelect');
if (engravingSelect) {
    engravingSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        const selectedOption = e.target.selectedOptions[0];
        state.engravingType = selectedType;
        if (selectedType && engravingsConfig[selectedType]) {
            state.engravingUrl = engravingsConfig[selectedType].file;
            if (engravingsConfig[selectedType].defaultScale) {
                state.engravingScale = engravingsConfig[selectedType].defaultScale;
                const scaleInput = document.getElementById('engravingScale');
                if (scaleInput) scaleInput.value = state.engravingScale;
                const scaleVal = document.getElementById('engravingScaleVal');
                if (scaleVal) scaleVal.textContent = state.engravingScale.toFixed(1);
            }
            if (engravingsConfig[selectedType].defaultOffsetY) {
                state.engravingOffsetY = engravingsConfig[selectedType].defaultOffsetY;
                const offsetYInput = document.getElementById('engravingOffsetYRange');
                if (offsetYInput) offsetYInput.value = state.engravingOffsetY;
                const offsetYVal = document.getElementById('engravingOffsetYVal');
                if (offsetYVal) offsetYVal.textContent = state.engravingOffsetY.toFixed(2);
            }
        } else {
            state.engravingUrl = null;
        }
        throttledUpdate();
        showToast(selectedType ? `Выбрана гравировка: ${engravingsConfig[selectedType]?.name || selectedType}` : 'Гравировка отключена', 'success');
    });
}

const engravingScaleRange = document.getElementById('engravingScale');
if (engravingScaleRange) {
    engravingScaleRange.addEventListener('input', (e) => { 
        state.engravingScale = parseFloat(e.target.value); 
        document.getElementById('engravingScaleVal').textContent = state.engravingScale.toFixed(1);
        throttledUpdate(); 
    });
}

const engravingOffsetXRange = document.getElementById('engravingOffsetXRange');
if (engravingOffsetXRange) {
    engravingOffsetXRange.addEventListener('input', (e) => { 
        state.engravingOffsetX = parseFloat(e.target.value); 
        document.getElementById('engravingOffsetXVal').textContent = state.engravingOffsetX.toFixed(2);
        throttledUpdate(); 
    });
}

const engravingOffsetYRange = document.getElementById('engravingOffsetYRange');
if (engravingOffsetYRange) {
    engravingOffsetYRange.addEventListener('input', (e) => { 
        state.engravingOffsetY = parseFloat(e.target.value); 
        document.getElementById('engravingOffsetYVal').textContent = state.engravingOffsetY.toFixed(2);
        throttledUpdate(); 
    });
}

const fullNameInput = document.getElementById('fullName');
if (fullNameInput) fullNameInput.addEventListener('input', (e) => { 
    state.fullName = e.target.value; 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});
const datesTextInput = document.getElementById('datesText');
if (datesTextInput) datesTextInput.addEventListener('input', (e) => { 
    state.dates = e.target.value; 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});
const epitaphTextarea = document.getElementById('epitaphText');
if (epitaphTextarea) epitaphTextarea.addEventListener('input', (e) => { 
    state.epitaph = e.target.value; 
    textureCache.invalidateBack(); 
    throttledUpdate(); 
});
const textColorInput = document.getElementById('textColor');
if (textColorInput) textColorInput.addEventListener('input', (e) => { 
    state.textColor = e.target.value; 
    textureCache.invalidateFront(); 
    textureCache.invalidateBack(); 
    throttledUpdate(); 
});
const fontFamilySelect = document.getElementById('fontFamily');
if (fontFamilySelect) fontFamilySelect.addEventListener('change', (e) => { 
    state.fontFamily = e.target.value; 
    textureCache.invalidateFront(); 
    textureCache.invalidateBack(); 
    throttledUpdate(); 
});

const nameFontSizeRange = document.getElementById('nameFontSize');
if (nameFontSizeRange) {
    nameFontSizeRange.addEventListener('input', (e) => { 
        state.nameFontSize = parseInt(e.target.value); 
        const valDisplay = document.getElementById('nameFontSizeVal');
        if (valDisplay) valDisplay.textContent = state.nameFontSize; 
        markTexturesDirty();
    });
}

const datesFontSizeRange = document.getElementById('datesFontSize');
if (datesFontSizeRange) {
    datesFontSizeRange.addEventListener('input', (e) => { 
        state.datesFontSize = parseInt(e.target.value); 
        const valDisplay = document.getElementById('datesFontSizeVal');
        if (valDisplay) valDisplay.textContent = state.datesFontSize; 
        markTexturesDirty();
    });
}

const epitaphFontSizeRange = document.getElementById('epitaphFontSize');
if (epitaphFontSizeRange) {
    epitaphFontSizeRange.addEventListener('input', (e) => { 
        state.epitaphFontSize = parseInt(e.target.value); 
        const valDisplay = document.getElementById('epitaphFontSizeVal');
        if (valDisplay) valDisplay.textContent = state.epitaphFontSize; 
        markTexturesDirty();
    });
}

const photoWidthMmInput = document.getElementById('photoWidthMm');
const photoHeightMmInput = document.getElementById('photoHeightMm');
if (photoWidthMmInput) photoWidthMmInput.addEventListener('input', (e) => { 
    state.photoWidthMm = parseInt(e.target.value); 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});
if (photoHeightMmInput) photoHeightMmInput.addEventListener('input', (e) => { 
    state.photoHeightMm = parseInt(e.target.value); 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});
const photoScaleRange = document.getElementById('photoScale');
if (photoScaleRange) photoScaleRange.addEventListener('input', (e) => { 
    state.photoScale = parseFloat(e.target.value); 
    document.getElementById('photoScaleVal').textContent = state.photoScale.toFixed(1); 
    textureCache.invalidateFront(); 
    throttledUpdate(); 
});

document.getElementById('graveWidth')?.addEventListener('input', (e) => {
    const raw = parseFloat(e.target.value);
    const snapped = snapToTile(raw);
    state.graveWidth = Math.max(0.3, snapped);
    document.getElementById('graveWidthVal').textContent = state.graveWidth.toFixed(2) + ' м';
    resetTileManager();
    throttledUpdate();
});

document.getElementById('graveLength')?.addEventListener('input', (e) => {
    const raw = parseFloat(e.target.value);
    const snapped = snapToTile(raw);
    state.graveLength = Math.max(0.3, snapped);
    document.getElementById('graveLengthVal').textContent = state.graveLength.toFixed(2) + ' м';
    resetTileManager();
    throttledUpdate();
});

document.getElementById('baseHeight')?.addEventListener('input', (e) => {
    state.baseHeight = parseFloat(e.target.value);
    document.getElementById('baseHeightVal').textContent = state.baseHeight.toFixed(2) + ' м';
    throttledUpdate();
});

document.getElementById('flowerWidth')?.addEventListener('input', (e) => {
    const raw = parseFloat(e.target.value);
    const snapped = snapToTile(raw);
    state.flowerWidth = Math.max(0.3, snapped);
    document.getElementById('flowerWidthVal').textContent = state.flowerWidth.toFixed(2) + ' м';
    resetTileManager();
    throttledUpdate();
    updateLayoutPreview();
});

document.getElementById('flowerLength')?.addEventListener('input', (e) => {
    const raw = parseFloat(e.target.value);
    const snapped = snapToTile(raw);
    state.flowerLength = Math.max(0.3, snapped);
    document.getElementById('flowerLengthVal').textContent = state.flowerLength.toFixed(2) + ' м';
    resetTileManager();
    throttledUpdate();
    updateLayoutPreview();
});

document.getElementById('pathEnabled')?.addEventListener('change', (e) => {
    state.pathEnabled = e.target.checked;
    const controls = document.getElementById('pathControls');
    if (controls) {
        controls.style.display = state.pathEnabled ? 'block' : 'none';
    }
    throttledUpdate();
});

document.getElementById('pathWidth')?.addEventListener('input', (e) => {
    state.pathWidth = parseFloat(e.target.value);
    document.getElementById('pathWidthVal').textContent = state.pathWidth.toFixed(2) + ' м';
    throttledUpdate();
});

document.getElementById('pathMaterial')?.addEventListener('change', (e) => {
    state.pathMaterial = e.target.value;
    const isTile = e.target.value === 'tile';
    document.getElementById('pathTileColorGroup').style.display = isTile ? 'block' : 'none';
    document.getElementById('pathTileSizeGroup').style.display = isTile ? 'block' : 'none';
    throttledUpdate();
});

document.getElementById('pathColor')?.addEventListener('input', (e) => {
    state.pathColor = e.target.value;
    throttledUpdate();
});

document.getElementById('pathTileSize')?.addEventListener('input', (e) => {
    state.pathTileSize = parseFloat(e.target.value);
    document.getElementById('pathTileSizeVal').textContent = state.pathTileSize.toFixed(2) + ' м';
    throttledUpdate();
});

document.getElementById('showEnvironment')?.addEventListener('change', function(e) {
    showEnvironment = e.target.checked;
    toggleEnvironment(showEnvironment);
});

document.getElementById('flowerPosX')?.addEventListener('input', (e) => {
    state.flowerPosX = parseFloat(e.target.value);
    document.getElementById('flowerPosXVal').textContent = state.flowerPosX.toFixed(2) + ' м';
    throttledUpdate();
});

document.getElementById('flowerPosZ')?.addEventListener('input', (e) => {
    state.flowerPosZ = parseFloat(e.target.value);
    document.getElementById('flowerPosZVal').textContent = state.flowerPosZ.toFixed(2) + ' м';
    throttledUpdate();
});

document.getElementById('flowerCenterBtn')?.addEventListener('click', () => {
    state.flowerPosX = 0;
    state.flowerPosZ = 0;
    document.getElementById('flowerPosX').value = 0;
    document.getElementById('flowerPosZ').value = 0;
    document.getElementById('flowerPosXVal').textContent = '0.00 м';
    document.getElementById('flowerPosZVal').textContent = '0.00 м';
    throttledUpdate();
});

document.getElementById('flowerEnabled')?.addEventListener('change', (e) => {
    state.flowerEnabled = e.target.checked;
    const flowerControls = document.getElementById('flowerControls');
    if (flowerControls) {
        flowerControls.style.display = state.flowerEnabled ? 'block' : 'none';
    }
    resetTileManager();
    throttledUpdate();
});

document.getElementById('flowerbedType')?.addEventListener('change', (e) => {
    state.flowerbedType = e.target.value;
    const isTile = e.target.value.startsWith('tile_');
    const tileSettings = document.getElementById('tileSettings');
    if (tileSettings) {
        tileSettings.style.display = isTile ? 'block' : 'none';
    }
    throttledUpdate();
});

document.getElementById('flowerColor')?.addEventListener('input', (e) => {
    state.flowerColor = e.target.value;
    throttledUpdate();
});

document.querySelectorAll('.flower-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        document.getElementById('flowerColor').value = color;
        state.flowerColor = color;
        throttledUpdate();
    });
});

document.getElementById('tileDirection')?.addEventListener('change', () => {
    resetTileManager();
    throttledUpdate();
});

document.getElementById('tilePattern')?.addEventListener('change', () => {
    resetTileManager();
    throttledUpdate();
});

document.getElementById('tileFillCenter')?.addEventListener('change', () => {
    resetTileManager();
    throttledUpdate();
});

document.getElementById('tileCenterMaterial')?.addEventListener('change', () => {
    resetTileManager();
    throttledUpdate();
});

// ============================================================
// ⭐ УПРАВЛЕНИЕ МЕБЕЛЬЮ
// ============================================================
let furnitureVisible = true;
let furnitureScale = 1.0;
let isRotateMode = false;

document.getElementById('moveModeBtn')?.addEventListener('click', function() {
    isRotateMode = false;
    this.style.background = '#00a896';
    document.getElementById('rotateModeBtn').style.background = '#2c3e50';
    if (window.furniture3DManager) {
        window.furniture3DManager.rotateMode = false;
        window.furniture3DManager.moveMode = true;
    }
    showToast('✋ Режим: Перемещение', 'info');
});

document.getElementById('rotateModeBtn')?.addEventListener('click', function() {
    isRotateMode = true;
    this.style.background = '#e67e22';
    document.getElementById('moveModeBtn').style.background = '#2c3e50';
    if (window.furniture3DManager) {
        window.furniture3DManager.rotateMode = true;
        window.furniture3DManager.moveMode = false;
    }
    showToast('🔄 Режим: Поворот (тяни мышкой)', 'info');
});

document.getElementById('deleteSelectedBtn')?.addEventListener('click', function() {
    if (window.furniture3DManager) {
        if (window.furniture3DManager.deleteSelected()) {
            showToast('🗑️ Объект удалён', 'success');
        } else {
            showToast('❌ Сначала выбери объект', 'error');
        }
    }
});

document.getElementById('rotateLeftBtn')?.addEventListener('click', function() {
    if (window.furniture3DManager) {
        if (window.furniture3DManager.rotateSelected(-Math.PI / 12)) {
            showToast('↺ Поворот на -15°', 'info');
        } else {
            showToast('❌ Сначала выбери объект', 'error');
        }
    }
});

document.getElementById('rotateRightBtn')?.addEventListener('click', function() {
    if (window.furniture3DManager) {
        if (window.furniture3DManager.rotateSelected(Math.PI / 12)) {
            showToast('↻ Поворот на +15°', 'info');
        } else {
            showToast('❌ Сначала выбери объект', 'error');
        }
    }
});

document.getElementById('rotateResetBtn')?.addEventListener('click', function() {
    if (window.furniture3DManager) {
        const selected = window.furniture3DManager.getSelected();
        if (selected) {
            selected.group.rotation.y = 0;
            selected.rotation = 0;
            showToast('⟲ Сброс поворота', 'info');
        } else {
            showToast('❌ Сначала выбери объект', 'error');
        }
    }
});

document.getElementById('clearFurnitureBtn')?.addEventListener('click', function() {
    if (window.furniture3DManager) {
        window.furniture3DManager.clearAll();
        showToast('🗑️ Вся мебель убрана', 'success');
    }
});

document.getElementById('showFurniture')?.addEventListener('change', function(e) {
    furnitureVisible = e.target.checked;
    if (window.furniture3DManager) {
        window.furniture3DManager.setVisible(furnitureVisible);
    }
});

document.getElementById('snapToGrid')?.addEventListener('change', function(e) {
    if (window.furniture3DManager) {
        window.furniture3DManager.setSnapToGrid(e.target.checked, 0.1);
        showToast(e.target.checked ? '✅ Привязка к сетке включена' : '❌ Привязка к сетке выключена', 'success');
    }
});

document.getElementById('addTableBtn')?.addEventListener('click', async function() {
    const manager = initFurniture3D();
    const angle = Math.random() * Math.PI * 2;
    const distance = 1.5 + Math.random() * 1.0;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    this.textContent = '⏳...';
    this.disabled = true;
    try {
        await manager.placeTable(x, z, 0, furnitureScale);
        showToast('🪵 Стол добавлен! Выделен автоматически', 'success');
    } catch (error) {
        showToast('❌ Ошибка', 'error');
    } finally {
        this.textContent = '🪵 Стол';
        this.disabled = false;
    }
});

document.getElementById('addBenchBtn')?.addEventListener('click', async function() {
    const manager = initFurniture3D();
    const angle = Math.random() * Math.PI * 2;
    const distance = 1.5 + Math.random() * 1.0;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    this.textContent = '⏳...';
    this.disabled = true;
    try {
        await manager.placeBench(x, z, 0, furnitureScale);
        showToast('🪑 Скамейка добавлена! Выделена автоматически', 'success');
    } catch (error) {
        showToast('❌ Ошибка', 'error');
    } finally {
        this.textContent = '🪑 Скамейка';
        this.disabled = false;
    }
});

document.getElementById('addPicnicSetBtn')?.addEventListener('click', async function() {
    const manager = initFurniture3D();
    const angle = Math.random() * Math.PI * 2;
    const distance = 2.0 + Math.random() * 1.0;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    this.textContent = '⏳...';
    this.disabled = true;
    try {
        await manager.placePicnicSet(x, z, 0, furnitureScale);
        showToast('🧺 Набор добавлен! Стол выделен', 'success');
    } catch (error) {
        showToast('❌ Ошибка', 'error');
    } finally {
        this.textContent = '🧺 Набор';
        this.disabled = false;
    }
});

document.getElementById('furnitureScale')?.addEventListener('input', function(e) {
    furnitureScale = parseFloat(e.target.value);
    document.getElementById('furnitureScaleVal').textContent = furnitureScale.toFixed(2);
    calculatePrice();
    throttledUpdate();
});

// ============================================================
// ⭐ ОГРАДКА
// ============================================================
const fenceGateSideSelect = document.getElementById('fenceGateSide');
if (fenceGateSideSelect) fenceGateSideSelect.addEventListener('change', (e) => { 
    state.fenceGateSide = e.target.value; 
    throttledUpdate(); 
});
const gateWidthRange = document.getElementById('gateWidth');
if (gateWidthRange) gateWidthRange.addEventListener('input', (e) => { 
    state.gateWidth = parseFloat(e.target.value); 
    document.getElementById('gateWidthVal').textContent = state.gateWidth.toFixed(1) + ' м'; 
    throttledUpdate(); 
});
const fenceOffsetRange = document.getElementById('fenceOffset');
if (fenceOffsetRange) fenceOffsetRange.addEventListener('input', (e) => { 
    state.fenceOffset = parseFloat(e.target.value); 
    document.getElementById('fenceOffsetVal').textContent = state.fenceOffset.toFixed(2) + ' м'; 
    throttledUpdate(); 
});
const fenceHeightRange = document.getElementById('fenceHeight');
if (fenceHeightRange) fenceHeightRange.addEventListener('input', (e) => { 
    state.fenceHeight = parseFloat(e.target.value); 
    document.getElementById('fenceHeightVal').textContent = state.fenceHeight.toFixed(1) + ' м'; 
    throttledUpdate(); 
});
const fenceTypeSelect = document.getElementById('fenceType');
if (fenceTypeSelect) fenceTypeSelect.addEventListener('change', (e) => { 
    state.fenceType = e.target.value; 
    throttledUpdate(); 
});
const fenceMaterialSelect = document.getElementById('fenceMaterial');
if (fenceMaterialSelect) fenceMaterialSelect.addEventListener('change', (e) => { 
    state.fenceMaterial = e.target.value; 
    updateFence3DMaterials(); 
    throttledUpdate(); 
});

// ============================================================
// ⭐ КНОПКИ
// ============================================================
const resetViewBtn = document.getElementById('resetViewBtn');
if (resetViewBtn) resetViewBtn.addEventListener('click', () => { 
    camera.position.set(2.5, 2, 3.5); 
    controls.target.set(0, 0.5, 0); 
    controls.update(); 
});
const refreshPriceBtn = document.getElementById('refreshPriceBtn');
if (refreshPriceBtn) refreshPriceBtn.addEventListener('click', calculatePrice);

const showAdminBtn = document.getElementById('showAdminBtn');
const adminPanel = document.getElementById('adminPanel');
const toggleAdminBtn = document.getElementById('toggleAdminBtn');
if (showAdminBtn && adminPanel && toggleAdminBtn) {
    showAdminBtn.addEventListener('click', () => { 
        adminPanel.style.display = 'block'; 
        showAdminBtn.style.display = 'none'; 
    });
    toggleAdminBtn.addEventListener('click', () => { 
        adminPanel.style.display = 'none'; 
        showAdminBtn.style.display = 'block'; 
    });
}

function exportScreenshot() { 
    renderer.render(scene, camera); 
    const canvas = renderer.domElement; 
    const dataURL = canvas.toDataURL('image/png'); 
    const link = document.createElement('a'); 
    link.download = `monument_${Date.now()}.png`; 
    link.href = dataURL; 
    link.click(); 
    showToast('Скриншот сохранён!', 'success'); 
}

function showToast(message, type) { 
    let toast = document.getElementById('toast-notification'); 
    if (!toast) { 
        toast = document.createElement('div'); 
        toast.id = 'toast-notification'; 
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:8px;z-index:10000;font-size:14px;transition:opacity 0.3s;opacity:0;'; 
        document.body.appendChild(toast); 
    } 
    toast.style.backgroundColor = type === 'success' ? '#00a896' : '#333'; 
    toast.textContent = message; 
    toast.style.opacity = '1'; 
    setTimeout(() => { toast.style.opacity = '0'; }, 3000); 
}

const screenshotBtn = document.getElementById('screenshotBtn');
if (screenshotBtn) screenshotBtn.addEventListener('click', exportScreenshot);

// ============================================================
// ⭐ DEBOUNCE ДЛЯ ТЕКСТОВЫХ ПОЛЕЙ
// ============================================================
function debounceInput(callback, delay = 500) {
    let timeout = null;
    return function(...args) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            callback.apply(this, args);
        }, delay);
    };
}

document.querySelectorAll('input[type="text"], textarea').forEach(input => {
    const debouncedHandler = debounceInput(function(e) {
        const key = this.id;
        if (key === 'fullName') {
            state.fullName = this.value;
            textureCache.invalidateFront();
        } else if (key === 'datesText') {
            state.dates = this.value;
            textureCache.invalidateFront();
        } else if (key === 'epitaphText') {
            state.epitaph = this.value;
            textureCache.invalidateBack();
        }
        throttledUpdate();
    }, 500);
    input.addEventListener('input', debouncedHandler);
});

// ============================================================
// ⭐ ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ ДЕКАЛЕЙ НА КАСТОМНУЮ МОДЕЛЬ
// ============================================================
function addDecalsToCustomStele(center, frontZ, backZ, modelType = 'custom_stl') {
    if (!center || isNaN(center.y)) {
        console.warn('❌ Неверные координаты для декалей');
        return;
    }
    const config = decalConfigs[modelType] || decalConfigs['custom_stl'];
    const isHorizontal = config.orientation === 'horizontal';
    const steleCenterY = center.y;
    const steleCenterX = center.x || 0;
    const steleCenterZ = center.z || 0;
    const steleFrontZ = frontZ;
    const steleBackZ = backZ;
    const zOffset = config.zOffset || -0.005;
    if (state.fullName.trim() || state.dates.trim()) {
        let texture;
        if (state.frontTextureNeedsUpdate || !state.frontTextureCache) {
            texture = createFrontTexture();
            state.frontTextureCache = texture;
            state.frontTextureNeedsUpdate = false;
        } else {
            texture = state.frontTextureCache;
            texture.needsUpdate = true;
        }
        const textWidth = state.width * config.textScale;
        const textHeight = state.height * config.textScale;
        const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        if (isHorizontal) {
            textMesh.position.set(0, steleCenterY + 0.015, steleCenterZ);
            textMesh.rotation.x = -Math.PI / 2;
            textMesh.renderOrder = 9;
        } else {
            textMesh.position.set(0, steleCenterY + config.textOffsetY, steleFrontZ + zOffset);
            textMesh.rotation.x = 0;
            textMesh.renderOrder = 9;
        }
        decalsGroup.add(textMesh);
    }
    if (state.textureUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(state.textureUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            let w, h;
            if (state.photoShape === 'custom') {
                w = mmToMeters(state.photoWidthMm) || 0.2;
                h = mmToMeters(state.photoHeightMm) || 0.2;
            } else {
                const presetSizes = { 
                    'oval':   { w: 0.22, h: 0.28 }, 
                    'circle': { w: 0.24, h: 0.24 }, 
                    'square': { w: 0.22, h: 0.22 } 
                };
                const size = presetSizes[state.photoShape] || presetSizes.oval;
                w = size.w; h = size.h;
            }
            const scale = (state.photoScale || 1.0) * config.photoScale;
            const finalW = w * scale;
            const finalH = h * scale;
            let geometry;
            if (state.photoShape === 'circle') {
                geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, isMobile ? 32 : 64);
            } else if (state.photoShape === 'oval') {
                geometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                geometry.scale(finalW, finalH, 1);
            } else {
                geometry = new THREE.PlaneGeometry(finalW, finalH);
            }
            const photoMat = new THREE.MeshBasicMaterial({ 
                map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
            });
            const photoMesh = new THREE.Mesh(geometry, photoMat);
            const photoX = state.photoOffsetX || 0; 
            const photoY = steleCenterY + (state.photoOffsetY || 0) + config.photoOffsetY;
            if (isHorizontal) {
                photoMesh.position.set(photoX, steleCenterY + 0.015, steleCenterZ + 0.1);
                photoMesh.rotation.x = -Math.PI / 2;
                photoMesh.renderOrder = 11;
            } else {
                photoMesh.position.set(photoX, photoY, steleFrontZ + zOffset);
                photoMesh.rotation.x = 0;
                photoMesh.renderOrder = 11;
            }
            decalsGroup.add(photoMesh);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
            let frameGeometry;
            if (state.photoShape === 'circle') {
                frameGeometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2 + 0.008, isMobile ? 32 : 64);
            } else if (state.photoShape === 'oval') {
                frameGeometry = new THREE.CircleGeometry(0.5, isMobile ? 32 : 64);
                frameGeometry.scale(finalW + 0.015, finalH + 0.015, 1);
            } else {
                frameGeometry = new THREE.PlaneGeometry(finalW + 0.015, finalH + 0.015);
            }
            const frameMesh = new THREE.Mesh(frameGeometry, frameMat);
            if (isHorizontal) {
                frameMesh.position.set(photoX, steleCenterY + 0.016, steleCenterZ + 0.1);
                frameMesh.rotation.x = -Math.PI / 2;
                frameMesh.renderOrder = 10;
            } else {
                frameMesh.position.set(photoX, photoY, steleFrontZ + zOffset - 0.001);
                frameMesh.rotation.x = 0;
                frameMesh.renderOrder = 10;
            }
            decalsGroup.add(frameMesh);
        });
    }
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        state.engravingsFront.forEach(eng => {
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const sizeM = 0.22 * (eng.scale || 1.0) * config.engravingScale;
                const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                const material = new THREE.MeshBasicMaterial({ 
                    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                });
                const mesh = new THREE.Mesh(geometry, material);
                if (isHorizontal) {
                    mesh.position.set(eng.x || 0, steleCenterY + 0.015, steleCenterZ + (eng.y || 0));
                    mesh.rotation.x = -Math.PI / 2;
                } else {
                    mesh.position.set(eng.x || 0, steleCenterY + (eng.y || 0) + config.engravingOffsetY, steleFrontZ + zOffset);
                    mesh.rotation.x = 0;
                }
                mesh.renderOrder = 10;
                decalsGroup.add(mesh);
            });
        });
    }
    if (state.epitaph.trim()) {
        let texture;
        if (state.backTextureNeedsUpdate || !state.backTextureCache) {
            texture = createBackTexture();
            state.backTextureCache = texture;
            state.backTextureNeedsUpdate = false;
        } else {
            texture = state.backTextureCache;
            texture.needsUpdate = true;
        }
        const textWidth = state.width * config.textScale;
        const textHeight = state.height * config.textScale;
        const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        if (isHorizontal) {
            textMesh.position.set(0, steleCenterY + 0.015, steleCenterZ - 0.1);
            textMesh.rotation.x = -Math.PI / 2;
            textMesh.rotation.y = Math.PI;
            textMesh.renderOrder = 9;
        } else {
            textMesh.position.set(0, steleCenterY + config.epitaphOffsetY, steleBackZ + 0.005);
            textMesh.rotation.y = Math.PI;
            textMesh.rotation.x = 0;
            textMesh.renderOrder = 9;
        }
        decalsGroup.add(textMesh);
    }
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        state.engravingsBack.forEach(eng => {
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const sizeM = 0.22 * (eng.scale || 1.0) * config.engravingScale;
                const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                const material = new THREE.MeshBasicMaterial({ 
                    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05
                });
                const mesh = new THREE.Mesh(geometry, material);
                if (isHorizontal) {
                    mesh.position.set(eng.x || 0, steleCenterY + 0.015, steleCenterZ - 0.1 + (eng.y || 0));
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.rotation.y = Math.PI;
                } else {
                    mesh.position.set(eng.x || 0, steleCenterY + (eng.y || 0) + config.backEngravingOffsetY, steleBackZ + 0.005);
                    mesh.rotation.y = Math.PI;
                    mesh.rotation.x = 0;
                }
                mesh.renderOrder = 10;
                decalsGroup.add(mesh);
            });
        });
    }
}

// ============================================================
// ⭐ ЗАГРУЗКА ЦЕН
// ============================================================
let prices = {};

async function loadPrices() {
    try {
        console.log('📡 Запрос цен с сервера...');
        const response = await fetch('/api/prices');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            prices = data;
            console.log('✅ Цены загружены с сервера:', Object.keys(prices).length);
        } else {
            console.warn('⚠️ Сервер вернул пустые цены, используем локальные');
            setDefaultPrices();
        }
    } catch (error) {
        console.warn('⚠️ Ошибка загрузки цен с сервера:', error.message);
        console.log('📦 Используются локальные цены (фолбэк)');
        setDefaultPrices();
    }
    calculatePrice();
    updateAdminPrices();
}

function setDefaultPrices() {
    prices = {
        granite: 5000, black_galaxy: 5500, ninimyaki: 4500,
        marble: 8000, red_granite: 7000, beige_granite: 6500, gray_granite: 6000,
        base_granite: 4000, base_marble: 6000, base_red_granite: 5500, base_other: 3500,
        grass: 500, gravel: 800, marble_chips: 1500,
        red_gravel: 1200, blue_gravel: 1200, black_gravel: 1400,
        sand: 600, flowers: 1800, moss: 900,
        pipe: 800, chain: 600, casting: 2000, model_3d: 2500, venzel: 2200,
        stele_work: 5000, engraving: 1500, photo: 2000,
        delivery: 3000, install: 5000,
        table: 15000,
        bench: 12000,
        picnic_set: 25000
    };
    console.log('📦 Установлены локальные цены (дефолтные)');
}

function updateAdminPrices() {
    try {
        const adminFrame = document.getElementById('adminFrame');
        if (adminFrame && adminFrame.contentWindow) {
            adminFrame.contentWindow.postMessage({
                type: 'pricesUpdated',
                prices: prices
            }, '*');
        }
    } catch(e) {}
}

// ============================================================
// ⭐ РАСЧЕТ СТОИМОСТИ
// ============================================================
function calculatePrice() {
    const p = prices || {};
    let total = 0;
    let details = [];
    const steleArea = state.width * state.height;
    const materialPrice = p[state.material] || p.granite || 5000;
    const stelePrice = steleArea * materialPrice;
    total += stelePrice;
    details.push(`🪦 Памятник: ${steleArea.toFixed(2)} м² × ${materialPrice} ₽/м² = ${stelePrice.toFixed(0)} ₽`);
    const graveArea = state.graveWidth * state.graveLength;
    let baseKey = 'base_other';
    if (['granite', 'black_galaxy', 'ninimyaki'].includes(state.material)) baseKey = 'base_granite';
    else if (state.material === 'marble') baseKey = 'base_marble';
    else if (state.material === 'red_granite') baseKey = 'base_red_granite';
    const basePrice = p[baseKey] || 4000;
    const basePriceTotal = graveArea * basePrice;
    total += basePriceTotal;
    details.push(`🪨 Основание: ${graveArea.toFixed(2)} м² × ${basePrice} ₽/м² = ${basePriceTotal.toFixed(0)} ₽`);
    const workPrice = p.stele_work || 5000;
    total += workPrice;
    details.push(`🔧 Изготовление стелы: ${workPrice} ₽`);
    let engravingPriceTotal = 0;
    let engravingCount = 0;
    let engravingLines = [];
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        state.engravingsFront.forEach(eng => {
            const basePrice = p.engraving || 1500;
            const scale = eng.scale || 1.0;
            const price = basePrice * scale;
            engravingPriceTotal += price;
            engravingCount++;
            const name = engravingsConfig[eng.type]?.name || eng.type;
            engravingLines.push(`  • ${name} (перед) ×${scale.toFixed(1)} = ${price.toFixed(0)} ₽`);
        });
    }
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        state.engravingsBack.forEach(eng => {
            const basePrice = p.engraving || 1500;
            const scale = eng.scale || 1.0;
            const price = basePrice * scale;
            engravingPriceTotal += price;
            engravingCount++;
            const name = engravingsConfig[eng.type]?.name || eng.type;
            engravingLines.push(`  • ${name} (зад) ×${scale.toFixed(1)} = ${price.toFixed(0)} ₽`);
        });
    }
    if (engravingPriceTotal > 0) {
        total += engravingPriceTotal;
        details.push(`🎨 Гравировки (${engravingCount} шт):`);
        details.push(...engravingLines);
        details.push(`  Итого гравировки: ${engravingPriceTotal.toFixed(0)} ₽`);
    }
    let photoPrice = 0;
    if (state.textureUrl) {
        photoPrice = p.photo || 2000;
        total += photoPrice;
        details.push(`🖼️ Фото: ${photoPrice} ₽`);
    }
    let flowerTotal = 0;
    if (state.flowerEnabled) {
        const flowerArea = state.flowerWidth * state.flowerLength;
        const flowerPrice = p[state.flowerbedType] || 500;
        flowerTotal = flowerArea * flowerPrice;
        total += flowerTotal;
        details.push(`🌿 Цветник (${state.flowerbedType}): ${flowerArea.toFixed(2)} м² × ${flowerPrice} ₽/м² = ${flowerTotal.toFixed(0)} ₽`);
    }
    let fenceTotal = 0;
    let fenceLength = (state.graveWidth + state.graveLength) * 2;
    if (state.fenceGateSide !== 'none') fenceLength -= parseFloat(state.gateWidth || 0.8);
    const fencePrice = p[state.fenceType] || 0;
    if (fencePrice > 0 && state.fenceType !== 'none') {
        fenceTotal = fenceLength * fencePrice;
        total += fenceTotal;
        details.push(`🚧 Оградка (${state.fenceType}): ${fenceLength.toFixed(2)} м × ${fencePrice} ₽/м = ${fenceTotal.toFixed(0)} ₽`);
    }
    let tableCount = 0;
    let benchCount = 0;
    let picnicCount = 0;
    const furnitureScaleInput = document.getElementById('furnitureScale');
    const currentFurnitureScale = furnitureScaleInput ? parseFloat(furnitureScaleInput.value) : 1.0;
    if (window.furniture3DManager && window.furniture3DManager.furniture) {
        const furnitureList = window.furniture3DManager.furniture;
        for (let i = 0; i < furnitureList.length; i++) {
            const item = furnitureList[i];
            if (item.type === 'table') tableCount++;
            else if (item.type === 'bench') benchCount++;
            else if (item.type === 'picnic_set') picnicCount++;
        }
    }
    const tablePrice = (p.table || 15000) * currentFurnitureScale;
    const benchPrice = (p.bench || 12000) * currentFurnitureScale;
    const picnicPrice = (p.picnic_set || 25000) * currentFurnitureScale;
    if (tableCount > 0) {
        const tableTotal = tableCount * tablePrice;
        total += tableTotal;
        details.push(`🪵 Столы (${tableCount} шт × масштаб ${currentFurnitureScale.toFixed(1)}): ${tableCount} × ${tablePrice.toFixed(0)} ₽ = ${tableTotal.toFixed(0)} ₽`);
    }
    if (benchCount > 0) {
        const benchTotal = benchCount * benchPrice;
        total += benchTotal;
        details.push(`🪑 Скамейки (${benchCount} шт × масштаб ${currentFurnitureScale.toFixed(1)}): ${benchCount} × ${benchPrice.toFixed(0)} ₽ = ${benchTotal.toFixed(0)} ₽`);
    }
    if (picnicCount > 0) {
        const picnicTotal = picnicCount * picnicPrice;
        total += picnicTotal;
        details.push(`🧺 Наборы (${picnicCount} шт × масштаб ${currentFurnitureScale.toFixed(1)}): ${picnicCount} × ${picnicPrice.toFixed(0)} ₽ = ${picnicTotal.toFixed(0)} ₽`);
    }
    const includeDelivery = document.getElementById('includeDelivery')?.checked || false;
    const includeInstall = document.getElementById('includeInstall')?.checked || false;
    let deliveryPrice = 0;
    let installPrice = 0;
    if (includeDelivery) {
        deliveryPrice = p.delivery || 3000;
        total += deliveryPrice;
        details.push(`🚚 Доставка: ${deliveryPrice} ₽`);
    }
    if (includeInstall) {
        installPrice = p.install || 5000;
        total += installPrice;
        details.push(`🔧 Установка: ${installPrice} ₽`);
    }
    const totalDisplay = document.getElementById('totalPriceDisplay');
    if (totalDisplay) {
        totalDisplay.innerText = total.toLocaleString('ru-RU') + ' ₽';
    }
    return total;
}

// ============================================================
// ⭐ ЗАГРУЗКА ИЗ URL
// ============================================================
function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fn')) {
        state.fullName = sanitizeText(decodeURIComponent(params.get('fn')));
        const fullNameInput = document.getElementById('fullName');
        if (fullNameInput) fullNameInput.value = state.fullName;
    }
    if (params.get('d')) {
        state.dates = sanitizeText(decodeURIComponent(params.get('d')));
        const datesTextInput = document.getElementById('datesText');
        if (datesTextInput) datesTextInput.value = state.dates;
    }
    if (params.get('e')) {
        state.epitaph = sanitizeText(decodeURIComponent(params.get('e')));
        const epitaphTextarea = document.getElementById('epitaphText');
        if (epitaphTextarea) epitaphTextarea.value = state.epitaph;
    }
    if (params.get('c')) {
        const color = params.get('c');
        if (/^[0-9a-fA-F]{6}$/.test(color)) {
            state.textColor = '#' + color;
            const textColorInput = document.getElementById('textColor');
            if (textColorInput) textColorInput.value = state.textColor;
        } else {
            console.warn('⚠️ Невалидный цвет в URL:', color);
        }
    }
    if (params.get('w')) {
        const val = parseFloat(params.get('w'));
        if (!isNaN(val) && val > 0 && val < 10) {
            state.width = val;
            const widthRange = document.getElementById('widthRange');
            if (widthRange) widthRange.value = val;
            const widthVal = document.getElementById('widthVal');
            if (widthVal) widthVal.textContent = val.toFixed(1) + ' м';
        }
    }
    if (params.get('h')) {
        const val = parseFloat(params.get('h'));
        if (!isNaN(val) && val > 0 && val < 10) {
            state.height = val;
            const heightRange = document.getElementById('heightRange');
            if (heightRange) heightRange.value = val;
            const heightVal = document.getElementById('heightVal');
            if (heightVal) heightVal.textContent = val.toFixed(1) + ' м';
        }
    }
    if (params.get('m')) {
        const allowedMaterials = ['granite', 'black_galaxy', 'ninimyaki', 'marble', 'red_granite', 'beige_granite', 'gray_granite'];
        const material = params.get('m');
        if (allowedMaterials.includes(material)) {
            state.material = material;
            const materialSelect = document.getElementById('materialSelect');
            if (materialSelect) materialSelect.value = material;
        } else {
            console.warn('⚠️ Неизвестный материал в URL:', material);
        }
    }
    if (params.get('fw')) {
        const val = parseFloat(params.get('fw'));
        if (!isNaN(val) && val > 0 && val < 10) {
            state.flowerWidth = val;
            const flowerWidthRange = document.getElementById('flowerWidth');
            if (flowerWidthRange) flowerWidthRange.value = val;
            const flowerWidthVal = document.getElementById('flowerWidthVal');
            if (flowerWidthVal) flowerWidthVal.textContent = val.toFixed(2) + ' м';
        }
    }
    if (params.get('fl')) {
        const val = parseFloat(params.get('fl'));
        if (!isNaN(val) && val > 0 && val < 10) {
            state.flowerLength = val;
            const flowerLengthRange = document.getElementById('flowerLength');
            if (flowerLengthRange) flowerLengthRange.value = val;
            const flowerLengthVal = document.getElementById('flowerLengthVal');
            if (flowerLengthVal) flowerLengthVal.textContent = val.toFixed(2) + ' м';
        }
    }
    if (params.get('ft')) {
        const allowedFenceTypes = ['pipe', 'chain', 'casting', 'none', 'model_3d', 'venzel'];
        const fenceType = params.get('ft');
        if (allowedFenceTypes.includes(fenceType)) {
            state.fenceType = fenceType;
            const fenceTypeSelect = document.getElementById('fenceType');
            if (fenceTypeSelect) fenceTypeSelect.value = fenceType;
        } else {
            console.warn('⚠️ Неизвестный тип оградки в URL:', fenceType);
        }
    }
    if (params.get('fh')) {
        const val = parseFloat(params.get('fh'));
        if (!isNaN(val) && val > 0 && val < 5) {
            state.fenceHeight = val;
            const fenceHeightRange = document.getElementById('fenceHeight');
            if (fenceHeightRange) fenceHeightRange.value = val;
            const fenceHeightVal = document.getElementById('fenceHeightVal');
            if (fenceHeightVal) fenceHeightVal.textContent = val.toFixed(1) + ' м';
        }
    }
    if (params.get('ps')) {
        const allowedShapes = ['oval', 'circle', 'square', 'custom'];
        const shape = params.get('ps');
        if (allowedShapes.includes(shape)) {
            state.photoShape = shape;
            document.querySelectorAll('.shape-option').forEach(el => {
                el.classList.toggle('active', el.dataset.shape === shape);
            });
            const customSize = document.getElementById('customPhotoSize');
            if (customSize) customSize.style.display = shape === 'custom' ? 'block' : 'none';
        } else {
            console.warn('⚠️ Неизвестная форма фото в URL:', shape);
        }
    }
    if (params.get('fe')) {
        const val = params.get('fe').toLowerCase();
        if (val === 'true' || val === '1') {
            state.flowerEnabled = true;
            const flowerEnabled = document.getElementById('flowerEnabled');
            if (flowerEnabled) flowerEnabled.checked = true;
        } else if (val === 'false' || val === '0') {
            state.flowerEnabled = false;
            const flowerEnabled = document.getElementById('flowerEnabled');
            if (flowerEnabled) flowerEnabled.checked = false;
        }
    }
    textureCache.invalidateFront();
    textureCache.invalidateBack();
    throttledUpdate();
    console.log('✅ Настройки загружены из URL с санитизацией');
}

// ============================================================
// ⭐ ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
// ============================================================
let engravingsManager = null;
let photoManager = null;
let epitaphManager = null;

// Отложенная инициализация для мобильных
const initDelay = isMobile ? 1500 : 500;

setTimeout(() => {
    console.log('Инициализация модулей...');
    try {
        engravingsManager = new EngravingsManager(state, () => {
            textureCache.invalidateFront();
            textureCache.invalidateBack();
            throttledUpdate();
        });
        console.log('✅ EngravingsManager инициализирован');
    } catch (e) {
        console.error('❌ Ошибка инициализации EngravingsManager:', e);
    }
    try {
        photoManager = new PhotoManager(state, () => {
            textureCache.invalidateFront();
            throttledUpdate();
        });
        console.log('✅ PhotoManager инициализирован');
    } catch (e) {
        console.error('❌ Ошибка инициализации PhotoManager:', e);
    }
    const getSteleMesh = () => {
        let steleMesh = null;
        monumentGroup.children.forEach(child => {
            if (child !== decalsGroup && child.geometry && (child.geometry.type === 'BoxGeometry' || child.type === 'Group')) {
                steleMesh = child;
            }
        });
        return steleMesh;
    };
    try {
        epitaphManager = new EpitaphManager(
            state, 
            () => {
                textureCache.invalidateBack();
                throttledUpdate();
            },
            renderer,
            camera,
            monumentGroup,
            getSteleMesh
        );
        console.log('✅ EpitaphManager инициализирован');
    } catch (e) {
        console.error('❌ Ошибка инициализации EpitaphManager:', e);
    }
    loadPrices();
    loadFromURL();
    calculatePrice();
    console.log("3D Конструктор загружен! ✅ Наборная решетка для всех типов.");
}, initDelay);

const enableMovePhoto = document.getElementById('enableMovePhoto');
if (enableMovePhoto) {
    enableMovePhoto.addEventListener('change', (e) => {
        state.enableMoveMode = e.target.checked;
        if (state.enableMoveMode) {
            state.enableMoveEngraving = false;
            state.enableMoveEpitaph = false;
            const engravingCheck = document.getElementById('enableMoveEngravingGlobal');
            if (engravingCheck) engravingCheck.checked = false;
            const epitaphCheck = document.getElementById('enableMoveEpitaph');
            if (epitaphCheck) epitaphCheck.checked = false;
        }
        const canvas = document.getElementById('canvas-container');
        if (canvas) canvas.style.cursor = state.enableMoveMode ? 'grab' : 'default';
        if (typeof controls !== 'undefined') {
            controls.enabled = !state.enableMoveMode;
        }
    });
}

// ============================================================
// ⭐ ЛОГИКА КНОПОК СДВИГА
// ============================================================
function markTexturesDirty() {
    if (typeof textureCache !== 'undefined') {
        textureCache.invalidateFront();
        textureCache.invalidateBack();
    }
    state.frontTextureNeedsUpdate = true;
    state.backTextureNeedsUpdate = true;
    throttledUpdate();
}

function updateTextOffsetDisplay() {
    const xVal = document.getElementById('textOffsetXVal');
    const yVal = document.getElementById('textOffsetYVal');
    if (xVal) xVal.textContent = state.textOffsetX.toFixed(2);
    if (yVal) yVal.textContent = state.textOffsetY.toFixed(2);
}

const step = 0.02;
document.getElementById('btnTextUp')?.addEventListener('click', () => {
    state.textOffsetY -= step;
    updateTextOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnTextDown')?.addEventListener('click', () => {
    state.textOffsetY += step;
    updateTextOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnTextLeft')?.addEventListener('click', () => {
    state.textOffsetX -= step;
    updateTextOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnTextRight')?.addEventListener('click', () => {
    state.textOffsetX += step;
    updateTextOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnTextReset')?.addEventListener('click', () => {
    state.textOffsetX = 0;
    state.textOffsetY = 0;
    updateTextOffsetDisplay();
    markTexturesDirty();
});

const stepEpitaph = 0.02;
function updateEpitaphOffsetDisplay() {
    const xVal = document.getElementById('epitaphOffsetXVal');
    const yVal = document.getElementById('epitaphOffsetYVal');
    if (xVal) xVal.textContent = state.epitaphOffsetX.toFixed(2);
    if (yVal) yVal.textContent = state.epitaphOffsetY.toFixed(2);
}
document.getElementById('btnEpitaphUp')?.addEventListener('click', () => {
    state.epitaphOffsetY -= stepEpitaph;
    updateEpitaphOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnEpitaphDown')?.addEventListener('click', () => {
    state.epitaphOffsetY += stepEpitaph;
    updateEpitaphOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnEpitaphLeft')?.addEventListener('click', () => {
    state.epitaphOffsetX -= stepEpitaph;
    updateEpitaphOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnEpitaphRight')?.addEventListener('click', () => {
    state.epitaphOffsetX += stepEpitaph;
    updateEpitaphOffsetDisplay();
    markTexturesDirty();
});
document.getElementById('btnEpitaphReset')?.addEventListener('click', () => {
    state.epitaphOffsetX = 0;
    state.epitaphOffsetY = 0;
    updateEpitaphOffsetDisplay();
    markTexturesDirty();
});

updateTextOffsetDisplay();

// ============================================================
// ⭐ ЛОГИКА ПЕРЕМЕЩЕНИЯ ГРАВИРОВОК (RAYCASTER)
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let draggedEngraving = null;

window.addEventListener('mousedown', (event) => {
    if (!state.enableMoveEngraving) return;
    if (event.target.tagName !== 'CANVAS') return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(decalsGroup.children, true);
    if (intersects.length > 0) {
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while(obj.parent && obj.parent !== decalsGroup) {
                if (obj.userData.isEngraving) break;
                obj = obj.parent;
            }
            if (obj.userData.isEngraving) {
                draggedEngraving = obj;
                controls.enabled = false;
                document.body.style.cursor = 'grabbing';
                const engData = state.engravings.find(e => e.id === obj.userData.id);
                if (engData) {
                    const planePoint = intersects[i].point;
                    draggedEngraving.userData.offsetX = planePoint.x - obj.position.x;
                    draggedEngraving.userData.offsetY = planePoint.y - obj.position.y;
                }
                break;
            }
        }
    }
});

window.addEventListener('mousemove', (event) => {
    if (!draggedEngraving) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const steleZ = draggedEngraving.position.z;
    const planeGeo = new THREE.PlaneGeometry(10, 10);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    const tempPlane = new THREE.Mesh(planeGeo, planeMat);
    tempPlane.position.z = steleZ;
    scene.add(tempPlane);
    const intersects = raycaster.intersectObject(tempPlane);
    scene.remove(tempPlane);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        draggedEngraving.position.x = point.x - draggedEngraving.userData.offsetX;
        draggedEngraving.position.y = point.y - draggedEngraving.userData.offsetY;
        const engData = state.engravings.find(e => e.id === draggedEngraving.userData.id);
        if (engData) {
            const steleCenterY = monumentGroup.children.find(c => c.geometry && c.geometry.type === 'BoxGeometry')?.position.y || 0.8;
            engData.x = draggedEngraving.position.x;
            engData.y = draggedEngraving.position.y - steleCenterY;
        }
    }
});

window.addEventListener('mouseup', () => {
    if (draggedEngraving) {
        draggedEngraving = null;
        controls.enabled = true;
        document.body.style.cursor = 'default';
        throttledUpdate();
    }
});

// ============================================================
// ⭐ 3D ГРАВИРОВКА
// ============================================================
let current3DEngraving = null;
let engravingSide = 'front';

function add3DEngraving(imageUrl, width = 0.25, height = 0.35) {
    if (current3DEngraving) {
        monumentGroup.remove(current3DEngraving);
        if (current3DEngraving.geometry) current3DEngraving.geometry.dispose();
        if (current3DEngraving.material) current3DEngraving.material.dispose();
    }
    const texture = new THREE.TextureLoader().load(imageUrl);
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        emissive: 0x222222,
        roughness: 0.3,
        metalness: 0.1
    });
    current3DEngraving = new THREE.Mesh(geometry, material);
    current3DEngraving.userData = { is3DEngraving: true };
    updateEngravingPosition(0, 0);
    monumentGroup.add(current3DEngraving);
    console.log('✅ 3D гравировка добавлена');
}

function updateEngravingPosition(x, y) {
    if (!current3DEngraving) return;
    let steleY = 0.8;
    let steleZ = 0;
    monumentGroup.children.forEach(child => {
        if (child.isMesh && child.geometry && (child.geometry.type === 'BoxGeometry' || child.type === 'Group')) {
            steleY = child.position.y;
            steleZ = child.position.z;
        }
    });
    const depth = state.depth || 0.1;
    let zOffset;
    if (engravingSide === 'front') {
        zOffset = (depth + 0.55) + 0.001;
    } else {
        zOffset = -(depth - 0.65) - 0.001;
    }
    current3DEngraving.position.set(x, steleY + y, steleZ + zOffset);
    if (!state.engraving3DPos) state.engraving3DPos = {};
    state.engraving3DPos = { x, y, side: engravingSide, z: zOffset };
}

function setEngravingSize(size) {
    if (!current3DEngraving) return;
    current3DEngraving.scale.set(size, size, 1);
    state.engraving3DSize = size;
}

function toggleEngravingSide() {
    engravingSide = engravingSide === 'front' ? 'back' : 'front';
    if (current3DEngraving && state.engraving3DPos) {
        updateEngravingPosition(state.engraving3DPos.x, state.engraving3DPos.y);
    }
    updateEngravingSideButton();
}

function updateEngravingSideButton() {
    const btn = document.getElementById('engravingSideToggle');
    if (btn) {
        btn.textContent = engravingSide === 'front' ? '📷 Передняя' : '🔙 Задняя';
        btn.style.background = engravingSide === 'front' ? '#00a896' : '#e74c3c';
    }
}

function createEngravingControls() {
    const container = document.getElementById('multiEngravingPanelContainer');
    if (!container) return;
    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'engraving3DControls';
    controlsPanel.style.cssText = `
        background: linear-gradient(145deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98));
        border-radius: 16px;
        padding: 20px;
        margin-top: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
    `;
    controlsPanel.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span>🎨</span>
                <span>3D Гравировка</span>
            </h3>
            <div id="engravingButtonsContainer" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;"></div>
        </div>
        <div id="multiEngravingList" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 8px;">
            <div style="color: #aaa; text-align: center; padding: 20px;">Нет добавленных гравировок</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
            <div style="color: #fff; font-size: 14px; margin-bottom: 10px; font-weight: 500;">Позиционирование</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 180px; margin: 0 auto 15px;">
                <div></div>
                <button class="engraving-move" data-dir="up" style="padding: 12px 8px; background: linear-gradient(145deg, #2a2a2a, #1a1a1a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; font-size: 16px;">⬆️</button>
                <div></div>
                <button class="engraving-move" data-dir="left" style="padding: 12px 8px; background: linear-gradient(145deg, #2a2a2a, #1a1a1a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; font-size: 16px;">⬅️</button>
                <button class="engraving-move" data-dir="reset" style="padding: 12px 8px; background: linear-gradient(145deg, #e74c3c, #c0392b); border: none; border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; font-size: 14px;">⟲</button>
                <button class="engraving-move" data-dir="right" style="padding: 12px 8px; background: linear-gradient(145deg, #2a2a2a, #1a1a1a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; font-size: 16px;">➡️</button>
                <div></div>
                <button class="engraving-move" data-dir="down" style="padding: 12px 8px; background: linear-gradient(145deg, #2a2a2a, #1a1a1a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; font-size: 16px;">⬇️</button>
                <div></div>
            </div>
            <div style="display: flex; justify-content: space-between; color: #aaa; font-size: 12px; font-family: monospace;">
                <span>X: <span id="engravingPosX" style="color: #00a896;">0.00</span> м</span>
                <span>Y: <span id="engravingPosY" style="color: #00a896;">0.00</span> м</span>
            </div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
            <div style="color: #fff; font-size: 14px; margin-bottom: 10px; font-weight: 500;">Настройки</div>
            <div style="margin-bottom: 12px;">
                <label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 5px;">Масштаб: <span id="engravingSizeVal" style="color: #00a896; font-weight: bold;">1.0</span>x</label>
                <input type="range" id="engravingSizeRange" min="0.3" max="2.0" step="0.05" value="1.0" style="width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, #00a896, #00d4aa); outline: none; -webkit-appearance: none;">
            </div>
            <button id="engravingSideToggle" style="width: 100%; padding: 10px; background: linear-gradient(145deg, #00a896, #008f7a); border: none; border-radius: 8px; color: white; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;">📍 Передняя сторона</button>
        </div>
        <button id="remove3DEngraving" style="width: 100%; padding: 12px; background: linear-gradient(145deg, #e74c3c, #c0392b); border: none; border-radius: 8px; color: white; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;">🗑️ Удалить гравировку</button>
    `;
    container.appendChild(controlsPanel);
    document.querySelectorAll('.engraving-move').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            if (btn.dataset.dir !== 'reset') {
                btn.style.background = 'linear-gradient(145deg, #3a3a3a, #2a2a2a)';
                btn.style.transform = 'scale(1.05)';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.dataset.dir !== 'reset') {
                btn.style.background = 'linear-gradient(145deg, #2a2a2a, #1a1a1a)';
                btn.style.transform = 'scale(1)';
            }
        });
    });
    let posX = 0, posY = 0;
    document.querySelectorAll('.engraving-move').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!current3DEngraving) {
                showToast('Сначала добавьте гравировку', 'error');
                return;
            }
            const dir = btn.dataset.dir;
            switch(dir) {
                case 'up': posY += step; break;
                case 'down': posY -= step; break;
                case 'left': posX -= step; break;
                case 'right': posX += step; break;
                case 'reset': posX = 0; posY = 0; break;
            }
            posX = Math.max(-0.35, Math.min(0.35, posX));
            posY = Math.max(-0.6, Math.min(0.6, posY));
            updateEngravingPosition(posX, posY);
            updateEngravingPosDisplay(posX, posY);
        });
    });
    const sizeRange = document.getElementById('engravingSizeRange');
    const sizeVal = document.getElementById('engravingSizeVal');
    if (sizeRange) {
        sizeRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            sizeVal.textContent = val.toFixed(1);
            setEngravingSize(val);
        });
    }
    const sideToggle = document.getElementById('engravingSideToggle');
    if (sideToggle) {
        sideToggle.addEventListener('click', () => {
            toggleEngravingSide();
        });
    }
    const removeBtn = document.getElementById('remove3DEngraving');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (current3DEngraving) {
                monumentGroup.remove(current3DEngraving);
                if (current3DEngraving.geometry) current3DEngraving.geometry.dispose();
                if (current3DEngraving.material) current3DEngraving.material.dispose();
                current3DEngraving = null;
                showToast('Гравировка удалена', 'success');
            } else {
                showToast('Нет активной гравировки', 'error');
            }
        });
    }
}

function updateEngravingPosDisplay(x, y) {
    const xSpan = document.getElementById('engravingPosX');
    const ySpan = document.getElementById('engravingPosY');
    if (xSpan) xSpan.textContent = x.toFixed(2);
    if (ySpan) ySpan.textContent = y.toFixed(2);
}

function addEngravingFromPNG() {
    add3DEngraving('./krest2.png', 0.28, 0.38);
}

setTimeout(() => {
    createEngravingControls();
    const buttonsContainer = document.getElementById('engravingButtonsContainer');
    if (buttonsContainer) {
        const testBtn = document.createElement('button');
        testBtn.textContent = '➕ Добавить 3D крест';
        testBtn.style.cssText = 'background: #00a896; width: auto; border-radius: 8px; border: none; padding: 6px 12px;';
        testBtn.onclick = () => addEngravingFromPNG();
        buttonsContainer.appendChild(testBtn);
    }
}, isMobile ? 1000 : 600);

// ============================================================
// ⭐ ИНИЦИАЛИЗАЦИЯ СПИСКА МОДЕЛЕЙ
// ============================================================
async function initModelList() {
    await loadModelList();
    const models = getModelList();
    const select = document.getElementById('steleTypeSelect');
    const optgroups = select.querySelectorAll('optgroup');
    let modelGroup = null;
    for (const group of optgroups) {
        if (group.label.includes('3D Модели')) {
            modelGroup = group;
            break;
        }
    }
    if (modelGroup) {
        modelGroup.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `🗿 ${model.name}`;
            option.dataset.defaultWidth = customModels[model.id].defaultWidth;
            option.dataset.defaultHeight = customModels[model.id].defaultHeight;
            option.dataset.defaultDepth = customModels[model.id].defaultDepth;
            modelGroup.appendChild(option);
        });
    }
    console.log(`✅ Загружено ${models.length} моделей в интерфейс`);
}

initModelList();
window.monumentGroup = monumentGroup;

const materialSelect = document.getElementById('materialSelect');
if (materialSelect) {
    materialSelect.addEventListener('change', (e) => {
        state.material = e.target.value;
        textureCache.invalidateFront();
        textureCache.invalidateBack();
        updateCurrentCustomSteleMaterial(state.material);
        resetTileManager();
        throttledUpdate();
    });
}

// ============================================================
// ⭐ ПРЕДПРОСМОТР РАСКЛАДКИ
// ============================================================
function updateLayoutPreview() {
    const preview = document.getElementById('layoutPreview');
    const layout = document.getElementById('tileLayout')?.value || 'auto';
    if (!preview) return;
    const layouts = {
        'auto': '🤖 Автоматический подбор',
        'vertical': '📐 Все вертикальные (300×600)',
        'horizontal': '📐 Все горизонтальные (600×300)',
        'mixed': '🔄 Вертикальные по краям, горизонтальные в центре',
        'checker': '🏁 Шахматная (чередование)',
        'herringbone': '〰️ Ёлочка (только периметр)'
    };
    let html = `<span style="color: #00a896; font-weight: bold;">${layouts[layout] || layouts.auto}</span><br>`;
    const size = state.flowerEnabled ? state.flowerWidth : 0.6;
    const length = state.flowerEnabled ? state.flowerLength : 0.6;
    const cols = Math.round(size / 0.3);
    const rows = Math.round(length / 0.6);
    const finalCols = cols % 2 === 0 ? cols + 1 : cols;
    const finalRows = rows % 2 === 0 ? rows + 1 : rows;
    const totalCols = finalCols;
    const totalRows = finalRows + 2;
    const displayCols = Math.min(totalCols, 8);
    const displayRows = Math.min(totalRows, 8);
    html += `<div style="display: grid; grid-template-columns: repeat(${displayCols}, 16px); gap: 2px; margin: 8px auto; max-width: 200px;">`;
    for (let row = 0; row < displayRows; row++) {
        for (let col = 0; col < displayCols; col++) {
            const isPerimeter = (row === 0 || row === displayRows - 1 || col === 0 || col === displayCols - 1);
            let color = isPerimeter ? '#00a896' : '#4caf50';
            if (layout === 'vertical') {
                color = '#00a896';
            } else if (layout === 'horizontal') {
                color = '#3498db';
            } else if (layout === 'mixed') {
                color = isPerimeter ? '#00a896' : '#3498db';
            } else if (layout === 'checker') {
                color = (row + col) % 2 === 0 ? '#00a896' : '#3498db';
            } else if (layout === 'herringbone') {
                color = isPerimeter ? ((row + col) % 2 === 0 ? '#00a896' : '#3498db') : '#4caf50';
            }
            html += `<div style="width: 16px; height: 16px; background: ${color}; border-radius: 2px;"></div>`;
        }
    }
    html += `</div>`;
    html += `<div style="font-size: 10px; color: #888;">🟢 Периметр | 🟢 Центр (зелёный - заполнение)</div>`;
    preview.innerHTML = html;
}

document.getElementById('tileLayout')?.addEventListener('change', () => {
    updateLayoutPreview();
    resetTileManager();
    throttledUpdate();
});
document.getElementById('tileDirection')?.addEventListener('change', () => {
    updateLayoutPreview();
    resetTileManager();
    throttledUpdate();
});
document.getElementById('flowerWidth')?.addEventListener('input', updateLayoutPreview);
document.getElementById('flowerLength')?.addEventListener('input', updateLayoutPreview);
document.getElementById('flowerEnabled')?.addEventListener('change', () => {
    setTimeout(updateLayoutPreview, 100);
});
setTimeout(updateLayoutPreview, 500);

// ============================================================
// ⭐ ОБНОВЛЕНИЕ UI ВЫБРАННОГО ОБЪЕКТА
// ============================================================
function updateSelectionUI(selected) {
    const infoEl = document.getElementById('selectedFurnitureInfo');
    if (!infoEl) return;
    const typeNames = {
        'table': '🪵 Стол',
        'bench': '🪑 Скамейка'
    };
    infoEl.innerHTML = `
        <span style="color: #00ff88;">⬤</span>
        <span style="color: #fff;">${typeNames[selected.type] || selected.type} (${selected.x.toFixed(2)}, ${selected.z.toFixed(2)})</span>
        <span style="background: #ff3366; color: white; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: bold;">✦ ВЫБРАНО</span>
    `;
}

// ============================================================
// ⭐ АНИМАЦИЯ
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (furniture3DManager) {
        furniture3DManager.update();
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// ⭐ ОТПРАВКА ЗАКАЗА
// ============================================================
document.getElementById('sendOrderBtn')?.addEventListener('click', async function() {
    const statusDiv = document.getElementById('orderStatus');
    const name = document.getElementById('clientName')?.value.trim();
    const phone = document.getElementById('clientPhone')?.value.trim();
    if (!name || !phone) {
        statusDiv.style.color = '#ef4444';
        statusDiv.textContent = '❌ Заполните имя и телефон!';
        return;
    }
    const orderData = {
        clientName: name,
        clientPhone: phone,
        clientEmail: document.getElementById('clientEmail')?.value.trim() || '',
        comment: document.getElementById('orderComment')?.value.trim() || '',
        steleWidth: state.width,
        steleHeight: state.height,
        steleMaterial: state.material,
        fullName: state.fullName,
        dates: state.dates,
        epitaph: state.epitaph,
        flowerWidth: state.flowerWidth,
        flowerLength: state.flowerLength,
        flowerbedType: state.flowerbedType,
        fenceType: state.fenceType,
        fenceHeight: state.fenceHeight,
        fenceMaterial: state.fenceMaterial,
        fenceGateSide: state.fenceGateSide,
        totalPrice: calculatePrice(),
        stelePrice: 0,
        flowerPrice: 0,
        fencePrice: 0,
        deliveryPrice: parseInt(localStorage.getItem('priceDelivery') || 3000),
        installPrice: parseInt(localStorage.getItem('priceInstall') || 5000)
    };
    try {
        renderer.render(scene, camera);
        const screenshot = renderer.domElement.toDataURL('image/jpeg', 0.7);
        orderData.screenshot = screenshot;
    } catch(e) {
        console.warn('Скриншот не создан');
    }
    statusDiv.style.color = '#fbbf24';
    statusDiv.textContent = '⏳ Отправка заказа...';
    this.disabled = true;
    try {
        const response = await fetch('send-order.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (result.success) {
            statusDiv.style.color = '#4ade80';
            statusDiv.textContent = '✅ ' + result.message;
            document.getElementById('clientName').value = '';
            document.getElementById('clientPhone').value = '';
            document.getElementById('clientEmail').value = '';
            document.getElementById('orderComment').value = '';
        } else {
            statusDiv.style.color = '#ef4444';
            statusDiv.textContent = '❌ ' + result.message;
        }
    } catch(error) {
        statusDiv.style.color = '#ef4444';
        statusDiv.textContent = '❌ Ошибка отправки. Попробуйте позже или позвоните нам.';
    }
    this.disabled = false;
});

window.controls = controls;

// ============================================================
// ⭐ ПЕЧАТЬ СМЕТЫ
// ============================================================
function escapeHTML(str) {
    if (!str) return 'Не указано';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function makeScreenshot(angle, height = 2.5, distance = 6.0, targetY = 0.6) {
    const savedPos = camera.position.clone();
    const savedTarget = controls.target.clone();
    const rad = angle * Math.PI / 180;
    const x = Math.sin(rad) * distance;
    const z = Math.cos(rad) * distance;
    camera.position.set(x, height, z);
    controls.target.set(0, targetY, 0);
    controls.update();
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.85);
    camera.position.copy(savedPos);
    controls.target.copy(savedTarget);
    controls.update();
    return dataUrl;
}

function generateEstimatePDF() {
    const p = prices || {};
    let total = 0;
    const tableRows = [];
    const steleArea = state.width * state.height;
    const materialPrice = p[state.material] || p.granite || 5000;
    const stelePrice = steleArea * materialPrice;
    total += stelePrice;
    const safeMaterial = escapeHTML(state.material || 'Гранит');
    tableRows.push({ name: '🪦 Памятник', desc: `${safeMaterial}, ${steleArea.toFixed(2)} м² × ${materialPrice} ₽/м²`, price: stelePrice });
    const graveArea = state.graveWidth * state.graveLength;
    let baseKey = 'base_other';
    if (['granite', 'black_galaxy', 'ninimyaki'].includes(state.material)) baseKey = 'base_granite';
    else if (state.material === 'marble') baseKey = 'base_marble';
    else if (state.material === 'red_granite') baseKey = 'base_red_granite';
    const basePrice = p[baseKey] || 4000;
    const basePriceTotal = graveArea * basePrice;
    total += basePriceTotal;
    tableRows.push({ name: '🪨 Основание', desc: `${graveArea.toFixed(2)} м² × ${basePrice} ₽/м²`, price: basePriceTotal });
    const workPrice = p.stele_work || 5000;
    total += workPrice;
    tableRows.push({ name: '🔧 Изготовление стелы', desc: 'Фиксированная цена', price: workPrice });
    let engravingPriceTotal = 0;
    let engravingCount = 0;
    const engravingDescParts = [];
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        for (let i = 0; i < state.engravingsFront.length; i++) {
            const eng = state.engravingsFront[i];
            const basePrice = p.engraving || 1500;
            const scale = eng.scale || 1.0;
            const price = basePrice * scale;
            engravingPriceTotal += price;
            engravingCount++;
            const name = engravingsConfig[eng.type]?.name || eng.type;
            engravingDescParts.push(`${name} (перед) ×${scale.toFixed(1)}`);
        }
    }
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        for (let i = 0; i < state.engravingsBack.length; i++) {
            const eng = state.engravingsBack[i];
            const basePrice = p.engraving || 1500;
            const scale = eng.scale || 1.0;
            const price = basePrice * scale;
            engravingPriceTotal += price;
            engravingCount++;
            const name = engravingsConfig[eng.type]?.name || eng.type;
            engravingDescParts.push(`${name} (зад) ×${scale.toFixed(1)}`);
        }
    }
    if (engravingPriceTotal > 0) {
        total += engravingPriceTotal;
        tableRows.push({ name: `🎨 Гравировки (${engravingCount} шт)`, desc: engravingDescParts.join('; '), price: engravingPriceTotal });
    }
    let photoPrice = 0;
    if (state.textureUrl) {
        photoPrice = p.photo || 2000;
        total += photoPrice;
        tableRows.push({ name: '🖼️ Фото', desc: 'Керамика', price: photoPrice });
    }
    let flowerTotal = 0;
    if (state.flowerEnabled) {
        const flowerArea = state.flowerWidth * state.flowerLength;
        const flowerPrice = p[state.flowerbedType] || 500;
        flowerTotal = flowerArea * flowerPrice;
        total += flowerTotal;
        const flowerName = {
            grass: 'Газон',
            gravel: 'Гравий',
            marble_chips: 'Мраморная крошка',
            red_gravel: 'Красный гравий',
            blue_gravel: 'Синий гравий',
            black_gravel: 'Чёрная галька',
            sand: 'Песок',
            flowers: 'Цветущий газон',
            moss: 'Мох'
        }[state.flowerbedType] || state.flowerbedType;
        tableRows.push({ name: '🌿 Цветник', desc: `${flowerName}, ${flowerArea.toFixed(2)} м² × ${flowerPrice} ₽/м²`, price: flowerTotal });
    }
    let fenceTotal = 0;
    let fenceLength = (state.graveWidth + state.graveLength) * 2;
    if (state.fenceGateSide !== 'none') fenceLength -= parseFloat(state.gateWidth || 0.8);
    const fencePrice = p[state.fenceType] || 0;
    if (fencePrice > 0 && state.fenceType !== 'none') {
        fenceTotal = fenceLength * fencePrice;
        total += fenceTotal;
        const fenceName = {
            pipe: 'Труба',
            chain: 'Цепь',
            casting: 'Литье',
            model_3d: '3D Модель',
            venzel: 'Вензель'
        }[state.fenceType] || state.fenceType;
        tableRows.push({ name: '🚧 Оградка', desc: `${fenceName}, ${fenceLength.toFixed(2)} м × ${fencePrice} ₽/м`, price: fenceTotal });
    }
    let tableCount = 0, benchCount = 0, picnicCount = 0;
    const furnitureScaleInput = document.getElementById('furnitureScale');
    const currentFurnitureScale = furnitureScaleInput ? parseFloat(furnitureScaleInput.value) : 1.0;
    if (window.furniture3DManager && window.furniture3DManager.furniture) {
        const furnitureList = window.furniture3DManager.furniture;
        for (let i = 0; i < furnitureList.length; i++) {
            const item = furnitureList[i];
            if (item.type === 'table') tableCount++;
            else if (item.type === 'bench') benchCount++;
            else if (item.type === 'picnic_set') picnicCount++;
        }
    }
    const tablePrice = (p.table || 15000) * currentFurnitureScale;
    const benchPrice = (p.bench || 12000) * currentFurnitureScale;
    const picnicPrice = (p.picnic_set || 25000) * currentFurnitureScale;
    if (tableCount > 0) {
        const tableTotal = tableCount * tablePrice;
        total += tableTotal;
        tableRows.push({ name: '🪵 Столы', desc: `${tableCount} шт × ${tablePrice.toFixed(0)} ₽ (масштаб ${currentFurnitureScale.toFixed(1)})`, price: tableTotal });
    }
    if (benchCount > 0) {
        const benchTotal = benchCount * benchPrice;
        total += benchTotal;
        tableRows.push({ name: '🪑 Скамейки', desc: `${benchCount} шт × ${benchPrice.toFixed(0)} ₽ (масштаб ${currentFurnitureScale.toFixed(1)})`, price: benchTotal });
    }
    if (picnicCount > 0) {
        const picnicTotal = picnicCount * picnicPrice;
        total += picnicTotal;
        tableRows.push({ name: '🧺 Наборы', desc: `${picnicCount} шт × ${picnicPrice.toFixed(0)} ₽ (масштаб ${currentFurnitureScale.toFixed(1)})`, price: picnicTotal });
    }
    const includeDelivery = document.getElementById('includeDelivery')?.checked || false;
    const includeInstall = document.getElementById('includeInstall')?.checked || false;
    if (includeDelivery) {
        const deliveryPrice = p.delivery || 3000;
        total += deliveryPrice;
        tableRows.push({ name: '🚚 Доставка', desc: 'По городу', price: deliveryPrice });
    }
    if (includeInstall) {
        const installPrice = p.install || 5000;
        total += installPrice;
        tableRows.push({ name: '🔧 Установка', desc: 'Монтаж', price: installPrice });
    }
    let screenshotFront = '', screenshotBack = '', screenshotSide = '', screenshotTop = '', screenshotSteleFront = '', screenshotSteleBack = '';
    try {
        const distance = 7.0;
        const height = 2.8;
        screenshotFront = makeScreenshot(0, height, distance);
        screenshotBack = makeScreenshot(180, height, distance);
        screenshotSide = makeScreenshot(90, height, distance);
        const savedPos = camera.position.clone();
        const savedTarget = controls.target.clone();
        camera.position.set(0, 8.0, 0.1);
        controls.target.set(0, 0, 0);
        controls.update();
        renderer.render(scene, camera);
        screenshotTop = renderer.domElement.toDataURL('image/jpeg', 0.85);
        camera.position.copy(savedPos);
        controls.target.copy(savedTarget);
        controls.update();
        const steleHeight = state.height || 1.2;
        const targetY = steleHeight / 2 + 0.2;
        const closeDistance = 1.8;
        const closeHeight = targetY + 0.1;
        screenshotSteleFront = makeScreenshot(0, closeHeight, closeDistance, targetY);
        screenshotSteleBack = makeScreenshot(180, closeHeight, closeDistance, targetY);
    } catch(e) {
        console.warn('Ошибка создания скриншотов:', e);
    }
    const date = new Date().toLocaleDateString('ru-RU');
    const orderNumber = '№ ' + String(Math.floor(100000 + Math.random() * 900000));
    const safeFullName = escapeHTML(state.fullName || 'Не указано');
    const safeDates = escapeHTML(state.dates || 'Не указаны');
    const safeEpitaph = escapeHTML(state.epitaph || 'Не указана');
    const safeFlowerbed = escapeHTML(state.flowerbedType || 'Нет');
    const safeFenceType = escapeHTML(state.fenceType !== 'none' ? state.fenceType : 'Нет');
    const clientPhone = document.getElementById('clientPhone')?.value || 'Не указан';
    const clientEmail = document.getElementById('clientEmail')?.value || 'Не указан';
    const engravingNames = [];
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        for (let i = 0; i < state.engravingsFront.length; i++) {
            const e = state.engravingsFront[i];
            if (engravingsConfig[e.type]) {
                const scale = e.scale || 1.0;
                engravingNames.push(`${engravingsConfig[e.type].name} (перед, ×${scale.toFixed(1)})`);
            }
        }
    }
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        for (let i = 0; i < state.engravingsBack.length; i++) {
            const e = state.engravingsBack[i];
            if (engravingsConfig[e.type]) {
                const scale = e.scale || 1.0;
                engravingNames.push(`${engravingsConfig[e.type].name} (зад, ×${scale.toFixed(1)})`);
            }
        }
    }
    const engravingText = engravingNames.length > 0 ? engravingNames.join('; ') : 'Нет';
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Смета на памятник</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Times New Roman',serif; background:#fff; padding:30px; color:#222; max-width:1100px; margin:0 auto; }
        .header { text-align:center; border-bottom:3px double #1a1a2e; padding-bottom:20px; margin-bottom:25px; }
        .header h1 { font-size:28px; letter-spacing:3px; color:#1a1a2e; }
        .header .sub { font-size:14px; color:#666; margin-top:5px; }
        .header .order-info { font-size:13px; color:#888; margin-top:5px; }
        .section { margin:20px 0; padding:15px 20px; background:#f9f9f9; border-radius:8px; page-break-inside:avoid; }
        .section-title { font-size:18px; font-weight:bold; color:#1a1a2e; border-bottom:2px solid #1a1a2e; padding-bottom:8px; margin-bottom:15px; }
        .params-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 30px; }
        .params-grid .item { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #eee; }
        .params-grid .label { color:#666; }
        .params-grid .value { font-weight:500; }
        .screenshots { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin:20px 0; }
        .screenshots-2 { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin:10px 0 20px 0; }
        .screenshots-stele { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin:20px 0; border-top:2px dashed #ddd; padding-top:20px; }
        .stele-title { grid-column:span 2; text-align:center; font-size:16px; font-weight:bold; color:#1a1a2e; margin-bottom:5px; }
        .stele-title span { background:#f0f0f0; padding:5px 20px; border-radius:20px; }
        .screenshot-box { text-align:center; padding:10px; background:#f0f0f0; border-radius:8px; border:1px solid #ddd; page-break-inside:avoid; }
        .screenshot-box .caption { font-size:13px; color:#555; margin-top:8px; font-weight:bold; }
        .screenshot-box img { width:100%; height:auto; max-height:200px; object-fit:contain; border:1px solid #ccc; border-radius:4px; background:#fff; }
        .screenshot-box-top img { max-height:280px; }
        .screenshot-box-stele img { max-height:300px; }
        .price-table { width:100%; border-collapse:collapse; margin:15px 0; font-size:15px; }
        .price-table th { background:#1a1a2e; color:white; padding:10px 15px; text-align:left; font-weight:600; }
        .price-table td { padding:8px 15px; border-bottom:1px solid #eee; }
        .price-table .total-row { font-weight:bold; font-size:18px; border-top:3px double #1a1a2e; }
        .price-table .total-row td { padding-top:12px; }
        .price-table .price { text-align:right; }
        .total-amount { font-size:28px; font-weight:bold; color:#00a896; }
        .notes { margin-top:20px; padding:15px 20px; background:#f0f8f6; border-left:4px solid #00a896; border-radius:4px; }
        .notes ul { list-style:none; padding:0; }
        .notes li { margin:5px 0; color:#555; }
        .footer { margin-top:30px; padding-top:20px; border-top:1px solid #ddd; text-align:center; font-size:12px; color:#888; }
        .footer a { color:#00a896; text-decoration:none; }
        @media print { body { padding:15px; } .no-print { display:none; } .section { background:#f5f5f5; } }
        @media (max-width:700px) { .screenshots, .screenshots-2, .screenshots-stele { grid-template-columns:1fr; } .params-grid { grid-template-columns:1fr; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>🪦 СМЕТА НА ПАМЯТНИК</h1>
        <div class="sub">ООО «Гига-НТ» • Ростов-на-Дону</div>
        <div class="order-info">Коммерческое предложение ${orderNumber} от ${date}</div>
    </div>
    <div class="section">
        <div class="section-title">📋 Данные клиента</div>
        <div class="params-grid">
            <div class="item"><span class="label">Клиент:</span><span class="value">${safeFullName}</span></div>
            <div class="item"><span class="label">Дата заявки:</span><span class="value">${date}</span></div>
            <div class="item"><span class="label">Телефон:</span><span class="value">${escapeHTML(clientPhone)}</span></div>
            <div class="item"><span class="label">Email:</span><span class="value">${escapeHTML(clientEmail)}</span></div>
        </div>
    </div>
    <div class="section">
        <div class="section-title">📐 Параметры памятника</div>
        <div class="params-grid">
            <div class="item"><span class="label">Стела:</span><span class="value">${state.width.toFixed(1)}×${state.height.toFixed(1)} м</span></div>
            <div class="item"><span class="label">Материал:</span><span class="value">${safeMaterial}</span></div>
            <div class="item"><span class="label">Основание:</span><span class="value">${state.graveWidth.toFixed(1)}×${state.graveLength.toFixed(1)} м</span></div>
            <div class="item"><span class="label">Цветник:</span><span class="value">${state.flowerEnabled ? state.flowerWidth.toFixed(1)+'×'+state.flowerLength.toFixed(1)+' м ('+safeFlowerbed+')' : 'Нет'}</span></div>
            <div class="item"><span class="label">Оградка:</span><span class="value">${safeFenceType} (высота ${state.fenceHeight.toFixed(1)} м)</span></div>
            <div class="item"><span class="label">Вход:</span><span class="value">${state.fenceGateSide !== 'none' ? state.fenceGateSide : 'Нет'}</span></div>
        </div>
    </div>
    <div class="section">
        <div class="section-title">🎨 Элементы на памятнике</div>
        <div class="params-grid">
            <div class="item"><span class="label">ФИО:</span><span class="value">${safeFullName}</span></div>
            <div class="item"><span class="label">Даты:</span><span class="value">${safeDates}</span></div>
            <div class="item" style="grid-column:span 2;"><span class="label">Эпитафия:</span><span class="value">${safeEpitaph}</span></div>
            <div class="item"><span class="label">Фото:</span><span class="value">${state.textureUrl ? '✅ Загружено' : '❌ Не загружено'}</span></div>
            <div class="item" style="grid-column:span 2;"><span class="label">Гравировки:</span><span class="value">${escapeHTML(engravingText)}</span></div>
        </div>
    </div>
    <div class="screenshots">
        ${screenshotFront ? `<div class="screenshot-box"><img src="${screenshotFront}"><div class="caption">📷 Вид спереди</div></div>` : ''}
        ${screenshotSide ? `<div class="screenshot-box"><img src="${screenshotSide}"><div class="caption">📷 Вид сбоку</div></div>` : ''}
    </div>
    <div class="screenshots-2">
        ${screenshotBack ? `<div class="screenshot-box"><img src="${screenshotBack}"><div class="caption">📷 Вид сзади</div></div>` : ''}
        ${screenshotTop ? `<div class="screenshot-box screenshot-box-top"><img src="${screenshotTop}"><div class="caption">📷 Вид сверху</div></div>` : ''}
    </div>
    <div class="screenshots-stele">
        <div class="stele-title"><span>🔍 Крупный план стелы</span></div>
        ${screenshotSteleFront ? `<div class="screenshot-box screenshot-box-stele"><img src="${screenshotSteleFront}"><div class="caption">📷 Стела (вид спереди)</div></div>` : ''}
        ${screenshotSteleBack ? `<div class="screenshot-box screenshot-box-stele"><img src="${screenshotSteleBack}"><div class="caption">📷 Стела (вид сзади)</div></div>` : ''}
    </div>
    <div class="section">
        <div class="section-title">💰 Стоимость</div>
        <table class="price-table">
            <thead><tr><th>Наименование</th><th style="text-align:left;">Расчёт</th><th style="text-align:right;">Стоимость</th></tr></thead>
            <tbody>`;
    for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        const safeName = escapeHTML(row.name);
        const safeDesc = escapeHTML(row.desc);
        html += `<tr><td>${safeName}</td><td style="font-size:13px;color:#555;">${safeDesc}</td><td class="price">${row.price.toFixed(0)} ₽</td></tr>`;
    }
    html += `
                <tr class="total-row"><td colspan="2" style="font-size:20px;">ИТОГО:</td><td class="price"><span class="total-amount">${total.toFixed(0)} ₽</span></td></tr>
            </tbody>
        </table>
    </div>
    <div class="notes">
        <div style="font-weight:bold;margin-bottom:8px;">📌 Примечания</div>
        <ul>
            <li>• Срок изготовления: 7-14 рабочих дней</li>
            <li>• Предоплата 50%</li>
            <li>• Окончательная стоимость уточняется</li>
            <li>• Цена действительна в течение 30 дней</li>
        </ul>
    </div>
    <div class="footer">
        <p>Giga-NT 3D Конструктор Памятников</p>
        <p><a href="https://giga-nt.ru">https://giga-nt.ru</a></p>
    </div>
    <div class="no-print" style="text-align:center;margin-top:30px;">
        <button onclick="window.print()" style="padding:12px 30px;background:#1a1a2e;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;">🖨️ Распечатать</button>
        <button onclick="window.close()" style="padding:12px 30px;background:#666;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin-left:10px;">✖ Закрыть</button>
    </div>
    <script>setTimeout(function(){window.print();},1500);<\/script>
</body>
</html>`;
    return html;
}

document.getElementById('printQuoteBtn')?.addEventListener('click', function() {
    try {
        const html = generateEstimatePDF();
        const win = window.open('', '_blank', 'width=1000,height=1000,scrollbars=yes,menubar=yes');
        if (!win) {
            showToast('❌ Блокировщик всплывающих окон! Разрешите для этого сайта.', 'error');
            return;
        }
        win.document.write(html);
        win.document.close();
        win.onload = function() {
            setTimeout(function(){ win.print(); }, 1500);
        };
        showToast('🖨️ Открыто окно для печати', 'success');
    } catch(error) {
        console.error('Ошибка печати:', error);
        showToast('❌ Ошибка при печати: ' + error.message, 'error');
    }
});

console.log('✅ 3D Конструктор загружен с оптимизациями для мобильных');
console.log(`📱 Мобильный режим: ${isMobile ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
console.log(`📐 Размер текстур: ${QUALITY.textureSize}px`);
console.log(`🎯 Уровень детализации: ${isLowEndDevice ? 'НИЗКИЙ' : 'ВЫСОКИЙ'}`);