// modules/drag/RectangleTextDrag.js
// ============================================================
// DRAG ДЛЯ ФИО/ДАТ НА ПРЯМОУГОЛЬНЫХ СТЕЛАХ
// ============================================================

import * as THREE from 'three';
import { DragManager } from './DragManager.js';
import { findRectangleStele, createFrontTextureWithOffset } from './drag-utils.js';

export class RectangleTextDrag extends DragManager {
    constructor(options = {}) {
        super(options);
        this.type = 'text_rectangle';
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
    }

    checkEnabled() {
        if (!this.state) return false;
        const checkbox = document.getElementById('enableDragText');
        return checkbox && checkbox.checked && 
               this.state.steleType === 'rectangle';
    }

    getDragType(y) {
        if (y > 0.15 && y < 0.55) {
            return this.type;
        }
        return null;
    }

    getOffsets(type) {
        return {
            x: this.state.textOffsetX || 0,
            y: this.state.textOffsetY || 0
        };
    }

    updateOffsets(type, x, y) {
        this.state.textOffsetX = x;
        this.state.textOffsetY = y;
        this.state.frontTextureNeedsUpdate = true;
        this.updateDisplay();
    }

    updateDisplay() {
        const xVal = document.getElementById('textOffsetXVal');
        const yVal = document.getElementById('textOffsetYVal');
        if (xVal) xVal.textContent = this.state.textOffsetX.toFixed(2);
        if (yVal) yVal.textContent = this.state.textOffsetY.toFixed(2);
    }

    onDragStart(type) {
        this.updateDisplay();
    }

    onDragMove(type, x, y) {
        this.updateDisplay();
        this.forceDecalUpdate();
    }

    onDragEnd(type) {
        this.forceDecalUpdate();
    }

    forceDecalUpdate() {
        // ⭐ ТОЧНО КАК В КАСТОМНЫХ СТЕЛАХ
        if (!this.monumentGroup || !this.decalsGroup) {
            console.warn('⚠️ monumentGroup или decalsGroup не найдены');
            return;
        }
        
        const steleObj = findRectangleStele(this.monumentGroup);
        if (!steleObj) {
            console.warn('⚠️ Прямоугольная стела не найдена');
            return;
        }
        
        // ⭐ ПОЛУЧАЕМ ЦЕНТР И РАЗМЕРЫ СТЕЛЫ (КАК В КАСТОМНЫХ)
        const box = new THREE.Box3().setFromObject(steleObj);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        console.log('📐 Параметры стелы:');
        console.log(`  center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
        console.log(`  size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
        console.log(`  textOffset: (${this.state.textOffsetX.toFixed(3)}, ${this.state.textOffsetY.toFixed(3)})`);
        
        const depth = this.state.depth || 0.1;
        const frontZ = center.z + depth / 2 + 0.015;
        const backZ = center.z - depth / 2 - 0.015;
        const centerY = center.y;
        
        // ⭐ ОЧИЩАЕМ СТАРЫЕ ДЕКАЛИ (КАК В КАСТОМНЫХ)
        while(this.decalsGroup.children.length > 0) {
            const child = this.decalsGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            this.decalsGroup.remove(child);
        }
        
        // ⭐ СОЗДАЁМ ТЕКСТ (КАК В КАСТОМНЫХ)
        if (this.state.fullName.trim() || this.state.dates.trim()) {
            // Создаём текстуру со смещением
            const texture = createFrontTextureWithOffset(
                this.state, 
                this.state.textOffsetX, 
                this.state.textOffsetY,
                size.x,
                size.y
            );
            
            // ⭐ ДЕКАЛЬ НА ВСЮ ВЫСОТУ И ШИРИНУ СТЕЛЫ (как у кастомных)
            const textWidth = size.x * 0.85;
            const textHeight = size.y * 0.85;
            
            const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
            const textMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05 
            });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            
            // ⭐ ПОЗИЦИЯ ПО ЦЕНТРУ СТЕЛЫ (как у кастомных)
            textMesh.position.set(0, centerY, frontZ - 0.015);
            textMesh.renderOrder = 9;
            
            this.decalsGroup.add(textMesh);
            console.log('✅ Создана декаль текста');
        }
        
        this.state.frontTextureNeedsUpdate = false;
        console.log('✅ Обновлены декали прямоугольной стелы (ФИО/даты)');
    }
}