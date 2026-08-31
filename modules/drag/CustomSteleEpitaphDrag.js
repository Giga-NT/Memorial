// modules/drag/CustomSteleEpitaphDrag.js
// ============================================================
// DRAG ДЛЯ ЭПИТАФИИ НА КАСТОМНЫХ СТЕЛАХ
// ============================================================

import { DragManager } from './DragManager.js';
import { findCustomStele } from './drag-utils.js';

export class CustomSteleEpitaphDrag extends DragManager {
    constructor(options = {}) {
        super(options);
        this.type = 'epitaph_custom';
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
    }

    checkEnabled() {
        const checkbox = document.getElementById('enableDragEpitaph');
        return checkbox && checkbox.checked && 
               this.state.steleType && this.state.steleType.startsWith('custom_stl');
    }

    getDragType(y) {
        // Нижняя часть канваса (0.55 - 0.9) - эпитафия
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
        this.forceDecalUpdate();
    }

    onDragEnd(type) {
        this.forceDecalUpdate();
    }

    forceDecalUpdate() {
        if (!window.positionDecalsOnCustomStele) return;
        
        const steleObj = findCustomStele(this.monumentGroup);
        if (!steleObj || !steleObj.userData.modelRef) return;
        
        while(this.decalsGroup.children.length > 0) {
            const child = this.decalsGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            this.decalsGroup.remove(child);
        }
        
        this.state.frontTextureCache = null;
        this.state.backTextureCache = null;
        
        try {
            window.positionDecalsOnCustomStele(steleObj, this.decalsGroup, this.state);
        } catch(e) {
            console.warn('⚠️ Ошибка обновления декалей:', e);
        }
    }
}