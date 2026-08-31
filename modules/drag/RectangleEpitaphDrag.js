// modules/drag/RectangleEpitaphDrag.js
// ============================================================
// DRAG ДЛЯ ЭПИТАФИИ НА ПРЯМОУГОЛЬНЫХ СТЕЛАХ
// ============================================================

import * as THREE from 'three';  // ⭐ ДОБАВЬ ЭТУ СТРОКУ
import { DragManager } from './DragManager.js';
import { findRectangleStele, createBackTextureWithOffset } from './drag-utils.js';

export class RectangleEpitaphDrag extends DragManager {
    constructor(options = {}) {
        super(options);
        this.type = 'epitaph_rectangle';
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
    }

    checkEnabled() {
        const checkbox = document.getElementById('enableDragEpitaph');
        return checkbox && checkbox.checked && 
               this.state.steleType === 'rectangle';
    }

    getDragType(y) {
        if (y > 0.55 && y < 0.9) {
            return this.type;
        }
        return null;
    }

    getOffsets(type) {
        return {
            x: this.state.epitaphOffsetX || 0,
            y: this.state.epitaphOffsetY || 0
        };
    }

    updateOffsets(type, x, y) {
        this.state.epitaphOffsetX = x;
        this.state.epitaphOffsetY = y;
        this.state.backTextureNeedsUpdate = true;
        this.updateDisplay();
    }

    updateDisplay() {
        const xVal = document.getElementById('epitaphOffsetXVal');
        const yVal = document.getElementById('epitaphOffsetYVal');
        if (xVal) xVal.textContent = this.state.epitaphOffsetX.toFixed(2);
        if (yVal) yVal.textContent = this.state.epitaphOffsetY.toFixed(2);
    }

    onDragStart(type) {
        this.updateDisplay();
    }

    onDragMove(type, x, y) {
        this.updateDisplay();
        this.updateRectangleDecals();
    }

    onDragEnd(type) {
        this.updateRectangleDecals();
    }

    updateRectangleDecals() {
        const steleObj = findRectangleStele(this.monumentGroup);
        if (!steleObj) {
            if (window.throttledUpdate) window.throttledUpdate();
            return;
        }
        
        const center = steleObj.position;
        const depth = this.state.depth || 0.1;
        const frontZ = center.z + depth / 2 + 0.015;
        const backZ = center.z - depth / 2 - 0.015;
        
        // Сохраняем фото и гравировки
        const savedDecals = [];
        this.decalsGroup.children.forEach(child => {
            if (child.renderOrder === 10 || child.renderOrder === 11) {
                savedDecals.push(child);
            }
        });
        
        // Удаляем текстовые декали (renderOrder 9)
        const toRemove = [];
        this.decalsGroup.children.forEach(child => {
            if (child.renderOrder === 9) {
                toRemove.push(child);
            }
        });
        
        toRemove.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            this.decalsGroup.remove(child);
        });
        
        // Создаём эпитафию
        if (this.state.epitaph.trim()) {
            const texture = createBackTextureWithOffset(
                this.state, 
                this.state.epitaphOffsetX, 
                this.state.epitaphOffsetY
            );
            
            const textWidth = this.state.width + 0.2;
            const textHeight = this.state.height + 0.2;
            const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
            const textMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05 
            });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            textMesh.position.set(0, center.y, backZ + 0.014);
            textMesh.rotation.y = Math.PI;
            textMesh.renderOrder = 9;
            this.decalsGroup.add(textMesh);
        }
        
        // Возвращаем сохранённые декали
        savedDecals.forEach(child => {
            this.decalsGroup.add(child);
        });
        
        this.state.backTextureNeedsUpdate = false;
        console.log('✅ Обновлены декали прямоугольной стелы (эпитафия)');
    }
}