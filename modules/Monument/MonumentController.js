// modules/MonumentController.js
import * as THREE from 'three';

export class MonumentController {
    constructor(scene, camera, renderer, monumentManager, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.monumentManager = monumentManager;
        this.controls = controls;
        
        this.isDragging = false;
        this.draggedMonument = null;
        this.dragOffset = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.moveMode = false;
        this.highlightColor = 0x00ff88;
        this.originalColors = new Map();
        
        // Визуальный индикатор выбранного памятника
        this.selectionRing = this.createSelectionRing();
        this.selectionRing.visible = false;
        this.scene.add(this.selectionRing);
        
        // Привязываем события
        this.bindEvents();
        
        console.log('✅ MonumentController инициализирован');
    }
    
    // ============================================================
    // ⭐ СОЗДАНИЕ КОЛЬЦА ВЫДЕЛЕНИЯ
    // ============================================================
    createSelectionRing() {
        const geometry = new THREE.RingGeometry(0.3, 0.35, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        return ring;
    }
    
    // ============================================================
    // ⭐ ВКЛЮЧЕНИЕ/ВЫКЛЮЧЕНИЕ РЕЖИМА ПЕРЕМЕЩЕНИЯ
    // ============================================================
    setMoveMode(enabled) {
        this.moveMode = enabled;
        if (enabled) {
            this.renderer.domElement.style.cursor = 'grab';
            this.renderer.domElement.style.border = '2px solid #00a896';
            console.log('✋ Режим перемещения памятников ВКЛЮЧЕН');
        } else {
            this.renderer.domElement.style.cursor = 'default';
            this.renderer.domElement.style.border = 'none';
            this.deselectAll();
            console.log('✋ Режим перемещения памятников ВЫКЛЮЧЕН');
        }
    }
    
    // ============================================================
    // ⭐ ВЫДЕЛЕНИЕ ПАМЯТНИКА
    // ============================================================
    selectMonument(index) {
        // Снимаем выделение со всех
        this.deselectAll();
        
        const monument = this.monumentManager.monuments[index];
        if (!monument) return;
        
        const group = monument.group;
        if (!group) return;
        
        // Подсвечиваем
        this.applyHighlight(group);
        
        // Показываем кольцо
        this.selectionRing.position.copy(group.position);
        this.selectionRing.position.y = 0.01;
        this.selectionRing.visible = true;
        
        // Обновляем UI
        this.updateSelectionUI(index);
        
        console.log(`🎯 Выбран памятник #${index + 1}`);
    }
    
    // ============================================================
    // ⭐ СНЯТИЕ ВЫДЕЛЕНИЯ
    // ============================================================
    deselectAll() {
        this.monumentManager.monuments.forEach((mon) => {
            this.removeHighlight(mon.group);
        });
        this.selectionRing.visible = false;
        this.updateSelectionUI(null);
    }
    
    // ============================================================
    // ⭐ ПОДСВЕТКА ПАМЯТНИКА
    // ============================================================
    applyHighlight(group) {
        if (!group) return;
        
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach((mat, index) => {
                    if (!mat || !mat.color) return;
                    
                    const colorKey = child.uuid + '_color_' + index;
                    if (!this.originalColors.has(colorKey)) {
                        this.originalColors.set(colorKey, mat.color.getHex());
                    }
                    
                    const origColor = this.originalColors.get(colorKey) || 0x888888;
                    const color = new THREE.Color(origColor);
                    const highlight = new THREE.Color(this.highlightColor);
                    color.lerp(highlight, 0.35);
                    mat.color.set(color);
                    
                    if (mat.emissive !== undefined) {
                        mat.emissive = new THREE.Color(this.highlightColor);
                        mat.emissiveIntensity = 0.15;
                    }
                    
                    if (mat.needsUpdate !== undefined) {
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    removeHighlight(group) {
        if (!group) return;
        
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach((mat, index) => {
                    if (!mat) return;
                    
                    const colorKey = child.uuid + '_color_' + index;
                    if (this.originalColors.has(colorKey) && mat.color) {
                        mat.color.setHex(this.originalColors.get(colorKey));
                    }
                    
                    if (mat.emissive !== undefined) {
                        mat.emissive = new THREE.Color(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                    
                    if (mat.needsUpdate !== undefined) {
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    // ============================================================
    // ⭐ ПОЛУЧЕНИЕ ПОЗИЦИИ УКАЗАТЕЛЯ
    // ============================================================
    getPointerPosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
    }
    
    // ============================================================
    // ⭐ ПОИСК ПАМЯТНИКА ПО МЕШУ
    // ============================================================
    findMonumentByMesh(mesh) {
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.isMonument && current.userData.monumentId) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
    
    // ============================================================
    // ⭐ ОБРАБОТЧИКИ СОБЫТИЙ
    // ============================================================
    bindEvents() {
        this.renderer.domElement.addEventListener('mousedown', this.onPointerDown.bind(this));
        window.addEventListener('mousemove', this.onPointerMove.bind(this));
        window.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        
        this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    }
    
    // ============================================================
    // ⭐ MOUSE EVENTS
    // ============================================================
    onPointerDown(event) {
        if (!this.moveMode) return;
        
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        this.startDrag();
    }
    
    onPointerMove(event) {
        if (!this.moveMode) return;
        
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        
        if (this.isDragging) {
            this.updateDrag();
        }
    }
    
    onPointerUp() {
        if (this.isDragging) {
            this.endDrag();
        }
    }
    
    // ============================================================
    // ⭐ TOUCH EVENTS
    // ============================================================
    onTouchStart(event) {
        if (!this.moveMode) return;
        event.preventDefault();
        const touch = event.touches[0];
        const pos = this.getPointerPosition(touch);
        this.mouse.set(pos.x, pos.y);
        this.startDrag();
    }
    
    onTouchMove(event) {
        if (!this.moveMode) return;
        event.preventDefault();
        const touch = event.touches[0];
        const pos = this.getPointerPosition(touch);
        this.mouse.set(pos.x, pos.y);
        if (this.isDragging) {
            this.updateDrag();
        }
    }
    
    onTouchEnd() {
        if (this.isDragging) {
            this.endDrag();
        }
    }
    
    // ============================================================
    // ⭐ КЛИК ДЛЯ ВЫДЕЛЕНИЯ
    // ============================================================
    onClick(event) {
        // ⭐ ЗАЩИТА: Клик по памятнику срабатывает только в режиме перемещения
        if (!this.moveMode) {
            return;
        }

        if (this.isDragging) return;
        
        const pos = this.getPointerPosition(event);
        this.mouse.set(pos.x, pos.y);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = [];
        this.monumentManager.monuments.forEach((mon) => {
            if (!mon || !mon.group) return;
            mon.group.traverse((child) => {
                if (child.isMesh) {
                    meshes.push(child);
                }
            });
        });
        
        const intersects = this.raycaster.intersectObjects(meshes);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const monumentGroup = this.findMonumentByMesh(hitMesh);
            if (monumentGroup) {
                const index = this.monumentManager.monuments.findIndex(
                    mon => mon.group === monumentGroup
                );
                if (index >= 0) {
                    this.monumentManager.selectMonument(index);
                    this.selectMonument(index);
                    return;
                }
            }
        }
        
        this.deselectAll();
    }
    
    // ============================================================
    // ⭐ DRAG LOGIC
    // ============================================================
    startDrag() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = [];
        this.monumentManager.monuments.forEach((mon) => {
            if (!mon || !mon.group) return;
            mon.group.traverse((child) => {
                if (child.isMesh) {
                    meshes.push(child);
                }
            });
        });
        
        const intersects = this.raycaster.intersectObjects(meshes);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const monumentGroup = this.findMonumentByMesh(hitMesh);
            if (monumentGroup) {
                this.isDragging = true;
                this.draggedMonument = monumentGroup;
                
                if (this.controls) {
                    this.controls.enabled = false;
                }
                
                const intersectPoint = intersects[0].point;
                this.dragOffset.copy(intersectPoint).sub(this.draggedMonument.position);
                this.dragOffset.y = 0;
                
                this.renderer.domElement.style.cursor = 'grabbing';
                
                // Выделяем
                const index = this.monumentManager.monuments.findIndex(
                    mon => mon.group === monumentGroup
                );
                if (index >= 0) {
                    this.monumentManager.selectMonument(index);
                    this.selectMonument(index);
                }
                
                console.log(`📦 Начат перетаскивание памятника #${index + 1}`);
            }
        }
    }
    
    updateDrag() {
        if (!this.isDragging || !this.draggedMonument) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = new THREE.Vector3();
        const ray = this.raycaster.ray;
        const intersectPoint = ray.intersectPlane(this.dragPlane, intersection);
        
        if (intersectPoint) {
            let newX = intersectPoint.x - this.dragOffset.x;
            let newZ = intersectPoint.z - this.dragOffset.z;
            
            newX = Math.max(-3, Math.min(3, newX));
            newZ = Math.max(-3, Math.min(3, newZ));
            
            this.draggedMonument.position.x = newX;
            this.draggedMonument.position.z = newZ;
            
            this.selectionRing.position.x = newX;
            this.selectionRing.position.z = newZ;
            
            // Обновляем данные в менеджере
            const index = this.monumentManager.monuments.findIndex(
                mon => mon.group === this.draggedMonument
            );
            if (index >= 0) {
                this.monumentManager.monuments[index].position.x = newX;
                this.monumentManager.monuments[index].position.z = newZ;
                this.updatePositionUI(index, newX, newZ);
            }
        }
    }
    
    endDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedMonument = null;
            
            if (this.controls) {
                this.controls.enabled = true;
            }
            
            this.renderer.domElement.style.cursor = 'grab';
            
            // Обновляем сцену
            if (this.monumentManager.updateCallback) {
                this.monumentManager.updateCallback();
            }
            
            console.log('📦 Перетаскивание завершено');
        }
    }
    
    // ============================================================
    // ⭐ UI ОБНОВЛЕНИЕ
    // ============================================================
    updateSelectionUI(index) {
        const infoEl = document.getElementById('selectedMonumentInfo');
        if (!infoEl) return;
        
        if (index === null || index === undefined) {
            infoEl.innerHTML = `
                <span style="color:#666;">⬤</span>
                <span style="color:#888;">Ничего не выбрано</span>
            `;
            return;
        }
        
        const monument = this.monumentManager.monuments[index];
        if (!monument) return;
        
        const name = monument.data?.fullName || `Памятник ${index + 1}`;
        
        infoEl.innerHTML = `
            <span style="color:#00ff88;">⬤</span>
            <span style="color:#fff;">🪦 ${name}</span>
            <span style="
                background:#00ff88;
                color:#000;
                padding:2px 10px;
                border-radius:12px;
                font-size:10px;
                font-weight:bold;
            ">ВЫБРАН</span>
            <span style="font-size:11px;color:#888;margin-left:8px;">
                (${monument.position.x.toFixed(2)}, ${monument.position.z.toFixed(2)})
            </span>
        `;
    }
    
    updatePositionUI(index, x, z) {
        const infoEl = document.getElementById('selectedMonumentInfo');
        if (infoEl) {
            // Просто обновляем данные
            this.updateSelectionUI(index);
        }
    }
    

    // ============================================================
    // ⭐ ОБНОВЛЕНИЕ ПОЗИЦИЙ ВСЕХ ПАМЯТНИКОВ В РЯД
    // ============================================================
    arrangeInRow(spacing = 0.7) {
        const monuments = this.monumentManager.monuments;
        if (!monuments || monuments.length === 0) return;
        
        const count = monuments.length;
        
        // ⭐ ИЗМЕНЕНИЕ: Стартовое смещение (вправо от центра), чтобы не было наложения
        const startX = 1.0; 
        
        monuments.forEach((m, index) => {
            const x = startX + index * spacing; // Каждый следующий правее на 0.7
            m.position.x = x;
            m.position.z = 0;
            
            // Обновляем 3D позицию
            if (m.group) {
                m.group.position.x = x;
                m.group.position.z = 0;
            }
        });
        
        // Обновляем UI
        if (this.monumentManager.renderMonumentList) {
            this.monumentManager.renderMonumentList();
        }
        if (this.monumentManager.updateCallback) {
            this.monumentManager.updateCallback();
        }
        
        console.log(`📐 ${count} памятников выровнены в ряд, начиная с x = ${startX}`);
    }
    
    // ============================================================
    // ⭐ УПРАВЛЕНИЕ ПОЗИЦИЕЙ КЛАВИАТУРОЙ
    // ============================================================
    moveSelected(dx, dz) {
        const index = this.monumentManager.activeIndex;
        if (index === undefined || index === null || index < 0) return;
        
        const monument = this.monumentManager.monuments[index];
        if (!monument) return;
        
        const newX = monument.position.x + dx;
        const newZ = monument.position.z + dz;
        
        monument.position.x = Math.max(-3, Math.min(3, newX));
        monument.position.z = Math.max(-3, Math.min(3, newZ));
        
        if (monument.group) {
            monument.group.position.x = monument.position.x;
            monument.group.position.z = monument.position.z;
        }
        
        this.selectionRing.position.x = monument.position.x;
        this.selectionRing.position.z = monument.position.z;
        
        this.updatePositionUI(index, monument.position.x, monument.position.z);
        this.updateSelectionUI(index);
        
        if (this.monumentManager.updateCallback) {
            this.monumentManager.updateCallback();
        }
    }
}