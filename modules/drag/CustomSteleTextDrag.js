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
			const duplicateState =
				manager.monuments[manager.activeIndex].data;

			// Чтобы DragManager начинал движение
			// с позиции именно этого дублера
			this.state = duplicateState;

			return {
				x: duplicateState.textOffsetX || 0,
				y: duplicateState.textOffsetY || 0
			};
		}

		return {
			x: this.state.textOffsetX || 0,
			y: this.state.textOffsetY || 0
		};
	}

	updateOffsets(type, x, y) {
		const manager = window.multiMonumentManager;

		// ============================================================
		// 🔒 Если редактируем дублер — меняем ТОЛЬКО его data
		// ============================================================
		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.data
		) {
			const duplicateState =
				manager.monuments[manager.activeIndex].data;

			duplicateState.textOffsetX = x;
			duplicateState.textOffsetY = y;
			duplicateState.frontTextureNeedsUpdate = true;

			// ВАЖНО:
			// дальше forceDecalUpdate() должен работать именно
			// с данными этого дублера
			this.state = duplicateState;

			this.updateDisplay();
			this.forceDecalUpdate();

			console.log('🔒 DRAG дублера: MAIN state не изменён', {
				index: manager.activeIndex,
				textOffsetX: x,
				textOffsetY: y
			});

			return;
		}

		// ============================================================
		// 🏠 MAIN
		// ============================================================
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
}