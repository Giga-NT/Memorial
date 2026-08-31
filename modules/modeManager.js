// modules/modeManager.js

/**
 * ModeManager - управление режимами обновления
 * ⚡ Живой - автоматическое обновление при изменениях
 * 🎯 Ручной - обновление только по кнопке
 */

class ModeManager {
    constructor() {
        this.currentMode = 'auto'; // 'auto' | 'manual'
        this.debounceTimers = {};
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Находим переключатель
        this.selector = document.getElementById('modeSelector');
        if (!this.selector) {
            console.warn('⚠️ ModeSelector не найден');
            return;
        }
        
        // Подписываемся на клики
        this.selector.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-btn');
            if (!btn) return;
            this.setMode(btn.dataset.mode);
        });
        
        // Получаем сохраненный режим
        const savedMode = localStorage.getItem('updateMode') || 'auto';
        this.setMode(savedMode);
        
        console.log(`✅ ModeManager инициализирован, режим: ${this.getModeLabel()}`);
    }
    
    setMode(mode) {
        if (mode !== 'auto' && mode !== 'manual') return;
        
        this.currentMode = mode;
        
        // Обновляем UI
        this.selector.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Сохраняем в localStorage
        localStorage.setItem('updateMode', mode);
        
        // Показываем/скрываем кнопки "Применить"
        this.updateApplyButtons();
        
        console.log(`🔄 Режим обновления: ${this.getModeLabel()}`);
    }
    
    getMode() {
        return this.currentMode;
    }
    
    getModeLabel() {
        return this.currentMode === 'auto' ? '⚡ Живой' : '🎯 Ручной';
    }
    
    isAuto() {
        return this.currentMode === 'auto';
    }
    
    isManual() {
        return this.currentMode === 'manual';
    }
    
    updateApplyButtons() {
        const isManual = this.isManual();
        
        // Показываем/скрываем кнопки "Применить" в списке дублеров
        document.querySelectorAll('.apply-monument-btn').forEach(btn => {
            btn.style.display = isManual ? 'inline-block' : 'none';
        });
        
        // В ручном режиме показываем индикатор
        const indicator = document.querySelector('.mode-indicator');
        if (indicator) {
            indicator.textContent = isManual ? '🎯 Ручной режим' : '⚡ Авто-режим';
            indicator.style.color = isManual ? '#f39c12' : '#00a896';
        }
    }
    
    // ⭐ ОБЕРТКА ДЛЯ ОБРАБОТЧИКОВ
    wrap(handler) {
        if (this.isAuto()) {
            return handler;
        } else {
            // В ручном режиме - сохраняем в pending
            return (...args) => {
                // Сохраняем изменения в pending для дублера
                const manager = window.multiMonumentManager;
                if (manager && manager.currentMode === 'duplicator' && manager.activeIndex >= 0) {
                    const uiData = manager.collectUIData ? manager.collectUIData() : {};
                    manager.pendingChanges = uiData;
                    manager.pendingIndex = manager.activeIndex;
                    manager.renderMonumentList();
                    console.log('📝 Изменения сохранены в pending (ручной режим)');
                }
            };
        }
    }
    
    // ⭐ DEBOUNCE ДЛЯ ТЕКСТОВЫХ ПОЛЕЙ (только в авто-режиме)
    debounce(key, callback, delay = 500) {
        if (this.isManual()) {
            // В ручном режиме - просто сохраняем в pending
            const manager = window.multiMonumentManager;
            if (manager && manager.currentMode === 'duplicator' && manager.activeIndex >= 0) {
                const uiData = manager.collectUIData ? manager.collectUIData() : {};
                manager.pendingChanges = uiData;
                manager.pendingIndex = manager.activeIndex;
                manager.renderMonumentList();
            }
            return;
        }
        
        // В авто-режиме - debounce
        clearTimeout(this.debounceTimers[key]);
        this.debounceTimers[key] = setTimeout(() => {
            callback();
        }, delay);
    }
    
    // ⭐ МГНОВЕННОЕ ОБНОВЛЕНИЕ (для ползунков, чекбоксов)
    immediate(callback) {
        if (this.isAuto()) {
            callback();
        } else {
            // В ручном режиме - только pending
            const manager = window.multiMonumentManager;
            if (manager && manager.currentMode === 'duplicator' && manager.activeIndex >= 0) {
                const uiData = manager.collectUIData ? manager.collectUIData() : {};
                manager.pendingChanges = uiData;
                manager.pendingIndex = manager.activeIndex;
                manager.renderMonumentList();
            }
        }
    }
}

// ⭐ СОЗДАЕМ ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР
const modeManager = new ModeManager();
window.modeManager = modeManager;

// ⭐ ДОБАВЛЯЕМ CSS ДЛЯ ПЕРЕКЛЮЧАТЕЛЯ (если нет в style.css)
const style = document.createElement('style');
style.textContent = `
    .mode-selector {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 3px;
        flex-shrink: 0;
    }
    
    .mode-btn {
        padding: 5px 12px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #888;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .mode-btn:hover {
        color: #ccc;
        background: rgba(255,255,255,0.05);
    }
    
    .mode-btn.active {
        background: #00a896;
        color: #fff;
        box-shadow: 0 2px 8px rgba(0,168,150,0.3);
    }
    
    .mode-btn .mode-icon {
        font-size: 14px;
    }
    
    .mode-indicator {
        font-size: 11px;
        padding: 2px 10px;
        border-radius: 12px;
        background: rgba(0,0,0,0.3);
        margin-left: 8px;
    }
    
    @media (max-width: 600px) {
        .mode-btn {
            font-size: 10px;
            padding: 4px 8px;
        }
        .mode-btn .mode-icon {
            font-size: 12px;
        }
    }
`;
document.head.appendChild(style);

console.log('✅ ModeManager загружен');


// ============================================================
// ⭐ КНОПКИ БЫСТРЫХ ДЕЙСТВИЙ
// ============================================================

function showToast(message, type) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'mobile-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 12px;
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
            opacity: 0;
            background: rgba(0,0,0,0.85);
            color: white;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.05);
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === 'success' ? '#00a896' : '#333';
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2500);
}


// ============================================================
// ⭐ ПРИМЕНИТЬ ТЕКУЩИЙ ДУБЛЕР К ОСНОВНОМУ
// ============================================================

document.getElementById('applyMainBtn')?.addEventListener('click', function () {

    console.log('🪦 === ПРИМЕНИТЬ ДУБЛЕР К ОСНОВНОМУ ===');

    const manager = window.multiMonumentManager;

    if (!manager) {
        console.error('❌ MultiMonumentManager не найден');
        showToast('❌ Менеджер не найден', 'error');
        return;
    }

    // --------------------------------------------------------
    // 1. Проверяем, что сейчас выбран дублер
    // --------------------------------------------------------

    if (
        manager.currentMode !== 'duplicator' ||
        manager.activeIndex < 1
    ) {
        console.error(
            '❌ Дублер не выбран',
            {
                currentMode: manager.currentMode,
                activeIndex: manager.activeIndex,
                monuments: manager.monuments?.length
            }
        );

        showToast('❌ Сначала выберите дублер', 'error');
        return;
    }

    const duplicateIndex = manager.activeIndex;

    const duplicate = manager.monuments?.[duplicateIndex];

    if (!duplicate || !duplicate.data) {
        console.error(
            '❌ Данные дублера не найдены',
            duplicateIndex
        );

        showToast('❌ Данные дублера не найдены', 'error');
        return;
    }

    // --------------------------------------------------------
    // 2. Берём ДАННЫЕ ДУБЛЕРА
    // --------------------------------------------------------

    const source = duplicate.data;

    console.log(
        '📋 ИСТОЧНИК — ДУБЛЕР:',
        {
            index: duplicateIndex,
            steleType: source.steleType,
            steleModel: source.steleModel,
            fullName: source.fullName,
            dates: source.dates
        }
    );

    // --------------------------------------------------------
    // 3. Глубокая копия
    // --------------------------------------------------------

    const mainData = structuredClone(source);

    // --------------------------------------------------------
    // 4. Записываем данные в ОСНОВНОЙ памятник
    // --------------------------------------------------------

    if (!manager.monuments[0]) {
        manager.monuments[0] = {
            id: 0,
            data: {}
        };
    }

    manager.monuments[0].data = {
        ...manager.monuments[0].data,
        ...mainData
    };

    // --------------------------------------------------------
    // 5. Синхронизируем window.state
    // --------------------------------------------------------

    window.state = {
        ...window.state,
        ...structuredClone(mainData)
    };

    console.log(
        '💾 ОСНОВНОЙ STATE ПОСЛЕ КОПИРОВАНИЯ:',
        {
            steleType: window.state.steleType,
            steleModel: window.state.steleModel,
            fullName: window.state.fullName,
            dates: window.state.dates
        }
    );

    // --------------------------------------------------------
    // 6. ВАЖНО:
    // временно переключаемся в main
    // --------------------------------------------------------

    const oldMode = manager.currentMode;
    const oldIndex = manager.activeIndex;

    manager.currentMode = 'main';
    manager.activeIndex = 0;

    // --------------------------------------------------------
    // 7. Перестраиваем ОСНОВНОЙ памятник
    // --------------------------------------------------------

    try {

        if (typeof window.updateMainMonument === 'function') {

            console.log(
                '🔥 Используем updateMainMonument()'
            );

            window.updateMainMonument();

        } else if (typeof window.updateSceneReal === 'function') {

            console.log(
                '🔥 Используем updateSceneReal()'
            );

            window.updateSceneReal();

        } else if (typeof window.updateScene === 'function') {

            console.log(
                '🔥 Используем updateScene()'
            );

            window.updateScene();

        } else {

            console.error(
                '❌ Функция обновления основной сцены не найдена'
            );

            throw new Error(
                'updateMainMonument/updateSceneReal/updateScene отсутствуют'
            );
        }

    } catch (error) {

        console.error(
            '❌ Ошибка обновления основного:',
            error
        );

        showToast(
            '❌ Ошибка обновления основного памятника',
            'error'
        );

        return;

    } finally {

        // ----------------------------------------------------
        // 8. Возвращаем выбранный дублер
        // ----------------------------------------------------

        manager.currentMode = oldMode;
        manager.activeIndex = oldIndex;
    }

    // --------------------------------------------------------
    // 9. Обновляем список
    // --------------------------------------------------------

    if (typeof manager.renderMonumentList === 'function') {
        manager.renderMonumentList();
    }

    console.log(
        '✅ === ДУБЛЕР УСПЕШНО ПРИМЕНЁН К ОСНОВНОМУ ==='
    );

    console.log(
        '🪦 НОВЫЙ ОСНОВНОЙ:',
        manager.monuments[0].data
    );

    showToast(
        '✅ Дублер применён к основному памятнику',
        'success'
    );
});


// ⭐ КНОПКА "ПРИМЕНИТЬ К ДУБЛЕРУ"
document.getElementById('applyDuplicatorBtn')?.addEventListener('click', function() {
    console.log('📋 Применить к дублеру');
    
    const manager = window.multiMonumentManager;
    if (!manager) {
        showToast('❌ Менеджер не найден', 'error');
        return;
    }
    
    if (manager.currentMode !== 'duplicator' || manager.activeIndex < 0) {
        showToast('❌ Сначала выберите дублер', 'error');
        return;
    }
    
    const index = manager.activeIndex;
    const uiData = manager.collectUIData ? manager.collectUIData() : {};
    
    // ⭐ СОХРАНЯЕМ ПОЗИЦИЮ ФОТО ИЗ ДАННЫХ ДУБЛЕРА
    const mon = manager.monuments[index];
    if (mon && mon.data) {
        // Сохраняем текущую позицию фото
        uiData.photoOffsetX = mon.data.photoOffsetX || 0;
        uiData.photoOffsetY = mon.data.photoOffsetY || 0;
    }
    
    manager.pendingChanges = uiData;
    manager.pendingIndex = index;
    
    manager.applyPendingChanges(index);
    manager.renderMonumentList();
    
    showToast(`✅ Дублер #${index + 1} обновлен`, 'success');
});




// ⭐ КНОПКА "СБРОС ВИДА"
document.getElementById('resetViewBtn')?.addEventListener('click', function() {
    // ⭐ ИСПОЛЬЗУЕМ controls.object
    if (window.controls) {
        window.controls.target.set(0, 0.5, 0);
        if (window.controls.object) {
            window.controls.object.position.set(2.5, 2, 3.5);
        } else if (window.camera) {
            window.camera.position.set(2.5, 2, 3.5);
        }
        window.controls.update();
        showToast('🔄 Вид сброшен', 'success');
    } else {
        console.warn('⚠️ controls не найдены');
        showToast('⚠️ Не удалось сбросить вид', 'error');
    }
});

// ⭐ ВКЛЮЧЕНИЕ/ОТКЛЮЧЕНИЕ ПЕРЕТАСКИВАНИЯ ФОТО
document.getElementById('enableMovePhoto')?.addEventListener('change', function(e) {
    const isEnabled = e.target.checked;
    const canvas = document.querySelector('#canvas-container canvas');
    if (canvas) {
        canvas.style.cursor = isEnabled ? 'grab' : 'default';
    }
    
    // Включаем/отключаем OrbitControls
    if (window.controls) {
        window.controls.enabled = !isEnabled;
    }
    
    // Показываем подсказку
    if (isEnabled) {
        showToast('✋ Режим перемещения фото включен. Перетащите фото на стеле.', 'info');
    } else {
        showToast('🔒 Режим перемещения фото выключен', 'info');
    }
});

// ⭐ ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК
function updateQuickButtons() {
    const mainBtn = document.getElementById('applyMainBtn');
    const dupBtn = document.getElementById('applyDuplicatorBtn');
    const manager = window.multiMonumentManager;
    
    if (mainBtn) {
        mainBtn.style.opacity = '1';
        mainBtn.style.cursor = 'pointer';
    }
    
    if (dupBtn) {
        if (manager && manager.currentMode === 'duplicator' && manager.activeIndex >= 0) {
            dupBtn.style.opacity = '1';
            dupBtn.style.cursor = 'pointer';
            // Обновляем текст и бейдж
            const badge = dupBtn.querySelector('.badge');
            if (!badge) {
                const b = document.createElement('span');
                b.className = 'badge';
                b.textContent = manager.activeIndex + 1;
                dupBtn.appendChild(b);
            } else {
                badge.textContent = manager.activeIndex + 1;
            }
        } else {
            dupBtn.style.opacity = '0.4';
            dupBtn.style.cursor = 'not-allowed';
            const badge = dupBtn.querySelector('.badge');
            if (badge) badge.remove();
        }
    }
}

// Подписываемся на события изменения
document.addEventListener('monumentSelected', updateQuickButtons);
document.addEventListener('monumentApplied', updateQuickButtons);

// Вызываем при загрузке
setTimeout(updateQuickButtons, 1000);

console.log('✅ Панель быстрых действий инициализирована');