// modules/drag/FenceDrag.js
// ============================================================
// DRAG ДЛЯ ПЕРЕМЕЩЕНИЯ ОГРАДКИ И ДОРОЖКИ
// ============================================================

import * as THREE from 'three';
import { DragManager } from './DragManager.js';

export class FenceDrag extends DragManager {
    constructor(options = {}) {
        super(options);
        this.type = 'fence';
        this.maxOffset = 9.5; // ⭐ УВЕЛИЧЕНО ДО 9.5 (вместо 1.5)
        this.sensitivity = 0.5;
        this.isFenceMode = false;
        this._updateTimeout = null;

        // ⭐ ВАЖНО: Принимаем функцию пересоздания сцены через параметры
        this.onRebuildNeeded = options.onRebuildNeeded || null;

        this.dragData = {
            startX: 0,
            startZ: 0,
            offsetX: 0,
            offsetZ: 0
        };
    }

    checkEnabled() {
        const btn = document.getElementById('moveFenceModeBtn');
        if (!btn) return false;
        
        this.isFenceMode = btn.classList.contains('active') || 
                          btn.style.background === '#e67e22';
        
        return this.isFenceMode;
    }

    getDragType(y, event) {
        if (!this.isFenceMode) return null;
        
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        
        if (clientX === undefined) return null;
        
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y3d = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y3d);
        raycaster.setFromCamera(mouse, this.controls.object);
        
        // Собираем только оградку и дорожку (по маркеру isFence и isPath)
        const meshes = [];
        this.monumentGroup.children.forEach(child => {
            if (child.userData && (child.userData.isFence === true || child.userData.isPath === true)) {
                child.traverse((node) => {
                    if (node.isMesh) {
                        meshes.push(node);
                    }
                });
            }
        });
        
        // Если ничего не нашли по маркерам - ищем по визуальным признакам
        if (meshes.length === 0) {
            this.monumentGroup.children.forEach(child => {
                if (child.isMesh || child.type === 'Group') {
                    if (child.isMesh && child.geometry) {
                        const box = new THREE.Box3().setFromObject(child);
                        const size = new THREE.Vector3();
                        box.getSize(size);
                        if (size.x < 0.3 && size.y < 0.3) {
                            meshes.push(child);
                        }
                    } else if (child.type === 'Group') {
                        let hasSmallParts = false;
                        child.traverse((node) => {
                            if (node.isMesh && node.geometry) {
                                const box = new THREE.Box3().setFromObject(node);
                                const size = new THREE.Vector3();
                                box.getSize(size);
                                if (size.x < 0.3 && size.y < 0.3) {
                                    hasSmallParts = true;
                                }
                            }
                        });
                        if (hasSmallParts) {
                            child.traverse((node) => {
                                if (node.isMesh) meshes.push(node);
                            });
                        }
                    }
                }
            });
        }
        
        const intersects = raycaster.intersectObjects(meshes, true);
        
        // ⭐ ВАЖНО: Если нашли пересечение, возвращаем тип. Иначе выходим, чтобы не спамить.
        if (intersects.length > 0) {
            console.log('🚧 Клик по оградке, начинаем перетаскивание');
            return this.type;
        }
        
        return null;
    }

    getOffsets(type) {
        return {
            x: this.state.fenceOffsetX || 0,
            z: this.state.fenceOffsetZ || 0
        };
    }

    updateOffsets(type, x, z) {
        // ⭐ УВЕЛИЧИЛИ МАКСИМАЛЬНОЕ СМЕЩЕНИЕ ДО 9.5
        const maxX = 9.5;
        const maxZ = 9.5;
        
        this.state.fenceOffsetX = Math.max(-maxX, Math.min(maxX, x));
        this.state.fenceOffsetZ = Math.max(-maxZ, Math.min(maxZ, z));
        
        // ПРИМЕНЯЕМ СМЕЩЕНИЕ С ПЕРЕСОЗДАНИЕМ
        this.applyFenceOffsetWithRebuild();
        this.updateDisplay();
    }

    // ⭐ ИСПРАВЛЕННЫЙ МЕТОД ПЕРЕСОЗДАНИЯ (БЕЗ РУЧНОГО УДАЛЕНИЯ)
    applyFenceOffsetWithRebuild() {
        // 1. ВЫЗЫВАЕМ ПЕРЕДАННУЮ ФУНКЦИЮ ПЕРЕСОЗДАНИЯ
        // Сама updateScene очистит monumentGroup и перерисует всё с нуля!
        if (typeof this.onRebuildNeeded === 'function') {
            // Просто вызываем глобальное обновление
            this.onRebuildNeeded();
        } else {
            console.error('❌ Не передана функция onRebuildNeeded в FenceDrag! Оградка пропала.');
        }
        
        console.log('🚧 Оградка и дорожка пересозданы с новым смещением');
    }

    updateDisplay() {
        const xDisplay = document.getElementById('fenceOffsetXDisplay');
        const zDisplay = document.getElementById('fenceOffsetZDisplay');
        if (xDisplay) xDisplay.textContent = (this.state.fenceOffsetX || 0).toFixed(2);
        if (zDisplay) zDisplay.textContent = (this.state.fenceOffsetZ || 0).toFixed(2);
        
        const xSlider = document.getElementById('fenceOffsetX');
        const zSlider = document.getElementById('fenceOffsetZ');
        if (xSlider) xSlider.value = this.state.fenceOffsetX || 0;
        if (zSlider) zSlider.value = this.state.fenceOffsetZ || 0;
    }

    onDragStart(type) {
        console.log('🚧 Начало перетаскивания оградки');
        this.updateDisplay();
        
        const canvas = this.renderer.domElement;
        canvas.style.cursor = 'grabbing';
    }

    onDragMove(type, x, z) {
        // ОБНОВЛЯЕМ ПОЗИЦИЮ С ПЕРЕСОЗДАНИЕМ
        this.updateOffsets(type, x, z);
        
        // Не вызываем onUpdate сразу, чтобы не было тормозов
        clearTimeout(this._updateTimeout);
        this._updateTimeout = setTimeout(() => {
            if (this.onUpdate) {
                this.onUpdate();
            }
        }, 100);
    }

    onDragEnd(type) {
        console.log('🚧 Перетаскивание оградки завершено');
        
        const canvas = this.renderer.domElement;
        canvas.style.cursor = this.isFenceMode ? 'grab' : 'default';
        
        this.updateDisplay();
        
        // Финальное обновление
        clearTimeout(this._updateTimeout);
        if (this.onUpdate) {
            this.onUpdate();
        }
    }

    resetPosition() {
        this.state.fenceOffsetX = 0;
        this.state.fenceOffsetZ = 0;
        this.applyFenceOffsetWithRebuild();
        this.updateDisplay();
        
        if (this.onUpdate) {
            this.onUpdate();
        }
    }
}