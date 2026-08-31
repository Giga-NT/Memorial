// modules/VasesManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPBRMaterial, getTextureTypeFromMaterial } from './textures.min.js';

export class VasesManager {
    constructor(scene, camera, renderer, monumentGroup, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.monumentGroup = monumentGroup;
        this.controls = controls;
        
        this.vasesGroup = new THREE.Group();
        this.vasesGroup.name = 'vasesGroup';
        this.scene.add(this.vasesGroup);
        console.log('✅ vasesGroup добавлена в сцену');
        
        this.loader = new GLTFLoader();
        this.vases = [];
        this.selectedId = null;
        this.isDragging = false;
        this.draggedVase = null;
        this.dragOffset = new THREE.Vector3();
        this.vasesConfig = {};
        this.vaseScale = 1.0;
        this.vaseMaterial = 'marble';
        this.visible = true;
        this.materials = {};
        this.materialsLoaded = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        this.highlightColor = 0x00ff88;
        this.originalColors = new Map();
        
        this.loadVasesConfig();
        this.bindEvents();
    }
    
    // ============================================================
    // ⭐ ЗАГРУЗКА КОНФИГА ВАЗ
    // ============================================================
    async loadVasesConfig() {
        try {
            const response = await fetch('./vases-list.json');
            if (!response.ok) throw new Error('Файл vases-list.json не найден');
            const data = await response.json();
            data.vases.forEach(vase => {
                this.vasesConfig[vase.id] = {
                    file: vase.file,
                    name: vase.name,
                    defaultScale: vase.defaultScale || 1.0,
                    defaultHeight: vase.defaultHeight || 0.5,
                    defaultMaterial: vase.defaultMaterial || 'marble'
                };
            });
            console.log(`✅ Загружено ${Object.keys(this.vasesConfig).length} типов ваз`);
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки конфига ваз:', error);
            this.vasesConfig = {
                'vase1': { file: 'vase1.glb', name: 'Классическая', defaultScale: 1.0, defaultHeight: 0.5, defaultMaterial: 'marble' },
                'vase2': { file: 'vase2.glb', name: 'С узором', defaultScale: 1.0, defaultHeight: 0.55, defaultMaterial: 'granite' },
                'vase3': { file: 'vase3.glb', name: 'Высокая', defaultScale: 0.9, defaultHeight: 0.6, defaultMaterial: 'marble' }
            };
        }
        await this.loadMaterial(this.vaseMaterial);
        this.updateVasesList();
    }
    
    // ============================================================
    // ⭐ ЗАГРУЗКА МАТЕРИАЛА
    // ============================================================
    async loadMaterial(materialType) {
        try {
            console.log(`📥 Загрузка материала для ваз: ${materialType}`);
            const textureType = getTextureTypeFromMaterial(materialType);
            const material = await loadPBRMaterial(textureType);
            
            if (material) {
                this.materials[materialType] = material;
                this.vaseMaterial = materialType;
                this.materialsLoaded = true;
                console.log(`✅ Материал ${materialType} загружен для ваз`);
                this.applyMaterialToAllVases();
                return material;
            }
        } catch (error) {
            console.warn(`⚠️ Ошибка загрузки материала ${materialType}:`, error);
        }
        return null;
    }
    
    // ============================================================
    // ⭐ ПРИМЕНЕНИЕ МАТЕРИАЛА
    // ============================================================
    applyMaterialToAllVases() {
        if (!this.materialsLoaded) return;
        this.vases.forEach(vase => {
            this.applyMaterialToVase(vase);
        });
    }
    
    applyMaterialToVase(vaseData) {
        if (!this.materialsLoaded) return;
        
        const material = this.materials[this.vaseMaterial];
        if (!material) return;
        
        vaseData.group.traverse((child) => {
            if (child.isMesh) {
                const colorKey = child.uuid + '_color';
                if (!this.originalColors.has(colorKey) && child.material && child.material.color) {
                    this.originalColors.set(colorKey, child.material.color.getHex());
                }
                
                const newMaterial = material.clone();
                
                if (this.originalColors.has(colorKey)) {
                    newMaterial.color.setHex(this.originalColors.get(colorKey));
                }
                
                if (child.material && child.material.emissive) {
                    newMaterial.emissive = child.material.emissive.clone();
                    newMaterial.emissiveIntensity = child.material.emissiveIntensity || 0;
                }
                
                child.material = newMaterial;
                child.material.needsUpdate = true;
            }
        });
    }
    
    // ============================================================
    // ⭐ ЗАГРУЗКА МОДЕЛИ ВАЗЫ
    // ============================================================
    loadVaseModel(vaseId) {
        return new Promise((resolve, reject) => {
            const config = this.vasesConfig[vaseId];
            if (!config) {
                reject(new Error(`Ваза ${vaseId} не найдена`));
                return;
            }
            
            const path = `./models/vases/${config.file}`;
            console.log(`📥 Загрузка вазы: ${path}`);
            
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    console.log(`✅ Ваза ${vaseId} загружена`);
                    resolve(model);
                },
                undefined,
                (error) => {
                    console.error(`❌ Ошибка загрузки ${path}:`, error);
                    reject(error);
                }
            );
        });
    }
    
    // ============================================================
    // ⭐ ГЕНЕРАЦИЯ ID
    // ============================================================
    generateUniqueId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    cloneWithUniqueIds(source) {
        const clone = source.clone();
        const id = this.generateUniqueId();
        clone.userData.id = id;
        clone.userData.isVase = true;
        clone.traverse((child) => {
            if (child.isMesh) {
                child.userData.vaseId = id;
                child.userData.isVase = true;
            }
        });
        return clone;
    }
    
// ============================================================
// ⭐ ОПРЕДЕЛЕНИЕ ВЫСОТЫ ПОВЕРХНОСТИ (ИЩЕМ НАДГРОБИЕ/ОСНОВАНИЕ)
// ============================================================
// ============================================================
// ⭐ ОПРЕДЕЛЕНИЕ ВЫСОТЫ ПОВЕРХНОСТИ (ФИНАЛЬНАЯ)
// ============================================================
getSurfaceHeight(x, z) {
    let surfaceHeight = 0.0; // дефолтная высота (земля)
    
    if (this.monumentGroup) {
        this.monumentGroup.children.forEach(child => {
            if (!child.isMesh) return;
            
            // ⭐ ИЩЕМ ОСНОВАНИЕ/НАДГРОБИЕ (BoxGeometry)
            if (child.geometry.type === 'BoxGeometry') {
                const params = child.geometry.parameters;
                if (params) {
                    const boxHeight = params.height || 0;
                    const boxWidth = params.width || 0;
                    const boxDepth = params.depth || 0;
                    
                    // ⭐ ЭТО ОСНОВАНИЕ (широкое и плоское)
                    if (boxHeight < boxWidth * 0.5 && boxHeight < boxDepth * 0.5) {
                        const box = new THREE.Box3().setFromObject(child);
                        const minX = box.min.x;
                        const maxX = box.max.x;
                        const minZ = box.min.z;
                        const maxZ = box.max.z;
                        
                        const tolerance = 0.05;
                        if (x >= minX - tolerance && x <= maxX + tolerance && 
                            z >= minZ - tolerance && z <= maxZ + tolerance) {
                            
                            // ⭐ ПРАВИЛЬНАЯ ВЫСОТА: позиция центра + половина высоты
                            surfaceHeight = child.position.y + (boxHeight / 2);
                            console.log(`🪨 Надгробие найдено! Высота: ${surfaceHeight}`);
                        }
                    }
                }
            }
        });
    }
    
    return surfaceHeight;
}
    
    // ============================================================
    // ⭐ ДОБАВЛЕНИЕ ВАЗЫ
    // ============================================================
    async addVase(vaseId, x, z, scale = 1.0) {
        try {
            const model = await this.loadVaseModel(vaseId);
            if (!model) return null;
            
            const config = this.vasesConfig[vaseId];
            const clone = this.cloneWithUniqueIds(model);
            
            // Получаем bounding box ДО масштабирования
            const box = new THREE.Box3().setFromObject(clone);
            const size = box.getSize(new THREE.Vector3());
            const minY = box.min.y;
            
            // Вычисляем смещение от дна до центра
            const bottomOffset = -minY;
            
            // Масштабируем
            const targetHeight = config.defaultHeight || 0.5;
            const scaleFactor = targetHeight / Math.max(size.y, 0.01);
            const finalScale = scaleFactor * scale;
            clone.scale.set(finalScale, finalScale, finalScale);
            
            // ⭐ ОПРЕДЕЛЯЕМ ВЫСОТУ ПОВЕРХНОСТИ В ТОЧКЕ (x, z)
            const clampedX = Math.max(-0.5, Math.min(0.5, x));
            const clampedZ = Math.max(-0.5, Math.min(0.5, z));
            const surfaceHeight = this.getSurfaceHeight(clampedX, clampedZ);
            
            // ⭐ ПОЗИЦИОНИРУЕМ - ВАЗА СТАНОВИТСЯ НА ПОВЕРХНОСТЬ
            // +1 мм (0.001) для предотвращения z-fighting
            const vaseY = surfaceHeight - 0.01;
            clone.position.set(clampedX, vaseY, clampedZ);
            clone.rotation.y = Math.random() * Math.PI * 2;
            
            clone.userData.type = 'vase';
            clone.userData.vaseType = vaseId;
            clone.userData.rotation = clone.rotation.y;
            clone.userData.selected = false;
            clone.userData.surfaceHeight = surfaceHeight;
            
            this.vasesGroup.add(clone);
            
            const vaseData = {
                id: clone.userData.id,
                group: clone,
                type: 'vase',
                vaseType: vaseId,
                x: clampedX,
                z: clampedZ,
                rotation: clone.rotation.y,
                scale: finalScale,
                config: config,
                selected: false,
                surfaceHeight: surfaceHeight
            };
            
            this.vases.push(vaseData);
            
            if (this.materialsLoaded) {
                this.applyMaterialToVase(vaseData);
            }
            
            this.selectVase(vaseData.id);
            this.updateVasesList();
            
            console.log(`✅ Ваза ${config.name} добавлена на позицию (${clampedX.toFixed(2)}, ${clampedZ.toFixed(2)}) на высоте ${vaseY.toFixed(3)}`);
            return vaseData;
        } catch (error) {
            console.error('❌ Ошибка добавления вазы:', error);
            return null;
        }
    }
    
    // ============================================================
    // ⭐ ДОБАВЛЕНИЕ СЛУЧАЙНОЙ ВАЗЫ
    // ============================================================
    async addVaseRandom() {
        const vaseIds = Object.keys(this.vasesConfig);
        if (vaseIds.length === 0) {
            console.warn('⚠️ Нет доступных типов ваз');
            return null;
        }
        
        const randomId = vaseIds[Math.floor(Math.random() * vaseIds.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = 0.2 + Math.random() * 0.3;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        return this.addVase(randomId, x, z, this.vaseScale);
    }
    
    // ============================================================
    // ⭐ ВЫДЕЛЕНИЕ
    // ============================================================
    selectVase(id) {
        this.vases.forEach(item => {
            item.selected = false;
            item.group.userData.selected = false;
            this.removeHighlight(item.group);
        });
        
        const selected = this.vases.find(v => v.id === id);
        if (selected) {
            selected.selected = true;
            selected.group.userData.selected = true;
            this.applyHighlight(selected.group);
            this.selectedId = id;
            this.updateSelectionUI(selected);
        } else {
            this.selectedId = null;
            const infoEl = document.getElementById('selectedVaseInfo');
            if (infoEl) infoEl.innerHTML = '❌ Ничего не выбрано';
        }
        this.updateVasesList();
    }
    
    deselectAll() {
        console.log('🔽 Снимаем выделение со всех ваз');
        this.vases.forEach(item => {
            item.selected = false;
            item.group.userData.selected = false;
            this.removeHighlight(item.group);
        });
        this.selectedId = null;
        
        const infoEl = document.getElementById('selectedVaseInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <span style="color: #666;">⬤</span>
                <span style="color: #888;">Ничего не выбрано</span>
            `;
        }
        this.updateVasesList();
    }
    
    getSelected() {
        return this.vases.find(v => v.id === this.selectedId) || null;
    }
    
    // ============================================================
    // ⭐ ПОДСВЕТКА
    // ============================================================
    applyHighlight(group) {
        const groupId = group.userData.id;
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                if (child.userData.vaseId === groupId) {
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
                if (child.userData.vaseId === groupId) {
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
    
    // ============================================================
    // ⭐ УДАЛЕНИЕ
    // ============================================================
    removeSelected() {
        if (this.selectedId) {
            const result = this.removeVaseById(this.selectedId);
            this.selectedId = null;
            if (this.vases.length > 0) {
                this.selectVase(this.vases[this.vases.length - 1].id);
            } else {
                const infoEl = document.getElementById('selectedVaseInfo');
                if (infoEl) infoEl.innerHTML = '❌ Ничего не выбрано';
            }
            this.updateVasesList();
            return result;
        }
        return false;
    }
    
    removeVaseById(id) {
        const index = this.vases.findIndex(v => v.id === id);
        if (index !== -1) {
            const item = this.vases[index];
            this.removeHighlight(item.group);
            this.vasesGroup.remove(item.group);
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
            this.vases.splice(index, 1);
            this.updateVasesList();
            return true;
        }
        return false;
    }
    
    clearAll() {
        while(this.vasesGroup.children.length > 0) {
            const child = this.vasesGroup.children[0];
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
            this.vasesGroup.remove(child);
        }
        this.vases = [];
        this.selectedId = null;
        this.originalColors.clear();
        this.updateVasesList();
        console.log('🗑️ Все вазы удалены');
    }
    
    // ============================================================
    // ⭐ СМЕНА МАТЕРИАЛА
    // ============================================================
    async setMaterial(materialType) {
        console.log(`🔄 Смена материала ваз на: ${materialType}`);
        await this.loadMaterial(materialType);
    }
    
    // ============================================================
    // ⭐ ИЗМЕНЕНИЕ МАСШТАБА
    // ============================================================
    setScale(scale) {
        this.vaseScale = scale;
        this.vases.forEach(vase => {
            const config = vase.config;
            const baseScale = config?.defaultScale || 1.0;
            const newScale = scale * baseScale;
            vase.scale = newScale;
            
            const group = vase.group;
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const height = config?.defaultHeight || 0.5;
            const scaleFactor = height / Math.max(size.y, 0.01) * newScale;
            group.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // ⭐ ПЕРЕСЧИТЫВАЕМ ВЫСОТУ ПРИ ИЗМЕНЕНИИ МАСШТАБА
            // Получаем новую высоту поверхности
            const surfaceHeight = this.getSurfaceHeight(vase.x, vase.z);
            vase.group.position.y = surfaceHeight + 0.001;
            vase.surfaceHeight = surfaceHeight;
            
            console.log(`📏 Масштаб изменён, новая высота: ${vase.group.position.y.toFixed(3)}`);
        });
    }
    
    // ============================================================
    // ⭐ ОБНОВЛЕНИЕ ПОЗИЦИИ ПРИ ПЕРЕТАСКИВАНИИ
    // ============================================================
    updateVasePosition(vaseData, newX, newZ) {
        // Обновляем позицию
        vaseData.x = newX;
        vaseData.z = newZ;
        vaseData.group.position.x = newX;
        vaseData.group.position.z = newZ;
        
        // ⭐ ПЕРЕСЧИТЫВАЕМ ВЫСОТУ ПОВЕРХНОСТИ
        const surfaceHeight = this.getSurfaceHeight(newX, newZ);
        vaseData.group.position.y = surfaceHeight - 0.01;
        vaseData.surfaceHeight = surfaceHeight;
        
        console.log(`📍 Ваза перемещена на (${newX.toFixed(2)}, ${newZ.toFixed(2)}), высота: ${surfaceHeight.toFixed(3)}`);
    }
    
    // ============================================================
    // ⭐ DRAG-AND-DROP (ОБНОВЛЕННЫЙ)
    // ============================================================
    bindEvents() {
        this.renderer.domElement.addEventListener('mousedown', this.onPointerDown.bind(this));
        window.addEventListener('mousemove', this.onPointerMove.bind(this));
        window.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        
        this.renderer.domElement.addEventListener('click', this.onCanvasClick.bind(this));
        
        this.renderer.domElement.addEventListener('touchend', (event) => {
            if (!this.isDragging) {
                const touch = event.changedTouches[0];
                if (touch) {
                    const mouseEvent = new MouseEvent('click', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                    });
                    this.onCanvasClick(mouseEvent);
                }
            }
        }, { passive: false });
    }
    
    getPointerPosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
    }
    
    findVaseByMesh(mesh) {
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.isVase && current.userData.id) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
    
    onCanvasClick(event) {
        if (this.isDragging) return;
        
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const vaseMeshes = [];
        this.vasesGroup.children.forEach(group => {
            group.traverse((node) => {
                if (node.isMesh) {
                    vaseMeshes.push(node);
                }
            });
        });
        
        const intersects = this.raycaster.intersectObjects(vaseMeshes);
        
        if (intersects.length === 0) {
            console.log('🔽 Клик в пустоту, снимаем выделение');
            this.deselectAll();
        }
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
            this.updateDrag();
        }
    }
    
    onPointerUp() {
        if (this.isDragging) this.endDrag();
    }
    
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
            this.updateDrag();
        }
    }
    
    onTouchEnd() {
        if (this.isDragging) this.endDrag();
    }
    
    startDrag() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const vaseMeshes = [];
        this.vasesGroup.children.forEach(group => {
            group.traverse((node) => {
                if (node.isMesh) vaseMeshes.push(node);
            });
        });
        const intersects = this.raycaster.intersectObjects(vaseMeshes);
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const vaseGroup = this.findVaseByMesh(hitMesh);
            if (vaseGroup && vaseGroup.userData.isVase) {
                const id = vaseGroup.userData.id;
                this.selectVase(id);
                this.draggedVase = vaseGroup;
                this.isDragging = true;
                if (this.controls) this.controls.enabled = false;
                const intersectPoint = intersects[0].point;
                this.dragOffset.copy(intersectPoint).sub(this.draggedVase.position);
                this.dragOffset.y = 0;
                this.renderer.domElement.style.cursor = 'grabbing';
            }
        }
    }
    
    updateDrag() {
        if (!this.draggedVase || !this.isDragging) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        const ray = this.raycaster.ray;
        const intersectPoint = ray.intersectPlane(plane, intersection);
        if (intersectPoint) {
            const newX = intersectPoint.x - this.dragOffset.x;
            const newZ = intersectPoint.z - this.dragOffset.z;
            
            // ⭐ ОБНОВЛЯЕМ ПОЗИЦИЮ С ПЕРЕСЧЁТОМ ВЫСОТЫ
            const vaseData = this.vases.find(v => v.id === this.draggedVase.userData.id);
            if (vaseData) {
                this.updateVasePosition(vaseData, newX, newZ);
                this.updateSelectionUI(vaseData);
                this.updateVasesList();
            }
        }
    }
    
    endDrag() {
        if (this.draggedVase) {
            if (this.controls) this.controls.enabled = true;
            this.renderer.domElement.style.cursor = 'default';
            this.draggedVase = null;
            this.isDragging = false;
            const selected = this.getSelected();
            if (selected) this.updateSelectionUI(selected);
        }
    }
    
    // ============================================================
    // ⭐ UI
    // ============================================================
    updateSelectionUI(selected) {
        const infoEl = document.getElementById('selectedVaseInfo');
        if (infoEl && selected) {
            const name = selected.config?.name || selected.vaseType || 'Ваза';
            infoEl.innerHTML = `
                <span style="color: #e67e22;">⬤</span>
                <span style="color: #fff;">🏺 ${name}</span>
                <span style="
                    background: #e67e22;
                    color: #fff;
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
                " onclick="window.vasesManager?.deselectAll()">✖</span>
            `;
        }
    }
    
    updateVasesList() {
        const container = document.getElementById('vasesList');
        if (!container) return;
        
        if (this.vases.length === 0) {
            container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px; font-size: 12px;">Нет добавленных ваз</div>';
            return;
        }
        
        let html = '';
        this.vases.forEach((vase, index) => {
            const name = vase.config?.name || vase.vaseType || 'Ваза';
            const isSelected = this.selectedId === vase.id;
            html += `
                <div class="vase-list-item" data-id="${vase.id}" style="
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 6px 10px; 
                    margin: 4px 0; 
                    background: ${isSelected ? 'rgba(230,126,34,0.25)' : 'rgba(255,255,255,0.05)'};
                    border-radius: 6px;
                    border-left: 3px solid ${isSelected ? '#e67e22' : '#666'};
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    <span style="font-size: 12px;">🏺 ${name}</span>
                    <button class="remove-vase-btn" data-id="${vase.id}" style="
                        background: #e74c3c; 
                        border: none; 
                        color: white; 
                        width: auto; 
                        padding: 2px 8px; 
                        margin: 0; 
                        border-radius: 4px; 
                        font-size: 11px; 
                        cursor: pointer;
                    ">✖</button>
                </div>
            `;
        });
        container.innerHTML = html;
        
        container.querySelectorAll('.vase-list-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                this.selectVase(id);
            });
        });
        
        container.querySelectorAll('.remove-vase-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.selectVase(id);
                this.removeSelected();
            });
        });
    }
    
    // ============================================================
    // ⭐ УПРАВЛЕНИЕ
    // ============================================================
    setVisible(visible) {
        this.visible = visible;
        this.vasesGroup.visible = visible;
    }
    
    getAllVases() {
        return this.vases;
    }
    
    getSelectedId() {
        return this.selectedId;
    }
}