// modules/eventHandlers.js

import { 
    state, 
    textureCache, 
    resetTileManager, 
    throttledUpdate, 
    markTexturesDirty,
    updateLayoutPreview,
    showToast,
    updateFence3DMaterials
} from '../script.js';

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ РАЗМЕРОВ ОГРАДКИ
// ============================================================

export function initFenceHandlers() {
    document.getElementById('fenceWidth')?.addEventListener('input', function(e) {
        state.fenceWidth = parseFloat(e.target.value);
        document.getElementById('fenceWidthVal').textContent = state.fenceWidth.toFixed(1) + ' м';
        throttledUpdate();
    });

    document.getElementById('fenceLength')?.addEventListener('input', function(e) {
        state.fenceLength = parseFloat(e.target.value);
        document.getElementById('fenceLengthVal').textContent = state.fenceLength.toFixed(1) + ' м';
        throttledUpdate();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ГАЛОЧЕК
// ============================================================

export function initCheckboxHandlers() {
    document.getElementById('fenceEnabled')?.addEventListener('change', function(e) {
        state.fenceEnabled = e.target.checked;
        throttledUpdate();
    });

    document.getElementById('pathEnabled')?.addEventListener('change', function(e) {
        state.pathEnabled = e.target.checked;
        const controls = document.getElementById('pathControls');
        if (controls) {
            controls.style.display = state.pathEnabled ? 'block' : 'none';
        }
        throttledUpdate();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ТИПА СТЕЛЫ
// ============================================================

export function initSteleTypeHandlers() {
    const steleTypeSelect = document.getElementById('steleTypeSelect');
    if (steleTypeSelect) {
        steleTypeSelect.addEventListener('change', (e) => {
            state.steleType = e.target.value;
            if (state.steleType.startsWith('custom_stl')) {
                const selectedOption = e.target.selectedOptions[0];
                if (selectedOption.dataset.defaultWidth) {
                    state.width = parseFloat(selectedOption.dataset.defaultWidth);
                    state.height = parseFloat(selectedOption.dataset.defaultHeight);
                    state.depth = parseFloat(selectedOption.dataset.defaultDepth || 0.08);
                    const widthRange = document.getElementById('widthRange');
                    const heightRange = document.getElementById('heightRange');
                    if (widthRange) widthRange.value = state.width;
                    if (heightRange) heightRange.value = state.height;
                    if (document.getElementById('widthVal')) document.getElementById('widthVal').textContent = state.width.toFixed(1) + ' м';
                    if (document.getElementById('heightVal')) document.getElementById('heightVal').textContent = state.height.toFixed(1) + ' м';
                }
            }
            throttledUpdate();
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
            state.width = parseFloat(e.target.value);
            document.getElementById('widthVal').textContent = state.width.toFixed(1) + ' м';
            textureCache.invalidateFront();
            throttledUpdate();
        });
    }
    
    if (heightRange) {
        heightRange.addEventListener('input', (e) => {
            state.height = parseFloat(e.target.value);
            document.getElementById('heightVal').textContent = state.height.toFixed(1) + ' м';
            textureCache.invalidateFront();
            throttledUpdate();
        });
    }
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ФОТО
// ============================================================

export function initPhotoHandlers() {
    // Загрузка фото
    const textureUpload = document.getElementById('textureUpload');
    if (textureUpload) {
        textureUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!isValidFile(file)) {
                    showToast('❌ Недопустимый файл', 'error');
                    textureUpload.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                    state.textureUrl = evt.target.result;
                    state.modelPhotoUrl = evt.target.result;
                    textureCache.invalidateFront();
                    throttledUpdate();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Масштаб фото
    document.getElementById('photoScale')?.addEventListener('input', function() {
        const val = parseFloat(this.value);
        document.getElementById('photoScaleVal').textContent = val.toFixed(1);
        state.photoScale = val;
        textureCache.invalidateFront();
        throttledUpdate();
    });

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
            state.photoShape = shape;
            throttledUpdate();
        });
    });

    // Размеры фото (custom)
    const photoWidthMmInput = document.getElementById('photoWidthMm');
    const photoHeightMmInput = document.getElementById('photoHeightMm');
    if (photoWidthMmInput) {
        photoWidthMmInput.addEventListener('input', (e) => {
            state.photoWidthMm = parseInt(e.target.value);
            textureCache.invalidateFront();
            throttledUpdate();
        });
    }
    if (photoHeightMmInput) {
        photoHeightMmInput.addEventListener('input', (e) => {
            state.photoHeightMm = parseInt(e.target.value);
            textureCache.invalidateFront();
            throttledUpdate();
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
                showToast('⚠️ Слишком длинное имя (максимум 500 символов)', 'warning');
                e.target.value = value.substring(0, 500);
                return;
            }
            state.fullName = e.target.value;
            textureCache.invalidateFront();
            throttledUpdate();
        });
    }

    const datesTextInput = document.getElementById('datesText');
    if (datesTextInput) {
        datesTextInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 200) {
                showToast('⚠️ Слишком длинная дата (максимум 200 символов)', 'warning');
                e.target.value = value.substring(0, 200);
                return;
            }
            state.dates = e.target.value;
            textureCache.invalidateFront();
            throttledUpdate();
        });
    }

    const epitaphTextarea = document.getElementById('epitaphText');
    if (epitaphTextarea) {
        epitaphTextarea.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 1000) {
                showToast('⚠️ Слишком длинная эпитафия (максимум 1000 символов)', 'warning');
                e.target.value = value.substring(0, 1000);
                return;
            }
            state.epitaph = e.target.value;
            textureCache.invalidateBack();
            throttledUpdate();
        });
    }

    const textColorInput = document.getElementById('textColor');
    if (textColorInput) {
        textColorInput.addEventListener('input', (e) => {
            state.textColor = e.target.value;
            textureCache.invalidateFront();
            textureCache.invalidateBack();
            throttledUpdate();
        });
    }

    const fontFamilySelect = document.getElementById('fontFamily');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', (e) => {
            const newFont = e.target.value;
            state.fontFamily = newFont;
            state.frontTextureNeedsUpdate = true;
            state.backTextureNeedsUpdate = true;
            textureCache.invalidateFront();
            textureCache.invalidateBack();
            state.frontTextureCache = null;
            state.backTextureCache = null;
            throttledUpdate();
        });
    }

    document.getElementById('forceFontUpdateBtn')?.addEventListener('click', function() {
        const currentFont = document.getElementById('fontFamily').value;
        state.fontFamily = currentFont;
        state.frontTextureNeedsUpdate = true;
        state.backTextureNeedsUpdate = true;
        state.frontTextureCache = null;
        state.backTextureCache = null;
        textureCache.invalidateFront();
        textureCache.invalidateBack();
        throttledUpdate();
        showToast('✅ Шрифт обновлен: ' + currentFont, 'success');
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ РАЗМЕРОВ ШРИФТА
// ============================================================

export function initFontSizeHandlers() {
    const nameFontSizeRange = document.getElementById('nameFontSize');
    if (nameFontSizeRange) {
        nameFontSizeRange.addEventListener('input', (e) => {
            state.nameFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('nameFontSizeVal');
            if (valDisplay) valDisplay.textContent = state.nameFontSize;
            markTexturesDirty();
        });
    }

    const datesFontSizeRange = document.getElementById('datesFontSize');
    if (datesFontSizeRange) {
        datesFontSizeRange.addEventListener('input', (e) => {
            state.datesFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('datesFontSizeVal');
            if (valDisplay) valDisplay.textContent = state.datesFontSize;
            markTexturesDirty();
        });
    }

    const epitaphFontSizeRange = document.getElementById('epitaphFontSize');
    if (epitaphFontSizeRange) {
        epitaphFontSizeRange.addEventListener('input', (e) => {
            state.epitaphFontSize = parseInt(e.target.value);
            const valDisplay = document.getElementById('epitaphFontSizeVal');
            if (valDisplay) valDisplay.textContent = state.epitaphFontSize;
            markTexturesDirty();
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
        state.graveWidth = Math.max(0.3, snapped);
        document.getElementById('graveWidthVal').textContent = state.graveWidth.toFixed(2) + ' м';
        resetTileManager();
        throttledUpdate();
    });

    document.getElementById('graveLength')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        state.graveLength = Math.max(0.3, snapped);
        document.getElementById('graveLengthVal').textContent = state.graveLength.toFixed(2) + ' м';
        resetTileManager();
        throttledUpdate();
    });

    document.getElementById('baseHeight')?.addEventListener('input', (e) => {
        state.baseHeight = parseFloat(e.target.value);
        document.getElementById('baseHeightVal').textContent = state.baseHeight.toFixed(2) + ' м';
        throttledUpdate();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ЦВЕТНИКА
// ============================================================

export function initFlowerbedHandlers() {
    document.getElementById('flowerEnabled')?.addEventListener('change', (e) => {
        state.flowerEnabled = e.target.checked;
        const flowerControls = document.getElementById('flowerControls');
        if (flowerControls) {
            flowerControls.style.display = state.flowerEnabled ? 'block' : 'none';
        }
        resetTileManager();
        throttledUpdate();
    });

    document.getElementById('flowerWidth')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        state.flowerWidth = Math.max(0.3, snapped);
        document.getElementById('flowerWidthVal').textContent = state.flowerWidth.toFixed(2) + ' м';
        resetTileManager();
        throttledUpdate();
        updateLayoutPreview();
    });

    document.getElementById('flowerLength')?.addEventListener('input', (e) => {
        const raw = parseFloat(e.target.value);
        const snapped = snapToTile(raw);
        state.flowerLength = Math.max(0.3, snapped);
        document.getElementById('flowerLengthVal').textContent = state.flowerLength.toFixed(2) + ' м';
        resetTileManager();
        throttledUpdate();
        updateLayoutPreview();
    });

    document.getElementById('flowerbedType')?.addEventListener('change', (e) => {
        state.flowerbedType = e.target.value;
        const isTile = e.target.value.startsWith('tile_');
        const tileSettings = document.getElementById('tileSettings');
        if (tileSettings) {
            tileSettings.style.display = isTile ? 'block' : 'none';
        }
        throttledUpdate();
    });

    document.getElementById('flowerColor')?.addEventListener('input', (e) => {
        state.flowerColor = e.target.value;
        throttledUpdate();
    });

    document.querySelectorAll('.flower-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.getElementById('flowerColor').value = color;
            state.flowerColor = color;
            throttledUpdate();
        });
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ДОРОЖКИ
// ============================================================

export function initPathHandlers() {
    document.getElementById('pathWidth')?.addEventListener('input', (e) => {
        state.pathWidth = parseFloat(e.target.value);
        document.getElementById('pathWidthVal').textContent = state.pathWidth.toFixed(2) + ' м';
        throttledUpdate();
    });

    document.getElementById('pathMaterial')?.addEventListener('change', (e) => {
        state.pathMaterial = e.target.value;
        throttledUpdate();
    });

    document.getElementById('pathTileSize')?.addEventListener('input', (e) => {
        state.pathTileSize = parseFloat(e.target.value);
        document.getElementById('pathTileSizeVal').textContent = state.pathTileSize.toFixed(2) + ' м';
        throttledUpdate();
    });

    document.getElementById('pathJointColor')?.addEventListener('input', (e) => {
        state.pathJointColor = e.target.value;
        throttledUpdate();
    });

    document.getElementById('pathTileLayout')?.addEventListener('change', (e) => {
        state.pathTileLayout = e.target.value;
        throttledUpdate();
    });
}

// ============================================================
// ⭐ ОБРАБОТЧИКИ ДЛЯ ОГРАДКИ (ТИП, МАТЕРИАЛ, ВЫСОТА, ВХОД)
// ============================================================

export function initFenceOptionsHandlers() {
    const fenceTypeSelect = document.getElementById('fenceType');
    if (fenceTypeSelect) {
        fenceTypeSelect.addEventListener('change', (e) => {
            state.fenceType = e.target.value;
            throttledUpdate();
        });
    }

    const fenceMaterialSelect = document.getElementById('fenceMaterial');
    if (fenceMaterialSelect) {
        fenceMaterialSelect.addEventListener('change', (e) => {
            state.fenceMaterial = e.target.value;
            updateFence3DMaterials();
            throttledUpdate();
        });
    }

    const fenceHeightRange = document.getElementById('fenceHeight');
    if (fenceHeightRange) {
        fenceHeightRange.addEventListener('input', (e) => {
            state.fenceHeight = parseFloat(e.target.value);
            document.getElementById('fenceHeightVal').textContent = state.fenceHeight.toFixed(1) + ' м';
            throttledUpdate();
        });
    }

    const fenceGateSideSelect = document.getElementById('fenceGateSide');
    if (fenceGateSideSelect) {
        fenceGateSideSelect.addEventListener('change', (e) => {
            state.fenceGateSide = e.target.value;
            throttledUpdate();
        });
    }

    const gateWidthRange = document.getElementById('gateWidth');
    if (gateWidthRange) {
        gateWidthRange.addEventListener('input', (e) => {
            state.gateWidth = parseFloat(e.target.value);
            document.getElementById('gateWidthVal').textContent = state.gateWidth.toFixed(1) + ' м';
            throttledUpdate();
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
    
    if (target === 'duplicator') {
        if (window.multiMonumentManager) {
            const index = window.multiMonumentManager.activeIndex;
            if (index >= 0 && window.multiMonumentManager.monuments[index]) {
                const mon = window.multiMonumentManager.monuments[index];
                const step = 0.02;
                mon.data.textOffsetX = (mon.data.textOffsetX || 0) + dx * step;
                mon.data.textOffsetY = (mon.data.textOffsetY || 0) + dy * step;
                window.multiMonumentManager._duplicatorDataCache[index] = { ...mon.data };
                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        const step = 0.02;
        state.textOffsetX = (state.textOffsetX || 0) + dx * step;
        state.textOffsetY = (state.textOffsetY || 0) + dy * step;
        if (typeof window.throttledUpdate === 'function') {
            window.throttledUpdate();
        }
    }
}

// ⭐ ДЛЯ ЭПИТАФИИ
function moveEpitaph(dx, dy) {
    const target = getTextTarget();
    
    if (target === 'duplicator') {
        if (window.multiMonumentManager) {
            const index = window.multiMonumentManager.activeIndex;
            if (index >= 0 && window.multiMonumentManager.monuments[index]) {
                const mon = window.multiMonumentManager.monuments[index];
                const step = 0.02;
                mon.data.epitaphOffsetX = (mon.data.epitaphOffsetX || 0) + dx * step;
                mon.data.epitaphOffsetY = (mon.data.epitaphOffsetY || 0) + dy * step;
                window.multiMonumentManager._duplicatorDataCache[index] = { ...mon.data };
                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        const step = 0.02;
        state.epitaphOffsetX = (state.epitaphOffsetX || 0) + dx * step;
        state.epitaphOffsetY = (state.epitaphOffsetY || 0) + dy * step;
        if (typeof window.throttledUpdate === 'function') {
            window.throttledUpdate();
        }
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
                mon.data.textOffsetX = 0;
                mon.data.textOffsetY = 0;
                window.multiMonumentManager._duplicatorDataCache[index] = { ...mon.data };
                window.multiMonumentManager.rebuildSimpleMonument(index);
            }
        }
    } else {
        state.textOffsetX = 0;
        state.textOffsetY = 0;
        if (typeof window.throttledUpdate === 'function') {
            window.throttledUpdate();
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
        state.epitaphOffsetX = 0;
        state.epitaphOffsetY = 0;
        if (typeof window.throttledUpdate === 'function') {
            window.throttledUpdate();
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
    if (xVal) xVal.textContent = state.textOffsetX.toFixed(2);
    if (yVal) yVal.textContent = state.textOffsetY.toFixed(2);
}

function updateEpitaphOffsetDisplay() {
    const xVal = document.getElementById('epitaphOffsetXVal');
    const yVal = document.getElementById('epitaphOffsetYVal');
    if (xVal) xVal.textContent = state.epitaphOffsetX.toFixed(2);
    if (yVal) yVal.textContent = state.epitaphOffsetY.toFixed(2);
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