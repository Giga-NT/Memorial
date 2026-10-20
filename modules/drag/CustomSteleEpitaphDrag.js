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

		this.setupPositionButtons();
	}

	checkEnabled() {
		const checkbox = document.getElementById('enableDragEpitaph');
		const manager = window.multiMonumentManager;

		const targetState =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0
				? manager.monuments?.[manager.activeIndex]?.data
				: this.state;

		const model = targetState?.steleModel || targetState?.steleType;

		return Boolean(
			checkbox?.checked &&
			typeof model === 'string' &&
			model.startsWith('custom_stl')
		);
	}

    getDragType(y) {
        // Нижняя часть канваса (0.55 - 0.9) - эпитафия
        if (y > 0.55 && y < 0.9) {
            return this.type;
        }
        return null;
    }

	getOffsets() {
		const manager = window.multiMonumentManager;

		const targetState =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0
				? manager.monuments?.[manager.activeIndex]?.data
				: this.state;

		return {
			x: Number(targetState?.epitaphOffsetX) || 0,
			y: Number(targetState?.epitaphOffsetY) || 0
		};
	}

	updateOffsets(type, x, y) {
		const manager = window.multiMonumentManager;
		const isDuplicator =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex];

		const targetState = isDuplicator
			? manager.monuments[manager.activeIndex].data
			: this.state;

		if (!targetState) return;

		targetState.epitaphOffsetX = x;
		targetState.epitaphOffsetY = y;
		targetState.backTextureNeedsUpdate = true;

		if (isDuplicator) {
			const index = manager.activeIndex;

			manager._duplicatorDataCache[index] = {
				...targetState,
				burials: Array.isArray(targetState.burials)
					? targetState.burials.map(burial => ({ ...burial }))
					: targetState.burials
			};
		}

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

		this.dragState.epitaphMesh = this.decalsGroup?.children.find(
			child => child.userData?.isEpitaph
		);

		if (this.dragState.epitaphMesh) {
			this.dragState.epitaphBaseX = this.dragState.epitaphMesh.position.x;
			this.dragState.epitaphBaseY = this.dragState.epitaphMesh.position.y;
		}
	}

	onDragMove(type, x, y) {
		this.updateDisplay();

		const mesh = this.dragState.epitaphMesh;
		if (!mesh) return;

		mesh.position.x =
			this.dragState.epitaphBaseX -
			(x - this.dragState.startOffsetX);

		mesh.position.y =
			this.dragState.epitaphBaseY -
			(y - this.dragState.startOffsetY);
	}

	onDragEnd(type) {
		this.dragState.epitaphMesh = null;
	}

	setupPositionButtons() {
		const step = 0.01;

		document.addEventListener('click', (event) => {
			const button = event.target?.closest?.(
				'#btnEpitaphUp, #btnEpitaphDown, ' +
				'#btnEpitaphLeft, #btnEpitaphRight, #btnEpitaphReset'
			);

			if (!button) return;

			if (!this.checkEnabled()) {
				console.warn(
					'[Epitaph] Перемещение отключено: проверьте enableDragEpitaph и тип стелы'
				);
				return;
			}

			let x = Number(this.state.epitaphOffsetX) || 0;
			let y = Number(this.state.epitaphOffsetY) || 0;

			switch (button.id) {
				case 'btnEpitaphUp':
					y += step;
					break;
				case 'btnEpitaphDown':
					y -= step;
					break;
				case 'btnEpitaphLeft':
					x -= step;
					break;
				case 'btnEpitaphRight':
					x += step;
					break;
				case 'btnEpitaphReset':
					x = 0;
					y = 0;
					break;
			}

			console.log('[Epitaph] Нажата кнопка', {
				button: button.id,
				x,
				y
			});

			this.updateOffsets(this.type, x, y);
			this.forceDecalUpdate();
		});
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