// modules/multiMonumentManager.js

import * as THREE from 'three';
import { loadFlowerbedTexture } from './textures.min.js';

// ⭐ КАРТА ТЕКСТУР
const TEXTURE_PATHS = {
    'granite': './textures/gabbro/color.webp',
    'black_galaxy': './textures/black_galaxy/color.webp',
    'ninimyaki': './textures/ninimyaki/color.webp',
    'marble': './textures/marble/color.webp',
    'red_granite': './textures/red_granite/color.webp',
    'beige_granite': './textures/beige_granite/color.webp',
    'gray_granite': './textures/gray_granite/gray-polished-granite_albedo.webp'
};

const FALLBACK_COLORS = {
    'granite': 0x1a1a1a,
    'black_galaxy': 0x111111,
    'ninimyaki': 0x1a2a1a,
    'marble': 0xf5f5f5,
    'red_granite': 0x8b0000,
    'beige_granite': 0xd4b896,
    'gray_granite': 0x808080
};

const textureCache = new Map();

function loadTextureForMaterial(materialType) {
    return new Promise((resolve) => {
        if (textureCache.has(materialType)) {
            resolve(textureCache.get(materialType));
            return;
        }
        
        const path = TEXTURE_PATHS[materialType];
        if (!path) {
            resolve(null);
            return;
        }
        
        const loader = new THREE.TextureLoader();
        loader.load(
            path,
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, 1);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = 4;
                textureCache.set(materialType, texture);
                resolve(texture);
            },
            undefined,
            () => {
                const altPath = path.replace('.webp', '.jpg');
                loader.load(
                    altPath,
                    (texture) => {
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(1, 1);
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.anisotropy = 4;
                        textureCache.set(materialType, texture);
                        resolve(texture);
                    },
                    undefined,
                    () => {
                        resolve(null);
                    }
                );
            }
        );
    });
}

async function createSteleMaterialWithTexture(materialType, isBase = false) {
    const texture = await loadTextureForMaterial(materialType);
    
    const material = new THREE.MeshStandardMaterial({
        roughness: isBase ? 0.7 : 0.25,
        metalness: isBase ? 0.02 : 0.05
    });
    
    if (texture) {
        material.map = texture;
        material.color = new THREE.Color(0xffffff);
    } else {
        const color = FALLBACK_COLORS[materialType] || 0x888888;
        material.color = new THREE.Color(color);
    }
    
    material.needsUpdate = true;
    return material;
}

export class MultiMonumentManager {
    constructor(scene, renderer, controls) {
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        
        // ⭐ ГРУППА ДЛЯ ДУБЛЕРОВ
        this.monumentsGroup = new THREE.Group();
        this.monumentsGroup.userData.isMonumentGroup = true;
        this.monumentsGroup.userData.isDuplicatorGroup = true;
        this.scene.add(this.monumentsGroup);
        
        this.monuments = [];
        this.mainPhotoMesh = null; 
        this.activeIndex = -1;
        this.nextId = 1;
        this.isUpdating = false;
        this.isRebuilding = false;
        this._isSleeping = false;
        this._isMoveModeActive = false;
        this._skipDuplicatorRebuild = false;
        this._pendingPhotoUrl = null;
        
        this.currentMode = 'main';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        this._savedState = null;
        this._duplicatorDataCache = {};
        this._blockStateUpdate = false;
        
        window._disableAutoMonument = true;
        window._isDuplicatorMode = false;
        
        this.createUI();
        this.bindEvents();
    
        this.setupPhotoDragHandlers();
        this.setupDuplicatorPhotoDragHandlers();
        // this.setupTextDragHandlers();
    }

    // ⭐ DRAG ДЛЯ ФОТО ДУБЛЕРОВ
    setupDuplicatorPhotoDragHandlers() {
        const canvas = this.renderer.domElement;
        if (!canvas) return;
        
        let isDragging = false;
        let selectedPhoto = null;
        let selectedDuplicatorIndex = -1;
        let dragOffset = { x: 0, y: 0 };
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const camera = this.controls.object;
        
        const onPointerDown = (event) => {
            if (this.currentMode !== 'duplicator' || this.activeIndex < 0) return;
            
            const enableMovePhoto = document.getElementById('enableMovePhoto');
            if (enableMovePhoto && !enableMovePhoto.checked) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            mouse.set(x, y);
            raycaster.setFromCamera(mouse, camera);
            
            const allMeshes = [];
            this.monuments.forEach((mon) => {
                mon.group.traverse((child) => {
                    if (child.isMesh) {
                        allMeshes.push(child);
                    }
                });
            });
            
            const intersects = raycaster.intersectObjects(allMeshes);
            
            for (const hit of intersects) {
                const obj = hit.object;
                if (obj.userData && obj.userData.isDuplicatorPhoto) {
                    let duplicatorIndex = -1;
                    this.monuments.forEach((mon, idx) => {
                        if (mon.group.children.includes(obj.parent) || mon.group === obj.parent) {
                            duplicatorIndex = idx;
                        }
                    });
                    
                    if (duplicatorIndex !== this.activeIndex) {
                        continue;
                    }
                    
                    console.log('✅ НАШЛИ ФОТО ДУБЛЕРА!');
                    isDragging = true;
                    selectedPhoto = obj;
                    selectedDuplicatorIndex = duplicatorIndex;
                    dragOffset.x = hit.point.x - obj.position.x;
                    dragOffset.y = hit.point.y - obj.position.y;
                    
                    canvas.style.cursor = 'grabbing';
                    if (this.controls) {
                        this.controls.enabled = false;
                    }
                    break;
                }
            }
        };
        
        const onPointerMove = (event) => {
            if (!isDragging || !selectedPhoto) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const planeZ = selectedPhoto.position.z;
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
            const mouseVec = new THREE.Vector3(x, y, 0.5);
            const r = new THREE.Raycaster();
            r.setFromCamera(mouseVec, camera);
            
            const intersectionPoint = new THREE.Vector3();
            r.ray.intersectPlane(plane, intersectionPoint);
            
            if (intersectionPoint) {
                let newX = intersectionPoint.x - dragOffset.x;
                let newY = intersectionPoint.y - dragOffset.y;
                
                const limitX = selectedPhoto.userData?.limitX || 0.3;
                const limitY = selectedPhoto.userData?.limitY || 0.3;
                const centerY = selectedPhoto.userData?.steleCenterY || 0.6;
                
                newX = Math.max(-limitX, Math.min(limitX, newX));
                const minY = centerY - limitY;
                const maxY = centerY + limitY;
                newY = Math.max(minY, Math.min(maxY, newY));
                
                selectedPhoto.position.x = newX;
                selectedPhoto.position.y = newY;
                
                if (selectedDuplicatorIndex >= 0 && selectedDuplicatorIndex < this.monuments.length) {
                    const mon = this.monuments[selectedDuplicatorIndex];
                    if (mon && mon.data) {
                        mon.data.photoOffsetX = newX;
                        mon.data.photoOffsetY = newY - centerY;
                        mon.data.photoAbsoluteX = newX;
                        mon.data.photoAbsoluteY = newY;
                        this._duplicatorDataCache[selectedDuplicatorIndex] = { ...mon.data };
                    }
                }
                
                if (this.renderer && this.scene && this.controls) {
                    this.renderer.render(this.scene, this.controls.object);
                }
            }
        };
        
        const onPointerUp = () => {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'default';
                if (this.controls) {
                    this.controls.enabled = true;
                }
                selectedPhoto = null;
                selectedDuplicatorIndex = -1;
            }
        };
        
        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        
        this._duplicatorPhotoDragHandlers = { onPointerDown, onPointerMove, onPointerUp };
    }

    setupPhotoDragHandlers() {
        const canvas = this.renderer.domElement;
        if (!canvas) return;
        
        let isDragging = false;
        let selectedPhoto = null;
        let dragOffset = { x: 0, y: 0 };
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const camera = this.controls.object;
        
        const findPhoto = () => {
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
                    if (child.isMesh && child.geometry.type === 'CircleGeometry') {
                        if (!child.userData) child.userData = {};
                        child.userData.type = 'photo';
                        child.userData.isDraggable = true;
                        child.userData.limitX = 0.5;
                        child.userData.limitY = 0.8;
                        child.userData.steleCenterY = 0.6;
                        child.userData.isMainPhoto = true;
                        child.userData._foundType = 'main';
                        return child;
                    }
                    if (child.userData && child.userData.type === 'photo') {
                        return child;
                    }
                }
            }
            
            if (this.mainPhotoMesh) {
                return this.mainPhotoMesh;
            }
            
            return null;
        };
        
        canvas.addEventListener('pointerdown', (event) => {
            const enableMovePhoto = document.getElementById('enableMovePhoto');
            if (enableMovePhoto && !enableMovePhoto.checked) {
                return;
            }
            
            if (window.furniture3DManager && window.furniture3DManager.isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            mouse.set(x, y);
            raycaster.setFromCamera(mouse, camera);
            
            const allMeshes = [];
            if (window.monumentGroup) {
                window.monumentGroup.traverse((child) => {
                    if (child.isMesh) {
                        allMeshes.push(child);
                    }
                });
            }
            
            const photo = findPhoto();
            if (photo && !allMeshes.includes(photo)) {
                allMeshes.push(photo);
            }
            
            const intersects = raycaster.intersectObjects(allMeshes);
            
            for (const hit of intersects) {
                if (hit.object === photo || (hit.object.userData && hit.object.userData.type === 'photo')) {
                    isDragging = true;
                    selectedPhoto = hit.object;
                    dragOffset.x = hit.point.x - hit.object.position.x;
                    dragOffset.y = hit.point.y - hit.object.position.y;
                    this.mainPhotoMesh = hit.object;
                    
                    canvas.style.cursor = 'grabbing';
                    if (this.controls) {
                        this.controls.enabled = false;
                    }
                    break;
                }
            }
        });
            
        const onPointerMove = (event) => {
            if (!isDragging || !selectedPhoto) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const planeZ = selectedPhoto.position.z;
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
            const mouseVec = new THREE.Vector3(x, y, 0.5);
            const r = new THREE.Raycaster();
            r.setFromCamera(mouseVec, camera);
            
            const intersectionPoint = new THREE.Vector3();
            r.ray.intersectPlane(plane, intersectionPoint);
            
            if (intersectionPoint) {
                let newX = intersectionPoint.x - dragOffset.x;
                let newY = intersectionPoint.y - dragOffset.y;
                
                const limitX = selectedPhoto.userData?.limitX || 0.3;
                const limitY = selectedPhoto.userData?.limitY || 0.3;
                const centerY = selectedPhoto.userData?.steleCenterY || 0.6;
                
                newX = Math.max(-limitX, Math.min(limitX, newX));
                const minY = centerY - limitY;
                const maxY = centerY + limitY;
                newY = Math.max(minY, Math.min(maxY, newY));
                
                selectedPhoto.position.x = newX;
                selectedPhoto.position.y = newY;
                
                if (window.state) {
                    window.state.photoOffsetX = newX;
                    window.state.photoOffsetY = newY - centerY;
                    window.state.photoAbsoluteX = newX;
                    window.state.photoAbsoluteY = newY;
                }
                if (this.renderer && this.scene && this.controls) {
                    this.renderer.render(this.scene, this.controls.object);
                }
            }
        };
        
        const onPointerUp = () => {
            if (isDragging && selectedPhoto) {
                if (window.state) {
                    const centerY = selectedPhoto.userData?.steleCenterY || 0.6;
                    window.state.photoOffsetX = selectedPhoto.position.x;
                    window.state.photoOffsetY = selectedPhoto.position.y - centerY;
                    window.state.photoAbsoluteX = selectedPhoto.position.x;
                    window.state.photoAbsoluteY = selectedPhoto.position.y;
                }
                
                isDragging = false;
                canvas.style.cursor = 'default';
                if (this.controls) {
                    this.controls.enabled = true;
                }
                selectedPhoto = null;
            }
        };
        
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        
        this._photoDragHandlers = { onPointerMove, onPointerUp };
    }

setupTextDragHandlers() {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;

    let isDragging = false;
    let dragType = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;
    let draggedMesh = null;

    let activeMonumentIndex = -1;
    let activeMonumentData = null;
    let isMainMonument = false;
    let centerY = 0.6;

    const findText = (x, y) => {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);

        raycaster.setFromCamera(mouse, this.controls.object);

        const meshes = [];

        // =========================================================
        // ОСНОВНОЙ ПАМЯТНИК
        // =========================================================
        if (this.currentMode === 'main') {
            const mainGroup = window.monumentGroup;

            if (mainGroup) {
                mainGroup.traverse((child) => {
                    if (
                        child.isMesh &&
                        child.userData &&
                        child.userData.isDraggable &&
                        child.userData.textType
                    ) {
                        meshes.push(child);
                    }
                });
            }
        }

        // =========================================================
        // ДУБЛЕР
        // =========================================================
        else if (this.currentMode === 'duplicator') {
            if (this.monumentsGroup) {
                this.monumentsGroup.traverse((child) => {
                    if (
                        child.isMesh &&
                        child.userData &&
                        child.userData.isDraggable &&
                        child.userData.textType
                    ) {
                        meshes.push(child);
                    }
                });
            }
        }

        if (!meshes.length) return null;

        const intersects = raycaster.intersectObjects(meshes, true);

        if (!intersects.length) return null;

        return intersects[0].object;
    };

    // =============================================================
    // POINTER DOWN
    // =============================================================
    const onPointerDown = (event) => {

        // Для основного и дублера разрешаем работу
        if (
            this.currentMode !== 'main' &&
            this.currentMode !== 'duplicator'
        ) {
            return;
        }

        const enableDragText = document.getElementById('enableDragText');

        if (!enableDragText || !enableDragText.checked) {
            return;
        }

        // Если включено перемещение фото — текст не хватаем
        const enableMovePhoto = document.getElementById('enableMovePhoto');

        if (enableMovePhoto && enableMovePhoto.checked) {
            return;
        }

        const rect = canvas.getBoundingClientRect();

        const x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        const y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const hit = findText(x, y);

        if (!hit) return;

        // =========================================================
        // НАЧАЛО DRAG
        // =========================================================

        isDragging = true;

        draggedMesh = hit;

        dragType = hit.userData.textType;

        dragStartX = x;
        dragStartY = y;

        startOffsetX = hit.position.x;
        startOffsetY = hit.position.y;

        activeMonumentIndex = -1;
        activeMonumentData = null;

        isMainMonument = this.currentMode === 'main';

        // =========================================================
        // ОСНОВНОЙ ПАМЯТНИК
        // =========================================================

        if (isMainMonument) {

            activeMonumentData = window.state;

            if (activeMonumentData) {
                centerY =
                    (activeMonumentData.height || 1.2) / 2;
            }

            console.log(
                '📝 НАЧАЛО ПЕРЕМЕЩЕНИЯ ТЕКСТА ОСНОВНОГО:',
                {
                    type: dragType,
                    x: startOffsetX,
                    y: startOffsetY
                }
            );
        }

        // =========================================================
        // ДУБЛЕР
        // =========================================================

        else {

            let parent = hit.parent;

            while (parent) {

                if (
                    parent.userData &&
                    parent.userData.isMonument
                ) {

                    for (
                        let i = 0;
                        i < this.monuments.length;
                        i++
                    ) {

                        if (
                            this.monuments[i].group === parent
                        ) {
                            activeMonumentIndex = i;

                            activeMonumentData =
                                this.monuments[i].data;

                            break;
                        }
                    }

                    break;
                }

                parent = parent.parent;
            }

            // fallback на активный дублер
            if (
                activeMonumentIndex === -1 &&
                this.activeIndex >= 0 &&
                this.monuments[this.activeIndex]
            ) {

                activeMonumentIndex = this.activeIndex;

                activeMonumentData =
                    this.monuments[activeMonumentIndex].data;
            }

            if (activeMonumentData) {
                centerY =
                    (activeMonumentData.height || 1.2) / 2;
            }

            console.log(
                '📝 НАЧАЛО ПЕРЕМЕЩЕНИЯ ТЕКСТА ДУБЛЕРА:',
                {
                    index: activeMonumentIndex,
                    type: dragType,
                    x: startOffsetX,
                    y: startOffsetY
                }
            );
        }

        this.controls.enabled = false;

        canvas.style.cursor = 'grabbing';

        // Чтобы клик не ушёл дальше в другие обработчики
        event.preventDefault();
    };

    // =============================================================
    // POINTER MOVE
    // =============================================================
    const onPointerMove = (event) => {

        if (
            !isDragging ||
            !dragType ||
            !draggedMesh
        ) {
            return;
        }

        const rect = canvas.getBoundingClientRect();

        const x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        const y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const sensitivity = 0.5;

        const deltaX =
            (x - dragStartX) * sensitivity;

        const deltaY =
            (y - dragStartY) * sensitivity;

        let newX =
            startOffsetX + deltaX;

        let newY =
            startOffsetY + deltaY;

        // =========================================================
        // ОГРАНИЧЕНИЯ
        // =========================================================

        let limitX = 0.3;
        let limitY = 0.6;

        if (activeMonumentData) {

            const w =
                activeMonumentData.width || 0.6;

            const h =
                activeMonumentData.height || 1.2;

            limitX =
                (w / 2) * 0.8;

            limitY =
                (h / 2) * 0.8;
        }

        newX =
            Math.max(
                -limitX,
                Math.min(limitX, newX)
            );

        newY =
            Math.max(
                -limitY,
                Math.min(limitY, newY)
            );

        // =========================================================
        // КЛЮЧЕВОЕ:
        // СРАЗУ ДВИГАЕМ СУЩЕСТВУЮЩИЙ MESH
        // =========================================================

        draggedMesh.position.x = newX;
        draggedMesh.position.y = newY;

        // =========================================================
        // ОСНОВНОЙ ПАМЯТНИК
        // =========================================================

        if (isMainMonument) {

            if (window.state) {

                if (dragType === 'name') {

                    window.state.textOffsetX = newX;

                    window.state.textOffsetY =
                        newY - centerY;

                } else if (dragType === 'epitaph') {

                    window.state.epitaphOffsetX = newX;

                    window.state.epitaphOffsetY =
                        newY - centerY;
                }

                console.log(
                    '🔄 ОСНОВНОЙ ТЕКСТ:',
                    {
                        type: dragType,
                        x: newX,
                        y: newY,
                        offsetX: dragType === 'name'
                            ? window.state.textOffsetX
                            : window.state.epitaphOffsetX,
                        offsetY: dragType === 'name'
                            ? window.state.textOffsetY
                            : window.state.epitaphOffsetY
                    }
                );
            }
        }

        // =========================================================
        // ДУБЛЕР
        // =========================================================

        else if (
            activeMonumentIndex >= 0 &&
            this.monuments[activeMonumentIndex]
        ) {

            const mon =
                this.monuments[activeMonumentIndex];

            if (mon.data) {

                if (dragType === 'name') {

                    mon.data.textOffsetX = newX;

                    mon.data.textOffsetY =
                        newY - centerY;

                } else if (dragType === 'epitaph') {

                    mon.data.epitaphOffsetX = newX;

                    mon.data.epitaphOffsetY =
                        newY - centerY;
                }

                this._duplicatorDataCache[
                    activeMonumentIndex
                ] = {
                    ...mon.data
                };
            }
        }

        // =========================================================
        // МГНОВЕННЫЙ РЕНДЕР
        // =========================================================

        if (
            this.renderer &&
            this.scene &&
            this.controls
        ) {
            this.renderer.render(
                this.scene,
                this.controls.object
            );
        }

        event.preventDefault();
    };

    // =============================================================
    // POINTER UP
    // =============================================================
    const onPointerUp = () => {

        if (!isDragging) {
            return;
        }

        const index = activeMonumentIndex;

        const wasMain = isMainMonument;

        const finishedType = dragType;

        isDragging = false;

        dragType = null;

        draggedMesh = null;

        activeMonumentIndex = -1;

        activeMonumentData = null;

        isMainMonument = false;

        this.controls.enabled = true;

        canvas.style.cursor = 'default';

        console.log(
            '✅ ЗАВЕРШЕНО ПЕРЕМЕЩЕНИЕ ТЕКСТА:',
            {
                main: wasMain,
                index,
                type: finishedType
            }
        );

        // =========================================================
        // ДЛЯ ДУБЛЕРА ОСТАВЛЯЕМ REBUILD
        // =========================================================

        if (
            !wasMain &&
            index >= 0 &&
            this.monuments[index]
        ) {

            setTimeout(() => {

                this.rebuildSimpleMonument(index);

            }, 50);
        }

        // =========================================================
        // ДЛЯ ОСНОВНОГО НИЧЕГО НЕ ПЕРЕСОЗДАЁМ
        // Mesh уже перемещён в onPointerMove.
        // =========================================================
    };

    // =============================================================
    // УДАЛЯЕМ СТАРЫЕ ОБРАБОТЧИКИ
    // =============================================================

    if (this._textDragHandlers) {

        const old =
            this._textDragHandlers;

        window.removeEventListener(
            'pointerdown',
            old.onPointerDown
        );

        window.removeEventListener(
            'pointermove',
            old.onPointerMove
        );

        window.removeEventListener(
            'pointerup',
            old.onPointerUp
        );
    }

    // =============================================================
    // НОВЫЕ ОБРАБОТЧИКИ
    // =============================================================

    window.addEventListener(
        'pointerdown',
        onPointerDown
    );

    window.addEventListener(
        'pointermove',
        onPointerMove
    );

    window.addEventListener(
        'pointerup',
        onPointerUp
    );

    this._textDragHandlers = {
        onPointerDown,
        onPointerMove,
        onPointerUp
    };

    console.log(
        '✅ setupTextDragHandlers(): main + duplicator'
    );
}

    updatePhotoPosition(photoMesh, x, y) {
        const isMain = photoMesh.userData && photoMesh.userData.isMainPhoto === true;
        const foundType = photoMesh.userData && photoMesh.userData._foundType;
        
        if (isMain || foundType === 'main') {
            if (window.state) {
                window.state.photoOffsetX = x;
                window.state.photoOffsetY = y;
            }
            this.mainPhotoMesh = photoMesh;
            return;
        }
        
        if (this.activeIndex < 0) return;
        const index = this.activeIndex;
        const mon = this.monuments[index];
        if (!mon || !mon.data) return;
        
        mon.data.photoOffsetX = x;
        mon.data.photoOffsetY = y;
        this._duplicatorDataCache[index] = { ...mon.data };
        this.rebuildSimpleMonument(index);
    }
    
    createUI() {
        const container = document.getElementById('monumentListContainer');
        if (container) {
            this.renderMonumentList();
        }
    }

    renderMonumentList() {
        const container = document.getElementById('monumentListContainer');
        if (!container) return;
        
        const countEl = document.getElementById('monumentCount');
        if (countEl) countEl.textContent = this.monuments.length || 1;
        
        const isMainActive = this.currentMode === 'main';
        let html = `
            <div class="monument-item" data-index="-1" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                margin-bottom: 4px;
                background: ${isMainActive ? 'rgba(0,168,150,0.3)' : 'rgba(255,255,255,0.03)'};
                border-radius: 6px;
                border: 1px solid ${isMainActive ? '#00a896' : 'rgba(255,255,255,0.05)'};
                cursor: pointer;
                transition: all 0.2s;
                font-size: 13px;
            ">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;">
                    <span style="color: ${isMainActive ? '#00a896' : '#666'};">
                        ${isMainActive ? '▶' : '⬤'}
                    </span>
                    <span style="color: ${isMainActive ? '#fff' : '#aaa'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        🪦 Основной памятник
                    </span>
                    <span style="font-size: 10px; color: #666; flex-shrink: 0;">(управление)</span>
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    <button class="select-main-btn" style="
                        background: none;
                        border: none;
                        color: ${isMainActive ? '#00a896' : '#666'};
                        cursor: pointer;
                        padding: 2px 6px;
                        font-size: 12px;
                        width: auto;
                        margin: 0;
                        border-radius: 4px;
                    " title="Выбрать основной">👁️</button>
                </div>
            </div>
        `;
        
        if (this.monuments.length === 0) {
            html += `
                <div style="font-size: 12px; color: #888; text-align: center; padding: 20px; border: 1px dashed #444; border-radius: 8px; margin-top: 8px;">
                    Нет добавленных дублеров
                </div>
            `;
        } else {
            this.monuments.forEach((mon, index) => {
                const isActive = this.currentMode === 'duplicator' && index === this.activeIndex;
                const name = mon.data?.fullName || mon.data?.name || `Памятник ${index + 1}`;
                const material = mon.data?.material || 'гранит';
                const displayName = name.length > 20 ? name.substring(0, 20) + '...' : name;
                
                const hasPending = this.pendingIndex === index && this.pendingChanges !== null;
                
                html += `
                    <div class="monument-item" data-index="${index}" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px;
                        margin-bottom: 4px;
                        background: ${isActive ? 'rgba(0,168,150,0.3)' : 'rgba(255,255,255,0.05)'};
                        border-radius: 6px;
                        border: 1px solid ${isActive ? '#00a896' : 'transparent'};
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 13px;
                    ">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;">
                            <span style="color: ${isActive ? '#00a896' : '#888'};">
                                ${isActive ? '▶' : '○'}
                            </span>
                            <span style="color: ${isActive ? '#fff' : '#aaa'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${this.escapeHtml(displayName)}
                                ${hasPending ? ' <span style="color:#f39c12;font-size:10px;">✏️*</span>' : ''}
                            </span>
                            <span style="font-size: 10px; color: #666; flex-shrink: 0;">${material}</span>
                        </div>
                        <div style="display: flex; gap: 4px; flex-shrink: 0;">
                            <button class="select-monument-btn" data-index="${index}" style="
                                background: none;
                                border: none;
                                color: ${isActive ? '#00a896' : '#666'};
                                cursor: pointer;
                                padding: 2px 6px;
                                font-size: 12px;
                                width: auto;
                                margin: 0;
                                border-radius: 4px;
                            " title="Выбрать">👁️</button>
                            <button class="apply-monument-btn" data-index="${index}" style="
                                background: ${hasPending ? '#f39c12' : '#2ecc71'};
                                border: none;
                                color: white;
                                cursor: pointer;
                                padding: 2px 6px;
                                font-size: 12px;
                                width: auto;
                                margin: 0;
                                border-radius: 4px;
                            " title="${hasPending ? '✅ Применить изменения' : '🔄 Применить настройки'}">
                                ${hasPending ? '✅' : '🔄'}
                            </button>
                            <button class="remove-monument-btn" data-index="${index}" style="
                                background: none;
                                border: none;
                                color: #e74c3c;
                                cursor: pointer;
                                padding: 2px 6px;
                                font-size: 12px;
                                width: auto;
                                margin: 0;
                                border-radius: 4px;
                            " title="Удалить">✖</button>
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
        
        const mainItem = container.querySelector('.monument-item[data-index="-1"]');
        if (mainItem) {
            mainItem.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.selectMainMonument();
            });
            const mainSelectBtn = mainItem.querySelector('.select-main-btn');
            if (mainSelectBtn) {
                mainSelectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectMainMonument();
                });
            }
        }

        container.querySelectorAll('.monument-item[data-index]').forEach(el => {
            const index = parseInt(el.dataset.index);
            if (isNaN(index)) return;
            
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.selectMonument(index);
            });
        });
        
        container.querySelectorAll('.select-monument-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.selectMonument(index);
            });
        });
        
        container.querySelectorAll('.apply-monument-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.applyPendingChanges(index);
            });
        });
        
        container.querySelectorAll('.remove-monument-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeMonument(index);
            });
        });
        
        const dupBtn = document.getElementById('duplicateMonumentBtn');
        const delBtn = document.getElementById('deleteMonumentBtn');
        if (dupBtn) dupBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
        if (delBtn) delBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
    }
    
    escapeHtml(text) {
        if (!text) return 'Без имени';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this._photoDragHandlers) {
            window.removeEventListener('pointermove', this._photoDragHandlers.onPointerMove);
            window.removeEventListener('pointerup', this._photoDragHandlers.onPointerUp);
        }
        if (this._duplicatorPhotoDragHandlers) {
            window.removeEventListener('pointermove', this._duplicatorPhotoDragHandlers.onPointerMove);
            window.removeEventListener('pointerup', this._duplicatorPhotoDragHandlers.onPointerUp);
        }
    }
    
    bindEvents() {
        document.getElementById('addMonumentBtn')?.addEventListener('click', () => {
            this.addMonument();
        });
        
        document.getElementById('deleteMonumentBtn')?.addEventListener('click', () => {
            if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                this.removeMonument(this.activeIndex);
            }
        });
        
        document.getElementById('duplicateMonumentBtn')?.addEventListener('click', () => {
            if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                this.duplicateMonument(this.activeIndex);
            }
        });
        
        document.getElementById('selectMainMonumentBtn')?.addEventListener('click', () => {
            this.selectMainMonument();
        });
        
        const canvas = document.querySelector('#canvas-container canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                this.handleCanvasClick(e);
            });
        }

        this._boundInputHandler = this._handleUIChange.bind(this);
        this._boundChangeHandler = this._handleUIChange.bind(this);
        
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.removeEventListener('input', this._boundInputHandler);
            input.removeEventListener('change', this._boundChangeHandler);
            input.addEventListener('input', this._boundInputHandler);
            input.addEventListener('change', this._boundChangeHandler);
        });
        
        document.addEventListener('steleModelSelected', (e) => {
            const modelId = e.detail?.modelId;
            if (modelId && this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                const uiData = this.collectUIData();
                uiData.steleModel = modelId;
                uiData.steleType = modelId;
                this.pendingChanges = uiData;
                this.pendingIndex = this.activeIndex;
                this.renderMonumentList();
                console.log('📐 Модель стелы сохранена в pending:', modelId);
            }
        });
    }


	_updateActiveTextDecals(data) {
		if (this.activeIndex < 0) return;

		const mon = this.monuments[this.activeIndex];
		if (!mon || !mon.group) return;

		const decalsGroup = mon.group.getObjectByName('decalsContainer');

		if (!decalsGroup) {
			console.warn('⚠️ decalsContainer не найден');
			return;
		}

		// Размеры стелы нужны для пересчёта координат
		const steleGroup = mon.group;
		const model = steleGroup.userData?.modelRef;

		if (!model) {
			console.warn('⚠️ modelRef не найден');
			return;
		}

		const box = new THREE.Box3().setFromObject(model);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());

		const frontZ = box.max.z + 0.015;
		const backZ = box.min.z - 0.015;

		// ============================================================
		// ФИО
		// ============================================================

		const nameMesh = decalsGroup.children.find(
			child =>
				child.isMesh &&
				child.userData &&
				child.userData.textType === 'name'
		);

		if (nameMesh) {
			const offsetX = (data.textOffsetX || 0) * size.x * 0.3;
			const offsetY = (data.textOffsetY || 0) * size.y * 0.3;

			nameMesh.position.set(
				offsetX,
				center.y + offsetY,
				frontZ - 0.01
			);

			// Пересоздаём только текстуру.
			const oldTexture = nameMesh.material?.map;

			const newTexture = this._createDecalTexture(data, 'front');

			if (nameMesh.material) {
				nameMesh.material.map = newTexture;
				nameMesh.material.needsUpdate = true;
			}

			if (oldTexture && oldTexture !== newTexture) {
				oldTexture.dispose();
			}

			nameMesh.userData.offsetX = data.textOffsetX || 0;
			nameMesh.userData.offsetY = data.textOffsetY || 0;
			nameMesh.userData.text = data.fullName || '';

			console.log('🔄 ФИО обновлено динамически');
		}

		// ============================================================
		// ЭПИТАФИЯ
		// ============================================================

		const epitaphMesh = decalsGroup.children.find(
			child =>
				child.isMesh &&
				child.userData &&
				child.userData.textType === 'epitaph'
		);

		if (epitaphMesh) {
			const offsetX =
				(data.epitaphOffsetX || 0) * size.x * 0.3;

			const offsetY =
				(data.epitaphOffsetY || 0) * size.y * 0.3;

			epitaphMesh.position.set(
				offsetX,
				center.y + offsetY,
				backZ + 0.01
			);

			epitaphMesh.rotation.y = Math.PI;

			const oldTexture = epitaphMesh.material?.map;

			const newTexture =
				this._createDecalTexture(data, 'back');

			if (epitaphMesh.material) {
				epitaphMesh.material.map = newTexture;
				epitaphMesh.material.needsUpdate = true;
			}

			if (oldTexture && oldTexture !== newTexture) {
				oldTexture.dispose();
			}

			epitaphMesh.userData.offsetX =
				data.epitaphOffsetX || 0;

			epitaphMesh.userData.offsetY =
				data.epitaphOffsetY || 0;

			epitaphMesh.userData.text =
				data.epitaph || '';

			console.log('🔄 Эпитафия обновлена динамически');
		}

		// На всякий случай принудительно обновляем рендер
		if (this.renderer) {
			this.renderer.render(
				this.scene,
				this.controls.object
			);
		}
	}

    _handleUIChange(e) {
        if (e.target && e.target.id === 'enableMovePhoto') {
            console.log('⏸️ Чекбокс переключен');
            return;
        }
        
		if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
			const uiData = this.collectUIData();

			this.pendingChanges = uiData;
			this.pendingIndex = this.activeIndex;

			// ⭐ Мгновенно обновляем текст на активном дублере
			this._updateActiveTextDecals(uiData);

			this.renderMonumentList();
			return;
		}
        
        if (this.currentMode === 'main') {
            this.syncStateFromUI();
            
            clearTimeout(this._updateTimeout);
            this._updateTimeout = setTimeout(() => {
                if (window.updateScene && !window._disableAutoMonument) {
                    window.updateScene();
                }
            }, 100);
        }
    }

    syncStateFromUI() {
        if (this._blockStateUpdate) {
            console.log('🛡️ syncStateFromUI заблокирован во время восстановления JSON');
            return;
        }

        let photoMesh = null;
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
                    photoMesh = child;
                    break;
                }
            }
        }
        
        if (photoMesh && window.state) {
            if (photoMesh.visible !== false) {
                window.state.photoAbsoluteX = photoMesh.position.x;
                window.state.photoAbsoluteY = photoMesh.position.y;
                const centerY = photoMesh.userData?.steleCenterY || 0.6;
                window.state.photoOffsetX = photoMesh.position.x;
                window.state.photoOffsetY = photoMesh.position.y - centerY;
            }
        }
        
        if (!window.state) return;
        
        const fullNameEl = document.getElementById('fullName');
        if (fullNameEl) window.state.fullName = fullNameEl.value;
        
        const datesEl = document.getElementById('datesText');
        if (datesEl) window.state.dates = datesEl.value;
        
        const epitaphEl = document.getElementById('epitaphText');
        if (epitaphEl) window.state.epitaph = epitaphEl.value;
        
        const textColorEl = document.getElementById('textColor');
        if (textColorEl) window.state.textColor = textColorEl.value;
        
        const widthEl = document.getElementById('widthRange');
        if (widthEl) window.state.width = parseFloat(widthEl.value);
        
        const heightEl = document.getElementById('heightRange');
        if (heightEl) window.state.height = parseFloat(heightEl.value);
        
        const depthEl = document.getElementById('depthRange');
        if (depthEl) window.state.depth = parseFloat(depthEl.value) || 0.1;
        
        const materialEl = document.getElementById('materialSelect');
        if (materialEl) window.state.material = materialEl.value;
        
        const fontEl = document.getElementById('fontFamily');
        if (fontEl) window.state.fontFamily = fontEl.value;
        
        const nameFontSizeEl = document.getElementById('nameFontSize');
        if (nameFontSizeEl) window.state.nameFontSize = parseInt(nameFontSizeEl.value);
        
        const datesFontSizeEl = document.getElementById('datesFontSize');
        if (datesFontSizeEl) window.state.datesFontSize = parseInt(datesFontSizeEl.value);
        
        const epitaphFontSizeEl = document.getElementById('epitaphFontSize');
        if (epitaphFontSizeEl) window.state.epitaphFontSize = parseInt(epitaphFontSizeEl.value);
        
        const textOffsetXEl = document.getElementById('textOffsetX');
        if (textOffsetXEl) window.state.textOffsetX = parseFloat(textOffsetXEl.value) || 0;
        
        const textOffsetYEl = document.getElementById('textOffsetY');
        if (textOffsetYEl) window.state.textOffsetY = parseFloat(textOffsetYEl.value) || 0;
        
        const epitaphOffsetXEl = document.getElementById('epitaphOffsetX');
        if (epitaphOffsetXEl) window.state.epitaphOffsetX = parseFloat(epitaphOffsetXEl.value) || 0;
        
        const epitaphOffsetYEl = document.getElementById('epitaphOffsetY');
        if (epitaphOffsetYEl) window.state.epitaphOffsetY = parseFloat(epitaphOffsetYEl.value) || 0;
        
        const graveWEl = document.getElementById('graveWidth');
        if (graveWEl) window.state.graveWidth = parseFloat(graveWEl.value);
        
        const graveLEl = document.getElementById('graveLength');
        if (graveLEl) window.state.graveLength = parseFloat(graveLEl.value);
        
        const baseHEl = document.getElementById('baseHeight');
        if (baseHEl) window.state.baseHeight = parseFloat(baseHEl.value);
        
        const flowerEnabledEl = document.getElementById('flowerEnabled');
        if (flowerEnabledEl) window.state.flowerEnabled = flowerEnabledEl.checked;
        
        const flowerWEl = document.getElementById('flowerWidth');
        if (flowerWEl) window.state.flowerWidth = parseFloat(flowerWEl.value);
        
        const flowerLEl = document.getElementById('flowerLength');
        if (flowerLEl) window.state.flowerLength = parseFloat(flowerLEl.value);
        
        const flowerbedTypeEl = document.getElementById('flowerbedType');
        if (flowerbedTypeEl) window.state.flowerbedType = flowerbedTypeEl.value;
        
        const fenceEnabledEl = document.getElementById('fenceEnabled');
        if (fenceEnabledEl) window.state.fenceEnabled = fenceEnabledEl.checked;
        
        const fenceWEl = document.getElementById('fenceWidth');
        if (fenceWEl) window.state.fenceWidth = parseFloat(fenceWEl.value);
        
        const fenceLEl = document.getElementById('fenceLength');
        if (fenceLEl) window.state.fenceLength = parseFloat(fenceLEl.value);
        
        const fenceTypeEl = document.getElementById('fenceType');
        if (fenceTypeEl) window.state.fenceType = fenceTypeEl.value;
        
        const fenceHEl = document.getElementById('fenceHeight');
        if (fenceHEl) window.state.fenceHeight = parseFloat(fenceHEl.value);
        
        const fenceMatEl = document.getElementById('fenceMaterial');
        if (fenceMatEl) window.state.fenceMaterial = fenceMatEl.value;
        
        const gateSideEl = document.getElementById('fenceGateSide');
        if (gateSideEl) window.state.fenceGateSide = gateSideEl.value;
        
        const gateWEl = document.getElementById('gateWidth');
        if (gateWEl) window.state.gateWidth = parseFloat(gateWEl.value);
        
        const fenceOffXEl = document.getElementById('fenceOffsetX');
        if (fenceOffXEl) window.state.fenceOffsetX = parseFloat(fenceOffXEl.value) || 0;
        
        const fenceOffZEl = document.getElementById('fenceOffsetZ');
        if (fenceOffZEl) window.state.fenceOffsetZ = parseFloat(fenceOffZEl.value) || 0;
        
        const pathEnabledEl = document.getElementById('pathEnabled');
        if (pathEnabledEl) window.state.pathEnabled = pathEnabledEl.checked;
        
        const pathWEl = document.getElementById('pathWidth');
        if (pathWEl) window.state.pathWidth = parseFloat(pathWEl.value);
        
        const pathMatEl = document.getElementById('pathMaterial');
        if (pathMatEl) window.state.pathMaterial = pathMatEl.value;
        
        const pathTileSizeEl = document.getElementById('pathTileSize');
        if (pathTileSizeEl) window.state.pathTileSize = parseFloat(pathTileSizeEl.value);
        
        const pathJointColorEl = document.getElementById('pathJointColor');
        if (pathJointColorEl) window.state.pathJointColor = pathJointColorEl.value;
        
        const pathTileLayoutEl = document.getElementById('pathTileLayout');
        if (pathTileLayoutEl) window.state.pathTileLayout = pathTileLayoutEl.value;
        
        const photoScaleEl = document.getElementById('photoScale');
        if (photoScaleEl) window.state.photoScale = parseFloat(photoScaleEl.value);
        
        const photoWidthMmEl = document.getElementById('photoWidthMm');
        if (photoWidthMmEl) window.state.photoWidthMm = parseInt(photoWidthMmEl.value) || 100;
        
        const photoHeightMmEl = document.getElementById('photoHeightMm');
        if (photoHeightMmEl) window.state.photoHeightMm = parseInt(photoHeightMmEl.value) || 140;
        
        const steleTypeEl = document.getElementById('steleTypeSelect');
        if (steleTypeEl) {
            window.state.steleType = steleTypeEl.value;
        }
        
        const activeModel = document.querySelector('.stele-grid-item.active');
        if (activeModel && activeModel.dataset.model) {
            window.state.steleModel = activeModel.dataset.model;
            window.state.steleType = activeModel.dataset.model;
        }
    }

    collectUIData() {
        const data = {};

        const mappings = {
            'fullName': 'fullName',
            'datesText': 'dates',
            'epitaphText': 'epitaph',
            'widthRange': 'width',
            'heightRange': 'height',
            'depthRange': 'depth',
            'materialSelect': 'material',
            'textColor': 'textColor',
            'fontFamily': 'fontFamily',
            'graveWidth': 'graveWidth',
            'graveLength': 'graveLength',
            'baseHeight': 'baseHeight',
            'flowerWidth': 'flowerWidth',
            'flowerLength': 'flowerLength',
            'flowerEnabled': 'flowerEnabled',
            'flowerbedType': 'flowerbedType',
            'fenceWidth': 'fenceWidth',
            'fenceLength': 'fenceLength',
            'fenceEnabled': 'fenceEnabled',
            'fenceType': 'fenceType',
            'fenceHeight': 'fenceHeight',
            'fenceMaterial': 'fenceMaterial',
            'fenceGateSide': 'fenceGateSide',
            'gateWidth': 'gateWidth',
            'fenceOffsetX': 'fenceOffsetX',
            'fenceOffsetZ': 'fenceOffsetZ',
            'pathEnabled': 'pathEnabled',
            'pathWidth': 'pathWidth',
            'pathMaterial': 'pathMaterial',
            'nameFontSize': 'nameFontSize',
            'datesFontSize': 'datesFontSize',
            'epitaphFontSize': 'epitaphFontSize',
            'steleTypeSelect': 'steleModel',
            'textOffsetX': 'textOffsetX',
            'textOffsetY': 'textOffsetY',
            'epitaphOffsetX': 'epitaphOffsetX',
            'epitaphOffsetY': 'epitaphOffsetY',
            'photoScale': 'photoScale',
            'photoWidthMm': 'photoWidthMm',
            'photoHeightMm': 'photoHeightMm'
        };

        for (const [elementId, stateKey] of Object.entries(mappings)) {
            const el = document.getElementById(elementId);
            if (!el) continue;

            if (el.type === 'checkbox') {
                data[stateKey] = el.checked;
            } else if (el.type === 'range') {
                data[stateKey] = parseFloat(el.value);
            } else if (el.type === 'number') {
                data[stateKey] = parseFloat(el.value);
            } else {
                data[stateKey] = el.value;
            }
        }

        // ФОТО
        const textureUpload = document.getElementById('textureUpload');

        if (textureUpload && textureUpload.files && textureUpload.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                data.photoUrl = e.target.result;
                data.textureUrl = e.target.result;
                this._pendingPhotoUrl = e.target.result;
            };
            reader.readAsDataURL(textureUpload.files[0]);
        } else if (this._pendingPhotoUrl) {
            data.photoUrl = this._pendingPhotoUrl;
            data.textureUrl = this._pendingPhotoUrl;
        } else if (window.state?.textureUrl && window.state.textureUrl.startsWith('data:')) {
            data.photoUrl = window.state.textureUrl;
            data.textureUrl = window.state.textureUrl;
        } else if (this.activeIndex >= 0 && this.monuments[this.activeIndex]?.data?.photoUrl) {
            data.photoUrl = this.monuments[this.activeIndex].data.photoUrl;
            data.textureUrl = data.photoUrl;
        }

        const photoShapeEl = document.querySelector('.shape-option.active');
        if (photoShapeEl) {
            data.photoShape = photoShapeEl.dataset.shape || 'oval';
        }

        // ⭐ КООРДИНАТЫ ФОТО из кэша дублера
        const cachedData = this.activeIndex >= 0 ? this._duplicatorDataCache[this.activeIndex] : null;
        const currentMonument = this.activeIndex >= 0 ? this.monuments[this.activeIndex] : null;

        if (cachedData && typeof cachedData.photoOffsetX === 'number' && typeof cachedData.photoOffsetY === 'number') {
            data.photoOffsetX = cachedData.photoOffsetX;
            data.photoOffsetY = cachedData.photoOffsetY;
        } else if (currentMonument?.data && typeof currentMonument.data.photoOffsetX === 'number' && typeof currentMonument.data.photoOffsetY === 'number') {
            data.photoOffsetX = currentMonument.data.photoOffsetX;
            data.photoOffsetY = currentMonument.data.photoOffsetY;
        } else {
            data.photoOffsetX = parseFloat(document.getElementById('photoOffsetX')?.value) || 0;
            data.photoOffsetY = parseFloat(document.getElementById('photoOffsetY')?.value) || 0;
        }

        data.photoAbsoluteX = data.photoOffsetX;
        data.photoAbsoluteY = data.photoOffsetY + 0.6;

        // ОСТАЛЬНЫЕ ДАННЫЕ
        if (window.engravingsManager) {
            const state = window.engravingsManager.state || {};
            data.engravingsFront = state.engravingsFront || [];
            data.engravingsBack = state.engravingsBack || [];
        } else {
            data.engravingsFront = window.state?.engravingsFront || [];
            data.engravingsBack = window.state?.engravingsBack || [];
        }

        data.textColor = document.getElementById('textColor')?.value || '#FFFFFF';
        data.fontFamily = document.getElementById('fontFamily')?.value || 'Arial, sans-serif';
        data.fenceEnabled = document.getElementById('fenceEnabled')?.checked || false;
        data.pathEnabled = document.getElementById('pathEnabled')?.checked || false;

        const steleSelect = document.getElementById('steleTypeSelect');
        if (steleSelect) {
            data.steleModel = steleSelect.value;
            data.steleType = steleSelect.value;
        }

        const activeModel = document.querySelector('.stele-grid-item.active');
        if (activeModel && activeModel.dataset.model) {
            data.steleModel = activeModel.dataset.model;
            data.steleType = activeModel.dataset.model;
        }

        return data;
    }

    selectMainMonument() {
        console.log('🔄 === ВЫБОР ОСНОВНОГО ПАМЯТНИКА ===');
        
        if (this._isSleeping) {
            this._isSleeping = false;
            this.scene.add(this.monumentsGroup);
            this.createUI();
        }
        
        this.currentMode = 'main';
        this.activeIndex = -1;
        this.pendingChanges = null;
        this.pendingIndex = -1;
        this.mainPhotoMesh = null;
        
        if (this._savedState && window.state) {
            const duplicatorData = this.monuments.map(mon => ({
                id: mon.id,
                data: { ...mon.data },
                position: { ...mon.position }
            }));
            
            Object.assign(window.state, this._savedState);
            this._savedState = null;
            
            this.monuments.forEach((mon, index) => {
                if (duplicatorData[index]) {
                    mon.data = { ...duplicatorData[index].data };
                    mon.position = { ...duplicatorData[index].position };
                }
            });
        }
        
        this._duplicatorDataCache = {};
        
        this.monuments.forEach((mon) => {
            this.removeHighlight(mon.group);
        });
        
        this.renderMonumentList();
        
        window._disableAutoMonument = false;
        window._isDuplicatorMode = false;
        
        this.syncStateFromUI();
        
        if (typeof window.updateScene === 'function') {
            window._skipDuplicatorRebuild = true;
            window._forceMainUpdate = true;
            
            setTimeout(() => {
                window.updateScene();
                setTimeout(() => {
                    window._skipDuplicatorRebuild = false;
                    window._forceMainUpdate = false;
                }, 500);
            }, 50);
        }
        
        this.showToast('🪦 Выбран основной памятник', 'info');
    }

    findAllPhotoMeshes() {
        const photos = [];
        
        if (this.monuments) {
            this.monuments.forEach((mon, idx) => {
                mon.group.traverse((child) => {
                    if (child.isMesh && child.userData && child.userData.isDraggable && child.userData.type === 'photo') {
                        photos.push({ mesh: child, index: idx, type: 'duplicator' });
                    }
                });
            });
        }
        
        if (this.mainPhotoMesh) {
            if (!this.mainPhotoMesh.userData) this.mainPhotoMesh.userData = {};
            this.mainPhotoMesh.userData.isDraggable = true;
            this.mainPhotoMesh.userData.type = 'photo';
            this.mainPhotoMesh.userData.isMainPhoto = true;
            this.mainPhotoMesh.userData._foundType = 'main';
            photos.push({ mesh: this.mainPhotoMesh, index: -1, type: 'main' });
        }
        
        return photos;
    }

    selectMonument(index) {
        if (index < 0 || index >= this.monuments.length) {
            this.selectMainMonument();
            return;
        }
        
        if (window.state && this.currentMode === 'main') {
            this._savedState = { ...window.state };
        }
        
        this.currentMode = 'duplicator';
        this.activeIndex = index;
        window._isDuplicatorMode = true;
        window._disableAutoMonument = true;
        
        this.loadMonumentToUI(index);
        
        this.renderMonumentList();
        this.highlightActiveMonument();
        
        this.showToast(`✏️ Редактирование дублера #${index + 1}`, 'info');
    }

    loadMonumentToUI(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const mon = this.monuments[index];
        let data = this._duplicatorDataCache[index] || mon.data;
        
        this.isUpdating = true;
        
        const mappings = {
            'fullName': 'fullName',
            'datesText': 'dates',
            'epitaphText': 'epitaph',
            'widthRange': 'width',
            'heightRange': 'height',
            'depthRange': 'depth',
            'materialSelect': 'material',
            'textColor': 'textColor',
            'fontFamily': 'fontFamily',
            'graveWidth': 'graveWidth',
            'graveLength': 'graveLength',
            'baseHeight': 'baseHeight',
            'flowerWidth': 'flowerWidth',
            'flowerLength': 'flowerLength',
            'flowerEnabled': 'flowerEnabled',
            'flowerbedType': 'flowerbedType',
            'fenceWidth': 'fenceWidth',
            'fenceLength': 'fenceLength',
            'fenceEnabled': 'fenceEnabled',
            'fenceType': 'fenceType',
            'fenceHeight': 'fenceHeight',
            'fenceMaterial': 'fenceMaterial',
            'fenceGateSide': 'fenceGateSide',
            'gateWidth': 'gateWidth',
            'fenceOffsetX': 'fenceOffsetX',
            'fenceOffsetZ': 'fenceOffsetZ',
            'pathEnabled': 'pathEnabled',
            'pathWidth': 'pathWidth',
            'pathMaterial': 'pathMaterial',
            'nameFontSize': 'nameFontSize',
            'datesFontSize': 'datesFontSize',
            'epitaphFontSize': 'epitaphFontSize',
            'steleTypeSelect': 'steleModel',
            'textOffsetX': 'textOffsetX',
            'textOffsetY': 'textOffsetY',
            'epitaphOffsetX': 'epitaphOffsetX',
            'epitaphOffsetY': 'epitaphOffsetY',
            'photoScale': 'photoScale',
            'photoWidthMm': 'photoWidthMm',
            'photoHeightMm': 'photoHeightMm',
            'photoOffsetX': 'photoOffsetX',
            'photoOffsetY': 'photoOffsetY'
        };
        
        for (const [elementId, stateKey] of Object.entries(mappings)) {
            const el = document.getElementById(elementId);
            if (!el) continue;
            const value = data[stateKey];
            if (value === undefined) continue;
            
            if (el.type === 'checkbox') {
                el.checked = !!value;
            } else if (el.type === 'range') {
                el.value = value;
                const valDisplay = document.getElementById(elementId.replace('Range', '') + 'Val');
                if (valDisplay) {
                    if (typeof value === 'number') {
                        if (value > 0 && value < 100) {
                            valDisplay.textContent = value.toFixed(2) + ' м';
                        } else {
                            valDisplay.textContent = value;
                        }
                    }
                }
            } else if (el.type === 'color') {
                el.value = value;
            } else if (el.tagName === 'SELECT') {
                el.value = value;
            } else if (el.tagName === 'TEXTAREA') {
                el.value = value || '';
            } else {
                el.value = value;
            }
        }
        
        let photoUrl = data.photoUrl || data.textureUrl || null;
        
        const photoPreview = document.getElementById('photoPreview');
        if (photoUrl) {
            if (photoPreview) {
                photoPreview.src = photoUrl;
                photoPreview.style.display = 'block';
            }
            if (window.state) {
                window.state.textureUrl = photoUrl;
                window.state.modelPhotoUrl = photoUrl;
            }
            this._pendingPhotoUrl = photoUrl;
        } else {
            if (photoPreview) {
                photoPreview.src = '';
                photoPreview.style.display = 'none';
            }
            this._pendingPhotoUrl = null;
        }
        
        if (data.photoShape) {
            document.querySelectorAll('.shape-option').forEach(el => {
                el.classList.toggle('active', el.dataset.shape === data.photoShape);
            });
            const customSize = document.getElementById('customPhotoSize');
            if (customSize) {
                customSize.style.display = data.photoShape === 'custom' ? 'block' : 'none';
            }
        }
        
        const flowerControls = document.getElementById('flowerControls');
        if (flowerControls) {
            flowerControls.style.display = data.flowerEnabled !== false ? 'block' : 'none';
        }
        
        if (data.steleModel) {
            this.updateSteleGridSelection(data.steleModel);
        }
        
        this.isUpdating = false;
    }
    
    updateSteleGridSelection(modelId) {
        const steleSelect = document.getElementById('steleTypeSelect');
        if (steleSelect) {
            const option = steleSelect.querySelector(`option[value="${modelId}"]`);
            if (option) {
                steleSelect.value = modelId;
            } else {
                const options = steleSelect.querySelectorAll('option');
                for (const opt of options) {
                    if (opt.dataset.model === modelId) {
                        steleSelect.value = opt.value;
                        break;
                    }
                }
            }
        }
        
        const gridItems = document.querySelectorAll('.stele-grid-item');
        gridItems.forEach(item => {
            const isActive = item.dataset.model === modelId;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.style.border = '2px solid #00a896';
                item.style.boxShadow = '0 0 15px rgba(0,168,150,0.3)';
            } else {
                item.style.border = '2px solid transparent';
                item.style.boxShadow = 'none';
            }
        });
    }

    applyPendingChanges(index) {
        if (index < 0 || index >= this.monuments.length) {
            this.showToast('❌ Дублер не найден', 'error');
            return;
        }

        const mon = this.monuments[index];
        let dataToApply;
        
        if (this.pendingIndex === index && this.pendingChanges) {
            dataToApply = this.pendingChanges;
            this.pendingChanges = null;
            this.pendingIndex = -1;
        } else {
            dataToApply = this._duplicatorDataCache[index] || { ...mon.data };
        }

        if (dataToApply.steleModel) {
            console.log('📐 Модель стелы:', dataToApply.steleModel);
        }
        if (dataToApply.steleType && !dataToApply.steleModel) {
            dataToApply.steleModel = dataToApply.steleType;
        }
        
        // Сохраняем фото
        const textureUpload = document.getElementById('textureUpload');
        if (textureUpload && textureUpload.files && textureUpload.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                dataToApply.photoUrl = e.target.result;
                dataToApply.textureUrl = e.target.result;
                this._pendingPhotoUrl = e.target.result;
                mon.data = { ...mon.data, ...dataToApply };
                this._duplicatorDataCache[index] = { ...mon.data };
                this.rebuildSimpleMonument(index);
                this.renderMonumentList();
                this.showToast(`✅ Настройки применены к дублеру #${index + 1}`, 'success');
            };
            reader.readAsDataURL(textureUpload.files[0]);
            return;
        } else if (this._pendingPhotoUrl) {
            dataToApply.photoUrl = this._pendingPhotoUrl;
            dataToApply.textureUrl = this._pendingPhotoUrl;
        } else if (window.state?.textureUrl && window.state.textureUrl.startsWith('data:')) {
            dataToApply.photoUrl = window.state.textureUrl;
            dataToApply.textureUrl = window.state.textureUrl;
        }

        mon.data = { ...mon.data, ...dataToApply };
        this._duplicatorDataCache[index] = { ...mon.data };

        this.rebuildSimpleMonument(index);
        this.renderMonumentList();

        this.showToast(`✅ Настройки применены к дублеру #${index + 1}`, 'success');
    }

async rebuildSimpleMonument(index) {
    if (this.isRebuilding) {
        console.log(`⏳ Дублер #${index + 1} уже перестраивается`);
        return;
    }
    this.isRebuilding = true;

    if (index < 0 || index >= this.monuments.length) {
        console.warn(`⚠️ Дублер #${index + 1} не найден`);
        this.isRebuilding = false;
        return;
    }
    
    const mon = this.monuments[index];
    
    // Восстанавливаем данные из кэша
    if (this._duplicatorDataCache[index]) {
        mon.data = { ...mon.data, ...this._duplicatorDataCache[index] };
        console.log(`📦 Данные дублера #${index + 1} восстановлены из кэша`);
    }
    
    const data = mon.data;
    
    console.log(`🔧 rebuildSimpleMonument #${index + 1}:`, {
        fullName: data.fullName,
        dates: data.dates,
        epitaph: data.epitaph,
        textOffsetX: data.textOffsetX,
        textOffsetY: data.textOffsetY,
        photoOffsetX: data.photoOffsetX,
        photoOffsetY: data.photoOffsetY
    });
    
    // Очищаем группу дублера
    while (mon.group.children.length > 0) {
        const child = mon.group.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        mon.group.remove(child);
    }
    
    const materialType = data.material || 'granite';
    
    // ============================================================
    // 1. ОСНОВАНИЕ
    // ============================================================
    const graveW = data.graveWidth || 0.9;
    const graveL = data.graveLength || 1.5;
    const baseH = data.baseHeight || 0.15;
    
    const baseGeo = new THREE.BoxGeometry(graveW, baseH, graveL);
    const baseMat = await createSteleMaterialWithTexture(materialType, true);
    
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = baseH / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    mon.group.add(baseMesh);
    
    // ============================================================
    // 2. ЦВЕТНИК
    // ============================================================
    if (data.flowerEnabled !== false) {
        const flowerW = data.flowerWidth || 0.6;
        const flowerL = data.flowerLength || 0.9;
        
        if (flowerW > 0.05 && flowerL > 0.05) {
            try {
                const flowerBedGeo = new THREE.PlaneGeometry(flowerW, flowerL);
                const flowerbedTexture = await loadFlowerbedTexture(data.flowerbedType || 'grass');
                
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
                        color: fallbackColors[data.flowerbedType || 'grass'] || 0x4caf50, 
                        roughness: 0.8 
                    });
                }
                
                const flowerBed = new THREE.Mesh(flowerBedGeo, flowerMat);
                flowerBed.rotation.x = -Math.PI / 2;
                flowerBed.position.set(0, baseH + 0.005, 0);
                flowerBed.receiveShadow = true;
                mon.group.add(flowerBed);
            } catch (e) {
                console.warn('⚠️ Ошибка создания цветника для дублера:', e);
            }
        }
    }
    
    // ============================================================
    // 3. СТЕЛА
    // ============================================================
    let steleName = data.steleModel || data.steleType || 'custom_stl_cupol';
    
    const modelMap = {
        'book': 'custom_stl0',
        'rectangle': 'custom_stl_Rectangle',
        'cupol': 'custom_stl_cupol',
        'stele1': 'custom_stl',
        'stele2': 'custom_stl2',
        'stele3': 'custom_stl3',
        'stele4': 'custom_stl4',
        'stele5': 'custom_stl5',
        'stele6': 'custom_stl6',
        'stele7': 'custom_stl7',
        'test': 'custom_stl8',
        'monument': 'custom_stl_monument',
        'custom_stl0': 'custom_stl0',
        'custom_stl': 'custom_stl',
        'custom_stl2': 'custom_stl2',
        'custom_stl3': 'custom_stl3',
        'custom_stl4': 'custom_stl4',
        'custom_stl5': 'custom_stl5',
        'custom_stl6': 'custom_stl6',
        'custom_stl7': 'custom_stl7',
        'custom_stl8': 'custom_stl8',
        'custom_stl_Rectangle': 'custom_stl_Rectangle',
        'custom_stl_cupol': 'custom_stl_cupol',
        'custom_stl_monument': 'custom_stl_monument'
    };
    
    if (modelMap[steleName]) {
        steleName = modelMap[steleName];
    }
    
    const loader = window.customSteleLoader;
    if (!loader) {
        console.error('❌ customSteleLoader не найден!');
        this.isRebuilding = false;
        return;
    }
    
    // ============================================================
    // ⭐ СОЗДАЕМ СТЕЛУ БЕЗ ДЕКАЛЕЙ (их создадим отдельно)
    // ============================================================
    const steleGroup = loader.createCustomSteleMesh(
        steleName,
        data.width || 0.6,
        data.height || 1.3,
        data.depth || 0.08,
        materialType,
        'vertical',
        null,
        true  // ⭐ skipDecals = true - НЕ создаем декали внутри
    );
    
    // ⭐ СОХРАНЯЕМ ССЫЛКУ НА ДАННЫЕ В СТЕЛЕ
    if (steleGroup) {
        steleGroup.userData.duplicatorData = data;
        steleGroup.userData.duplicatorIndex = index;
    }
    
    // ПРИМЕНЯЕМ МАТЕРИАЛ
    if (steleGroup) {
        steleGroup.traverse((child) => {
            if (child.isMesh) {
                const newMat = new THREE.MeshStandardMaterial({
                    map: child.material?.map || null,
                    color: child.material?.color || new THREE.Color(0xffffff),
                    roughness: 0.25,
                    metalness: 0.05,
                });
                child.material = newMat;
                child.material.needsUpdate = true;
            }
        });
    }

    steleGroup.position.set(0, baseH + 0.6, -(graveL / 2 - 0.09));
    mon.group.add(steleGroup);
    
    // ============================================================
    // 4. ⭐ СОЗДАЕМ ДЕКАЛИ (С ПЕРЕДАЧЕЙ ДАННЫХ)
    // ============================================================
    // Ждем загрузки модели и создаем декали
    const waitForModel = async () => {
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            // Ищем модель внутри steleGroup
            let modelRef = null;
            steleGroup.traverse((child) => {
                if (child.userData && child.userData.modelRef) {
                    modelRef = child.userData.modelRef;
                }
            });
            
            if (modelRef || steleGroup.userData.modelRef) {
                console.log(`✅ Модель найдена для дублера #${index + 1}, создаем декали`);
                
                // Создаем контейнер для декалей
                let decalsContainer = mon.group.getObjectByName('decalsContainer');
                if (!decalsContainer) {
                    decalsContainer = new THREE.Group();
                    decalsContainer.name = 'decalsContainer';
                    mon.group.add(decalsContainer);
                } else {
                    // Очищаем старые декали
                    while (decalsContainer.children.length > 0) {
                        const child = decalsContainer.children[0];
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                        decalsContainer.remove(child);
                    }
                }
                
                // Создаем новые декали
                const newDecals = await this.createDecalsForDuplicator(steleGroup, data);
                if (newDecals) {
					while (newDecals.children.length > 0) {
						const child = newDecals.children[0];

						// Сначала запоминаем WORLD-позицию
						child.updateWorldMatrix(true, false);

						const worldPosition = new THREE.Vector3();
						child.getWorldPosition(worldPosition);

						newDecals.remove(child);
						decalsContainer.add(child);

						// После смены родителя переводим WORLD -> LOCAL
						decalsContainer.updateWorldMatrix(true, false);

						child.position.copy(
							decalsContainer.worldToLocal(worldPosition)
						);
					}
                    console.log(`✅ Декали созданы для дублера #${index + 1}`);
                }
                return;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn(`⚠️ Модель не загрузилась для дублера #${index + 1}, декали не созданы`);
    };
    
    // Запускаем создание декалей
    waitForModel();
    
    // ============================================================
    // 5. ДОРОЖКА
    // ============================================================
    if (data.pathEnabled !== false) {
        const pathWidth = data.pathWidth || 0.5;
        const pathGeo = new THREE.PlaneGeometry(pathWidth, graveL * 0.6);
        const pathMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            roughness: 0.9 
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);
        pathMesh.rotation.x = -Math.PI / 2;
        pathMesh.position.set(0, 0.09, graveL * 0.2);
        pathMesh.receiveShadow = true;
        mon.group.add(pathMesh);
    }
    
    // Сохраняем данные в кэш
    this._duplicatorDataCache[index] = { ...data };
    
    console.log(`✅ Дублер #${index + 1} перестроен с сохранением данных`);
    this.isRebuilding = false;
}

    waitForSteleGroup(group, callback, attempts = 0) {
        const maxAttempts = 20;
        const delay = 100;
        
        let foundSteleGroup = null;
        group.traverse((child) => {
            if (child.type === 'Group' && child.userData && child.userData.modelRef) {
                foundSteleGroup = child;
            }
        });
        
        if (foundSteleGroup) {
            callback(foundSteleGroup);
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(() => {
                this.waitForSteleGroup(group, callback, attempts + 1);
            }, delay);
        } else {
            callback(null);
        }
    }

async createDecalsForDuplicator(steleGroup, data) {
    if (!steleGroup || !data) {
        console.warn('⚠️ createDecalsForDuplicator: нет steleGroup или data');
        return null;
    }

    const decalsGroup = new THREE.Group();
    decalsGroup.name = 'decalsContainer';

    try {
        // ============================================================
        // 1. АКТУАЛЬНЫЕ WORLD-КООРДИНАТЫ СТЕЛЫ
        // ============================================================

        steleGroup.updateWorldMatrix(true, true);

        const boundingBox = new THREE.Box3().setFromObject(steleGroup);

        const centerWorld = boundingBox.getCenter(
            new THREE.Vector3()
        );

        const frontWorldZ = boundingBox.max.z + 0.016;
        const backWorldZ = boundingBox.min.z - 0.016;

        console.log('========== DECAL COORD SYSTEM ==========');
        console.log('STELE WORLD BOX:', {
            min: boundingBox.min.clone(),
            max: boundingBox.max.clone()
        });

        console.log('STELE WORLD CENTER:', centerWorld.clone());

        // ============================================================
        // 2. РАЗМЕРЫ
        // ============================================================

        const width = Number(data.width) || 0.6;
        const height = Number(data.height) || 1.2;

        // ============================================================
        // 3. ПОЛУЧАЕМ WORLD -> LOCAL ФУНКЦИЮ
        // ============================================================

        /*
         * decalsGroup в дальнейшем может оказаться внутри другой
         * группы дублера.
         *
         * Поэтому координату сначала вычисляем в WORLD,
         * а потом переводим в локальную систему decalsGroup.
         */

        decalsGroup.updateWorldMatrix(true, true);

        const worldToDecalLocal = (worldPosition) => {
            const result = worldPosition.clone();

            decalsGroup.worldToLocal(result);

            return result;
        };

        // ============================================================
        // 4. TEXT
        // ============================================================

        if (
            (data.fullName && data.fullName.trim()) ||
            (data.dates && data.dates.trim())
        ) {
            const texture = this.createDecalTextureFromData(
                data,
                'front'
            );

            const textWidth = width * 0.85;
            const textHeight = height * 0.85;

            const textGeo = new THREE.PlaneGeometry(
                textWidth,
                textHeight
            );

            const textMat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
                alphaTest: 0.05
            });

            const textMesh = new THREE.Mesh(
                textGeo,
                textMat
            );

            // ========================================================
            // СМЕЩЕНИЯ ИЗ ДАННЫХ
            // ========================================================

            const offsetX =
                (Number(data.textOffsetX) || 0) *
                width *
                0.5;

            const offsetY =
                (Number(data.textOffsetY) || 0) *
                height *
                0.5;

            /*
             * ВАЖНО:
             * Здесь offsetX/offsetY применяются в WORLD,
             * а не напрямую к textMesh.position.
             */

            const textWorld = new THREE.Vector3(
                centerWorld.x + offsetX,
                centerWorld.y + offsetY,
                frontWorldZ
            );

            // ========================================================
            // WORLD -> LOCAL decalsContainer
            // ========================================================

            textMesh.position.copy(
                worldToDecalLocal(textWorld)
            );

            textMesh.renderOrder = 9;

            textMesh.userData.isDecal = true;
            textMesh.userData.id = 'frontText';
            textMesh.userData.textType = 'name';
            textMesh.userData.isDraggable = true;

            decalsGroup.add(textMesh);

            console.log('📝 FRONT TEXT:', {
                world: textWorld.clone(),
                local: textMesh.position.clone()
            });
        }

        // ============================================================
        // 5. ФОТО
        // ============================================================

        const photoUrl =
            data.photoUrl ||
            data.textureUrl ||
            null;

        if (photoUrl) {
            await new Promise((resolve) => {

                const loader = new THREE.TextureLoader();

                loader.load(
                    photoUrl,

                    (tex) => {

                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;

                        const photoWidth =
                            width *
                            (Number(data.photoWidth) || 0.45);

                        const photoHeight =
                            height *
                            (Number(data.photoHeight) || 0.35);

                        const photoGeo =
                            new THREE.PlaneGeometry(
                                photoWidth,
                                photoHeight
                            );

                        const photoMat =
                            new THREE.MeshBasicMaterial({
                                map: tex,
                                transparent: true,
                                side: THREE.DoubleSide,
                                depthWrite: false,
                                alphaTest: 0.05
                            });

                        const photoMesh =
                            new THREE.Mesh(
                                photoGeo,
                                photoMat
                            );

                        // ------------------------------------------------
                        // Позиция фото
                        // ------------------------------------------------

                        const photoOffsetX =
                            (Number(data.photoOffsetX) || 0) *
                            width *
                            0.5;

                        const photoOffsetY =
                            (Number(data.photoOffsetY) || 0) *
                            height *
                            0.5;

                        const photoWorld =
                            new THREE.Vector3(
                                centerWorld.x + photoOffsetX,
                                centerWorld.y + photoOffsetY,
                                frontWorldZ - 0.002
                            );

                        photoMesh.position.copy(
                            worldToDecalLocal(photoWorld)
                        );

                        photoMesh.renderOrder = 10;

                        photoMesh.userData.isDecal = true;
                        photoMesh.userData.id = 'photo';
                        photoMesh.userData.textType = 'photo';
                        photoMesh.userData.isDraggable = true;

                        decalsGroup.add(photoMesh);

                        console.log('🖼️ PHOTO:', {
                            world: photoWorld.clone(),
                            local: photoMesh.position.clone()
                        });

                        resolve();
                    },

                    undefined,

                    (err) => {
                        console.warn(
                            '⚠️ Ошибка загрузки фото дублера:',
                            err
                        );

                        resolve();
                    }
                );

            });
        }

        // ============================================================
        // 6. BACK TEXT
        // ============================================================

        if (
            data.epitaph &&
            data.epitaph.trim()
        ) {

            const backTexture =
                this.createDecalTextureFromData(
                    data,
                    'back'
                );

            const backWidth =
                width * 0.75;

            const backHeight =
                height * 0.55;

            const backGeo =
                new THREE.PlaneGeometry(
                    backWidth,
                    backHeight
                );

            const backMat =
                new THREE.MeshBasicMaterial({
                    map: backTexture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    alphaTest: 0.05
                });

            const backMesh =
                new THREE.Mesh(
                    backGeo,
                    backMat
                );

            const backOffsetX =
                (Number(data.textOffsetX) || 0) *
                width *
                0.5;

            const backOffsetY =
                (Number(data.textOffsetY) || 0) *
                height *
                0.5;

            const backWorld =
                new THREE.Vector3(
                    centerWorld.x + backOffsetX,
                    centerWorld.y + backOffsetY,
                    backWorldZ
                );

            backMesh.position.copy(
                worldToDecalLocal(backWorld)
            );

            // Разворачиваем на обратную сторону
            backMesh.rotation.y = Math.PI;

            backMesh.renderOrder = 9;

            backMesh.userData.isDecal = true;
            backMesh.userData.id = 'backText';
            backMesh.userData.textType = 'epitaph';
            backMesh.userData.isDraggable = true;

            decalsGroup.add(backMesh);

            console.log('📝 BACK TEXT:', {
                world: backWorld.clone(),
                local: backMesh.position.clone()
            });
        }

        // ============================================================
        // 7. ФИНАЛЬНАЯ ПРОВЕРКА
        // ============================================================

        decalsGroup.updateWorldMatrix(true, true);

        decalsGroup.traverse(obj => {

            if (!obj.userData?.isDecal) return;

            const wp = new THREE.Vector3();

            obj.getWorldPosition(wp);

            console.log(
                '🎯 FINAL DECAL:',
                obj.userData.id,
                {
                    local: obj.position.clone(),
                    world: wp.clone(),

                    targetStele: {
                        x: centerWorld.x,
                        y: centerWorld.y,
                        z: obj.userData.id === 'backText'
                            ? backWorldZ
                            : frontWorldZ
                    }
                }
            );
        });

        console.log(
            `✅ createDecalsForDuplicator: создано ${decalsGroup.children.length} декалей`
        );

        return decalsGroup;

    } catch (error) {

        console.error(
            '❌ createDecalsForDuplicator:',
            error
        );

        return null;
    }
}

    createDecalTextureFromData(data, type = 'front') {
        const canvas = document.createElement('canvas');
        const isMobile = window.innerWidth < 768;
        const canvasSize = isMobile ? 512 : 1024;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const textColor = data.textColor || '#FFFFFF';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = isMobile ? 4 : 8;
        
        const fontFamily = data.fontFamily || 'Arial, sans-serif';
        
        let currentY = 80;
        
        if (type === 'front') {
            if (data.fullName && data.fullName.trim()) {
                const safeFullName = data.fullName.trim();
                const fontSize = (data.nameFontSize || 48) * (isMobile ? 0.8 : 1.5);
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
                    ctx.fillText(line, canvas.width / 2, currentY);
                    currentY += (data.nameFontSize || 48) * (isMobile ? 0.9 : 1.8);
                });
                currentY += isMobile ? 12 : 25;
            }
            
            if (data.dates && data.dates.trim()) {
                const safeDates = data.dates.trim();
                const fontSize = (data.datesFontSize || 32) * (isMobile ? 0.8 : 1.3);
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.fillText(safeDates, canvas.width / 2, currentY);
            }
        } else {
            if (data.epitaph && data.epitaph.trim()) {
                const safeEpitaph = data.epitaph.trim();
                const lines = safeEpitaph.split(/\r?\n|\//);
                const fontSize = (data.epitaphFontSize || 40) * (isMobile ? 0.8 : 1.2);
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                
                lines.forEach(line => {
                    if (line.trim()) {
                        ctx.fillText(line.trim(), canvas.width / 2, currentY);
                        currentY += (data.epitaphFontSize || 40) * (isMobile ? 0.9 : 1.5);
                    }
                });
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    }

    highlightActiveMonument() {
        this.monuments.forEach((mon, idx) => {
            const isActive = this.currentMode === 'duplicator' && idx === this.activeIndex;
            mon.group.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (isActive) {
                        child.material.emissive = new THREE.Color(0x00a896);
                        child.material.emissiveIntensity = 0.08;
                    } else {
                        child.material.emissive = new THREE.Color(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
            });
        });
    }

    removeHighlight(group) {
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    }

addMonument(position) {
    this.currentMode = 'duplicator';
    this.pendingChanges = null;
    this.pendingIndex = -1;
    
    const uiData = this.collectUIData();
    
    const newData = {
        ...uiData,
        id: this.nextId++,
        name: `Памятник ${this.monuments.length + 1}`,
        photoUrl: uiData.photoUrl || null,
        textureUrl: uiData.textureUrl || null,
        photoOffsetX: uiData.photoOffsetX || 0,
        photoOffsetY: uiData.photoOffsetY || 0,
        photoAbsoluteX: uiData.photoOffsetX || 0,
        photoAbsoluteY: (uiData.photoOffsetY || 0) + 0.6,
        
        // ⭐⭐⭐ ДОБАВЛЯЕМ ПАРАМЕТРЫ ТЕКСТА ⭐⭐⭐
        textOffsetX: uiData.textOffsetX || 0,
        textOffsetY: uiData.textOffsetY || 0,
        epitaphOffsetX: uiData.epitaphOffsetX || 0,
        epitaphOffsetY: uiData.epitaphOffsetY || 0,
        nameFontSize: uiData.nameFontSize || 48,
        datesFontSize: uiData.datesFontSize || 32,
        epitaphFontSize: uiData.epitaphFontSize || 40,
        fontFamily: uiData.fontFamily || 'Arial, sans-serif',
        textColor: uiData.textColor || '#FFFFFF'
    };
    
    if (!position) {
        const count = this.monuments.length;
        const spacing = 2.0;
        position = { x: (count + 1) * spacing, z: 0 };
    }
    
    const group = new THREE.Group();
    group.position.set(position.x || 0, 0, position.z || 0);
    group.userData.monumentId = newData.id;
    group.userData.isMonument = true;
    
    this.monumentsGroup.add(group);
    
    const monument = {
        id: newData.id,
        data: newData,
        group: group,
        position: { x: position.x || 0, z: position.z || 0 }
    };
    
    this.monuments.push(monument);
    this.activeIndex = this.monuments.length - 1;
    this.rebuildSimpleMonument(this.monuments.length - 1);
    this.renderMonumentList();
    
    window._disableAutoMonument = true;
    
    this.showToast(`➕ Добавлен дублер #${this.monuments.length}`, 'success');
    return monument;
}

duplicateMonument(index) {
    if (index < 0 || index >= this.monuments.length) return;
    
    this.currentMode = 'duplicator';
    this.pendingChanges = null;
    this.pendingIndex = -1;
    
    const source = this.monuments[index];
    const newData = structuredClone(source.data);
    newData.id = this.nextId++;
    newData.name = `Копия ${source.data.name || index + 1}`;
    newData.photoUrl = source.data.photoUrl || source.data.textureUrl || null;
    newData.textureUrl = source.data.textureUrl || source.data.photoUrl || null;
    newData.photoOffsetX = source.data.photoOffsetX || 0;
    newData.photoOffsetY = source.data.photoOffsetY || 0;
    newData.photoAbsoluteX = source.data.photoAbsoluteX || 0;
    newData.photoAbsoluteY = source.data.photoAbsoluteY || 0.6;
    
    // ⭐⭐⭐ КОПИРУЕМ ПАРАМЕТРЫ ТЕКСТА ⭐⭐⭐
    // Они уже есть в source.data, но structureClone копирует всё!
    // Просто убедимся, что они есть:
    newData.textOffsetX = source.data.textOffsetX || 0;
    newData.textOffsetY = source.data.textOffsetY || 0;
    newData.epitaphOffsetX = source.data.epitaphOffsetX || 0;
    newData.epitaphOffsetY = source.data.epitaphOffsetY || 0;
    newData.nameFontSize = source.data.nameFontSize || 48;
    newData.datesFontSize = source.data.datesFontSize || 32;
    newData.epitaphFontSize = source.data.epitaphFontSize || 40;
    newData.fontFamily = source.data.fontFamily || 'Arial, sans-serif';
    newData.textColor = source.data.textColor || '#FFFFFF';
    
    const offset = 0.8;
    const count = this.monuments.length;
    const angle = (count / 2) * 0.8;
    const pos = {
        x: source.position.x + Math.cos(angle) * offset,
        z: source.position.z + Math.sin(angle) * offset
    };
    
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    group.userData.monumentId = newData.id;
    group.userData.isMonument = true;
    
    this.monumentsGroup.add(group);
    
    const monument = {
        id: newData.id,
        data: newData,
        group: group,
        position: pos
    };
    
    this.monuments.push(monument);
    this.activeIndex = this.monuments.length - 1;
    this.rebuildSimpleMonument(this.monuments.length - 1);
    this.renderMonumentList();
    
    window._disableAutoMonument = true;
    
    this.showToast(`📋 Дублер скопирован`, 'success');
}

    removeMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const mon = this.monuments[index];
        this.monumentsGroup.remove(mon.group);
        
        mon.group.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        
        this.monuments.splice(index, 1);
        
        if (this.activeIndex === index) {
            this.activeIndex = -1;
            if (this.monuments.length > 0) {
                this.activeIndex = Math.min(index, this.monuments.length - 1);
                this.loadMonumentToUI(this.activeIndex);
            } else {
                this.currentMode = 'main';
                window._disableAutoMonument = false;
                window._isDuplicatorMode = false;
                if (window.updateScene) window.updateScene();
            }
        } else if (this.activeIndex > index) {
            this.activeIndex--;
        }
        
        this.renderMonumentList();
        this.showToast(`🗑️ Дублер удалён`, 'success');
    }

    handleCanvasClick(event) {
        if (!this._isMoveModeActive) return;
        
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);
        const camera = window.camera || this.controls?.object;
        if (!camera) return;
        
        raycaster.setFromCamera(mouse, camera);
        
        const meshes = [];
        this.monuments.forEach((mon, idx) => {
            mon.group.traverse((child) => {
                if (child.isMesh) {
                    meshes.push({ mesh: child, index: idx });
                }
            });
        });
        
        const intersects = raycaster.intersectObjects(meshes.map(m => m.mesh));
        
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            for (const entry of meshes) {
                if (entry.mesh === hit) {
                    this.selectMonument(entry.index);
                    return;
                }
            }
        }
    }

    showToast(message, type) {
        let toast = document.getElementById('monument-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'monument-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                border-radius: 12px;
                z-index: 10001;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s;
                opacity: 0;
                background: rgba(0,0,0,0.85);
                color: white;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.05);
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2000);
    }

    getActiveMonument() {
        if (this.currentMode === 'duplicator' && this.activeIndex >= 0 && this.activeIndex < this.monuments.length) {
            return this.monuments[this.activeIndex];
        }
        return null;
    }
    
    getAllMonuments() {
        return this.monuments;
    }
    
    getMonumentCount() {
        return this.monuments.length;
    }
    
    toJSON() {
        return {
            monuments: this.monuments
                .filter(mon => mon.data?.type !== 'main')
                .map(mon => ({
                    id: mon.id,
                    data: {
                        ...mon.data,
                        type: 'duplicator'
                    },
                    position: {
                        x: mon.position?.x || mon.group?.position?.x || 0,
                        z: mon.position?.z || mon.group?.position?.z || 0
                    }
                }))
        };
    }
    
    // ============================================================
    // ⭐ ЗАГРУЗКА ИЗ JSON
    // ============================================================

    async fromJSON(data) {
        console.log('📂 Загрузка проекта из JSON');
        console.log('📊 Данные JSON:', data);

        // 1. ПОЛНОСТЬЮ ОЧИЩАЕМ СТАРОЕ СОСТОЯНИЕ ДУБЛЕРОВ
        this.monuments.forEach(mon => {
            if (mon.group) {
                this.monumentsGroup.remove(mon.group);

                mon.group.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();

                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat?.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                });
            }
        });

        this.monuments = [];
        this.activeIndex = -1;
        this.currentMode = 'main';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        this._duplicatorDataCache = {};

        this._blockStateUpdate = true;

        try {
            // 2. ПОЛУЧАЕМ СОХРАНЁННЫЕ ПАМЯТНИКИ
            const savedMonuments = Array.isArray(data?.monuments) ? data.monuments : [];
            console.log('📦 Сохранено памятников:', savedMonuments.length);

            // 3. СТАРЫЙ ФОРМАТ JSON
            if (savedMonuments.length === 0) {
                console.warn('⚠️ В JSON нет monuments');
                const ui = data.ui || data;
                const mainData = this._extractMainData(ui);

                if (!window.state) {
                    window.state = {};
                }

                Object.assign(window.state, mainData);
                this._restoreFence(mainData);

                console.log('🚧 ОГРАДКА СТАРОГО ФОРМАТА:', {
                    enabled: window.state.fenceEnabled,
                    width: window.state.fenceWidth,
                    length: window.state.fenceLength,
                    type: window.state.fenceType,
                    height: window.state.fenceHeight,
                    material: window.state.fenceMaterial,
                    gateSide: window.state.fenceGateSide,
                    gateWidth: window.state.gateWidth
                });

                await this._rebuildMainMonument(window.state);
                this.renderMonumentList();
                console.log('✅ Проект загружен в старом формате');
                return;
            }

            // 4. ПЕРВЫЙ ПАМЯТНИК = ОСНОВНОЙ
            const savedMain = savedMonuments[0];
            console.log('🪦 СОХРАНЁННЫЙ ОСНОВНОЙ ПАМЯТНИК:', savedMain);

            let mainData = savedMain?.data || savedMain;

			// ⭐ Восстанавливаем параметры оградки с верхнего уровня JSON
			if (data.fenceWidth !== undefined) {
				mainData.fenceWidth = data.fenceWidth;
			}
			if (data.fenceLength !== undefined) {
				mainData.fenceLength = data.fenceLength;
			}
			if (data.fenceEnabled !== undefined) {
				mainData.fenceEnabled = data.fenceEnabled;
			}
			if (data.fenceType !== undefined) {
				mainData.fenceType = data.fenceType;
			}
			if (data.fenceHeight !== undefined) {
				mainData.fenceHeight = data.fenceHeight;
			}
			if (data.fenceMaterial !== undefined) {
				mainData.fenceMaterial = data.fenceMaterial;
			}
			if (data.fenceGateSide !== undefined) {
				mainData.fenceGateSide = data.fenceGateSide;
			}
			if (data.gateWidth !== undefined) {
				mainData.gateWidth = data.gateWidth;
			}
			if (data.fenceOffsetX !== undefined) {
				mainData.fenceOffsetX = data.fenceOffsetX;
			}
			if (data.fenceOffsetZ !== undefined) {
				mainData.fenceOffsetZ = data.fenceOffsetZ;
			}

            // 5. РАСПАКОВКА stele
            if (mainData.stele && typeof mainData.stele === 'object') {
                mainData = { ...mainData, ...mainData.stele };
            }

            // 6. РАСПАКОВКА main
            if (mainData.main && typeof mainData.main === 'object') {
                mainData = { ...mainData, ...mainData.main };
            }

            console.log('🪦 ИТОГОВЫЕ ДАННЫЕ ОСНОВНОГО:', {
                id: mainData.id,
                steleType: mainData.steleType,
                steleModel: mainData.steleModel,
                fullName: mainData.fullName,
                dates: mainData.dates,
                epitaph: mainData.epitaph,
                material: mainData.material,
                fenceEnabled: mainData.fenceEnabled,
                fenceWidth: mainData.fenceWidth,
                fenceLength: mainData.fenceLength,
                fenceType: mainData.fenceType,
                fenceHeight: mainData.fenceHeight,
                fenceMaterial: mainData.fenceMaterial,
                fenceGateSide: mainData.fenceGateSide,
                gateWidth: mainData.gateWidth
            });

            // 7. СОЗДАЁМ STATE
            if (!window.state) {
                window.state = {};
            }

            Object.assign(window.state, mainData);
			
// ⭐ СОЗДАЁМ ГРАВИРОВКИ ИЗ ТЕКСТА
function createTextEngravings(state) {
    const front = [];
    const back = [];
    
    // Имя на лицевой стороне
    if (state.fullName && state.fullName.trim()) {
        front.push({
            id: `text_front_name_${Date.now()}`,
            type: 'text',
            text: state.fullName,
            side: 'front',
            x: state.textOffsetX || 0,
            y: state.textOffsetY || 0,
            fontSize: state.nameFontSize || 48,
            fontFamily: state.fontFamily || 'Arial, sans-serif',
            color: state.textColor || '#ffffff',
            bold: true
        });
    }
    
    // Даты на лицевой стороне
    if (state.dates && state.dates.trim()) {
        front.push({
            id: `text_front_dates_${Date.now()}`,
            type: 'text',
            text: state.dates,
            side: 'front',
            x: state.textOffsetX || 0,
            y: (state.textOffsetY || 0) - (state.nameFontSize || 48) / 1000 * 1.2,
            fontSize: state.datesFontSize || 32,
            fontFamily: state.fontFamily || 'Arial, sans-serif',
            color: state.textColor || '#ffffff',
            bold: true
        });
    }
    
    // Эпитафия на задней стороне
    if (state.epitaph && state.epitaph.trim()) {
        back.push({
            id: `text_back_epitaph_${Date.now()}`,
            type: 'text',
            text: state.epitaph,
            side: 'back',
            x: state.epitaphOffsetX || 0,
            y: state.epitaphOffsetY || 0,
            fontSize: state.epitaphFontSize || 40,
            fontFamily: state.fontFamily || 'Arial, sans-serif',
            color: state.textColor || '#ffffff',
            bold: true
        });
    }
    
    return { front, back };
}

// ⭐ ПРИМЕНЯЕМ
const engravings = createTextEngravings(window.state);
window.state.engravingsFront = engravings.front;
window.state.engravingsBack = engravings.back;

console.log('✅ Созданы гравировки из текста:', {
    front: engravings.front.length,
    back: engravings.back.length
});

            // 8. НОРМАЛИЗАЦИЯ СТЕЛЫ
            window.state.steleType = mainData.steleType || mainData.steleModel || 'custom_stl_monument';
            window.state.steleModel = mainData.steleModel || mainData.steleType || window.state.steleType;
            window.state.fullName = mainData.fullName || '';
            window.state.dates = mainData.dates || '';
            window.state.epitaph = mainData.epitaph || '';

            // 9. КРИТИЧЕСКИЙ БЛОК - ОГРАДКА ИЗ JSON
            if (mainData.fenceEnabled !== undefined) {
                window.state.fenceEnabled = mainData.fenceEnabled;
            }
            if (mainData.fenceWidth !== undefined) {
                window.state.fenceWidth = Number(mainData.fenceWidth);
            }
            if (mainData.fenceLength !== undefined) {
                window.state.fenceLength = Number(mainData.fenceLength);
            }
            if (mainData.fenceType !== undefined) {
                window.state.fenceType = String(mainData.fenceType);
            }
            if (mainData.fenceHeight !== undefined) {
                window.state.fenceHeight = Number(mainData.fenceHeight);
            }
            if (mainData.fenceMaterial !== undefined) {
                window.state.fenceMaterial = String(mainData.fenceMaterial);
            }
            if (mainData.fenceGateSide !== undefined) {
                window.state.fenceGateSide = String(mainData.fenceGateSide);
            }
            if (mainData.gateWidth !== undefined) {
                window.state.gateWidth = Number(mainData.gateWidth);
            }
            if (mainData.fenceOffsetX !== undefined) {
                window.state.fenceOffsetX = Number(mainData.fenceOffsetX);
            }
            if (mainData.fenceOffsetZ !== undefined) {
                window.state.fenceOffsetZ = Number(mainData.fenceOffsetZ);
            }

            // 10. ПРОВЕРКА STATE
            console.log('🚧 STATE ОГРАДКИ ПОСЛЕ JSON:', {
                enabled: window.state.fenceEnabled,
                width: window.state.fenceWidth,
                length: window.state.fenceLength,
                type: window.state.fenceType,
                height: window.state.fenceHeight,
                material: window.state.fenceMaterial,
                gateSide: window.state.fenceGateSide,
                gateWidth: window.state.gateWidth
            });

            // 11. ВОССТАНАВЛИВАЕМ UI
            this._restoreUI(window.state);

            // 12. ⭐ ПРИНУДИТЕЛЬНО ВОССТАНАВЛИВАЕМ ОГРАДКУ
            this._restoreFence(mainData);

            // 13. ⭐ ЕЩЕ РАЗ ПРИМЕНЯЕМ ЗНАЧЕНИЯ ИЗ JSON
            window.state.fenceWidth = Number(mainData.fenceWidth) || 1.5;
            window.state.fenceLength = Number(mainData.fenceLength) || 2.5;
            window.state.fenceType = mainData.fenceType || 'pipe';
            window.state.fenceHeight = Number(mainData.fenceHeight) || 0.6;
            window.state.fenceMaterial = mainData.fenceMaterial || 'steel';
            window.state.fenceGateSide = mainData.fenceGateSide || 'none';
            window.state.gateWidth = Number(mainData.gateWidth) || 0.8;

            // 14. ⭐ ОБНОВЛЯЕМ UI ЕЩЕ РАЗ
            const fenceWidthEl = document.getElementById('fenceWidth');
            if (fenceWidthEl) fenceWidthEl.value = window.state.fenceWidth;

            const fenceLengthEl = document.getElementById('fenceLength');
            if (fenceLengthEl) fenceLengthEl.value = window.state.fenceLength;

            const fenceTypeEl = document.getElementById('fenceType');
            if (fenceTypeEl) fenceTypeEl.value = window.state.fenceType;

            const fenceHeightEl = document.getElementById('fenceHeight');
            if (fenceHeightEl) fenceHeightEl.value = window.state.fenceHeight;

            const fenceMaterialEl = document.getElementById('fenceMaterial');
            if (fenceMaterialEl) fenceMaterialEl.value = window.state.fenceMaterial;

            const fenceGateSideEl = document.getElementById('fenceGateSide');
            if (fenceGateSideEl) fenceGateSideEl.value = window.state.fenceGateSide;

            const gateWidthEl = document.getElementById('gateWidth');
            if (gateWidthEl) gateWidthEl.value = window.state.gateWidth;

            // 15. ЛОГИРУЕМ ФИНАЛЬНЫЕ ЗНАЧЕНИЯ
            console.log('✅ ФИНАЛЬНЫЕ ЗНАЧЕНИЯ ОГРАДКИ:');
            console.log('  Ширина:', window.state.fenceWidth);
            console.log('  Длина:', window.state.fenceLength);
            console.log('  Тип:', window.state.fenceType);
            console.log('  Высота:', window.state.fenceHeight);
            console.log('  Материал:', window.state.fenceMaterial);

            // 16. КОНТРОЛЬ ПЕРЕД ПОСТРОЕНИЕМ
            console.log('🚨🚨🚨 STATE ПРЯМО ПЕРЕД _rebuildMainMonument:', {
                fenceEnabled: window.state.fenceEnabled,
                fenceWidth: window.state.fenceWidth,
                fenceLength: window.state.fenceLength,
                fenceType: window.state.fenceType,
                fenceHeight: window.state.fenceHeight,
                fenceMaterial: window.state.fenceMaterial,
                fenceGateSide: window.state.fenceGateSide,
                gateWidth: window.state.gateWidth
            });

            // 17. СТРОИМ ОСНОВНОЙ ПАМЯТНИК
            await this._rebuildMainMonument(window.state);

            // 18. ПРОВЕРКА ПОСЛЕ ПОСТРОЕНИЯ
            console.log('✅ Основной памятник восстановлен');
            console.log('🚧 ОГРАДКА ОСНОВНОГО ПОСЛЕ BUILD:', {
                enabled: window.state.fenceEnabled,
                width: window.state.fenceWidth,
                length: window.state.fenceLength,
                type: window.state.fenceType
            });

            // 19. ВОССТАНАВЛИВАЕМ ДУБЛЕРЫ
            const duplicators = savedMonuments.slice(1);
            console.log('📊 Найдено дублеров:', duplicators.length);

            for (const monData of duplicators) {
                try {
                    console.log('📋 Восстанавливаем дублер:', monData);

                    let duplicatorData = monData?.data || monData;

                    if (duplicatorData.stele && typeof duplicatorData.stele === 'object') {
                        duplicatorData = { ...duplicatorData, ...duplicatorData.stele };
                    }

                    if (duplicatorData.main && typeof duplicatorData.main === 'object') {
                        duplicatorData = { ...duplicatorData, ...duplicatorData.main };
                    }

                    const position = monData?.position || { x: 0, z: 0 };

                    console.log('📐 Данные дублера:', {
                        id: monData.id,
                        position,
                        steleType: duplicatorData.steleType,
                        steleModel: duplicatorData.steleModel,
                        fullName: duplicatorData.fullName,
                        dates: duplicatorData.dates,
                        fenceEnabled: duplicatorData.fenceEnabled,
                        fenceWidth: duplicatorData.fenceWidth,
                        fenceLength: duplicatorData.fenceLength,
                        fenceType: duplicatorData.fenceType
                    });

                    this._addMonumentFromData(duplicatorData, position);
                    const index = this.monuments.length - 1;
                    await this.rebuildSimpleMonument(index);

                    console.log(`✅ Дублер #${index + 1} восстановлен`);

                } catch (err) {
                    console.error('❌ Ошибка восстановления дублера:', err);
                }
            }

            // 20. NEXT ID
            const maxId = this.monuments.reduce((max, mon) => Math.max(max, Number(mon.id) || 0), 0);
            this.nextId = maxId + 1;

            // 21. ОБНОВЛЯЕМ UI
            this.renderMonumentList();
            this.currentMode = 'main';
            this.activeIndex = 0;

            // 22. БЛОКИРУЕМ СЛУЧАЙНЫЙ AUTO UPDATE
            window._disableAutoMonument = true;
            window._isDuplicatorMode = false;

            // 23. ФИНАЛЬНАЯ ПРОВЕРКА
            console.log('======================================');
            console.log('✅ ПРОЕКТ ПОЛНОСТЬЮ ЗАГРУЖЕН');
            console.log('🪦 Основной:', {
                steleType: window.state.steleType,
                fullName: window.state.fullName,
                dates: window.state.dates
            });
            console.log('🚧 ОГРАДКА ОСНОВНОГО:', {
                enabled: window.state.fenceEnabled,
                width: window.state.fenceWidth,
                length: window.state.fenceLength,
                type: window.state.fenceType,
                height: window.state.fenceHeight,
                material: window.state.fenceMaterial,
                gateSide: window.state.fenceGateSide,
                gateWidth: window.state.gateWidth
            });
            console.log('➕ Дублеров:', duplicators.length);
            console.log('======================================');

            this.showToast('✅ Проект загружен!', 'success');

        } finally {
            this._blockStateUpdate = false;
        }
    }

_restoreFence(ui) {
    console.log('🚧 Восстановление оградки из JSON');
    
    if (!window.state || !ui) return;

    const fenceParams = [
        'fenceEnabled',
        'fenceWidth',
        'fenceLength',
        'fenceType',
        'fenceHeight',
        'fenceMaterial',
        'fenceGateSide',
        'gateWidth',
        'fenceOffsetX',
        'fenceOffsetZ'
    ];

    // ⭐ JSON -> STATE (ТОЛЬКО если значение есть в JSON)
    for (const key of fenceParams) {
        if (ui[key] === undefined || ui[key] === null) {
            continue;  // ← НЕ ПЕРЕЗАПИСЫВАТЬ ЕСЛИ НЕТ ЗНАЧЕНИЯ
        }
        
        const value = ui[key];
        
        if (typeof value === 'boolean') {
            window.state[key] = value;
        } else if (key === 'fenceType' || key === 'fenceMaterial' || key === 'fenceGateSide') {
            window.state[key] = String(value);
        } else {
            const num = parseFloat(value);
            if (!Number.isNaN(num)) {
                window.state[key] = num;
            }
        }
    }

    // STATE -> UI
    const uiMap = {
        fenceEnabled: 'fenceEnabled',
        fenceWidth: 'fenceWidth',
        fenceLength: 'fenceLength',
        fenceType: 'fenceType',
        fenceHeight: 'fenceHeight',
        fenceMaterial: 'fenceMaterial',
        fenceGateSide: 'fenceGateSide',
        gateWidth: 'gateWidth',
        fenceOffsetX: 'fenceOffsetX',
        fenceOffsetZ: 'fenceOffsetZ'
    };

    for (const [key, elementId] of Object.entries(uiMap)) {
        const el = document.getElementById(elementId);
        if (!el) continue;

        const value = window.state[key];
        if (value === undefined || value === null) continue;

        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else if (el.tagName === 'SELECT') {
            el.value = String(value);
        } else if (el.type === 'range' || el.type === 'number') {
            el.value = value;
            const display = document.getElementById(elementId.replace('Range', '') + 'Val') ||
                          document.getElementById(elementId + 'Val');
            if (display) {
                const num = parseFloat(value);
                if (!Number.isNaN(num)) {
                    if (elementId.includes('Width') || elementId.includes('Length') || elementId.includes('Height')) {
                        display.textContent = num.toFixed(1) + ' м';
                    } else {
                        display.textContent = num.toFixed(2);
                    }
                }
            }
        } else {
            el.value = value;
        }
    }

    console.log('✅ Оградка восстановлена:', {
        enabled: window.state.fenceEnabled,
        type: window.state.fenceType,
        width: window.state.fenceWidth,
        length: window.state.fenceLength,
        height: window.state.fenceHeight,
        material: window.state.fenceMaterial,
        gateSide: window.state.fenceGateSide,
        gateWidth: window.state.gateWidth
    });
}

    _restoreUI(ui) {
        console.log('🔄 Восстановление UI из JSON');

        // ---- ТЕКСТОВЫЕ ПОЛЯ ----
        const textFields = {
            'fullName': 'fullName',
            'datesText': 'dates',
            'epitaphText': 'epitaph',
            'projectName': 'projectName',
            'textColor': 'textColor',
            'fontFamily': 'fontFamily',
            'pathColor': 'pathColor',
            'pathJointColor': 'pathJointColor',
            'flowerColor': 'flowerColor',
            'modelFrontText': 'modelFrontText',
            'modelBackName': 'modelBackName',
            'modelBackDates': 'modelBackDates',
        };

        for (const [elId, key] of Object.entries(textFields)) {
            const el = document.getElementById(elId);
            if (el && ui[key] !== undefined && ui[key] !== null) {
                el.value = ui[key];
            }
        }

        // ---- ЧИСЛОВЫЕ ПОЛЯ ----
        const numberFields = {
            'widthRange': 'width',
            'heightRange': 'height',
            'depthRange': 'depth',
            'graveWidth': 'graveWidth',
            'graveLength': 'graveLength',
            'baseHeight': 'baseHeight',
            'flowerWidth': 'flowerWidth',
            'flowerLength': 'flowerLength',
            'fenceWidth': 'fenceWidth',
            'fenceLength': 'fenceLength',
            'fenceHeight': 'fenceHeight',
            'gateWidth': 'gateWidth',
            'fenceOffsetX': 'fenceOffsetX',
            'fenceOffsetZ': 'fenceOffsetZ',
            'pathWidth': 'pathWidth',
            'pathTileSize': 'pathTileSize',
            'nameFontSize': 'nameFontSize',
            'datesFontSize': 'datesFontSize',
            'epitaphFontSize': 'epitaphFontSize',
            'photoScale': 'photoScale',
            'photoWidthMm': 'photoWidthMm',
            'photoHeightMm': 'photoHeightMm',
            'photoOffsetX': 'photoOffsetX',
            'photoOffsetY': 'photoOffsetY',
            'textOffsetX': 'textOffsetX',
            'textOffsetY': 'textOffsetY',
            'epitaphOffsetX': 'epitaphOffsetX',
            'epitaphOffsetY': 'epitaphOffsetY',
            'furnitureScale': 'furnitureScale',
            'vaseScale': 'vaseScale',
            'modelScale': 'modelScale',
            'modelPosY': 'modelPosY',
            'modelFrontFontSize': 'modelFrontFontSize',
            'modelBackFontSize': 'modelBackFontSize',
            'frontDecalSize': 'frontDecalSize',
            'backDecalSize': 'backDecalSize',
            'flowerPosX': 'flowerPosX',
            'flowerPosZ': 'flowerPosZ',
        };

		for (const [elId, key] of Object.entries(numberFields)) {
			const el = document.getElementById(elId);
			if (!el) continue;
			
			// ⭐ ИЗМЕНИТЬ: брать значение ТОЛЬКО если оно есть в JSON
			let value = ui[key];
			if (value === undefined || value === null) {
				continue;  // ← НЕ УСТАНАВЛИВАТЬ ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ!
			}
			
			const numValue = parseFloat(value);
			if (isNaN(numValue)) continue;
			
			el.value = numValue;
			
			const valDisplay = document.getElementById(elId.replace('Range', '') + 'Val') || 
							  document.getElementById(elId + 'Val');
			if (valDisplay) {
				if (elId.includes('Width') || elId.includes('Length') || elId.includes('Height')) {
					valDisplay.textContent = numValue.toFixed(1) + ' м';
				} else {
					valDisplay.textContent = numValue.toFixed(2);
				}
			}
		}

        // ---- SELECT-ПОЛЯ ----
        const selectFields = {
            'materialSelect': 'material',
            'steleTypeSelect': 'steleType',
            'fontFamily': 'fontFamily',
            'flowerbedType': 'flowerbedType',
            'fenceType': 'fenceType',
            'fenceMaterial': 'fenceMaterial',
            'fenceGateSide': 'fenceGateSide',
            'pathMaterial': 'pathMaterial',
            'pathTileLayout': 'pathTileLayout',
            'photoShape': 'photoShape',
            'vaseMaterialSelect': 'vaseMaterial',
            'modelMaterial': 'modelMaterial',
            'modelFontFamily': 'modelFontFamily',
        };

        for (const [elId, key] of Object.entries(selectFields)) {
            const el = document.getElementById(elId);
            if (el && ui[key] !== undefined && ui[key] !== null) {
                let hasValue = false;
                for (let i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === ui[key]) {
                        hasValue = true;
                        break;
                    }
                }
                if (hasValue) {
                    el.value = ui[key];
                }
            }
        }

        // ---- ЧЕКБОКСЫ ----
        const checkboxFields = {
            'flowerEnabled': 'flowerEnabled',
            'fenceEnabled': 'fenceEnabled',
            'pathEnabled': 'pathEnabled',
            'showFurniture': 'showFurniture',
            'showVases': 'showVases',
        };

        for (const [elId, key] of Object.entries(checkboxFields)) {
            const el = document.getElementById(elId);
            if (el && ui[key] !== undefined && ui[key] !== null) {
                el.checked = !!ui[key];
            }
        }

        // ---- ФОТО ----
        if (ui.textureUrl || ui.photoUrl) {
            const photoPreview = document.getElementById('photoPreview');
            if (photoPreview) {
                photoPreview.src = ui.textureUrl || ui.photoUrl;
                photoPreview.style.display = 'block';
            }
            if (window.state) {
                window.state.textureUrl = ui.textureUrl || ui.photoUrl;
            }
        }

        // ---- ФОРМА ФОТО ----
        if (ui.photoShape) {
            document.querySelectorAll('.shape-option').forEach(el => {
                el.classList.toggle('active', el.dataset.shape === ui.photoShape);
            });
            const customSize = document.getElementById('customPhotoSize');
            if (customSize) {
                customSize.style.display = ui.photoShape === 'custom' ? 'block' : 'none';
            }
        }

        // ---- ТЕКСТ ----
        if (ui.fullName !== undefined) {
            const el = document.getElementById('fullName');
            if (el) el.value = ui.fullName;
        }
        if (ui.dates !== undefined || ui.datesText !== undefined) {
            const el = document.getElementById('datesText');
            if (el) el.value = ui.dates || ui.datesText || '';
        }
        if (ui.epitaph !== undefined || ui.epitaphText !== undefined) {
            const el = document.getElementById('epitaphText');
            if (el) el.value = ui.epitaph || ui.epitaphText || '';
        }

        // ---- ГРАВИРОВКИ ----
        if (ui.engravingsFront && ui.engravingsFront.length > 0) {
            if (window.state) {
                window.state.engravingsFront = ui.engravingsFront;
            }
            if (typeof updateEngravingsFrontList === 'function') {
                updateEngravingsFrontList();
            }
        }
        if (ui.engravingsBack && ui.engravingsBack.length > 0) {
            if (window.state) {
                window.state.engravingsBack = ui.engravingsBack;
            }
            if (typeof updateEngravingsBackList === 'function') {
                updateEngravingsBackList();
            }
        }

        // ---- МЕБЕЛЬ ----
        if (ui.furniture && ui.furniture.length > 0 && window.furniture3DManager) {
            console.log('🪑 Восстанавливаем мебель:', ui.furniture.length, 'шт.');
            
            if (typeof window.furniture3DManager.clearAll === 'function') {
                window.furniture3DManager.clearAll();
            }
            
            for (const item of ui.furniture) {
                try {
                    const type = item.type || 'table';
                    const x = item.x || 0;
                    const z = item.z || 0;
                    const rotation = item.rotation || 0;
                    const scale = item.scale || 1;
                    
                    if (type === 'table' || type === 'table_simple') {
                        window.furniture3DManager.placeTable(x, z, rotation, scale);
                    } else if (type === 'bench' || type === 'bench_simple') {
                        window.furniture3DManager.placeBench(x, z, rotation, scale);
                    } else if (type === 'table_garden') {
                        window.furniture3DManager.placeTableGarden(x, z, rotation, scale);
                    } else if (type === 'garden_bench') {
                        window.furniture3DManager.placeGardenBench(x, z, rotation, scale);
                    } else if (type === 'picnic_set') {
                        window.furniture3DManager.placePicnicSet(x, z, rotation, scale);
                    } else {
                        console.warn(`⚠️ Неизвестный тип мебели: ${type}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Ошибка восстановления мебели:`, err);
                }
            }
        }

        // ---- ВОССТАНОВЛЕНИЕ ОГРАДКИ ----
        this._restoreFence(ui);
        
        // ---- ВОССТАНОВЛЕНИЕ ВАЗ ----
        this._restoreVases(ui);

        // ---- НАЗВАНИЕ ПРОЕКТА ----
        if (ui.projectName || ui.name) {
            const el = document.getElementById('projectName');
            if (el) el.value = ui.projectName || ui.name || 'Без названия';
        }

        // ---- ОБНОВЛЯЕМ ОТОБРАЖЕНИЯ ----
        document.querySelectorAll('[id$="Val"]').forEach(el => {
            const inputId = el.id.replace('Val', '');
            const input = document.getElementById(inputId);
            if (input && input.type === 'range') {
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                    if (inputId.includes('Width') || inputId.includes('Length') || 
                        inputId.includes('Height') || inputId.includes('Size') || 
                        inputId.includes('Offset') || inputId.includes('Pos')) {
                        if (val > 0 && val < 10) {
                            el.textContent = val.toFixed(2) + ' м';
                        } else {
                            el.textContent = val.toFixed(2);
                        }
                    } else if (inputId.includes('Scale')) {
                        el.textContent = val.toFixed(2);
                    } else if (inputId.includes('FontSize')) {
                        el.textContent = val;
                    } else {
                        el.textContent = val;
                    }
                }
            }
        });

        // ---- ВИДИМОСТЬ КОНТРОЛОВ ----
        const flowerControls = document.getElementById('flowerControls');
        if (flowerControls) {
            const flowerEnabled = document.getElementById('flowerEnabled');
            flowerControls.style.display = (flowerEnabled && flowerEnabled.checked) ? 'block' : 'none';
        }
        
        const fenceControls = document.getElementById('fenceControls');
        if (fenceControls) {
            const fenceEnabled = document.getElementById('fenceEnabled');
            fenceControls.style.display = (fenceEnabled && fenceEnabled.checked) ? 'block' : 'none';
        }
        
        const pathControls = document.getElementById('pathControls');
        if (pathControls) {
            const pathEnabled = document.getElementById('pathEnabled');
            pathControls.style.display = (pathEnabled && pathEnabled.checked) ? 'block' : 'none';
        }

        console.log('✅ UI полностью восстановлен из JSON');
    }

    _extractMainData(ui) {
        const steleModel = ui.steleModel || ui.steleType || ui.steleName || 'custom_stl_monument';

        const modelMap = {
            'book': 'custom_stl0',
            'rectangle': 'custom_stl_Rectangle',
            'cupol': 'custom_stl_cupol',
            'stele1': 'custom_stl',
            'stele2': 'custom_stl2',
            'stele3': 'custom_stl3',
            'stele4': 'custom_stl4',
            'stele5': 'custom_stl5',
            'stele6': 'custom_stl6',
            'stele7': 'custom_stl7',
            'test': 'custom_stl8',
            'monument': 'custom_stl_monument'
        };

        const normalizedStele = modelMap[steleModel] || steleModel;

        console.log('🔎 ОСНОВНОЙ ПАМЯТНИК:');
        console.log('  исходная модель:', steleModel);
        console.log('  нормализованная модель:', normalizedStele);
        console.log('  ФИО:', ui.fullName);
        console.log('  Даты:', ui.dates);

        return {
            steleType: normalizedStele,
            steleModel: normalizedStele,
            steleName: normalizedStele,

            width: parseFloat(ui.widthRange) || parseFloat(ui.width) || 0.6,
            height: parseFloat(ui.heightRange) || parseFloat(ui.height) || 1.2,
            depth: parseFloat(ui.depth) || 0.08,

            material: ui.materialSelect || ui.material || 'granite',

            fullName: ui.fullName || '',
            dates: ui.dates || ui.datesText || '',
            epitaph: ui.epitaph || ui.epitaphText || '',

            textColor: ui.textColor || '#ffffff',
            fontFamily: ui.fontFamily || 'Arial, sans-serif',

            nameFontSize: parseInt(ui.nameFontSize) || 48,
            datesFontSize: parseInt(ui.datesFontSize) || 32,
            epitaphFontSize: parseInt(ui.epitaphFontSize) || 40,

            textOffsetX: parseFloat(ui.textOffsetX) || 0,
            textOffsetY: parseFloat(ui.textOffsetY) || 0,

            epitaphOffsetX: parseFloat(ui.epitaphOffsetX) || 0,
            epitaphOffsetY: parseFloat(ui.epitaphOffsetY) || 0,

            textureUrl: ui.textureUrl || ui.photoUrl || null,
            photoUrl: ui.photoUrl || ui.textureUrl || null,

            photoShape: ui.photoShape || 'oval',
            photoWidthMm: parseInt(ui.photoWidthMm) || 100,
            photoHeightMm: parseInt(ui.photoHeightMm) || 140,
            photoScale: parseFloat(ui.photoScale) || 1.0,
            photoOffsetX: parseFloat(ui.photoOffsetX) || 0,
            photoOffsetY: parseFloat(ui.photoOffsetY) || 0,

            engravingsFront: ui.engravingsFront || [],
            engravingsBack: ui.engravingsBack || [],

            graveWidth: parseFloat(ui.graveWidth) || 0.9,
            graveLength: parseFloat(ui.graveLength) || 1.5,
            baseHeight: parseFloat(ui.baseHeight) || 0.15,

            flowerEnabled: ui.flowerEnabled !== undefined ? ui.flowerEnabled : true,
            flowerWidth: parseFloat(ui.flowerWidth) || 0.6,
            flowerLength: parseFloat(ui.flowerLength) || 0.9,
            flowerbedType: ui.flowerbedType || 'grass',

            fenceEnabled: ui.fenceEnabled !== undefined ? ui.fenceEnabled : true,
            fenceWidth: parseFloat(ui.fenceWidth) || 1.5,
            fenceLength: parseFloat(ui.fenceLength) || 2.5,
            fenceType: ui.fenceType || 'pipe',
            fenceHeight: parseFloat(ui.fenceHeight) || 0.6,
            fenceMaterial: ui.fenceMaterial || 'steel',
            fenceGateSide: ui.fenceGateSide || 'none',
            gateWidth: parseFloat(ui.gateWidth) || 0.8,
            fenceOffsetX: parseFloat(ui.fenceOffsetX) || 0,
            fenceOffsetZ: parseFloat(ui.fenceOffsetZ) || 0,

            pathEnabled: ui.pathEnabled !== undefined ? ui.pathEnabled : true,
            pathWidth: parseFloat(ui.pathWidth) || 0.5,
            pathMaterial: ui.pathMaterial || 'tile_gray',
            pathColor: ui.pathColor || '#888888',

            vases: ui.vases || [],
            vaseScale: parseFloat(ui.vaseScale) || 1.0,
            vaseMaterial: ui.vaseMaterial || 'marble',
            showVases: ui.showVases !== undefined ? ui.showVases : true
        };
    }

async _rebuildMainMonument(data) {
    console.log('🔄 === ВОССТАНОВЛЕНИЕ ОСНОВНОГО ПАМЯТНИКА ===');
    console.log('📊 ВХОДНЫЕ ДАННЫЕ (JSON):', data);

    if (!window.state) {
        window.state = {};
    }

    this._blockStateUpdate = true;

    try {
        // ============================================================
        // 1. JSON -> STATE (сохраняем все параметры)
        // ============================================================
        Object.assign(window.state, data);

        // ============================================================
        // 2. СОХРАНЯЕМ ПАРАМЕТРЫ ОГРАДКИ ИЗ JSON
        // ============================================================
        const fenceFromJSON = {
            fenceEnabled: data.fenceEnabled !== undefined ? data.fenceEnabled : true,
            fenceWidth: data.fenceWidth !== undefined ? Number(data.fenceWidth) : 10,
            fenceLength: data.fenceLength !== undefined ? Number(data.fenceLength) : 10,
            fenceType: data.fenceType !== undefined ? String(data.fenceType) : 'pipe',
            fenceHeight: data.fenceHeight !== undefined ? Number(data.fenceHeight) : 0.6,
            fenceMaterial: data.fenceMaterial !== undefined ? String(data.fenceMaterial) : 'steel',
            fenceGateSide: data.fenceGateSide !== undefined ? String(data.fenceGateSide) : 'none',
            gateWidth: data.gateWidth !== undefined ? Number(data.gateWidth) : 0.8,
            fenceOffsetX: data.fenceOffsetX !== undefined ? Number(data.fenceOffsetX) : 0,
            fenceOffsetZ: data.fenceOffsetZ !== undefined ? Number(data.fenceOffsetZ) : 0
        };

        console.log('🚧 ОГРАДКА ИЗ JSON:', fenceFromJSON);

        // ============================================================
        // 3. ⭐ ПРИНУДИТЕЛЬНО УСТАНАВЛИВАЕМ ЗНАЧЕНИЯ В UI ИЗ JSON
        //    (ЭТО КРИТИЧЕСКИ ВАЖНО, Т.К. updateMainMonument читает из DOM!)
        // ============================================================
        const fenceUIMap = {
            'fenceEnabled': 'fenceEnabled',
            'fenceWidth': 'fenceWidth',
            'fenceLength': 'fenceLength',
            'fenceType': 'fenceType',
            'fenceHeight': 'fenceHeight',
            'fenceMaterial': 'fenceMaterial',
            'fenceGateSide': 'fenceGateSide',
            'gateWidth': 'gateWidth',
            'fenceOffsetX': 'fenceOffsetX',
            'fenceOffsetZ': 'fenceOffsetZ'
        };

        console.log('🔄 УСТАНАВЛИВАЕМ ЗНАЧЕНИЯ В UI:');
        
        for (const [key, elementId] of Object.entries(fenceUIMap)) {
            const el = document.getElementById(elementId);
            if (!el) {
                console.warn(`⚠️ Элемент ${elementId} не найден`);
                continue;
            }

            // ⭐ БЕРЕМ ЗНАЧЕНИЕ ИЗ JSON, А НЕ ИЗ UI!
            const value = fenceFromJSON[key];
            console.log(`  ${elementId} = ${value} (${typeof value})`);

            if (el.type === 'checkbox') {
                el.checked = !!value;
            } else if (el.tagName === 'SELECT') {
                let hasValue = false;
                for (let i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === String(value)) {
                        hasValue = true;
                        break;
                    }
                }
                if (hasValue) {
                    el.value = String(value);
                } else {
                    console.warn(`⚠️ Значение ${value} не найдено в select ${elementId}`);
                }
            } else if (el.type === 'range' || el.type === 'number') {
                el.value = value;
                
                const displayId = elementId.replace('Range', '') + 'Val';
                const display = document.getElementById(displayId) || 
                               document.getElementById(elementId + 'Val');
                if (display) {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        if (elementId.includes('Width') || elementId.includes('Length') || 
                            elementId.includes('Height') || elementId.includes('Offset')) {
                            display.textContent = num.toFixed(2) + ' м';
                        } else {
                            display.textContent = num.toFixed(2);
                        }
                    }
                }
            } else {
                el.value = value;
            }
        }

        // ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
        // ⭐ 4. НЕ ОБНОВЛЯЕМ STATE ИЗ UI! 
        // ⭐    STATE УЖЕ СОДЕРЖИТ ЗНАЧЕНИЯ ИЗ JSON
        // ⭐    Обновление из UI перезапишет JSON значениями по умолчанию!
        // ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐

        // ============================================================
        // 5. ТЕКСТОВЫЕ ПОЛЯ
        // ============================================================
        const textFields = {
            'fullName': 'fullName',
            'datesText': 'dates',
            'epitaphText': 'epitaph',
            'textColor': 'textColor',
            'fontFamily': 'fontFamily'
        };

        for (const [elId, key] of Object.entries(textFields)) {
            const el = document.getElementById(elId);
            if (el && data[key] !== undefined && data[key] !== null) {
                el.value = data[key];
                window.state[key] = data[key];
            }
        }

        // ============================================================
        // 6. ЧИСЛОВЫЕ ПОЛЯ (КРОМЕ ОГРАДКИ)
        // ============================================================
        const numberFields = {
            'widthRange': 'width',
            'heightRange': 'height',
            'depthRange': 'depth',
            'graveWidth': 'graveWidth',
            'graveLength': 'graveLength',
            'baseHeight': 'baseHeight',
            'flowerWidth': 'flowerWidth',
            'flowerLength': 'flowerLength',
            'nameFontSize': 'nameFontSize',
            'datesFontSize': 'datesFontSize',
            'epitaphFontSize': 'epitaphFontSize',
            'photoScale': 'photoScale',
            'photoWidthMm': 'photoWidthMm',
            'photoHeightMm': 'photoHeightMm',
            'photoOffsetX': 'photoOffsetX',
            'photoOffsetY': 'photoOffsetY',
            'textOffsetX': 'textOffsetX',
            'textOffsetY': 'textOffsetY',
            'epitaphOffsetX': 'epitaphOffsetX',
            'epitaphOffsetY': 'epitaphOffsetY'
        };

        for (const [elId, key] of Object.entries(numberFields)) {
            const el = document.getElementById(elId);
            if (!el) continue;
            
            let value = data[key];
            if (value === undefined || value === null) continue;
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) continue;
            
            el.value = numValue;
            window.state[key] = numValue;
            
            const displayId = elId.replace('Range', '') + 'Val';
            const display = document.getElementById(displayId) || 
                           document.getElementById(elId + 'Val');
            if (display) {
                if (elId.includes('Width') || elId.includes('Length') || elId.includes('Height')) {
                    display.textContent = numValue.toFixed(2) + ' м';
                } else {
                    display.textContent = numValue.toFixed(2);
                }
            }
        }

        // ============================================================
        // 7. SELECT ПОЛЯ
        // ============================================================
        const selectFields = {
            'materialSelect': 'material',
            'steleTypeSelect': 'steleType',
            'flowerbedType': 'flowerbedType'
        };

        for (const [elId, key] of Object.entries(selectFields)) {
            const el = document.getElementById(elId);
            if (!el) continue;
            
            let value = data[key] || data.steleModel;
            if (value === undefined || value === null) continue;
            
            let hasValue = false;
            for (let i = 0; i < el.options.length; i++) {
                if (el.options[i].value === String(value)) {
                    hasValue = true;
                    break;
                }
            }
            if (hasValue) {
                el.value = String(value);
                window.state[key] = String(value);
            }
        }

        // ============================================================
        // 8. ЧЕКБОКСЫ (КРОМЕ ОГРАДКИ)
        // ============================================================
        const checkboxFields = {
            'flowerEnabled': 'flowerEnabled',
            'pathEnabled': 'pathEnabled'
        };

        for (const [elId, key] of Object.entries(checkboxFields)) {
            const el = document.getElementById(elId);
            if (el && data[key] !== undefined && data[key] !== null) {
                el.checked = !!data[key];
                window.state[key] = !!data[key];
            }
        }

        // ============================================================
        // 9. ФОТО
        // ============================================================
        if (data.textureUrl || data.photoUrl) {
            const photoPreview = document.getElementById('photoPreview');
            if (photoPreview) {
                photoPreview.src = data.textureUrl || data.photoUrl;
                photoPreview.style.display = 'block';
            }
            window.state.textureUrl = data.textureUrl || data.photoUrl;
            window.state.photoUrl = data.photoUrl || data.textureUrl;
        }

        if (data.photoShape) {
            document.querySelectorAll('.shape-option').forEach(el => {
                el.classList.toggle('active', el.dataset.shape === data.photoShape);
            });
            const customSize = document.getElementById('customPhotoSize');
            if (customSize) {
                customSize.style.display = data.photoShape === 'custom' ? 'block' : 'none';
            }
            window.state.photoShape = data.photoShape;
        }

        // ============================================================
        // 10. ⭐⭐ КОНТРОЛЬНАЯ ПРОВЕРКА ПЕРЕД ПОСТРОЕНИЕМ ⭐⭐
        // ============================================================
        console.log('🚨🚨🚨 ФИНАЛЬНАЯ ПРОВЕРКА ПЕРЕД BUILD:');
        console.log('  fenceEnabled:', window.state.fenceEnabled);
        console.log('  fenceWidth:', window.state.fenceWidth);
        console.log('  fenceLength:', window.state.fenceLength);
        console.log('  fenceType:', window.state.fenceType);
        console.log('  fenceHeight:', window.state.fenceHeight);
        console.log('  fenceMaterial:', window.state.fenceMaterial);
        console.log('  fenceGateSide:', window.state.fenceGateSide);
        console.log('  gateWidth:', window.state.gateWidth);

        // ============================================================
        // 11. СОЗДАЁМ КОПИЮ STATE ДЛЯ BUILDER
        // ============================================================
        const buildState = {
            ...window.state,
            ...fenceFromJSON  // Явно перезаписываем оградку из JSON
        };

        console.log('🏗️ BUILD STATE:', buildState);

        // ============================================================
        // 12. СТРОИМ ОСНОВНОЙ ПАМЯТНИК
        // ============================================================
        if (typeof updateMainMonument === 'function') {
            await updateMainMonument(buildState, window.monumentGroup, window.decalsGroup);
            console.log('✅ Основной памятник построен через updateMainMonument');
        } else {
            console.warn('⚠️ updateMainMonument не найдена, пропускаем');
        }

        // ============================================================
        // 13. ПОСЛЕ BUILD ВОЗВРАЩАЕМ ЗНАЧЕНИЯ В STATE
        // ============================================================
        Object.assign(window.state, fenceFromJSON);

        console.log('✅ Основной памятник восстановлен');
        console.log('🚧 ФИНАЛЬНЫЙ STATE:', {
            fenceEnabled: window.state.fenceEnabled,
            fenceWidth: window.state.fenceWidth,
            fenceLength: window.state.fenceLength,
            fenceType: window.state.fenceType,
            fenceHeight: window.state.fenceHeight,
            fenceMaterial: window.state.fenceMaterial,
            fenceGateSide: window.state.fenceGateSide,
            gateWidth: window.state.gateWidth
        });

        // ============================================================
        // 14. ВИДИМОСТЬ КОНТРОЛОВ
        // ============================================================
        const fenceControls = document.getElementById('fenceControls');
        if (fenceControls) {
            fenceControls.style.display = window.state.fenceEnabled ? 'block' : 'none';
        }

        const flowerControls = document.getElementById('flowerControls');
        if (flowerControls) {
            flowerControls.style.display = window.state.flowerEnabled ? 'block' : 'none';
        }

        const pathControls = document.getElementById('pathControls');
        if (pathControls) {
            pathControls.style.display = window.state.pathEnabled ? 'block' : 'none';
        }

    } catch (error) {
        console.error('❌ Ошибка восстановления основного памятника:', error);
    } finally {
        this._blockStateUpdate = false;
    }
}

_addDecalsToStele(steleGroup, decalsGroup, data) {
    if (!steleGroup || !decalsGroup) return;

    // Очищаем контейнер декалей
    while (decalsGroup.children.length > 0) {
        const child = decalsGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        decalsGroup.remove(child);
    }

    // Проверяем, что модель загружена
    const model = steleGroup.userData.modelRef;
    if (!model) {
        console.warn('⚠️ Модель не загружена');
        return;
    }

    // Получаем размеры модели
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const frontZ = box.max.z + 0.015;
    const backZ = box.min.z - 0.015;

    const textScale = 0.65;
    const engravingBaseSize = 0.18;

    // ============================================================
    // 1. ТЕКСТ СПЕРЕДИ (ФИО + Даты)
    // ============================================================
    if (data.fullName || data.dates) {
        const texture = this._createDecalTexture(data, 'front');
        const textWidth = size.x * textScale;
        const textHeight = size.y * textScale;
        const geo = new THREE.PlaneGeometry(textWidth, textHeight);
        const mat = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide, 
            depthWrite: false, 
            alphaTest: 0.05
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        const offsetX = (data.textOffsetX || 0) * size.x * 0.3;
        const offsetY = (data.textOffsetY || 0) * size.y * 0.3;
        mesh.position.set(offsetX, center.y + offsetY, frontZ - 0.01);
        mesh.renderOrder = 9;
        
        // ⭐⭐⭐ ФЛАГИ ДЛЯ ПЕРЕТАСКИВАНИЯ (КРИТИЧЕСКИ ВАЖНО) ⭐⭐⭐
        mesh.userData.isDecal = true;
        mesh.userData.isDraggable = true;          // <-- ГЛАВНЫЙ ФЛАГ
        mesh.userData.textType = 'name';            // <-- ИДЕНТИФИКАТОР
        mesh.userData.type = 'text';                // <-- ТИП
        mesh.userData.text = data.fullName || data.name || 'ФИО';
        mesh.userData.offsetX = data.textOffsetX || 0;
        mesh.userData.offsetY = data.textOffsetY || 0;
        mesh.userData.duplicatorIndex = this.activeIndex; // <-- ИНДЕКС ДУБЛЕРА
        
        decalsGroup.add(mesh);
        console.log('✅ Текст (ФИО) добавлен с textType=name и isDraggable=true');
    }

    // ============================================================
    // 2. ФОТО
    // ============================================================
    if (data.textureUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(data.textureUrl, (tex) => {
            let photoWidth = (data.photoWidthMm || 100) / 1000;
            let photoHeight = (data.photoHeightMm || 140) / 1000;
            const scale = data.photoScale || 1.0;
            photoWidth *= scale;
            photoHeight *= scale;
            photoWidth = Math.min(photoWidth, size.x * 0.45);
            photoHeight = Math.min(photoHeight, size.y * 0.35);
            
            const geo = new THREE.PlaneGeometry(photoWidth, photoHeight);
            const mat = new THREE.MeshBasicMaterial({ 
                map: tex, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            const photoX = data.photoOffsetX || 0;
            const photoY = center.y + (data.photoOffsetY || 0);
            mesh.position.set(photoX, photoY, frontZ - 0.008);
            mesh.renderOrder = 11;
            
            // ФОТО ТОЖЕ ДОЛЖНО БЫТЬ ПЕРЕТАСКИВАЕМЫМ
            mesh.userData.isDraggable = true;      // <-- ГЛАВНЫЙ ФЛАГ
            mesh.userData.type = 'photo';          // <-- ТИП
            mesh.userData.isPhoto = true;
            mesh.userData.photoIndex = 0;
            mesh.userData.duplicatorIndex = this.activeIndex;
            
            decalsGroup.add(mesh);
        });
    }

    // ============================================================
    // 3. ЭПИТАФИЯ
    // ============================================================
    if (data.epitaph) {
        const texture = this._createDecalTexture(data, 'back');
        const textWidth = size.x * textScale;
        const textHeight = size.y * textScale;
        const geo = new THREE.PlaneGeometry(textWidth, textHeight);
        const mat = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide, 
            depthWrite: false, 
            alphaTest: 0.05
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        const offsetX = (data.epitaphOffsetX || 0) * size.x * 0.3;
        const offsetY = (data.epitaphOffsetY || 0) * size.y * 0.3;
        mesh.position.set(offsetX, center.y + offsetY, backZ + 0.01);
        mesh.rotation.y = Math.PI;
        mesh.renderOrder = 9;
        
        // ⭐⭐⭐ ФЛАГИ ДЛЯ ПЕРЕТАСКИВАНИЯ ⭐⭐⭐
        mesh.userData.isDecal = true;
        mesh.userData.isDraggable = true;          // <-- ГЛАВНЫЙ ФЛАГ
        mesh.userData.textType = 'epitaph';        // <-- ИДЕНТИФИКАТОР
        mesh.userData.type = 'text';               // <-- ТИП
        mesh.userData.text = data.epitaph || 'ЭПИТАФИЯ';
        mesh.userData.offsetX = data.epitaphOffsetX || 0;
        mesh.userData.offsetY = data.epitaphOffsetY || 0;
        mesh.userData.duplicatorIndex = this.activeIndex;
        
        decalsGroup.add(mesh);
        console.log('✅ Эпитафия добавлена с textType=epitaph и isDraggable=true');
    }

    // ============================================================
    // 4. ГРАВИРОВКИ СПЕРЕДИ
    // ============================================================
    const frontEngravings = data.engravingsFront || [];
    frontEngravings.forEach(eng => {
        if (!eng.url) return;
        const loader = new THREE.TextureLoader();
        loader.load(eng.url, (tex) => {
            let scaleFactor = 1.0;
            if (eng.size !== undefined && eng.size > 0) {
                scaleFactor = parseFloat(eng.size);
            } else if (eng.scale !== undefined && eng.scale > 0) {
                scaleFactor = parseFloat(eng.scale);
            }
            scaleFactor = Math.min(scaleFactor, 1.5);
            const sizeM = engravingBaseSize * scaleFactor;
            
            const geo = new THREE.PlaneGeometry(sizeM, sizeM);
            const mat = new THREE.MeshBasicMaterial({ 
                map: tex, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            const offsetX = eng.x || 0;
            const offsetY = center.y + (eng.y || 0);
            mesh.position.set(offsetX, offsetY, frontZ - 0.009);
            mesh.renderOrder = 10;
            
            // ⭐ ГРАВИРОВКИ МОЖНО ПЕРЕТАСКИВАТЬ
            mesh.userData.isDraggable = true;
            mesh.userData.isEngraving = true;
            mesh.userData.side = 'front';
            mesh.userData.scale = scaleFactor;
            mesh.userData.id = eng.id || `eng_front_${Date.now()}`;
            mesh.userData.duplicatorIndex = this.activeIndex;
            
            decalsGroup.add(mesh);
        });
    });

    // ============================================================
    // 5. ГРАВИРОВКИ СЗАДИ
    // ============================================================
    const backEngravings = data.engravingsBack || [];
    backEngravings.forEach(eng => {
        if (!eng.url) return;
        const loader = new THREE.TextureLoader();
        loader.load(eng.url, (tex) => {
            let scaleFactor = 1.0;
            if (eng.size !== undefined && eng.size > 0) {
                scaleFactor = parseFloat(eng.size);
            } else if (eng.scale !== undefined && eng.scale > 0) {
                scaleFactor = parseFloat(eng.scale);
            }
            scaleFactor = Math.min(scaleFactor, 1.5);
            const sizeM = engravingBaseSize * scaleFactor;
            
            const geo = new THREE.PlaneGeometry(sizeM, sizeM);
            const mat = new THREE.MeshBasicMaterial({ 
                map: tex, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            const offsetX = eng.x || 0;
            const offsetY = center.y + (eng.y || 0);
            mesh.position.set(offsetX, offsetY, backZ + 0.009);
            mesh.rotation.y = Math.PI;
            mesh.renderOrder = 10;
            
            // ⭐ ГРАВИРОВКИ МОЖНО ПЕРЕТАСКИВАТЬ
            mesh.userData.isDraggable = true;
            mesh.userData.isEngraving = true;
            mesh.userData.side = 'back';
            mesh.userData.scale = scaleFactor;
            mesh.userData.id = eng.id || `eng_back_${Date.now()}`;
            mesh.userData.duplicatorIndex = this.activeIndex;
            
            decalsGroup.add(mesh);
        });
    });

    console.log('✅ Декали добавлены в _addDecalsToStele');
}

    _createDecalTexture(data, type) {
        const canvas = document.createElement('canvas');
        const canvasSize = 1024;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = data.textColor || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;

        const fontFamily = data.fontFamily || 'Arial, sans-serif';
        let currentY = 80;

        if (type === 'front') {
            if (data.fullName) {
                const fontSize = (data.nameFontSize || 48) * 1.5;
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                
                const rawLines = data.fullName.split(/\r?\n/);
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
                    ctx.fillText(line, canvas.width / 2, currentY);
                    currentY += (data.nameFontSize || 48) * 1.8;
                });
                currentY += 25;
            }

            if (data.dates) {
                const fontSize = (data.datesFontSize || 32) * 1.3;
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.fillText(data.dates, canvas.width / 2, currentY);
            }
        } else {
            if (data.epitaph) {
                const lines = data.epitaph.split(/\r?\n|\//);
                const fontSize = (data.epitaphFontSize || 40) * 1.2;
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                
                lines.forEach(line => {
                    if (line.trim()) {
                        ctx.fillText(line.trim(), canvas.width / 2, currentY);
                        currentY += (data.epitaphFontSize || 40) * 1.5;
                    }
                });
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    }

    _restoreVases(ui) {
        console.log('🏺 Восстановление ваз из JSON');
        
        if (!window.vasesManager) {
            console.warn('⚠️ VasesManager не найден');
            return;
        }
        
        if (typeof window.vasesManager.clearAll === 'function') {
            window.vasesManager.clearAll();
        }
        
        let globalScale = 0.6;
        if (ui.vaseScale !== undefined) {
            globalScale = parseFloat(ui.vaseScale) || 0.6;
        }
        globalScale = Math.max(0.3, Math.min(1.0, globalScale));
        
        if (window.state) {
            window.state.vaseScale = globalScale;
            if (ui.vaseMaterial) window.state.vaseMaterial = ui.vaseMaterial;
        }
        
        const scaleInput = document.getElementById('vaseScale');
        if (scaleInput) {
            scaleInput.value = globalScale;
            const display = document.getElementById('vaseScaleVal');
            if (display) display.textContent = globalScale.toFixed(2);
        }
        
        const matSelect = document.getElementById('vaseMaterialSelect');
        if (matSelect && ui.vaseMaterial) {
            matSelect.value = ui.vaseMaterial;
        }
        
        if (typeof window.vasesManager.setScale === 'function') {
            window.vasesManager.setScale(globalScale);
        }
        
        if (ui.vases && ui.vases.length > 0) {
            console.log(`🏺 Добавляем ${ui.vases.length} ваз с масштабом ${globalScale}`);
            
            for (const vase of ui.vases) {
                try {
                    const type = vase.type || 'vase1';
                    const x = parseFloat(vase.x) || 0;
                    const z = parseFloat(vase.z) || 0;
                    const rotation = parseFloat(vase.rotation) || 0;
                    const material = vase.material || ui.vaseMaterial || 'marble';
                    
                    let scale = globalScale;
                    if (vase.scale !== undefined && vase.scale !== null) {
                        scale = parseFloat(vase.scale) * 0.5;
                    }
                    scale = Math.max(0.3, Math.min(1.0, scale));
                    
                    console.log(`🏺 Ваза: ${type}, x=${x.toFixed(2)}, z=${z.toFixed(2)}, scale=${scale.toFixed(2)}`);
                    
                    if (typeof window.vasesManager.addVase === 'function') {
                        window.vasesManager.addVase(type, x, z, rotation, scale, material);
                    }
                } catch (err) {
                    console.warn('⚠️ Ошибка добавления вазы:', err);
                }
            }
        }
    }

	_rebuildDuplicator(index) {
		if (index < 0 || index >= this.monuments.length) return;

		const mon = this.monuments[index];
		const data = mon.data;

		console.log(`🔨 Перестраиваем дублер #${index + 1}`);

		// Полностью очищаем старую модель дублера
		while (mon.group.children.length > 0) {
			const child = mon.group.children[0];

			child.traverse(obj => {
				if (obj.geometry) {
					obj.geometry.dispose();
				}

				if (obj.material) {
					if (obj.material.map) {
						obj.material.map.dispose();
					}

					obj.material.dispose();
				}
			});

			mon.group.remove(child);
		}

		// ============================================================
		// ОСНОВАНИЕ
		// ============================================================

		const baseHeight = data.baseHeight || 0.15;
		const graveWidth = data.graveWidth || 0.9;
		const graveLength = data.graveLength || 1.5;

		const baseGeo = new THREE.BoxGeometry(
			graveWidth,
			baseHeight,
			graveLength
		);

		const baseMat = new THREE.MeshStandardMaterial({
			color: 0x888888,
			roughness: 0.7
		});

		const baseMesh = new THREE.Mesh(baseGeo, baseMat);

		baseMesh.position.y = baseHeight / 2;
		baseMesh.castShadow = true;
		baseMesh.receiveShadow = true;

		mon.group.add(baseMesh);

		// ============================================================
		// СТЕЛА
		// ============================================================

		const steleGroup = window.customSteleLoader.createCustomSteleMesh(
			data.steleType || 'custom_stl_monument',
			data.width || 0.6,
			data.height || 1.2,
			data.depth || 0.08,
			data.material || 'granite',
			'vertical',
			null,
			true
		);

		steleGroup.position.y =
			baseHeight + ((data.height || 1.2) / 2);

		steleGroup.position.z =
			-(graveLength / 2 - (data.depth || 0.08) / 2 - 0.05);

		mon.group.add(steleGroup);

		// ============================================================
		// DECALS — РОВНО ОДИН КОНТЕЙНЕР
		// ============================================================

		const decalsGroup = new THREE.Group();
		decalsGroup.name = 'decalsContainer';

		const waitForModel = () => {

			// Если дублер уже был перестроен повторно,
			// прекращаем старый асинхронный callback
			if (!mon.group.children.includes(steleGroup)) {
				return;
			}

			if (
				steleGroup.userData.isLoaded &&
				steleGroup.userData.modelRef
			) {

				console.log(
					`📝 Создаём ФИО/даты для дублера #${index + 1}`,
					{
						fullName: data.fullName,
						dates: data.dates
					}
				);

				// Создаём ФИО + даты ОДИН РАЗ
				this._addDecalsToStele(
					steleGroup,
					decalsGroup,
					data
				);

				// Добавляем контейнер ОДИН РАЗ
				if (!mon.group.getObjectByName('decalsContainer')) {
					mon.group.add(decalsGroup);
				}

			} else {
				setTimeout(waitForModel, 100);
			}
		};

		waitForModel();

		console.log(`✅ Дублер #${index + 1} перестроен`);
	}

    _addMonumentFromData(data, position) {
        const newData = {
            ...data,
            id: this.nextId++,
            name: data.name || `Памятник ${this.monuments.length + 1}`,
        };

        let pos = position || { x: 0, z: 0 };
        
        if (pos.x === 0 && pos.z === 0 && this.monuments.length > 0) {
            const offset = 2.0 + this.monuments.length * 0.8;
            pos = { x: offset, z: 0 };
            console.log(`📍 Позиция дублера автоматически установлена на x=${offset}`);
        }

        const group = new THREE.Group();
        group.position.set(pos.x || 0, 0, pos.z || 0);
        group.userData.monumentId = newData.id;
        group.userData.isMonument = true;

        this.monumentsGroup.add(group);

        const monument = {
            id: newData.id,
            data: newData,
            group: group,
            position: { x: group.position.x, z: group.position.z }
        };

        this.monuments.push(monument);
        return monument;
    }

    rebuildAllMonuments() {
        this.monuments.forEach((mon, idx) => {
            this.rebuildSimpleMonument(idx);
        });
    }
}