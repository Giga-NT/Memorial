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
		const manager = window.multiMonumentManager;

		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.data
		) {
			this.state = manager.monuments[manager.activeIndex].data;
		}

		const burial = this.getActiveBurial();

		if (burial) {
			return {
				x: Number(burial.textOffsetX) || 0,
				y: Number(burial.textOffsetY) || 0
			};
		}

		return {
			x: Number(this.state.textOffsetX) || 0,
			y: Number(this.state.textOffsetY) || 0
		};
	}

	updateOffsets(type, x, y) {
		const manager = window.multiMonumentManager;

		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.data
		) {
			this.state = manager.monuments[manager.activeIndex].data;
		}

		const burial = this.getActiveBurial();

		if (burial) {
			// Меняем координаты только активного человека
			burial.textOffsetX = x;
			burial.textOffsetY = y;

			this.state.frontTextureNeedsUpdate = true;

			this.updateDisplay();
			this.forceDecalUpdate();
			return;
		}

		// Старый режим — если записей погребённых нет
		this.state.textOffsetX = x;
		this.state.textOffsetY = y;
		this.state.frontTextureNeedsUpdate = true;

		this.updateDisplay();
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

			const offsets = this.getOffsets(this.type);

			this.updateOffsets(
				this.type,
				offsets.x + dx,
				offsets.y + dy
			);
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
		if (!window.positionDecalsOnCustomStele) {
			console.warn('⚠️ positionDecalsOnCustomStele не найден');
			return;
		}

		if (!this.monumentGroup || !this.decalsGroup) {
			console.warn('⚠️ monumentGroup или decalsGroup не найдены');
			return;
		}

		// ============================================================
		// 🔒 ДУБЛЕР: берём ТОЛЬКО группу активного дублера
		// ============================================================
		const manager = window.multiMonumentManager;

		let searchGroup = this.monumentGroup;
		let targetDecalsGroup = this.decalsGroup;

		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]
		) {
			const activeMonument = manager.monuments[manager.activeIndex];

			if (activeMonument.group) {
				searchGroup = activeMonument.group;

				// 🔒 ВАЖНО:
				// В дублере используем decalsContainer,
				// который является прямым child группы дублера.
				// НЕ decalsContainer внутри самой стелы.
				targetDecalsGroup = activeMonument.group.children.find(
					child =>
						child.name === 'decalsContainer' &&
						child.parent === activeMonument.group
				);

				if (!targetDecalsGroup) {
					console.warn(
						'⚠️ decalsContainer дублера не найден'
					);
					return;
				}

				console.log(
					'🔒 DRAG: работаем ТОЛЬКО с дублером #' +
					(manager.activeIndex + 1),
					{
						decalsUuid: targetDecalsGroup.uuid,
						decalsChildren: targetDecalsGroup.children.length
					}
				);
			}
		}

		// ============================================================
		// 🔍 Ищем стелу ТОЛЬКО внутри выбранной группы
		// ============================================================
		const steleObj = findCustomStele(searchGroup);

		if (!steleObj || !steleObj.userData.modelRef) {
			console.warn(
				'⚠️ Кастомная стела не найдена в активной группе'
			);
			return;
		}

		console.log('🎯 DRAG target:', {
			mode: manager?.currentMode,
			activeIndex: manager?.activeIndex,
			group: searchGroup.name,
			stele: steleObj.name,
			steleUuid: steleObj.uuid,
			decalsGroup: targetDecalsGroup.uuid
		});

		// ============================================================
		// 🔒 В ДУБЛЕРЕ НЕ ТРОГАЕМ MAIN STATE
		// ============================================================
		const isDuplicator =
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0;

		// ============================================================
		// 🧹 Очищаем декали ТОЛЬКО целевого контейнера
		// ============================================================
		while (targetDecalsGroup.children.length > 0) {
			const child = targetDecalsGroup.children[0];

			if (child.geometry) {
				child.geometry.dispose();
			}

			if (child.material) {
				if (Array.isArray(child.material)) {
					child.material.forEach(material => {
						if (material.map) {
							material.map.dispose();
						}
						material.dispose();
					});
				} else {
					if (child.material.map) {
						child.material.map.dispose();
					}

					child.material.dispose();
				}
			}

			targetDecalsGroup.remove(child);
		}

		// ВАЖНО:
		// Не сбрасываем window.state в режиме дублера.
		if (!isDuplicator) {
			this.state.frontTextureCache = null;
			this.state.backTextureCache = null;
		}

		try {
			window.positionDecalsOnCustomStele(
				steleObj,
				targetDecalsGroup,
				this.state
			);

			console.log(
				'✅ Декали обновлены ТОЛЬКО для активной кастомной стелы'
			);

			if (isDuplicator) {
				console.log(
					'🔒 MAIN window.state НЕ изменён'
				);
			}

		} catch (e) {
			console.warn(
				'⚠️ Ошибка обновления декалей:',
				e
			);
		}
	}

	getActiveBurial() {
		const burials = this.state?.burials || [];
		const activeId = this.state?.activeBurialId;

		return burials.find(b => b.id === activeId) || null;
	}

	getBurialOffset(burial, axis) {
		if (!burial) return 0;

		const key = axis === 'x' ? 'textOffsetX' : 'textOffsetY';
		return Number(burial[key]) || 0;
	}

	setBurialOffset(burial, x, y) {
		if (!burial) return false;

		burial.textOffsetX = x;
		burial.textOffsetY = y;

		return true;
	}
}