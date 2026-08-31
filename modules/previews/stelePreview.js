// modules/stelePreview.js

// ⭐ ФУНКЦИЯ ЗАГРУЗКИ ПРЕВЬЮ ИЗ ФАЙЛА
export async function getPreviewUrl(modelId) {
    // Если картинка уже загружена в кэш браузера — вернём
    const cacheKey = `preview_${modelId}`;
    if (sessionStorage.getItem(cacheKey)) {
        return sessionStorage.getItem(cacheKey);
    }

    // Путь к картинке: ./models/previews/ID.png
    const previewPath = `./models/previews/${modelId}.png`;
    
    try {
        const response = await fetch(previewPath);
        if (response.ok) {
            // Если файл есть — возвращаем путь
            sessionStorage.setItem(cacheKey, previewPath);
            return previewPath;
        }
    } catch (e) {
        // Если нет — просто вернём null
    }
    
    return null;
}

// ⭐ КАРТОЧКИ (плитки) — рендерит сетку 3 на 3
export async function renderSteleGrid() {
    const container = document.getElementById('steleOptionsGrid');
    if (!container) {
        console.warn('⚠️ Контейнер #steleOptionsGrid не найден');
        return;
    }

    const loader = window.customSteleLoader;
    if (!loader) {
        console.warn('⚠️ customSteleLoader не готов');
        return;
    }

    const models = loader.getModelList?.() || [];
    if (models.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">Нет моделей</div>`;
        return;
    }

    models.sort((a, b) => a.name.localeCompare(b.name));

    let html = '';
    let firstId = null;

    for (const model of models) {
        if (!firstId) firstId = model.id;
        
        // Пытаемся загрузить статичную превьюшку
        const previewUrl = await getPreviewUrl(model.id);
        
        html += `
            <div class="stele-grid-item" data-model="${model.id}" data-model-id="${model.id}" data-name="${model.name}">
                <div class="stele-grid-preview">
                    ${previewUrl 
                        ? `<img src="${previewUrl}" alt="${model.name}" loading="lazy" draggable="false">` 
                        : `<div class="stele-placeholder">📦</div>`
                    }
                </div>
                <div class="stele-grid-name">${model.name}</div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Выбираем первую модель по умолчанию
    if (firstId) {
        selectSteleModelGrid(firstId);
    }

    // ⭐ ПРИВЯЗЫВАЕМ СОБЫТИЯ
    bindSteleGridEvents();
    
    console.log(`✅ Сетка стел рендерена (${models.length} моделей)`);
}

// ⭐ ПРИВЯЗКА СОБЫТИЙ К ЭЛЕМЕНТАМ СЕТКИ
export function bindSteleGridEvents() {
    const container = document.getElementById('steleOptionsGrid');
    if (!container) return;
    
    const gridItems = container.querySelectorAll('.stele-grid-item');
    gridItems.forEach(item => {
        // Удаляем старые обработчики
        item.removeEventListener('click', item._clickHandler);
        
        // Создаем новый обработчик
        item._clickHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const modelId = this.dataset.model || this.dataset.modelId;
            if (modelId) {
                selectSteleModelGrid(modelId);
            }
        };
        
        item.addEventListener('click', item._clickHandler);
        
        // Добавляем стиль при наведении
        item.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected') && !this.classList.contains('active')) {
                this.style.border = '2px solid rgba(0,168,150,0.3)';
                this.style.transform = 'scale(1.02)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected') && !this.classList.contains('active')) {
                this.style.border = '2px solid transparent';
                this.style.transform = 'scale(1)';
            }
        });
    });
    
    console.log('✅ События сетки стел привязаны');
}

// ⭐ ОБНОВЛЕНИЕ ВЫБОРА В СЕТКЕ
export function updateSteleGridSelection(modelId) {
    const container = document.getElementById('steleOptionsGrid');
    if (!container) return;
    
    container.querySelectorAll('.stele-grid-item').forEach(item => {
        const isActive = (item.dataset.model === modelId || item.dataset.modelId === modelId);
        item.classList.toggle('selected', isActive);
        item.classList.toggle('active', isActive);
        
        if (isActive) {
            item.style.border = '2px solid #00a896';
            item.style.boxShadow = '0 0 20px rgba(0,168,150,0.3)';
            item.style.transform = 'scale(1.02)';
        } else {
            item.style.border = '2px solid transparent';
            item.style.boxShadow = 'none';
            item.style.transform = 'scale(1)';
        }
    });
    
    // Обновляем select
    const steleSelect = document.getElementById('steleTypeSelect');
    if (steleSelect) {
        // Ищем опцию с таким значением
        const option = steleSelect.querySelector(`option[value="${modelId}"]`);
        if (option) {
            steleSelect.value = modelId;
        } else {
            // Ищем по data-model
            const options = steleSelect.querySelectorAll('option');
            for (const opt of options) {
                if (opt.dataset.model === modelId) {
                    steleSelect.value = opt.value;
                    break;
                }
            }
        }
    }
    
    console.log('🔄 Сетка обновлена, выбрана модель:', modelId);
}

export function selectSteleModelGrid(modelId) {
    if (!modelId) {
        console.warn('⚠️ selectSteleModelGrid: modelId не указан');
        return;
    }
    
    console.log(`✅ Выбрана модель из сетки: ${modelId}`);
    
    // 1. ОБНОВЛЯЕМ ВИЗУАЛЬНОЕ ВЫДЕЛЕНИЕ
    updateSteleGridSelection(modelId);
    
    // 2. ОБНОВЛЯЕМ SELECT
    const steleSelect = document.getElementById('steleTypeSelect');
    if (steleSelect) {
        const option = steleSelect.querySelector(`option[value="${modelId}"]`);
        if (option) {
            steleSelect.value = modelId;
            const event = new Event('change', { bubbles: true });
            steleSelect.dispatchEvent(event);
        }
    }
    
    // 3. ОБНОВЛЯЕМ window.state
    if (window.state) {
        window.state.steleModel = modelId;
        window.state.steleType = modelId;
        console.log('📐 window.state обновлен:', modelId);
    }
    
    // 4. ЕСЛИ МЫ В РЕЖИМЕ ДУБЛЕРА - СОХРАНЯЕМ В PENDING
    const manager = window.multiMonumentManager;
    if (manager && manager.currentMode === 'duplicator' && manager.activeIndex >= 0) {
        const uiData = manager.collectUIData ? manager.collectUIData() : {};
        uiData.steleModel = modelId;
        uiData.steleType = modelId;
        
        manager.pendingChanges = uiData;
        manager.pendingIndex = manager.activeIndex;
        manager.renderMonumentList();
        
        if (manager.monuments[manager.activeIndex]) {
            const mon = manager.monuments[manager.activeIndex];
            mon.data.steleModel = modelId;
            mon.data.steleType = modelId;
            manager._duplicatorDataCache[manager.activeIndex] = { ...mon.data };
        }
        
        // Отправляем событие
        document.dispatchEvent(new CustomEvent('steleModelSelected', {
            detail: { modelId, isDuplicator: true }
        }));
        
        return;
    }
    
    // ⭐ 5. РЕЖИМ ОСНОВНОГО - ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ
    if (!window._isDuplicatorMode && !window._disableAutoMonument) {
        if (window.updateScene) {
            console.log('🔄 Обновляем основную сцену с моделью:', modelId);
            
            // ⭐ УСТАНАВЛИВАЕМ ФЛАГИ ДЛЯ ОБХОДА БЛОКИРОВКИ
            window._forceMainUpdate = true;
            window._skipDuplicatorRebuild = true;
            
            setTimeout(() => {
                console.log('🔥 ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ОСНОВНОГО ИЗ СЕТКИ');
                window.updateScene();
                setTimeout(() => {
                    window._forceMainUpdate = false;
                    window._skipDuplicatorRebuild = false;
                    console.log('🔓 Сняты флаги _forceMainUpdate и _skipDuplicatorRebuild');
                }, 500);
            }, 50);
        } else {
            console.error('❌ window.updateScene не найден!');
        }
    } else {
        console.warn('⚠️ Обновление заблокировано');
        console.log('📊 _isDuplicatorMode:', window._isDuplicatorMode);
        console.log('📊 _disableAutoMonument:', window._disableAutoMonument);
    }
    
    // Отправляем событие
    document.dispatchEvent(new CustomEvent('steleModelSelected', {
        detail: { modelId, isDuplicator: false }
    }));
    
    console.log('✅ Модель применена:', modelId);
}


// ⭐ ПОЛУЧИТЬ ТЕКУЩУЮ ВЫБРАННУЮ МОДЕЛЬ
export function getSelectedSteleModel() {
    const activeItem = document.querySelector('.stele-grid-item.selected, .stele-grid-item.active');
    if (activeItem) {
        return activeItem.dataset.model || activeItem.dataset.modelId;
    }
    
    // Или из select
    const steleSelect = document.getElementById('steleTypeSelect');
    if (steleSelect && steleSelect.value) {
        return steleSelect.value;
    }
    
    // Или из state
    if (window.state && window.state.steleType) {
        return window.state.steleType;
    }
    
    return null;
}

// ⭐ УСТАНОВИТЬ МОДЕЛЬ БЕЗ ОБНОВЛЕНИЯ СЦЕНЫ
export function setSteleModelSilent(modelId) {
    if (!modelId) return;
    
    // Обновляем визуальное выделение
    updateSteleGridSelection(modelId);
    
    // Обновляем select
    const steleSelect = document.getElementById('steleTypeSelect');
    if (steleSelect) {
        const option = steleSelect.querySelector(`option[value="${modelId}"]`);
        if (option) {
            steleSelect.value = modelId;
        }
    }
    
    // Обновляем state
    if (window.state) {
        window.state.steleModel = modelId;
        window.state.steleType = modelId;
    }
    
    console.log('🔇 Модель установлена без обновления сцены:', modelId);
}

// ⭐ ИНИЦИАЛИЗАЦИЯ
export function initStelePreview() {
    // Загружаем сетку
    renderSteleGrid();
    
    // Подписываемся на события от дублеров
    document.addEventListener('steleModelSelected', (e) => {
        const modelId = e.detail?.modelId;
        if (modelId && !e.detail?.isDuplicator) {
            // Обновляем выделение при выборе из другого места
            updateSteleGridSelection(modelId);
        }
    });
    
    console.log('✅ stelePreview инициализирован');
}

// ⭐ АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ
// Если скрипт загружен как модуль, инициализируемся
if (typeof document !== 'undefined') {
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initStelePreview, 500);
        });
    } else {
        setTimeout(initStelePreview, 500);
    }
}

// ⭐ ЭКСПОРТ ПО УМОЛЧАНИЮ
export default {
    renderSteleGrid,
    selectSteleModelGrid,
    updateSteleGridSelection,
    getSelectedSteleModel,
    setSteleModelSilent,
    bindSteleGridEvents,
    initStelePreview
};