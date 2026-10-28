// modules/eventHandlers.js

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ РАЗМЕРОВ ОГРАДКИ
// ============================================================

export function initFenceHandlers() {
    document.getElementById('fenceWidth')?.addEventListener('input', function(e) {
        window.state.fenceWidth = parseFloat(e.target.value);
        document.getElementById('fenceWidthVal').textContent = window.state.fenceWidth.toFixed(1) + ' м';
        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('fenceLength')?.addEventListener('input', function(e) {
        window.state.fenceLength = parseFloat(e.target.value);
        document.getElementById('fenceLengthVal').textContent = window.state.fenceLength.toFixed(1) + ' м';
        window.throttledUpdate();
        window.calculatePrice();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ГАЛОЧЕК
// ============================================================

export function initCheckboxHandlers() {
    document.getElementById('fenceEnabled')?.addEventListener('change', function(e) {
        window.state.fenceEnabled = e.target.checked;
        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('pathEnabled')?.addEventListener('change', function(e) {
        window.state.pathEnabled = e.target.checked;
        const controls = document.getElementById('pathControls');
        if (controls) {
            controls.style.display = window.state.pathEnabled ? 'block' : 'none';
        }
        window.throttledUpdate();
        window.calculatePrice();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ТИПА СТЕЛЫ
// ============================================================

export function initSteleTypeHandlers() {
    const steleTypeSelect = document.getElementById('steleTypeSelect');
    if (steleTypeSelect) {
        steleTypeSelect.addEventListener('change', (e) => {
            window.state.steleType = e.target.value;
            if (window.state.steleType.startsWith('custom_stl')) {
                const selectedOption = e.target.selectedOptions[0];
                if (selectedOption.dataset.defaultWidth) {
                    window.state.width = parseFloat(selectedOption.dataset.defaultWidth);
                    window.state.height = parseFloat(selectedOption.dataset.defaultHeight);
                    window.state.depth = parseFloat(selectedOption.dataset.defaultDepth || 0.07);
                    const widthRange = document.getElementById('widthRange');
                    const heightRange = document.getElementById('heightRange');
                    if (widthRange) widthRange.value = window.state.width;
                    if (heightRange) heightRange.value = window.state.height;
                    if (document.getElementById('widthVal')) document.getElementById('widthVal').textContent = window.state.width.toFixed(1) + ' м';
                    if (document.getElementById('heightVal')) document.getElementById('heightVal').textContent = window.state.height.toFixed(1) + ' м';
                }
            }
            window.throttledUpdate();
        });
    }
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ РАЗМЕРОВ СТЕЛЫ
// ============================================================

export function initSteleSizeHandlers() {
    const widthRange = document.getElementById('widthRange');
    const heightRange = document.getElementById('heightRange');
    
    if (widthRange) {
        widthRange.addEventListener('input', (e) => {
            window.state.width = parseFloat(e.target.value);
            document.getElementById('widthVal').textContent = window.state.width.toFixed(1) + ' м';
            window.textureCache.invalidateFront();
            window.throttledUpdate();
            window.calculatePrice();
        });
    }
    
    if (heightRange) {
        heightRange.addEventListener('input', (e) => {
            window.state.height = parseFloat(e.target.value);
            document.getElementById('heightVal').textContent = window.state.height.toFixed(1) + ' м';
            window.textureCache.invalidateFront();
            window.throttledUpdate();
            window.calculatePrice();
        });
    }
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ФОТО
// ============================================================

let photoScaleHandlersInitialized = false;

export function initPhotoScaleHandler() {
    if (photoScaleHandlersInitialized) return;

    // Масштаб фото: меняем только выбранную фотографию
    const photoScaleRange = document.getElementById('photoScale');
    const photoScaleNumber = document.getElementById('photoScaleInput');

    if (!photoScaleRange && !photoScaleNumber) return;

    photoScaleHandlersInitialized = true;

    const applyPhotoScale = function (rawValue) {
        const val = Number.parseFloat(rawValue);

        if (!Number.isFinite(val) || val <= 0) return;

        const label = document.getElementById('photoScaleVal');
        if (label) label.textContent = val.toFixed(1);

        const manager = window.multiMonumentManager;
        const isDuplicator =
            manager?.currentMode === 'duplicator' &&
            manager.activeIndex >= 0;

        let state;
        let decalsGroup;

        if (isDuplicator) {
            const monument = manager.monuments?.[manager.activeIndex];

            if (!monument?.data || !monument?.group) return;

            state = monument.data;

            decalsGroup = monument.group.children.find(
                child =>
                    child.name === 'decalsContainer' &&
                    child.parent === monument.group
            );
        } else {
            state = window.state;
            decalsGroup = window.decalsGroup ||
                window.monumentGroup?.children.find(
                    child => child.name === 'mainDecalsGroup'
                );
        }

        if (!state || !decalsGroup) return;

        const burials = Array.isArray(state.burials)
            ? state.burials
            : [];

        // Берём человека, выбранного в основной панели «Люди на стеле»
        const selectedId = state.activeBurialId;
        const isLegacyPhoto = burials.length === 0;

        if (!isLegacyPhoto && selectedId == null) {
            console.warn('Сначала выберите человека в панели «Люди на стеле»');
            return;
        }

        let photoMesh = null;

        decalsGroup.traverse(child => {
            if (!child.isMesh || child.userData?.type !== 'photo') return;

            if (isLegacyPhoto) {
                photoMesh ??= child;
                return;
            }

            if (String(child.userData.burialId) === String(selectedId)) {
                photoMesh = child;
            }
        });

        if (!photoMesh) {
            console.warn('Не найдено выбранное фото для изменения масштаба');
            return;
        }

        const person = burials.find(
            item => String(item.id) === String(photoMesh.userData.burialId)
        );

        if (person) {
            person.photoScale = val;
        }

        if (!isDuplicator || burials.length === 0) {
            state.photoScale = val;
        }

        if (isDuplicator) {
            // В дублере перестройки нет — обновляем только выбранный mesh.
            photoMesh.scale.set(val, val, 1);
            photoMesh.userData.photoScale = val;
            photoMesh.updateMatrixWorld(true);

            const index = manager.activeIndex;
            const monument = manager.monuments[index];

            // Сохраняем индивидуальный масштаб в данных дубликатора
            if (monument?.data) {
                monument.data.burials = burials.map(item => ({ ...item }));
            }

            // Сохраняем индивидуальный масштаб в кэше
            manager._duplicatorDataCache ??= {};
            manager._duplicatorDataCache[index] = {
                ...monument.data,
                burials: burials.map(item => ({ ...item }))
            };

            // Обновляем pendingChanges, не теряя остальные поля
            if (manager.pendingIndex === index && manager.pendingChanges) {
                manager.pendingChanges.burials = burials.map(item => ({
                    ...item
                }));
            }
        } else if (typeof window.throttledUpdate === 'function') {
            // Основная стела: пересобираем только MAIN.
            // Масштабы остальных фото берутся из их burial.photoScale.
            window.throttledUpdate();
        }
    };

    photoScaleRange?.addEventListener('input', function () {
        applyPhotoScale(this.value);
    });

    photoScaleNumber?.addEventListener('input', function () {
        applyPhotoScale(this.value);
    });
}

export function initPhotoHandlers() {
    // Загрузка фото
    const textureUpload = document.getElementById('textureUpload');
    if (textureUpload) {
        textureUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!isValidFile(file)) {
                    window.showToast('❌ Недопустимый файл', 'error');
                    textureUpload.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                    window.state.textureUrl = evt.target.result;
                    window.state.modelPhotoUrl = evt.target.result;
                    window.textureCache.invalidateFront();
                    window.throttledUpdate();
                    window.calculatePrice();
                };
                reader.readAsDataURL(file);
            }
        });
    }


    initPhotoScaleHandler();


    // Форма фото
    document.querySelectorAll('.shape-option').forEach(option => {
        option.addEventListener('click', function() {
            const shape = this.dataset.shape;
            document.querySelectorAll('.shape-option').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
            const customSize = document.getElementById('customPhotoSize');
            if (customSize) {
                customSize.style.display = shape === 'custom' ? 'block' : 'none';
            }
            window.state.photoShape = shape;
            window.throttledUpdate();
        });
    });

    // Размеры фото (custom)
    const photoWidthMmInput = document.getElementById('photoWidthMm');
    const photoHeightMmInput = document.getElementById('photoHeightMm');
    if (photoWidthMmInput) {
        photoWidthMmInput.addEventListener('input', (e) => {
            window.state.photoWidthMm = parseInt(e.target.value);
            window.textureCache.invalidateFront();
            window.throttledUpdate();
        });
    }
    if (photoHeightMmInput) {
        photoHeightMmInput.addEventListener('input', (e) => {
            window.state.photoHeightMm = parseInt(e.target.value);
            window.textureCache.invalidateFront();
            window.throttledUpdate();
        });
    }
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ТЕКСТА
// ============================================================

export function initTextHandlers() {
    const fullNameInput = document.getElementById('fullName');
    if (fullNameInput) {
        fullNameInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 500) {
                window.showToast('⚠️ Слишком длинное имя (максимум 500 символов)', 'warning');
                e.target.value = value.substring(0, 500);
                return;
            }
            window.state.fullName = e.target.value;
            window.textureCache.invalidateFront();
            window.throttledUpdate();
        });
    }

    const datesTextInput = document.getElementById('datesText');
    if (datesTextInput) {
        datesTextInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 200) {
                window.showToast('⚠️ Слишком длинная дата (максимум 200 символов)', 'warning');
                e.target.value = value.substring(0, 200);
                return;
            }
            window.state.dates = e.target.value;
            window.textureCache.invalidateFront();
            window.throttledUpdate();
        });
    }

    const epitaphTextarea = document.getElementById('epitaphText');
    if (epitaphTextarea) {
        epitaphTextarea.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 2000) {
                window.showToast('⚠️ Слишком длинная эпитафия (максимум 2000 символов)', 'warning');
                e.target.value = value.substring(0, 2000);
                return;
            }
            window.state.epitaph = e.target.value;
            window.state.backTextureNeedsUpdate = true;
            window.textureCache.invalidateBack();
            window.throttledUpdate();
        });
    }

    const textColorInput = document.getElementById('textColor');
    if (textColorInput) {
        textColorInput.addEventListener('input', (e) => {
            window.state.textColor = e.target.value;
            window.textureCache.invalidateFront();
            window.textureCache.invalidateBack();
            window.throttledUpdate();
        });
    }

    const fontFamilySelect = document.getElementById('fontFamily');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', (e) => {
            const newFont = e.target.value;
            window.state.fontFamily = newFont;
            window.state.frontTextureNeedsUpdate = true;
            window.state.backTextureNeedsUpdate = true;
            window.textureCache.invalidateFront();
            window.textureCache.invalidateBack();
            window.state.frontTextureCache = null;
            window.state.backTextureCache = null;
            window.throttledUpdate();
        });
    }

    document.getElementById('forceFontUpdateBtn')?.addEventListener('click', function() {
        const currentFont = document.getElementById('fontFamily').value;
        window.state.fontFamily = currentFont;
        window.state.frontTextureNeedsUpdate = true;
        window.state.backTextureNeedsUpdate = true;
        window.state.frontTextureCache = null;
        window.state.backTextureCache = null;
        window.textureCache.invalidateFront();
        window.textureCache.invalidateBack();
        window.throttledUpdate();
        window.showToast('✅ Шрифт обновлен: ' + currentFont, 'success');
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ РАЗМЕРОВ ШРИФТА
// ============================================================

export function initFontSizeHandlers() {
    const nameFontSizeRange = document.getElementById('nameFontSize');
    if (nameFontSizeRange) {
        nameFontSizeRange.addEventListener('input', (e) => {
            window.state.nameFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('nameFontSizeVal');
            if (valDisplay) valDisplay.textContent = window.state.nameFontSize;
            window.markTexturesDirty();
        });
    }

    const datesFontSizeRange = document.getElementById('datesFontSize');
    if (datesFontSizeRange) {
        datesFontSizeRange.addEventListener('input', (e) => {
            window.state.datesFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('datesFontSizeVal');
            if (valDisplay) valDisplay.textContent = window.state.datesFontSize;
            window.markTexturesDirty();
        });
    }

    const epitaphFontSizeRange = document.getElementById('epitaphFontSize');
    if (epitaphFontSizeRange) {
        epitaphFontSizeRange.addEventListener('input', (e) => {
            window.state.epitaphFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('epitaphFontSizeVal');
            if (valDisplay) valDisplay.textContent = window.state.epitaphFontSize;
            window.markTexturesDirty();
        });
    }
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ОСНОВАНИЯ
// ============================================================

export function initBaseHandlers() {
    document.getElementById('graveWidth')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
            window.state.graveWidth = Math.max(0.3, snapped);
        document.getElementById('graveWidthVal').textContent = window.state.graveWidth.toFixed(2) + ' м';
        window.resetTileManager();
        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('graveLength')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        window.state.graveLength = Math.max(0.3, snapped);
        document.getElementById('graveLengthVal').textContent = window.state.graveLength.toFixed(2) + ' м';
        window.resetTileManager();
        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('baseHeight')?.addEventListener('input', (e) => {
        window.state.baseHeight = parseFloat(e.target.value);
        document.getElementById('baseHeightVal').textContent = window.state.baseHeight.toFixed(2) + ' м';
        window.throttledUpdate();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ЦВЕТНИКА
// ============================================================

export function initFlowerbedHandlers() {
    document.getElementById('flowerEnabled')?.addEventListener('change', (e) => {
        window.state.flowerEnabled = e.target.checked;
        const flowerControls = document.getElementById('flowerControls');
        const isSlab = window.state.flowerbedMode === 'slab';
        if (flowerControls) {
            flowerControls.style.display =
                window.state.flowerEnabled && !isSlab ? 'block' : 'none';
        }
        window.resetTileManager();
        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('flowerWidth')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        window.state.flowerWidth = Math.max(0.3, snapped);
        document.getElementById('flowerWidthVal').textContent = window.state.flowerWidth.toFixed(2) + ' м';
        window.resetTileManager();
        window.throttledUpdate();
        window.updateLayoutPreview();
        window.calculatePrice();
    });

    document.getElementById('flowerLength')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        window.state.flowerLength = Math.max(0.3, snapped);
        document.getElementById('flowerLengthVal').textContent = window.state.flowerLength.toFixed(2) + ' м';
        window.resetTileManager();
        window.throttledUpdate();
        window.updateLayoutPreview();
        window.calculatePrice();
    });

    document.getElementById('flowerbedType')?.addEventListener('change', (e) => {
        window.state.flowerbedType = e.target.value;
        const isTile = e.target.value.startsWith('tile_');
        const tileSettings = document.getElementById('tileSettings');
        if (tileSettings) {
            tileSettings.style.display = isTile ? 'block' : 'none';
        }
        window.throttledUpdate();
        window.calculatePrice();
    });

	document.getElementById('flowerbedMode')?.addEventListener('change', (e) => {
		console.log('🔥 flowerbedMode CHANGE:', e.target.value);

		if (typeof window.applyFlowerbedMode === 'function') {
			window.applyFlowerbedMode(e.target.value);
			return;
		}

		window.state.flowerbedMode = e.target.value;

		const isSlab = e.target.value === 'slab';

		const flowerControls =
			document.getElementById('flowerControls');

		if (flowerControls) {
			flowerControls.style.display = isSlab ? 'none' : 'block';
		}

		const graveSlabModelControls =
			document.getElementById('graveSlabModelControls');

		if (graveSlabModelControls) {
			graveSlabModelControls.style.display =
				isSlab ? 'block' : 'none';
		}

		// 🎨 Материалы надгробной плиты
		const graveSlabMaterialControls =
			document.getElementById('graveSlabMaterialControls');

		if (graveSlabMaterialControls) {
			graveSlabMaterialControls.style.display =
				isSlab ? 'block' : 'none';
		}

        window.throttledUpdate();
        window.calculatePrice();
    });

    document.getElementById('flowerColor')?.addEventListener('input', (e) => {
        window.state.flowerColor = e.target.value;
        window.throttledUpdate();
    });

    document.querySelectorAll('.flower-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.getElementById('flowerColor').value = color;
            window.state.flowerColor = color;
            window.throttledUpdate();
            window.calculatePrice();
        });
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ДОРОЖКИ
// ============================================================

export function initPathHandlers() {
    document.getElementById('pathWidth')?.addEventListener('input', (e) => {
        window.state.pathWidth = parseFloat(e.target.value);
        document.getElementById('pathWidthVal').textContent = window.state.pathWidth.toFixed(2) + ' м';
        window.throttledUpdate();
    });

    document.getElementById('pathMaterial')?.addEventListener('change', (e) => {
        window.state.pathMaterial = e.target.value;
        window.throttledUpdate();
    });

    document.getElementById('pathTileSize')?.addEventListener('input', (e) => {
        window.state.pathTileSize = parseFloat(e.target.value);
        document.getElementById('pathTileSizeVal').textContent = window.state.pathTileSize.toFixed(2) + ' м';
        window.throttledUpdate();
    });

    document.getElementById('pathJointColor')?.addEventListener('input', (e) => {
        window.state.pathJointColor = e.target.value;
        window.throttledUpdate();
    });

    document.getElementById('pathTileLayout')?.addEventListener('change', (e) => {
        window.state.pathTileLayout = e.target.value;
        window.throttledUpdate();
    });
}

// ============================================================
// БОРДЮР ПЛОЩАДКИ
// ============================================================
export function initSiteCurbHandlers() {
    const controls = document.getElementById('siteCurbControls');
    const syncVisibility = () => {
        if (controls) controls.style.display = window.state.curbVisible ? 'block' : 'none';
    };
    const refresh = () => {
        window.throttledUpdate();
        window.calculatePrice();
    };
    document.getElementById('curbVisible')?.addEventListener('change', e => {
        window.state.curbVisible = e.target.checked;
        syncVisibility();
        refresh();
    });
    document.getElementById('curbMaterial')?.addEventListener('change', e => {
        window.state.curbMaterial = e.target.value;
        refresh();
    });
    ['curbWidth', 'curbHeight'].forEach(id => {
        const range = document.getElementById(id);
        const number = document.getElementById(`${id}Input`);
        const update = raw => {
            const value = Number.parseFloat(raw);
            if (!Number.isFinite(value)) return;
            window.state[id] = value;
            if (range) range.value = String(value);
            if (number) number.value = String(value);
            const label = document.getElementById(`${id}Val`);
            if (label) label.textContent = `${value.toFixed(2)} м`;
            refresh();
        };
        range?.addEventListener('input', e => update(e.target.value));
        number?.addEventListener('change', e => update(e.target.value));
    });
    document.getElementById('curbInstallEnabled')?.addEventListener('change', e => {
        window.state.curbInstallEnabled = e.target.checked;
        window.calculatePrice();
    });
    document.getElementById('curbGateOpeningEnabled')?.addEventListener('change', e => {
        window.state.curbGateOpeningEnabled = e.target.checked;
        refresh();
    });
    syncVisibility();
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ОГРАДКИ (ТИП, МАТЕРИАЛ, ВЫСОТА, ВХОД)
// ============================================================

export function initFenceOptionsHandlers() {
    const fenceTypeSelect = document.getElementById('fenceType');
    if (fenceTypeSelect) {
        fenceTypeSelect.addEventListener('change', (e) => {
        window.state.fenceType = e.target.value;
        window.throttledUpdate();
        window.calculatePrice();
        });
    }
    const fenceMaterialSelect = document.getElementById('fenceMaterial');
    if (fenceMaterialSelect) {
        fenceMaterialSelect.addEventListener('change', (e) => {
            window.state.fenceMaterial = e.target.value;
            window.updateFence3DMaterials();
            window.throttledUpdate();
        });
    }

    const fenceHeightRange = document.getElementById('fenceHeight');
    if (fenceHeightRange) {
        fenceHeightRange.addEventListener('input', (e) => {
            window.state.fenceHeight = parseFloat(e.target.value);
            document.getElementById('fenceHeightVal').textContent = window.state.fenceHeight.toFixed(1) + ' м';
            window.throttledUpdate();
        });
    }

    const fenceGateSideSelect = document.getElementById('fenceGateSide');
    if (fenceGateSideSelect) {
        fenceGateSideSelect.addEventListener('change', (e) => {
        window.state.fenceGateSide = e.target.value;
        window.throttledUpdate();
        window.calculatePrice();
        });
    }

    const gateWidthRange = document.getElementById('gateWidth');
    if (gateWidthRange) {
        gateWidthRange.addEventListener('input', (e) => {
            window.state.gateWidth = parseFloat(e.target.value);
            document.getElementById('gateWidthVal').textContent = window.state.gateWidth.toFixed(1) + ' м';
            window.throttledUpdate();
            window.calculatePrice();
        });
    }
}

// ============================================================
// ⭐ ФУНКЦИИ ДЛЯ ПЕРЕМЕЩЕНИЯ ТЕКСТА И ЭПИТАФИИ
// ============================================================

function getTextTarget() {
    if (window.multiMonumentManager && window.multiMonumentManager.currentMode === 'duplicator') {
        return 'duplicator';
    }
    return 'main';
}


 // ⭐ ДЛЯ ОСНОВНОГО ТЕКСТА (ФИО)
function moveText(dx, dy) {
    const target = getTextTarget();

    // Определяем данные активного памятника или дублера.
    const targetState =
        target === 'duplicator'
            ? window.multiMonumentManager?.monuments?.[
                  window.multiMonumentManager.activeIndex
              ]?.data
            : state;

    const model = targetState?.steleModel || targetState?.steleType;

    // Кастомной стелой управляет CustomSteleTextDrag.
    // Не запускаем старый обработчик, чтобы он не конфликтовал
    // с новыми стрелками и перетаскиванием мышью.
    if (typeof model === 'string' && model.startsWith('custom_stl')) {
        return;
    }

    // Ниже оставлена старая логика для остальных моделей.
    if (target === 'duplicator') {
        if (window.multiMonumentManager) {
            const index = window.multiMonumentManager.activeIndex;

            if (
                index >= 0 &&
                window.multiMonumentManager.monuments[index]
            ) {
				const mon = window.multiMonumentManager.monuments[index];

				// Кастомная стела: её текстом управляет CustomSteleTextDrag.
				// Не запускаем старую логику с rebuildSimpleMonument().
				const steleModel = mon.data.steleModel || mon.data.steleType;

				if (
					typeof steleModel === 'string' &&
					steleModel.startsWith('custom_stl')
				) {
					return;
				}
                const step = 0.02;

                mon.data.textOffsetX =
                    (mon.data.textOffsetX || 0) + dx * step;

                mon.data.textOffsetY =
                    (mon.data.textOffsetY || 0) + dy * step;

                window.multiMonumentManager._duplicatorDataCache[index] = {
                    ...mon.data
                };

                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        const step = 0.02;

        window.state.textOffsetX =
            (window.state.textOffsetX || 0) + dx * step;

        window.state.textOffsetY =
            (window.state.textOffsetY || 0) + dy * step;

        if (typeof window.throttledUpdate === 'function') {
            window.window.throttledUpdate();
        }
    }
}

// ⭐ ДЛЯ ЭПИТАФИИ
function moveEpitaph(dx, dy) {
    const target = getTextTarget();
    const step = 0.02;

    if (target === 'duplicator') {
        const manager = window.multiMonumentManager;
        const index = manager?.activeIndex;
        const mon = manager?.monuments?.[index];

        if (!mon) return;

        // На задней стороне вертикальное направление визуально обратное.
        mon.data.epitaphOffsetX =
            (Number(mon.data.epitaphOffsetX) || 0) + dx * step;

        mon.data.epitaphOffsetY =
            (Number(mon.data.epitaphOffsetY) || 0) - dy * step;

        manager._duplicatorDataCache[index] = {
            ...mon.data,
            burials: Array.isArray(mon.data.burials)
                ? mon.data.burials.map(burial => ({ ...burial }))
                : mon.data.burials
        };

        manager.rebuildSimpleMonument(index);
        return;
    }

    window.state.epitaphOffsetX =
        (Number(window.state.epitaphOffsetX) || 0) + dx * step;

    window.state.epitaphOffsetY =
        (Number(window.state.epitaphOffsetY) || 0) + dy * step;

    if (typeof window.throttledUpdate === 'function') {
        window.window.throttledUpdate();
    }
}

// ⭐ СБРОС ПОЗИЦИИ ТЕКСТА
function resetTextPosition() {
    const target = getTextTarget();
    
    if (target === 'duplicator') {
        if (window.multiMonumentManager) {
            const index = window.multiMonumentManager.activeIndex;
            if (index >= 0 && window.multiMonumentManager.monuments[index]) {
				const mon = window.multiMonumentManager.monuments[index];

				const steleModel = mon.data.steleModel || mon.data.steleType;

				if (
					typeof steleModel === 'string' &&
					steleModel.startsWith('custom_stl')
				) {
					return;
				}
                mon.data.textOffsetX = 0;
                mon.data.textOffsetY = 0;
                window.multiMonumentManager._duplicatorDataCache[index] = { ...mon.data };
                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        window.state.textOffsetX = 0;
        window.state.textOffsetY = 0;
        if (typeof window.throttledUpdate === 'function') {
            window.window.throttledUpdate();
        }
    }
}

// ⭐ СБРОС ПОЗИЦИИ ЭПИТАФИИ
function resetEpitaphPosition() {
    const target = getTextTarget();
    
    if (target === 'duplicator') {
        if (window.multiMonumentManager) {
            const index = window.multiMonumentManager.activeIndex;
            if (index >= 0 && window.multiMonumentManager.monuments[index]) {
                const mon = window.multiMonumentManager.monuments[index];
                mon.data.epitaphOffsetX = 0;
                mon.data.epitaphOffsetY = 0;
                window.multiMonumentManager._duplicatorDataCache[index] = { ...mon.data };
                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        window.state.epitaphOffsetX = 0;
        window.state.epitaphOffsetY = 0;
        if (typeof window.throttledUpdate === 'function') {
            window.window.throttledUpdate();
        }
    }
}

// ============================================================
// ⭐ ПРИВЯЗКА КНОПОК
// ============================================================

export function initTextPositionHandlers() {
    document.getElementById('btnTextUp')?.addEventListener('click', () => moveText(0, -1));
    document.getElementById('btnTextDown')?.addEventListener('click', () => moveText(0, 1));
    document.getElementById('btnTextLeft')?.addEventListener('click', () => moveText(-1, 0));
    document.getElementById('btnTextRight')?.addEventListener('click', () => moveText(1, 0));
    document.getElementById('btnTextReset')?.addEventListener('click', resetTextPosition);
}

export function initEpitaphPositionHandlers() {
    document.getElementById('btnEpitaphUp')?.addEventListener('click', () => moveEpitaph(0, -1));
    document.getElementById('btnEpitaphDown')?.addEventListener('click', () => moveEpitaph(0, 1));
    document.getElementById('btnEpitaphLeft')?.addEventListener('click', () => moveEpitaph(-1, 0));
    document.getElementById('btnEpitaphRight')?.addEventListener('click', () => moveEpitaph(1, 0));
    document.getElementById('btnEpitaphReset')?.addEventListener('click', resetEpitaphPosition);
}

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function snapToTile(value) {
    return Math.round(value / 0.3) * 0.3;
}

function updateTextOffsetDisplay() {
    const xVal = document.getElementById('textOffsetXVal');
    const yVal = document.getElementById('textOffsetYVal');
    if (xVal) xVal.textContent = window.state.textOffsetX.toFixed(2);
    if (yVal) yVal.textContent = window.state.textOffsetY.toFixed(2);
}

function updateEpitaphOffsetDisplay() {
    const xVal = document.getElementById('epitaphOffsetXVal');
    const yVal = document.getElementById('epitaphOffsetYVal');
    if (xVal) xVal.textContent = window.state.epitaphOffsetX.toFixed(2);
    if (yVal) yVal.textContent = window.state.epitaphOffsetY.toFixed(2);
}

function isValidFile(file) {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file) return false;
    if (file.size > MAX_FILE_SIZE) {
        console.warn('⚠️ Файл слишком большой:', file.size);
        return false;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        console.warn('⚠️ Недопустимый тип файла:', file.type);
        return false;
    }
    return true;
}