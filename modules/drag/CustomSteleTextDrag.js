// modules/drag/CustomSteleTextDrag.js
// ============================================================
// DRAG ДЛЯ ФИО/ДАТ НА КАСТОМНЫХ СТЕЛАХ
// ============================================================

import { DragManager } from './DragManager.js';
import { findCustomStele, getSteleCenter } from './drag-utils.js';

export class CustomSteleTextDrag extends DragManager {
	constructor(options = {}) {
		super(options);
		this.type = 'text_custom';

		this.setupPositionButtons();
	}

    checkEnabled() {
        // ⭐ ПРОВЕРЯЕМ, ЧТО state ЕСТЬ
        if (!this.state) return false;
        
        const checkbox = document.getElementById('enableDragText');
        return checkbox && checkbox.checked && 
               this.state.steleType && this.state.steleType.startsWith('custom_stl');
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

		// Сразу обновляем декали на кастомной STL
		this.forceDecalUpdate();
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


	setupPositionButtons() {
		const step = 0.001;

		const up = document.getElementById('btnTextUp');
		const down = document.getElementById('btnTextDown');
		const left = document.getElementById('btnTextLeft');
		const right = document.getElementById('btnTextRight');
		const reset = document.getElementById('btnTextReset');

		const move = (dx, dy) => {
			if (!this.checkEnabled()) return;

			const x = (this.state.textOffsetX || 0) + dx;
			const y = (this.state.textOffsetY || 0) + dy;

			this.updateOffsets(this.type, x, y);
			this.forceDecalUpdate();
		};

		up?.addEventListener('click', () => move(0, step));
		down?.addEventListener('click', () => move(0, -step));
		left?.addEventListener('click', () => move(-step, 0));
		right?.addEventListener('click', () => move(step, 0));

		reset?.addEventListener('click', () => {
			if (!this.checkEnabled()) return;

			this.updateOffsets(this.type, 0, 0);
			this.forceDecalUpdate();
		});
	}

    forceDecalUpdate() {
        // ⭐ ПРОВЕРЯЕМ НАЛИЧИЕ ВСЕХ НЕОБХОДИМЫХ ОБЪЕКТОВ
        if (!window.positionDecalsOnCustomStele) {
            console.warn('⚠️ positionDecalsOnCustomStele не найден');
            return;
        }
        
        if (!this.monumentGroup || !this.decalsGroup) {
            console.warn('⚠️ monumentGroup или decalsGroup не найдены');
            return;
        }
        
        const steleObj = findCustomStele(this.monumentGroup);
        if (!steleObj || !steleObj.userData.modelRef) {
            console.warn('⚠️ Кастомная стела не найдена или не загружена');
            return;
        }
        
        // Очищаем старые декали
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
            console.log('✅ Декали обновлены для кастомной стелы (ФИО/даты)');
        } catch(e) {
            console.warn('⚠️ Ошибка обновления декалей:', e);
        }
    }
}