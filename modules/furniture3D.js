// modules/furniture3D.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Furniture3DManager {
    constructor(scene, camera, renderer, monumentGroup, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.monumentGroup = monumentGroup;
        this.controls = controls;
        this.furnitureGroup = new THREE.Group();
        this.scene.add(this.furnitureGroup);
        
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        this.models = {
            table: null,
            bench: null,
            tableGarden: null,
            benchGarden: null
        };
        this.isLoading = {
            table: false,
            bench: false,
            tableGarden: false,
            benchGarden: false
        };
        this.isLoaded = {
            table: false,
            bench: false,
            tableGarden: false,
            benchGarden: false
        };
        this.furniture = [];
        this.selectedId = null;
        this.highlightColor = 0x00ff88;
        this.originalColors = new Map();
        
        // Drag-and-Drop
        this.dragging = null;
        this.dragOffset = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDragging = false;
        this._wasDragging = false;
        this.dragStartPos = new THREE.Vector3();
        this.dragStartRot = 0;
        this.rotateMode = false;
        this.moveMode = true;
        
        this.snapToGrid = false;
        this.gridSize = 0.1;
        
        // ⭐ ТЕКСТУРЫ
        this.textures = {
            wood: null,
            metal: null,
            woodGarden: null
        };
        this.texturesLoaded = false;
        
        // ⭐ МАТЕРИАЛЫ
        this.materials = {
            wood: null,
            woodDark: null,
            woodLight: null,
            metal: null,
            legs: null,
            woodGarden: null
        };
        
        this.loadTextures();
        this.bindEvents();
    }

    // ============================================================
    // ⭐ ЗАГРУЗКА ТЕКСТУР
    // ============================================================
    loadTextures() {
        console.log('🎨 Загрузка текстур...');
        
        // ⭐ ПРОВЕРКА НА IPHONE
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        console.log(`📱 Устройство: ${isIOS ? 'iOS' : 'другое'}`);
        
        let loadedCount = 0;
        const totalTextures = 3;
        
        const checkLoaded = () => {
            loadedCount++;
            console.log(`📊 Загружено текстур: ${loadedCount}/${totalTextures}`);
            if (loadedCount >= totalTextures) {
                this.texturesLoaded = true;
                this.createMaterials();
                console.log('✅ Все текстуры загружены');
                this.applyTexturesToAllFurniture();
            }
        };
        
        const loadTexture = (path, callback) => {
            console.log(`📥 Загрузка: ${path}`);
            this.textureLoader.load(
                path,
                (texture) => {
                    console.log(`✅ Загружена: ${path}`);
                    callback(texture);
                },
                undefined,
                (error) => {
                    console.warn(`⚠️ Не удалось загрузить: ${path}`, error);
                    const fallback = this.createFallbackWoodTexture();
                    callback(fallback);
                }
            );
        };
        
        // wood.jpg
        loadTexture('./models/furniture/wood 01.jpg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.anisotropy = 2;
            this.textures.wood = texture;
            checkLoaded();
        });
        
        // metal.jpg
        loadTexture('./models/furniture/metal.jpg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            texture.anisotropy = 2;
            this.textures.metal = texture;
            checkLoaded();
        });
        
        // wood_garden
        loadTexture('./models/furniture/wood 01.jpg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            texture.anisotropy = 2;
            this.textures.woodGarden = texture;
            checkLoaded();
        });
    }

    // ============================================================
    // ⭐ ФОЛБЭК ТЕКСТУРЫ
    // ============================================================
    createFallbackWoodTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const w = 1 + Math.random() * 4;
            const h = 5 + Math.random() * 30;
            const alpha = 0.1 + Math.random() * 0.3;
            const shade = 40 + Math.random() * 60;
            ctx.fillStyle = `rgba(${shade}, ${shade - 20}, ${shade - 40}, ${alpha})`;
            ctx.fillRect(x, y, w, h);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    createFallbackMetalTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 256, 256);
        grad.addColorStop(0, '#888888');
        grad.addColorStop(0.5, '#666666');
        grad.addColorStop(1, '#999999');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        const imageData = ctx.getImageData(0, 0, 256, 256);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 25;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        return texture;
    }

    // ============================================================
    // ⭐ СОЗДАНИЕ МАТЕРИАЛОВ
    // ============================================================
    createMaterials() {
        if (!this.texturesLoaded) return;
        
        this.materials.wood = new THREE.MeshStandardMaterial({
            map: this.textures.wood,
            color: 0x8d6e63,
            roughness: 0.7,
            metalness: 0.05,
        });
        
        this.materials.woodDark = new THREE.MeshStandardMaterial({
            map: this.textures.wood,
            color: 0x5d4037,
            roughness: 0.8,
            metalness: 0.05,
        });
        
        this.materials.woodLight = new THREE.MeshStandardMaterial({
            map: this.textures.wood,
            color: 0xbfa58a,
            roughness: 0.6,
            metalness: 0.05,
        });
        
        this.materials.metal = new THREE.MeshStandardMaterial({
            map: this.textures.metal,
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.8,
        });
        
        this.materials.legs = new THREE.MeshStandardMaterial({
            map: this.textures.metal,
            color: 0x444444,
            roughness: 0.4,
            metalness: 0.9,
        });
        
        this.materials.woodGarden = new THREE.MeshStandardMaterial({
            map: this.textures.woodGarden,
            color: 0x8d6e63,
            roughness: 0.6,
            metalness: 0.05,
        });
        
        console.log('✅ Материалы созданы');
    }

    // ============================================================
    // ⭐ ПРИМЕНЕНИЕ ТЕКСТУР
    // ============================================================
    applyTexturesToAllFurniture() {
        if (!this.texturesLoaded) return;
        this.furniture.forEach(item => {
            if (item.type === 'table_garden' || item.type === 'garden_bench') {
                this.applyGardenMaterials(item.group);
            } else {
                this.applyMaterialsToModel(item.group);
            }
        });
    }

    // ============================================================
    // ⭐ ПРИМЕНЕНИЕ МАТЕРИАЛОВ К ОБЫЧНОЙ МОДЕЛИ
    // ============================================================
    applyMaterialsToModel(model) {
        if (!this.texturesLoaded) {
            setTimeout(() => this.applyMaterialsToModel(model), 500);
            return;
        }
        
        console.log('🎨 Применяем материалы к модели...');
        
        model.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                const size = this.getMeshSize(child);
                let material = null;
                
                // Стол
                if (name.includes('stol_fanera__1') || (size.width > 0.5 && size.height < 0.1)) {
                    material = this.materials.wood;
                    console.log(`  🪵 Столешница: ${child.name}`);
                } else if (name.includes('stol_fanera__2') || (size.height > 0.5 && size.width < 0.5)) {
                    material = this.materials.metal;
                    console.log(`  🔩 Ножки: ${child.name}`);
                }
                // Скамейка
                else if (name.includes('скамейка_1') || (size.width > 1.5 && size.height < 0.5)) {
                    material = this.materials.wood;
                    console.log(`  🪵 Сиденье: ${child.name}`);
                } else if (name.includes('скамейка_2') || (size.width > 0.5 && size.height > 0.2)) {
                    material = this.materials.metal;
                    console.log(`  🔩 Каркас: ${child.name}`);
                }
                else {
                    material = this.materials.wood;
                    console.log(`  🪵 По умолчанию: ${child.name}`);
                }
                
                if (material) {
                    if (child.material && child.material.color) {
                        const colorKey = child.uuid + '_color';
                        if (!this.originalColors.has(colorKey)) {
                            this.originalColors.set(colorKey, child.material.color.getHex());
                        }
                    }
                    child.material = material.clone();
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.needsUpdate = true;
                }
            }
        });
    }

    // ============================================================
    // ⭐ ПРИМЕНЕНИЕ МАТЕРИАЛОВ К САДОВОМУ СТОЛУ
    // ============================================================
    applyGardenMaterials(model) {
        if (!this.texturesLoaded) {
            setTimeout(() => this.applyGardenMaterials(model), 500);
            return;
        }
        
        console.log('🎨 Применяем материалы для садовой мебели...');
        
        let woodCount = 0;
        let metalCount = 0;
        
        model.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                const size = this.getMeshSize(child);
                let material = null;
                
                // Столешница / Сиденье (плоские широкие части) - дерево
                if (name.includes('стол') || name.includes('table') || 
                    name.includes('top') || name.includes('крыш') ||
                    name.includes('сид') || name.includes('seat') ||
                    (size.width > 0.5 && size.height < 0.15)) {
                    material = this.materials.woodGarden;
                    woodCount++;
                    console.log(`  🪵 Деревянная часть: ${child.name}`);
                }
                // Ножки / Каркас (высокие узкие части) - металл
                else if (name.includes('ножк') || name.includes('leg') || 
                         name.includes('каркас') || name.includes('frame') ||
                         (size.height > 0.3 && size.width < 0.5)) {
                    material = this.materials.metal;
                    metalCount++;
                    console.log(`  🔩 Металлическая часть: ${child.name}`);
                }
                // По умолчанию
                else {
                    if (size.height < 0.15 && size.width > 0.3) {
                        material = this.materials.woodGarden;
                        woodCount++;
                    } else if (size.height > 0.2 && size.width < 0.3) {
                        material = this.materials.metal;
                        metalCount++;
                    } else {
                        material = this.materials.woodGarden;
                        woodCount++;
                    }
                    console.log(`  📦 По умолчанию: ${child.name}`);
                }
                
                if (material) {
                    if (child.material && child.material.color) {
                        const colorKey = child.uuid + '_color';
                        if (!this.originalColors.has(colorKey)) {
                            this.originalColors.set(colorKey, child.material.color.getHex());
                        }
                    }
                    child.material = material.clone();
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.needsUpdate = true;
                }
            }
        });
        
        console.log(`✅ Материалы применены: Дерево=${woodCount}, Металл=${metalCount}`);
    }

    // ============================================================
    // ⭐ ОПРЕДЕЛЕНИЕ РАЗМЕРА МЕША
    // ============================================================
    getMeshSize(mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        return { width: size.x, height: size.y, depth: size.z };
    }

    // ============================================================
    // ⭐ ГЕНЕРАЦИЯ ID
    // ============================================================
    generateUniqueId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    cloneWithUniqueIds(source) {
        const clone = source.clone();
        const groupId = this.generateUniqueId();
        clone.userData.id = groupId;
        clone.userData.isFurniture = true;
        clone.traverse((child) => {
            if (child.isMesh) {
                child.userData.groupId = groupId;
                child.userData.furnitureId = groupId;
                child.userData.isFurniture = true;
            }
        });
        return clone;
    }

    // ============================================================
    // ⭐ ЗАГРУЗКА МОДЕЛЕЙ
    // ============================================================
    async loadTableModel() {
        if (this.isLoaded.table) return this.models.table;
        if (this.isLoading.table) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isLoaded.table) {
                        clearInterval(checkInterval);
                        resolve(this.models.table);
                    }
                }, 100);
            });
        }
        this.isLoading.table = true;
        try {
            const gltf = await this.loadModel('./models/furniture/Стол.glb');
            this.models.table = gltf.scene;
            this.isLoaded.table = true;
            this.isLoading.table = false;
            this.applyMaterialsToModel(this.models.table);
            console.log('✅ Модель стола загружена');
            return this.models.table;
        } catch (error) {
            console.error('❌ Ошибка загрузки стола:', error);
            this.isLoading.table = false;
            return this.createFallbackTable();
        }
    }

    async loadBenchModel() {
        if (this.isLoaded.bench) return this.models.bench;
        if (this.isLoading.bench) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isLoaded.bench) {
                        clearInterval(checkInterval);
                        resolve(this.models.bench);
                    }
                }, 100);
            });
        }
        this.isLoading.bench = true;
        try {
            const gltf = await this.loadModel('./models/furniture/Скамейка.glb');
            this.models.bench = gltf.scene;
            this.isLoaded.bench = true;
            this.isLoading.bench = false;
            this.applyMaterialsToModel(this.models.bench);
            console.log('✅ Модель скамейки загружена');
            return this.models.bench;
        } catch (error) {
            console.error('❌ Ошибка загрузки скамейки:', error);
            this.isLoading.bench = false;
            return this.createFallbackBench();
        }
    }

    async loadTableGardenModel() {
        if (this.isLoaded.tableGarden) return this.models.tableGarden;
        if (this.isLoading.tableGarden) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isLoaded.tableGarden) {
                        clearInterval(checkInterval);
                        resolve(this.models.tableGarden);
                    }
                }, 100);
            });
        }
        this.isLoading.tableGarden = true;
        try {
            const gltf = await this.loadModel('./models/furniture/table_garden.glb');
            this.models.tableGarden = gltf.scene;
            this.isLoaded.tableGarden = true;
            this.isLoading.tableGarden = false;
            this.applyGardenMaterials(this.models.tableGarden);
            console.log('✅ Модель садового стола загружена');
            return this.models.tableGarden;
        } catch (error) {
            console.error('❌ Ошибка загрузки садового стола:', error);
            this.isLoading.tableGarden = false;
            return this.createFallbackTableGarden();
        }
    }

    async loadGardenBenchModel() {
        if (this.isLoaded.benchGarden) return this.models.benchGarden;
        if (this.isLoading.benchGarden) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.isLoaded.benchGarden) {
                        clearInterval(checkInterval);
                        resolve(this.models.benchGarden);
                    }
                }, 100);
            });
        }
        this.isLoading.benchGarden = true;
        try {
            const gltf = await this.loadModel('./models/furniture/table_garden_bench.glb');
            this.models.benchGarden = gltf.scene;
            this.isLoaded.benchGarden = true;
            this.isLoading.benchGarden = false;
            this.applyGardenMaterials(this.models.benchGarden);
            console.log('✅ Модель садовой скамейки загружена');
            return this.models.benchGarden;
        } catch (error) {
            console.error('❌ Ошибка загрузки садовой скамейки:', error);
            this.isLoading.benchGarden = false;
            return this.createFallbackGardenBench();
        }
    }

    loadModel(url) {
        return new Promise((resolve, reject) => {
            // ⭐ ДОБАВЛЯЕМ ПАРАМЕТР ДЛЯ ОБХОДА КЭША
            const cacheBuster = Date.now();
            const urlWithCache = url + (url.includes('?') ? '&' : '?') + 't=' + cacheBuster;
            
            console.log(`📦 Загрузка: ${urlWithCache}`);
            this.gltfLoader.load(
                urlWithCache,
                (gltf) => {
                    console.log(`✅ Загружено: ${url}`);
                    resolve(gltf);
                },
                undefined,
                (error) => {
                    console.error(`❌ Ошибка: ${url}`, error);
                    reject(error);
                }
            );
        });
    }

    // ============================================================
    // ⭐ FALLBACK МОДЕЛИ
    // ============================================================
    createFallbackTable() {
        const group = new THREE.Group();
        const woodMat = this.materials.wood || new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const metalMat = this.materials.metal || new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), woodMat);
        top.position.y = 0.73;
        group.add(top);
        const legPos = [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]];
        legPos.forEach(pos => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 8), metalMat);
            leg.position.set(pos[0], 0.35, pos[1]);
            group.add(leg);
        });
        return group;
    }

    createFallbackBench() {
        const group = new THREE.Group();
        const woodMat = this.materials.wood || new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const woodDark = this.materials.woodDark || new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const metalMat = this.materials.metal || new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.4), woodMat);
        seat.position.y = 0.43;
        group.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.04), woodDark);
        back.position.set(0, 0.63, -0.2);
        back.rotation.x = 0.1;
        group.add(back);
        const legPos = [[-0.5, -0.15], [0.5, -0.15], [-0.5, 0.15], [0.5, 0.15]];
        legPos.forEach(pos => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.4, 8), metalMat);
            leg.position.set(pos[0], 0.2, pos[1]);
            group.add(leg);
        });
        return group;
    }

    createFallbackTableGarden() {
        const group = new THREE.Group();
        const woodMat = this.materials.woodGarden || this.materials.wood || new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const metalMat = this.materials.metal || new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.8), woodMat);
        top.position.y = 0.75;
        group.add(top);
        const legPos = [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]];
        legPos.forEach(pos => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.7, 8), metalMat);
            leg.position.set(pos[0], 0.35, pos[1]);
            group.add(leg);
        });
        return group;
    }

    createFallbackGardenBench() {
        const group = new THREE.Group();
        const woodMat = this.materials.woodGarden || this.materials.wood || new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const metalMat = this.materials.metal || new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.35), woodMat);
        seat.position.y = 0.43;
        group.add(seat);
        
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.04), woodMat);
        back.position.set(0, 0.6, -0.17);
        back.rotation.x = 0.1;
        group.add(back);
        
        const legPos = [[-0.4, -0.12], [0.4, -0.12], [-0.4, 0.12], [0.4, 0.12]];
        legPos.forEach(pos => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.4, 8), metalMat);
            leg.position.set(pos[0], 0.2, pos[1]);
            group.add(leg);
        });
        
        return group;
    }

    // ============================================================
    // ⭐ РАЗМЕЩЕНИЕ МЕБЕЛИ
    // ============================================================
    async placeTable(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const model = await this.loadTableModel();
        const clone = this.cloneWithUniqueIds(model);
        clone.scale.set(scale, scale, scale);
        clone.position.set(x, 0, z);
        clone.rotation.y = rotation;
        clone.userData.type = 'table';
        clone.userData.rotation = rotation;
        clone.userData.selected = false;
        this.furnitureGroup.add(clone);
        this.furniture.push({ type: 'table', group: clone, x, z, rotation, scale, id: clone.userData.id, selected: false });
        return clone;
    }

    async placeBench(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const model = await this.loadBenchModel();
        const clone = this.cloneWithUniqueIds(model);
        clone.scale.set(scale, scale, scale);
        clone.position.set(x, 0, z);
        clone.rotation.y = rotation;
        clone.userData.type = 'bench';
        clone.userData.rotation = rotation;
        clone.userData.selected = false;
        this.furnitureGroup.add(clone);
        this.furniture.push({ type: 'bench', group: clone, x, z, rotation, scale, id: clone.userData.id, selected: false });
        return clone;
    }

    async placeTableGarden(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const model = await this.loadTableGardenModel();
        const clone = this.cloneWithUniqueIds(model);
        clone.scale.set(scale, scale, scale);
        clone.position.set(x, 0, z);
        clone.rotation.y = rotation;
        clone.userData.type = 'table_garden';
        clone.userData.rotation = rotation;
        clone.userData.selected = false;
        this.furnitureGroup.add(clone);
        this.furniture.push({ type: 'table_garden', group: clone, x, z, rotation, scale, id: clone.userData.id, selected: false });
        console.log('🌳 Садовый стол размещён!');
        return clone;
    }

    async placeGardenBench(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const model = await this.loadGardenBenchModel();
        const clone = this.cloneWithUniqueIds(model);
        clone.scale.set(scale, scale, scale);
        clone.position.set(x, 0, z);
        clone.rotation.y = rotation;
        clone.userData.type = 'garden_bench';
        clone.userData.rotation = rotation;
        clone.userData.selected = false;
        this.furnitureGroup.add(clone);
        this.furniture.push({ type: 'garden_bench', group: clone, x, z, rotation, scale, id: clone.userData.id, selected: false });
        console.log('🌳 Садовая скамейка размещена!');
        return clone;
    }

    async placeGardenSet(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const results = [];
        
        // Стол
        const table = await this.placeTableGarden(x, z, rotation, scale);
        results.push(table);
        
        // Скамейка 1 (слева)
        const bench1 = await this.placeGardenBench(
            x - 0.8 * scale, 
            z, 
            rotation, 
            scale
        );
        results.push(bench1);
        
        // Скамейка 2 (справа)
        const bench2 = await this.placeGardenBench(
            x + 0.8 * scale, 
            z, 
            rotation, 
            scale
        );
        results.push(bench2);
        
        const setId = 'garden_set_' + Date.now();
        results.forEach(item => {
            item.userData.setId = setId;
        });
        
        console.log('🌳 Садовый набор размещён! (стол + 2 скамейки)');
        return { table, bench1, bench2, setId };
    }

    async placePicnicSet(x = 0, z = 2.5, rotation = 0, scale = 1.0) {
        const table = await this.placeTable(x, z, rotation, scale);
        const bench1 = await this.placeBench(x - 0.4, z, rotation, scale);
        const bench2 = await this.placeBench(x + 0.4, z, rotation, scale);
        return { table, bench1, bench2 };
    }

    // ============================================================
    // ⭐ ВЫДЕЛЕНИЕ
    // ============================================================
    selectFurniture(id) {
        this.furniture.forEach(item => {
            item.selected = false;
            item.group.userData.selected = false;
            this.removeHighlight(item.group);
        });
        const selected = this.furniture.find(f => f.id === id);
        if (selected) {
            selected.selected = true;
            selected.group.userData.selected = true;
            this.applyHighlight(selected.group);
            this.selectedId = id;
            this.updateSelectionUI(selected);
        } else {
            this.selectedId = null;
            const infoEl = document.getElementById('selectedFurnitureInfo');
            if (infoEl) infoEl.innerHTML = '❌ Ничего не выбрано';
        }
    }

    deselectAll() {
        console.log('🔽 Снимаем выделение со всей мебели');
        
        this.furniture.forEach(item => {
            item.selected = false;
            item.group.userData.selected = false;
            this.removeHighlight(item.group);
        });
        this.selectedId = null;
        
        const infoEl = document.getElementById('selectedFurnitureInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <span style="color: #666;">⬤</span>
                <span style="color: #888;">Ничего не выбрано</span>
            `;
        }
        
        this.renderer.domElement.style.cursor = 'default';
    }

    applyHighlight(group) {
        const groupId = group.userData.id;
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                if (child.userData.groupId === groupId) {
                    const colorKey = child.uuid + '_color';
                    if (!this.originalColors.has(colorKey) && child.material.color) {
                        this.originalColors.set(colorKey, child.material.color.getHex());
                    }
                    if (child.material.color) {
                        const origColor = this.originalColors.get(colorKey) || 0x888888;
                        const color = new THREE.Color(origColor);
                        const highlight = new THREE.Color(this.highlightColor);
                        color.lerp(highlight, 0.35);
                        child.material.color.set(color);
                        child.material.emissive = new THREE.Color(this.highlightColor);
                        child.material.emissiveIntensity = 0.15;
                    }
                }
            }
        });
    }

    removeHighlight(group) {
        const groupId = group.userData.id;
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                if (child.userData.groupId === groupId) {
                    const colorKey = child.uuid + '_color';
                    if (this.originalColors.has(colorKey) && child.material.color) {
                        child.material.color.setHex(this.originalColors.get(colorKey));
                    }
                    child.material.emissive = new THREE.Color(0x000000);
                    child.material.emissiveIntensity = 0;
                }
            }
        });
    }

    updateSelectionUI(selected) {
        const infoEl = document.getElementById('selectedFurnitureInfo');
        if (infoEl) {
            const typeNames = { 
                'table': '🪵 Стол', 
                'bench': '🪑 Скамейка', 
                'table_garden': '🌳 Садовый стол',
                'garden_bench': '🌳 Садовая скамейка'
            };
            infoEl.innerHTML = `
                <span style="color: #00ff88;">⬤</span>
                <span style="color: #fff;">${typeNames[selected.type] || selected.type}</span>
                <span style="
                    background: #00ff88;
                    color: #000;
                    padding: 2px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                ">✦ ВЫБРАНО</span>
                <span style="
                    background: #666;
                    color: #fff;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 9px;
                    cursor: pointer;
                    margin-left: 5px;
                " onclick="window.furniture3DManager?.deselectAll()">✖</span>
            `;
        }
    }

    getSelected() {
        return this.furniture.find(f => f.id === this.selectedId) || null;
    }

    // ============================================================
    // ⭐ DRAG-AND-DROP
    // ============================================================
    bindEvents() {
        // Mouse events
        this.renderer.domElement.addEventListener('mousedown', this.onPointerDown.bind(this));
        window.addEventListener('mousemove', this.onPointerMove.bind(this));
        window.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        // Touch events
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        
        // ⭐ СНЯТИЕ ВЫДЕЛЕНИЯ (РАБОТАЕТ НА ВСЕХ УСТРОЙСТВАХ)
        this.renderer.domElement.addEventListener('click', this.onCanvasClick.bind(this));
        
        // ⭐ ДЛЯ IPHONE: ДОПОЛНИТЕЛЬНЫЙ ОБРАБОТЧИК
        this.renderer.domElement.addEventListener('touchend', (event) => {
            if (!this.isDragging && !this._wasDragging) {
                const touch = event.changedTouches[0];
                if (touch) {
                    const mouseEvent = new MouseEvent('click', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                    });
                    this.onCanvasClick(mouseEvent);
                }
            }
            this._wasDragging = false;
        }, { passive: false });
        
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.rotateMode = true;
                this.moveMode = false;
                this.renderer.domElement.style.cursor = 'grab';
                this.updateModeUI();
            }
            // ⭐ КНОПКА ESC ДЛЯ СНЯТИЯ ВЫДЕЛЕНИЯ
            if (e.key === 'Escape') {
                this.deselectAll();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.rotateMode = false;
                this.moveMode = true;
                this.renderer.domElement.style.cursor = 'default';
                this.updateModeUI();
            }
        });
    }

    onCanvasClick(event) {
        if (this.isDragging) return;
        
        console.log('🖱️ Клик по канвасу');
        
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const furnitureMeshes = [];
        this.furnitureGroup.children.forEach(group => {
            group.traverse((node) => {
                if (node.isMesh) {
                    furnitureMeshes.push(node);
                }
            });
        });
        
        const intersects = this.raycaster.intersectObjects(furnitureMeshes);
        
        if (intersects.length === 0) {
            console.log('🔽 Клик в пустоту, снимаем выделение');
            this.deselectAll();
        }
    }

    getPointerPosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    findFurnitureByMesh(mesh) {
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.isFurniture && current.userData.id) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    onPointerDown(event) {
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        this.startDrag();
    }

    onPointerMove(event) {
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        if (this.isDragging) {
            if (this.rotateMode) this.updateRotation();
            else this.updateDrag();
        }
    }

    onPointerUp() { if (this.isDragging) this.endDrag(); }

    onTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const pos = this.getPointerPosition(touch);
        this.mouse.set(pos.x, pos.y);
        this.startDrag();
    }

    onTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const pos = this.getPointerPosition(touch);
        this.mouse.set(pos.x, pos.y);
        if (this.isDragging) {
            if (this.rotateMode) this.updateRotation();
            else this.updateDrag();
        }
    }

    onTouchEnd() { if (this.isDragging) this.endDrag(); }

    startDrag() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const furnitureMeshes = [];
        this.furnitureGroup.children.forEach(group => {
            group.traverse((node) => { if (node.isMesh) furnitureMeshes.push(node); });
        });
        const intersects = this.raycaster.intersectObjects(furnitureMeshes);
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const furnitureGroup = this.findFurnitureByMesh(hitMesh);
            if (furnitureGroup && furnitureGroup.userData.isFurniture) {
                const id = furnitureGroup.userData.id;
                this.selectFurniture(id);
                this.dragging = furnitureGroup;
                this.isDragging = true;
                this._wasDragging = true;
                if (this.controls) this.controls.enabled = false;
                const intersectPoint = intersects[0].point;
                this.dragOffset.copy(intersectPoint).sub(this.dragging.position);
                this.dragOffset.y = 0;
                this.dragStartPos.copy(this.dragging.position);
                this.dragStartRot = this.dragging.rotation.y;
                this.renderer.domElement.style.cursor = this.rotateMode ? 'grabbing' : 'grabbing';
            }
        }
    }

    updateDrag() {
        if (!this.dragging || !this.isDragging || this.rotateMode) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        const ray = this.raycaster.ray;
        const intersectPoint = ray.intersectPlane(plane, intersection);
        if (intersectPoint) {
            let newX = intersectPoint.x - this.dragOffset.x;
            let newZ = intersectPoint.z - this.dragOffset.z;
            if (this.snapToGrid) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newZ = Math.round(newZ / this.gridSize) * this.gridSize;
            }
            this.dragging.position.x = newX;
            this.dragging.position.z = newZ;
            const furnitureData = this.furniture.find(f => f.id === this.dragging.userData.id);
            if (furnitureData) {
                furnitureData.x = newX;
                furnitureData.z = newZ;
                this.updateSelectionUI(furnitureData);
            }
        }
    }

    updateRotation() {
        if (!this.dragging || !this.isDragging) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        const ray = this.raycaster.ray;
        const intersectPoint = ray.intersectPlane(plane, intersection);
        if (intersectPoint) {
            const dx = intersectPoint.x - this.dragging.position.x;
            const dz = intersectPoint.z - this.dragging.position.z;
            const angle = Math.atan2(dx, dz);
            const snapAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
            this.dragging.rotation.y = snapAngle;
            const furnitureData = this.furniture.find(f => f.id === this.dragging.userData.id);
            if (furnitureData) {
                furnitureData.rotation = snapAngle;
            }
        }
    }

    endDrag() {
        if (this.dragging) {
            if (this.controls) this.controls.enabled = true;
            this.renderer.domElement.style.cursor = this.rotateMode ? 'grab' : 'default';
            this.dragging = null;
            this.isDragging = false;
            this._wasDragging = false;
            const selected = this.getSelected();
            if (selected) this.updateSelectionUI(selected);
        }
    }

    // ============================================================
    // ⭐ РУЧНОЙ ПОВОРОТ
    // ============================================================
    rotateSelected(angle) {
        const selected = this.getSelected();
        if (selected) {
            selected.group.rotation.y += angle;
            selected.rotation = selected.group.rotation.y;
            return true;
        }
        return false;
    }

    // ============================================================
    // ⭐ УДАЛЕНИЕ
    // ============================================================
    deleteSelected() {
        if (this.selectedId) {
            const result = this.removeFurnitureById(this.selectedId);
            this.selectedId = null;
            if (this.furniture.length > 0) {
                this.selectFurniture(this.furniture[this.furniture.length - 1].id);
            } else {
                const infoEl = document.getElementById('selectedFurnitureInfo');
                if (infoEl) infoEl.innerHTML = '❌ Ничего не выбрано';
            }
            return result;
        }
        return false;
    }

    removeFurnitureById(id) {
        const index = this.furniture.findIndex(f => f.id === id);
        if (index !== -1) {
            const item = this.furniture[index];
            this.removeHighlight(item.group);
            this.furnitureGroup.remove(item.group);
            item.group.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(m => m.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                }
            });
            this.furniture.splice(index, 1);
            return true;
        }
        return false;
    }

    // ============================================================
    // ⭐ UI
    // ============================================================
    updateModeUI() {
        const modeEl = document.getElementById('furnitureMode');
        if (modeEl) {
            modeEl.textContent = this.rotateMode ? '🔄 Поворот' : '✋ Перемещение';
            modeEl.style.background = this.rotateMode ? '#e67e22' : '#00a896';
        }
    }

    // ============================================================
    // ⭐ ОЧИСТКА
    // ============================================================
    clearAll() {
        while(this.furnitureGroup.children.length > 0) {
            const child = this.furnitureGroup.children[0];
            child.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(m => m.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                }
            });
            this.furnitureGroup.remove(child);
        }
        this.furniture = [];
        this.selectedId = null;
        this.dragging = null;
        this.isDragging = false;
        this._wasDragging = false;
        this.originalColors.clear();
        if (this.controls) this.controls.enabled = true;
        const infoEl = document.getElementById('selectedFurnitureInfo');
        if (infoEl) infoEl.innerHTML = '❌ Ничего не выбрано';
    }

    setVisible(visible) {
        this.furnitureGroup.visible = visible;
    }

    setSnapToGrid(enabled, size = 0.1) {
        this.snapToGrid = enabled;
        this.gridSize = size;
    }

    getAllFurniture() {
        return this.furniture;
    }

    getSelectedId() {
        return this.selectedId;
    }

    update() {
        // Ничего не делаем
    }
}