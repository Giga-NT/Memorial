// customSteleLoader.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ DRAG-AND-DROP
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSteleMaterial } from './uvUtils.js';
import { loadPBRMaterial } from './textures.js';

export const customModels = {};
let modelCache = new Map();
let currentModelId = null;

export async function loadModelList() {
    try {
        const response = await fetch('./models/models-list.json');
        if (!response.ok) throw new Error('Файл models-list.json не найден');
        const data = await response.json();
        
        data.models.forEach(item => {
            customModels[item.id] = {
                path: `./models/${item.file}`,
                name: item.name || item.file.replace('.glb', ''),
                defaultWidth: item.defaultWidth || 0.6,
                defaultHeight: item.defaultHeight || 1.3,
                defaultDepth: item.defaultDepth || 0.08,
                modelType: item.modelType || 'vertical',
            };
        });
        
        console.log(`✅ Загружено ${data.models.length} моделей`);
        return data.models;
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить список моделей');
        return [];
    }
}

export async function loadCustomStele(modelId) {
    const config = customModels[modelId];
    if (!config) {
        console.warn(`⚠️ Модель ${modelId} не найдена`);
        return null;
    }
    
    if (modelCache.has(modelId)) {
        return modelCache.get(modelId).clone();
    }
    
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        console.log(`📥 Загрузка модели: ${config.path}`);
        
        loader.load(
            config.path,
            (gltf) => {
                const model = gltf.scene;
                modelCache.set(modelId, model.clone());
                console.log(`✅ Модель ${modelId} загружена`);
                resolve(model);
            },
            undefined,
            (error) => {
                console.error(`❌ Ошибка загрузки ${config.path}:`, error);
                reject(error);
            }
        );
    });
}

function generateUVsForModel(geometry, modelType = 'vertical') {
    const pos = geometry.attributes.position;
    if (!pos) return;
    
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const min = box.min;
    const max = box.max;
    
    const sizeX = max.x - min.x || 0.001;
    const sizeY = max.y - min.y || 0.001;
    const sizeZ = max.z - min.z || 0.001;
    
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    const normal = geometry.attributes.normal;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        let u, v;
        
        if (normal) {
            const nx = Math.abs(normal.getX(i));
            const ny = Math.abs(normal.getY(i));
            const nz = Math.abs(normal.getZ(i));
            
            if (modelType === 'horizontal') {
                if (ny > nx && ny > nz) {
                    u = (x - min.x) / sizeX;
                    v = (z - min.z) / sizeZ;
                } else {
                    u = (x - min.x) / sizeX;
                    v = 1 - (y - min.y) / sizeY;
                }
            } else {
                if (nz > nx && nz > ny) {
                    u = (x - min.x) / sizeX;
                    v = 1 - (y - min.y) / sizeY;
                } else if (nx > ny && nx > nz) {
                    u = (z - min.z) / sizeZ;
                    v = 1 - (y - min.y) / sizeY;
                } else {
                    u = (x - min.x) / sizeX;
                    v = (z - min.z) / sizeZ;
                }
            }
        } else {
            u = (x - min.x) / sizeX;
            v = 1 - (y - min.y) / sizeY;
        }
        
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
}

export async function applyMaterialToCustomModel(model, materialType, modelId = null, modelType = 'vertical') {
    if (!model) return;
    
    // ⭐⭐⭐ ИСПРАВЛЕНО: если materialType пустой или невалидный, используем granite
    if (!materialType || materialType === '' || materialType === ' ' || materialType === 'undefined' || materialType === 'null') {
        console.warn(`⚠️ Материал "${materialType}" пустой или невалидный, используем granite`);
        materialType = 'granite';
    }
    
    console.log(`🎨 Загрузка материала "${materialType}" для модели ${modelId || 'текущей'}`);
    
    try {
        const pbrMat = await loadPBRMaterial(materialType);
        const texture = pbrMat?.map || null;
        
        if (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            texture.needsUpdate = true;
        } else {
            console.warn(`⚠️ Текстура для материала "${materialType}" не загружена, используем fallback`);
        }
        
        const material = createSteleMaterial(texture);
        
        model.traverse((child) => {
            if (child.isMesh) {
                const geometry = child.geometry;
                const pos = geometry.attributes.position;
                
                if (!pos) return;
                
                generateUVsForModel(geometry, modelType);
                geometry.computeVertexNormals();
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                
                child.material = material.clone();
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        console.log(`✅ Материал ${materialType} применён к модели ${modelId || 'текущей'}`);
    } catch (error) {
        console.error(`❌ Ошибка применения материала "${materialType}":`, error);
        // Пробуем применить granite как fallback
        if (materialType !== 'granite') {
            console.warn('🔄 Пробуем применить granite как fallback');
            await applyMaterialToCustomModel(model, 'granite', modelId, modelType);
        }
    }
}

export function createCustomSteleMesh(modelId, width, height, depth, materialType = 'granite', modelType = 'vertical', externalDecalsGroup = null, skipDecals = false) {
    const group = new THREE.Group();
    group.userData.modelId = modelId;
    group.userData.isCustomStele = true;
    group.userData.isLoaded = false;
    currentModelId = modelId;
    
    const decalsContainer = new THREE.Group();
    decalsContainer.name = 'decalsContainer';
    group.add(decalsContainer);
    
    loadCustomStele(modelId).then(async (model) => {
        if (model) {
            const oldModel = group.userData.modelRef;
            if (oldModel) {
                group.remove(oldModel);
            }
            
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            const scaleX = width / size.x;
            const scaleY = height / size.y;
            const scaleZ = depth / size.z;
            
            model.scale.set(scaleX, scaleY, scaleZ);
            
            const center = box.getCenter(new THREE.Vector3());
            model.position.set(-center.x * scaleX, -center.y * scaleY, -center.z * scaleZ);
            
            group.userData.modelRef = model;
            group.userData.isLoaded = true;
            
            await applyMaterialToCustomModel(model, materialType, modelId, modelType);
            
            group.add(model);
            
            // ⭐ СОЗДАЕМ ДЕКАЛИ ТОЛЬКО ЕСЛИ:
            // 1. НЕ skipDecals
            // 2. externalDecalsGroup передан
            // 3. window.positionDecalsOnCustomStele существует
            // 4. window.state существует
            if (!skipDecals && externalDecalsGroup && window.positionDecalsOnCustomStele && window.state) {
                setTimeout(() => {
                    window.positionDecalsOnCustomStele(group, externalDecalsGroup, window.state);
                }, 50);
            } else {
                console.log(`⏭️ Декали пропущены для ${modelId} (skipDecals=${skipDecals})`);
            }
            
            console.log(`✅ Модель ${modelId} создана (размер: ${width}x${height}x${depth}, тип: ${modelType})`);
        }
    });
    
    return group;
}


export async function updateCurrentCustomSteleMaterial(materialType) {
    // ⭐ ЕСЛИ ВЫБРАН ДУБЛЕР, НЕ ТРОГАЕМ ОСНОВНОЙ
    if (window.multiMonumentManager && window.multiMonumentManager.activeIndex >= 0) {
        console.log('⏭️ updateCurrentCustomSteleMaterial пропущена (выбран дублер)');
        return;
    }
    
    if (!window.monumentGroup) {
        console.warn('monumentGroup не найден');
        return;
    }
    
    const children = window.monumentGroup.children;
    let found = false;
    
    for (const child of children) {
        if (child.type === 'Group' && child.userData && child.userData.modelId) {
            const modelId = child.userData.modelId;
            const modelRef = child.userData.modelRef;
            
            if (modelRef) {
                const config = customModels[modelId];
                const modelType = config?.modelType || 'vertical';
                console.log(`🔄 Обновляем материал для модели ${modelId} на ${materialType}`);
                await applyMaterialToCustomModel(modelRef, materialType, modelId, modelType);
                found = true;
            }
        }
    }
    
    if (found) {
        console.log(`✅ Материал ${materialType} применён к основному памятнику`);
    } else {
        console.warn('⚠️ Кастомные модели не найдены');
    }
}

export function getModelList() {
    return Object.keys(customModels).map(id => ({
        id: id,
        name: customModels[id].name,
        modelType: customModels[id].modelType || 'vertical',
    }));
}

export function getModelDimensions(model) {
    if (!model) return null;
    
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    return {
        width: size.x,
        height: size.y,
        depth: size.z,
        centerX: center.x,
        centerY: center.y,
        centerZ: center.z,
        minX: box.min.x,
        maxX: box.max.x,
        minY: box.min.y,
        maxY: box.max.y,
        minZ: box.min.z,
        maxZ: box.max.z,
    };
}

export function positionDecalsOnCustomStele(steleGroup, decalsGroup, state) {
    if (!steleGroup || !decalsGroup) return;
    
    // Очистка
    while (decalsGroup.children.length > 0) {
        const child = decalsGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        decalsGroup.remove(child);
    }
    
    // Проверяем флаги обновления
    if (state.frontTextureNeedsUpdate) {
        state.frontTextureCache = null;
        state.frontTextureNeedsUpdate = false;
    }
    if (state.backTextureNeedsUpdate) {
        state.backTextureCache = null;
        state.backTextureNeedsUpdate = false;
    }
    
    // Ждём загрузки модели
    const model = steleGroup.userData.modelRef;
    if (!model) {
        const checkModel = () => {
            if (steleGroup.userData.modelRef) {
                positionDecalsOnCustomStele(steleGroup, decalsGroup, state);
            } else {
                requestAnimationFrame(checkModel);
            }
        };
        checkModel();
        return;
    }
    
    const dims = getModelDimensions(model);
    if (!dims) {
        console.warn('⚠️ Не удалось получить размеры модели');
        return;
    }
    
    const scale = state.decalScale || 0.99;
    const decalWidth = dims.width * scale;
    const decalHeight = dims.height * scale;
    const textCenterY = 0.6;
    const frontZ = (state.decalFrontZ !== undefined) ? state.decalFrontZ : -0.599;
    const backZ = (state.decalBackZ !== undefined) ? state.decalBackZ : -0.702;

    // ============================================================
    // === 1. ТЕКСТ НА ЛИЦЕВОЙ СТОРОНЕ ===
    // ============================================================
    if (state.fullName && state.fullName.trim()) {
        let texture;
        if (state.frontTextureNeedsUpdate || !state.frontTextureCache) {
            texture = createFrontTexture(state);
            state.frontTextureCache = texture;
            state.frontTextureNeedsUpdate = false;
        } else {
            texture = state.frontTextureCache;
        }
        
        const textGeo = new THREE.PlaneGeometry(decalWidth, decalHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide, 
            depthWrite: false, 
            alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.set(0, textCenterY, frontZ);
        textMesh.renderOrder = 9;
        decalsGroup.add(textMesh);
    }
    

    
    // ============================================================
    // === 3. ФОТО ===
    // ============================================================
    if (state.textureUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(state.textureUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            
            let w, h;
            const shape = state.photoShape || 'oval';
            
            if (shape === 'custom') {
                w = mmToMeters(state.photoWidthMm || 100);
                h = mmToMeters(state.photoHeightMm || 140);
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
            
            const scale = state.photoScale || 1.0;
            const finalW = w * scale;
            const finalH = h * scale;
            
            let geometry;
            if (shape === 'circle') {
                const radius = Math.max(finalW, finalH) / 2;
                geometry = new THREE.CircleGeometry(radius, 64);
            } else if (shape === 'oval') {
                geometry = new THREE.CircleGeometry(0.5, 64);
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
            
            const photoX = (state.photoAbsoluteX !== undefined) ? state.photoAbsoluteX : 0;
            const photoY = (state.photoAbsoluteY !== undefined) ? state.photoAbsoluteY : 0.6;
            
            photoMesh.position.set(photoX, photoY, frontZ);
            photoMesh.renderOrder = 11;
            
            photoMesh.userData.isDraggable = true;
            photoMesh.userData.type = 'photo';
            
            decalsGroup.add(photoMesh);
        });
    }
    
    // ============================================================
    // === 4. ЭПИТАФИЯ ===
    // ============================================================
    if (state.epitaph && state.epitaph.trim()) {
        let texture;
        if (state.backTextureNeedsUpdate || !state.backTextureCache) {
            texture = createBackTexture(state);
            state.backTextureCache = texture;
            state.backTextureNeedsUpdate = false;
        } else {
            texture = state.backTextureCache;
        }
        
        const textGeo = new THREE.PlaneGeometry(decalWidth, decalHeight);
        const textMat = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide, 
            depthWrite: false, 
            alphaTest: 0.05 
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.set(0, textCenterY, backZ);
        textMesh.rotation.y = Math.PI;
        textMesh.renderOrder = 9;
        decalsGroup.add(textMesh);
    }
    
    // ============================================================
    // === 5. ГРАВИРОВКИ (ИСПРАВЛЕНО - ПОДДЕРЖКА ТЕКСТА) ===
    // ============================================================
    
    const BASE_ENGRAVING_SIZE = 0.22;
    
    // === ГРАВИРОВКИ СПЕРЕДИ ===
    if (state.engravingsFront && state.engravingsFront.length > 0) {
        console.log(`🖼️ Создаем ${state.engravingsFront.length} гравировок спереди`);
        
        state.engravingsFront.forEach((eng, index) => {
            // ⭐⭐⭐ НОВАЯ ЛОГИКА: ПРОВЕРЯЕМ ТИП ⭐⭐⭐
            
            // === ТЕКСТОВАЯ ГРАВИРОВКА ===
            if (eng.type === 'text' && eng.text && !eng.url) {
                console.log(`📝 Текстовая гравировка спереди: "${eng.text}"`);
                
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                
                ctx.clearRect(0, 0, 512, 512);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 8;
                
                const fontSize = eng.fontSize || 48;
                const fontFamily = eng.fontFamily || 'Arial, sans-serif';
                const color = eng.color || '#ffffff';
                
                ctx.fillStyle = color;
                ctx.font = `${eng.bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
                
                const lines = eng.text.split(/\r?\n|\//);
                const lineHeight = fontSize * 1.5;
                const startY = 256 - (lines.length - 1) * lineHeight / 2;
                
                lines.forEach((line, i) => {
                    if (line.trim()) {
                        ctx.fillText(line.trim(), 256, startY + i * lineHeight);
                    }
                });
                
                const texture = new THREE.CanvasTexture(canvas);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                
                // Масштаб
                let scaleFactor = 1.0;
                if (eng.size !== undefined && eng.size > 0) {
                    scaleFactor = parseFloat(eng.size);
                } else if (eng.scale !== undefined && eng.scale > 0) {
                    scaleFactor = parseFloat(eng.scale);
                }
                const engravingSize = BASE_ENGRAVING_SIZE * scaleFactor;
                
                const geometry = new THREE.PlaneGeometry(engravingSize, engravingSize);
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture, 
                    transparent: true, 
                    side: THREE.DoubleSide, 
                    depthWrite: false, 
                    alphaTest: 0.05
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                const offsetX = eng.x || 0;
                const offsetY = eng.y || 0;
                mesh.position.set(offsetX, textCenterY + offsetY, frontZ);
                mesh.renderOrder = 10;
                
				mesh.userData.text = eng.text;  
                mesh.userData.isEngraving = true;
                mesh.userData.isTextEngraving = true;
                mesh.userData.scale = scaleFactor;
                mesh.userData.size = engravingSize;
                mesh.userData.side = 'front';
                mesh.userData.id = eng.id || `text_front_${index}`;
                
                decalsGroup.add(mesh);
                console.log(`  ✅ Текстовая гравировка добавлена: "${eng.text}"`);
                return;
            }
            
            // === ГРАВИРОВКА С URL ===
            if (!eng.url) {
                console.warn(`⚠️ Гравировка ${eng.type || index} без URL, пропускаем`);
                return;
            }
            
            let scaleFactor = 1.0;
            if (eng.size !== undefined && eng.size > 0) {
                scaleFactor = parseFloat(eng.size);
            } else if (eng.scale !== undefined && eng.scale > 0) {
                scaleFactor = parseFloat(eng.scale);
            }
            const engravingSize = BASE_ENGRAVING_SIZE * scaleFactor;
            
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                
                const geometry = new THREE.PlaneGeometry(engravingSize, engravingSize);
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
                mesh.position.set(offsetX, textCenterY + offsetY, frontZ);
                mesh.renderOrder = 10;
                
                mesh.userData.isEngraving = true;
                mesh.userData.scale = scaleFactor;
                mesh.userData.size = engravingSize;
                mesh.userData.side = 'front';
                mesh.userData.id = eng.id || `eng_front_${index}`;
                
                decalsGroup.add(mesh);
                console.log(`  ✅ Гравировка с URL добавлена (размер ${engravingSize.toFixed(4)}m)`);
            });
        });
    }
    
    // === ГРАВИРОВКИ СЗАДИ ===
    if (state.engravingsBack && state.engravingsBack.length > 0) {
        console.log(`🖼️ Создаем ${state.engravingsBack.length} гравировок сзади`);
        
        state.engravingsBack.forEach((eng, index) => {
            // ⭐⭐⭐ ТЕКСТОВАЯ ГРАВИРОВКА СЗАДИ ⭐⭐⭐
            if (eng.type === 'text' && eng.text && !eng.url) {
                console.log(`📝 Текстовая гравировка сзади: "${eng.text}"`);
                
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                
                ctx.clearRect(0, 0, 512, 512);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 8;
                
                const fontSize = eng.fontSize || 48;
                const fontFamily = eng.fontFamily || 'Arial, sans-serif';
                const color = eng.color || '#ffffff';
                
                ctx.fillStyle = color;
                ctx.font = `${eng.bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
                
                const lines = eng.text.split(/\r?\n|\//);
                const lineHeight = fontSize * 1.5;
                const startY = 256 - (lines.length - 1) * lineHeight / 2;
                
                lines.forEach((line, i) => {
                    if (line.trim()) {
                        ctx.fillText(line.trim(), 256, startY + i * lineHeight);
                    }
                });
                
                const texture = new THREE.CanvasTexture(canvas);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                
                let scaleFactor = 1.0;
                if (eng.size !== undefined && eng.size > 0) {
                    scaleFactor = parseFloat(eng.size);
                } else if (eng.scale !== undefined && eng.scale > 0) {
                    scaleFactor = parseFloat(eng.scale);
                }
                const engravingSize = BASE_ENGRAVING_SIZE * scaleFactor;
                
                const geometry = new THREE.PlaneGeometry(engravingSize, engravingSize);
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture, 
                    transparent: true, 
                    side: THREE.DoubleSide, 
                    depthWrite: false, 
                    alphaTest: 0.05
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                const offsetX = eng.x || 0;
                const offsetY = eng.y || 0;
                mesh.position.set(offsetX, textCenterY + offsetY, backZ);
                mesh.rotation.y = Math.PI;
                mesh.renderOrder = 10;
                
				mesh.userData.text = eng.text;   
                mesh.userData.isEngraving = true;
                mesh.userData.isTextEngraving = true;
                mesh.userData.scale = scaleFactor;
                mesh.userData.size = engravingSize;
                mesh.userData.side = 'back';
                mesh.userData.id = eng.id || `text_back_${index}`;
                
                decalsGroup.add(mesh);
                console.log(`  ✅ Текстовая гравировка сзади добавлена: "${eng.text}"`);
                return;
            }
            
            // === ГРАВИРОВКА С URL СЗАДИ ===
            if (!eng.url) {
                console.warn(`⚠️ Гравировка ${eng.type || index} без URL, пропускаем`);
                return;
            }
            
            let scaleFactor = 1.0;
            if (eng.size !== undefined && eng.size > 0) {
                scaleFactor = parseFloat(eng.size);
            } else if (eng.scale !== undefined && eng.scale > 0) {
                scaleFactor = parseFloat(eng.scale);
            }
            const engravingSize = BASE_ENGRAVING_SIZE * scaleFactor;
            
            const loader = new THREE.TextureLoader();
            loader.load(eng.url, (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                
                const geometry = new THREE.PlaneGeometry(engravingSize, engravingSize);
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
                mesh.position.set(offsetX, textCenterY + offsetY, backZ);
                mesh.rotation.y = Math.PI;
                mesh.renderOrder = 10;
                
                mesh.userData.isEngraving = true;
                mesh.userData.scale = scaleFactor;
                mesh.userData.size = engravingSize;
                mesh.userData.side = 'back';
                mesh.userData.id = eng.id || `eng_back_${index}`;
                
                decalsGroup.add(mesh);
                console.log(`  ✅ Гравировка с URL сзади добавлена (размер ${engravingSize.toFixed(4)}m)`);
            });
        });
    }
    
    console.log('✅ Декали размещены на STL модели');
}

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ИСПРАВЛЕНЫ)
// ============================================================

function createFrontTexture(state) {
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
    ctx.shadowBlur = isMobile ? 4 : 8;
    
    // ⭐ СМЕЩЕНИЯ В ПИКСЕЛЯХ (МЕТРЫ → ПИКСЕЛИ)
    // state.textOffsetX/Y хранятся в метрах, переводим в пиксели
    const pixelsPerMeter = canvasSize / 1.2; // 1.2 метра - максимальная высота стелы
    const offsetX = state.textOffsetX * pixelsPerMeter;
    const offsetY = state.textOffsetY * pixelsPerMeter;
    
    let currentY = 80 + offsetY;
    
    if (state.fullName.trim()) {
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
        
        const fontSize = state.nameFontSize * (isMobile ? 0.8 : 1.5);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        
        const rawLines = state.fullName.split(/\r?\n/);
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
        let fontFamily = state.fontFamily;
        if (fontFamily.includes('Yermak')) fontFamily = 'Yermak';
        const fontSize = state.datesFontSize * (isMobile ? 0.8 : 1.3);
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.fillText(state.dates, canvas.width/2 + offsetX, currentY);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function createBackTexture(state) {
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
    
    // ⭐ СМЕЩЕНИЯ В ПИКСЕЛЯХ (МЕТРЫ → ПИКСЕЛИ)
    const pixelsPerMeter = canvasSize / 1.2;
    const offsetX = state.epitaphOffsetX * pixelsPerMeter;
    const offsetY = state.epitaphOffsetY * pixelsPerMeter;
    
    let currentY = 80 + offsetY;
    
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
                ctx.fillText(line.trim(), canvas.width/2 + offsetX, currentY);
                currentY += state.epitaphFontSize * (isMobile ? 0.9 : 1.5);
            }
        });
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function mmToMeters(mm) { return mm / 1000; }
// ⭐ ДЕЛАЕМ ЗАГРУЗЧИК ДОСТУПНЫМ ГЛОБАЛЬНО
window.customSteleLoader = {
    customModels: customModels,  // ⭐ ВАЖНО: customModels с большой "M", как у тебя в файле
    loadCustomStele: loadCustomStele,
    applyMaterialToCustomModel: applyMaterialToCustomModel,
    positionDecalsOnCustomStele: positionDecalsOnCustomStele,
    getModelList: getModelList,
    getModelDimensions: getModelDimensions,
    createCustomSteleMesh: createCustomSteleMesh,
    updateCurrentCustomSteleMaterial: updateCurrentCustomSteleMaterial
};