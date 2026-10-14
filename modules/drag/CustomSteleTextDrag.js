// modules/drag/CustomSteleTextDrag.js
// ============================================================
// DRAG ДЛЯ ФИО/ДАТ НА КАСТОМНЫХ СТЕЛАХ
// ============================================================

import { DragManager } from './DragManager.js';
import { findCustomStele, getSteleCenter, getEventPosition } from './drag-utils.js';

export class CustomSteleTextDrag extends DragManager {
	constructor(options = {}) {
		super(options);
		this.type = 'text_custom';

		this.setupPositionButtons();
	}

	checkEnabled() {
		const manager = window.multiMonumentManager;

		const targetState =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0
				? manager.monuments?.[manager.activeIndex]?.data
				: this.state;

		if (!targetState) return false;

		const checkbox = document.getElementById('enableDragText');
		const model = targetState.steleModel || targetState.steleType;

		return Boolean(
			checkbox?.checked &&
			typeof model === 'string' &&
			model.startsWith('custom_stl')
		);
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

		const isDuplicator =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.data;

		if (isDuplicator) {
			const mon = manager.monuments[manager.activeIndex];

			this.state = mon.data;

			const burial = this.getActiveBurial();

			if (!burial) {
				console.warn(
					'Не найдена активная запись для перемещения текста'
				);
				return;
			}

			// Сохраняем координаты именно в данных дублера.
			burial.textOffsetX = x;
			burial.textOffsetY = y;

			// Обновляем UI-копию записи, если она существует.
			const uiBurial = window.state?.burials?.find(
				person => person.id === burial.id
			);

			if (uiBurial) {
				uiBurial.textOffsetX = x;
				uiBurial.textOffsetY = y;
			}

			// Запоминаем выбранную запись.
			mon.data.activeBurialId = burial.id;

			// Обновляем кэш дублера.
			manager._duplicatorDataCache[manager.activeIndex] = {
				...mon.data,
				burials: mon.data.burials.map(person => ({
					...person
				}))
			};

			mon.data.frontTextureNeedsUpdate = true;

			this.updateDisplay();

			// ВАЖНО:
			// Здесь НЕ вызываем forceDecalUpdate().
			// Во время drag меняем существующий Mesh.
			// Пересоздание выполняется кнопкой «Применить».
			return;
		}

		// Основной памятник и прежний режим без списка записей.
		const burial = this.getActiveBurial();

		if (burial) {
			burial.textOffsetX = x;
			burial.textOffsetY = y;
		} else {
			this.state.textOffsetX = x;
			this.state.textOffsetY = y;
		}

		this.state.frontTextureNeedsUpdate = true;

		this.updateDisplay();
		this.forceDecalUpdate();
	}



	updateDisplay() {
		const xVal = document.getElementById('textOffsetXVal');
		const yVal = document.getElementById('textOffsetYVal');

		const burial = this.getActiveBurial();

		const x = burial
			? Number(burial.textOffsetX) || 0
			: Number(this.state?.textOffsetX) || 0;

		const y = burial
			? Number(burial.textOffsetY) || 0
			: Number(this.state?.textOffsetY) || 0;

		if (xVal) xVal.textContent = x.toFixed(3);
		if (yVal) yVal.textContent = y.toFixed(3);
	}



	onDragStart(type) {
		this.updateDisplay();

		const manager = window.multiMonumentManager;

		if (
			manager?.currentMode !== 'duplicator' ||
			manager.activeIndex < 0
		) {
			return;
		}

		const mon = manager.monuments[manager.activeIndex];
		const burial = this.getActiveBurial();

		if (!mon?.group || !burial) {
			this.dragState.burialTextMesh = null;
			return;
		}

		let textMesh = null;

		// Ищем текст только внутри активного дублера.
		const decalsGroup = mon.group.children.find(
			child =>
				child.name === 'decalsContainer' &&
				child.parent === mon.group
		);

		decalsGroup?.traverse(child => {
			if (
				!textMesh &&
				child.isMesh &&
				child.userData?.isBurialText &&
				child.userData?.burialId === burial.id
			) {
				textMesh = child;
			}
		});

		if (!textMesh) {
			console.warn(
				'Текст активного захоронения не найден в дублере',
				burial.id
			);
			this.dragState.burialTextMesh = null;
			return;
		}

		// Запоминаем исходную позицию Mesh и координаты.
		this.dragState.burialTextMesh = textMesh;

		this.dragState.burialTextStartPosition = {
			x: textMesh.position.x,
			y: textMesh.position.y
		};

		this.dragState.burialTextStartOffset = {
			x: Number(burial.textOffsetX) || 0,
			y: Number(burial.textOffsetY) || 0
		};

		// Масштаб должен совпадать с createDecalsForDuplicator().
		this.dragState.burialTextWidth =
			(mon.data.width || 0.6) * 0.5;

		this.dragState.burialTextHeight =
			(mon.data.height || 1.2) * 0.5;
	}

	onDragMove(type, x, y) {
		const manager = window.multiMonumentManager;

		const isDuplicator =
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0;

		if (isDuplicator) {
			const mesh = this.dragState.burialTextMesh;
			const start = this.dragState.burialTextStartPosition;
			const startOffset = this.dragState.burialTextStartOffset;

			if (!mesh || !start || !startOffset) {
				return;
			}

			// Перемещаем существующий Mesh.
			// Не пересоздаём текст и не меняем базовую позицию
			// каждого кадра относительно предыдущего.
			mesh.position.x =
				start.x +
				(x - startOffset.x) *
				this.dragState.burialTextWidth;

			mesh.position.y =
				start.y +
				(y - startOffset.y) *
				this.dragState.burialTextHeight;

			if (this.renderer && this.scene && this.controls) {
				this.renderer.render(
					this.scene,
					this.controls.object
				);
			}

			this.updateDisplay();
			return;
		}

		// Основной памятник оставляем на прежней логике.
		this.updateDisplay();
		this.forceDecalUpdate();
	}


	onMove(event) {
		if (!this.dragState.active) return;

		if (event.cancelable) {
			event.preventDefault();
		}

		const pos = getEventPosition(event, this.renderer);
		if (!pos) return;

		const dx =
			(pos.x - this.dragState.startX) / this.sensitivity;

		// Исправление инверсии по вертикали:
		// getEventPosition() уже переворачивает экранную ось Y.
		const dy =
			(pos.y - this.dragState.startY) / this.sensitivity;

		let newX = this.dragState.startOffsetX + dx;
		let newY = this.dragState.startOffsetY + dy;

		newX = Math.max(-this.maxOffset, Math.min(this.maxOffset, newX));
		newY = Math.max(-this.maxOffset, Math.min(this.maxOffset, newY));

		this.dragState.currentOffsetX = newX;
		this.dragState.currentOffsetY = newY;

		this.updateOffsets(this.dragState.type, newX, newY);
		this.onDragMove(this.dragState.type, newX, newY);
	}


	onDragEnd(type) {
		const manager = window.multiMonumentManager;

		if (
			manager?.currentMode === 'duplicator' &&
			manager.activeIndex >= 0
		) {
			// Координаты уже записаны в updateOffsets().
			// Не пересоздаём декали при отпускании мыши.
			this.dragState.burialTextMesh = null;
			this.dragState.burialTextStartPosition = null;
			this.dragState.burialTextStartOffset = null;
			return;
		}

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
		const manager = window.multiMonumentManager;

		const activeId =
			manager?.currentMode === 'duplicator'
				? window.state?.activeBurialId ?? this.state?.activeBurialId
				: this.state?.activeBurialId;

		const burials = this.state?.burials || [];

		return burials.find(person => person.id === activeId) || null;
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