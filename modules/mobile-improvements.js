// modules/mobile-improvements.js
// ============================================================
// МОБИЛЬНЫЕ УЛУЧШЕНИЯ - ВЕРСИЯ 3.3
// ============================================================

export class MobileImprovements {
    constructor(options = {}) {
        this.options = {
            enableZoomReset: true,
            enableDragText: true,
            enableDragEpitaph: true,
            ...options
        };
        
        this.state = null;
        this.controls = null;
        this.renderer = null;
        this.monumentGroup = null;
        this.decalsGroup = null;
        
        this.isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isMobile = this.isIPhone || this.isAndroid || 
                        window.innerWidth < 768 || 
                        ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0);
        
        this.dragState = {
            active: false,
            type: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
            isDragging: false,
            dragStartTime: 0,
            lastUpdateTime: 0
        };
        
        this.dragIndicator = null;
        this.isInitialized = false;
        this.updateThrottle = 50;
        
        this.init();
    }

    // ============================================================
    // ⭐ ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        console.log(`📱 Мобильные улучшения: ${this.isMobile ? 'ВКЛ' : 'ВЫКЛ'}`);
        
        if (!this.isMobile) return;
        
        this.state = window.state;
        this.controls = window.controls;
        this.renderer = window.renderer;
        this.monumentGroup = window.monumentGroup;
        this.decalsGroup = window.decalsGroup;
        
        if (!this.state || !this.controls || !this.renderer) {
            console.warn('⚠️ Глобальные объекты не найдены, повторная попытка...');
            setTimeout(() => {
                this.state = window.state;
                this.controls = window.controls;
                this.renderer = window.renderer;
                this.monumentGroup = window.monumentGroup;
                this.decalsGroup = window.decalsGroup;
                
                if (this.state && this.controls && this.renderer) {
                    console.log('✅ Объекты найдены, инициализация...');
                    this.initFeatures();
                }
            }, 1000);
            return;
        }
        
        this.initFeatures();
    }

    initFeatures() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        console.log('✅ Мобильные улучшения инициализированы');
        
        this.createDragIndicator();
        
        if (this.options.enableZoomReset) {
            this.initZoomReset();
        }
        
        if (this.options.enableDragText || this.options.enableDragEpitaph) {
            this.initTextDrag();
        }
        
        this.initButtonFix();
        this.initScrollFix();
        this.addCenterButtons();
        this.addDragHints();
    }

    // ============================================================
    // ⭐ ВИЗУАЛЬНЫЙ ИНДИКАТОР
    // ============================================================
    
    createDragIndicator() {
        if (this.dragIndicator) {
            this.dragIndicator.remove();
        }
        
        this.dragIndicator = document.createElement('div');
        this.dragIndicator.id = 'drag-indicator';
        this.dragIndicator.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            color: white;
            padding: 12px 24px;
            border-radius: 16px;
            z-index: 9999;
            font-size: 15px;
            font-weight: 600;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            pointer-events: none;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 90%;
            text-align: center;
        `;
        
        const icon = document.createElement('span');
        icon.id = 'drag-indicator-icon';
        icon.textContent = '✋';
        icon.style.cssText = 'margin-right: 10px; font-size: 20px;';
        
        const text = document.createElement('span');
        text.id = 'drag-indicator-text';
        text.textContent = 'Перетащите текст';
        
        this.dragIndicator.appendChild(icon);
        this.dragIndicator.appendChild(text);
        document.body.appendChild(this.dragIndicator);
    }

    showDragIndicator(message, type = 'idle') {
        if (!this.dragIndicator) return;
        
        const icon = document.getElementById('drag-indicator-icon');
        const text = document.getElementById('drag-indicator-text');
        
        if (icon) {
            if (type === 'active') icon.textContent = '👆';
            else if (type === 'dragging') icon.textContent = '✋';
            else icon.textContent = '✋';
        }
        
        if (text) text.textContent = message;
        
        this.dragIndicator.style.opacity = '1';
        this.dragIndicator.style.transform = 'translateX(-50%) translateY(0)';
        
        if (type === 'active') {
            this.dragIndicator.style.background = 'rgba(0, 168, 150, 0.9)';
            this.dragIndicator.style.borderColor = 'rgba(0, 255, 200, 0.3)';
        } else if (type === 'dragging') {
            this.dragIndicator.style.background = 'rgba(231, 76, 60, 0.9)';
            this.dragIndicator.style.borderColor = 'rgba(255, 100, 100, 0.3)';
        } else {
            this.dragIndicator.style.background = 'rgba(0, 0, 0, 0.85)';
            this.dragIndicator.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }
    }

    hideDragIndicator() {
        if (!this.dragIndicator) return;
        this.dragIndicator.style.opacity = '0';
        this.dragIndicator.style.transform = 'translateX(-50%) translateY(20px)';
    }

    // ============================================================
    // ⭐ ПОДСКАЗКИ
    // ============================================================
    
    addDragHints() {
        const canvas = this.renderer?.domElement;
        if (!canvas) return;
        
        const hintOverlay = document.createElement('div');
        hintOverlay.id = 'drag-hint-overlay';
        hintOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 50;
            display: none;
        `;
        
        const topZone = document.createElement('div');
        topZone.style.cssText = `
            position: absolute;
            top: 20%;
            left: 10%;
            right: 10%;
            height: 30%;
            border: 2px dashed rgba(0, 168, 150, 0.3);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
            background: rgba(0, 168, 150, 0.05);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        topZone.textContent = '👆 Перетащите ФИО и даты';
        
        const bottomZone = document.createElement('div');
        bottomZone.style.cssText = `
            position: absolute;
            bottom: 20%;
            left: 10%;
            right: 10%;
            height: 25%;
            border: 2px dashed rgba(231, 76, 60, 0.3);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
            background: rgba(231, 76, 60, 0.05);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        bottomZone.textContent = '👆 Перетащите эпитафию';
        
        hintOverlay.appendChild(topZone);
        hintOverlay.appendChild(bottomZone);
        document.body.appendChild(hintOverlay);
        
        this.updateHintsVisibility();
        
        document.addEventListener('change', (e) => {
            if (e.target.id === 'enableDragText' || e.target.id === 'enableDragEpitaph') {
                this.updateHintsVisibility();
            }
        });
    }

    updateHintsVisibility() {
        const overlay = document.getElementById('drag-hint-overlay');
        if (!overlay) return;
        
        const textCheck = document.getElementById('enableDragText');
        const epitaphCheck = document.getElementById('enableDragEpitaph');
        
        const isTextActive = textCheck && textCheck.checked;
        const isEpitaphActive = epitaphCheck && epitaphCheck.checked;
        
        if (isTextActive || isEpitaphActive) {
            overlay.style.display = 'block';
            const zones = overlay.children;
            if (zones.length >= 2) {
                zones[0].style.display = isTextActive ? 'flex' : 'none';
                zones[1].style.display = isEpitaphActive ? 'flex' : 'none';
            }
            clearTimeout(this._hintTimeout);
            this._hintTimeout = setTimeout(() => {
                overlay.style.display = 'none';
            }, 5000);
        } else {
            overlay.style.display = 'none';
        }
    }

    // ============================================================
    // ⭐ СБРОС ЗУМА
    // ============================================================
    
    initZoomReset() {
        if (!this.isIPhone) return;
        
        let scrollPosition = 0;
        let activeInput = null;
        
        const resetZoom = () => {
            document.body.style.transform = 'scale(1)';
            document.body.style.transformOrigin = 'top left';
            document.body.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            const viewport = document.querySelector('meta[name=viewport]');
            if (viewport) {
                viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no';
            }
            
            window.scrollTo(0, scrollPosition);
            setTimeout(() => { document.body.style.transition = ''; }, 300);
        };
        
        document.querySelectorAll('input, textarea, select').forEach((el) => {
            el.addEventListener('focus', function() {
                activeInput = this;
                scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            });
            el.addEventListener('blur', function() {
                setTimeout(resetZoom, 200);
                activeInput = null;
            });
            el.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && this.tagName === 'INPUT') {
                    this.blur();
                    setTimeout(resetZoom, 100);
                }
            });
        });
        
        document.addEventListener('click', function(event) {
            const target = event.target;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
            if (!isInput && activeInput) {
                activeInput.blur();
                setTimeout(resetZoom, 100);
            }
        }, true);
        
        document.addEventListener('touchend', function() {
            if (activeInput) {
                setTimeout(() => {
                    if (!document.activeElement || 
                        (document.activeElement.tagName !== 'INPUT' && 
                         document.activeElement.tagName !== 'TEXTAREA')) {
                        resetZoom();
                        activeInput = null;
                    }
                }, 300);
            }
        }, { passive: true });
        
        window.addEventListener('orientationchange', function() {
            setTimeout(resetZoom, 500);
        });
        
        window.addEventListener('resize', function() {
            if (window.visualViewport && window.visualViewport.scale > 1) {
                setTimeout(resetZoom, 200);
            }
        });
    }

    // ============================================================
    // ⭐ DRAG-AND-DROP
    // ============================================================
    
    initTextDrag() {
        console.log('✋ Drag-and-Drop для текста активирован');
        
        setTimeout(() => {
            this.addDragControls();
        }, 300);
        
        this.bindDragEvents();
    }

    addDragControls() {
        // Чекбокс для ФИО
        let textSection = this.findSectionByText('ФИО (используйте / для переноса)') ||
                          this.findSectionByText('fullName') ||
                          this.findSectionByText('Лицевая сторона');
        
        if (textSection && !textSection.querySelector('#enableDragText')) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                margin-top: 12px;
                padding: 14px 16px;
                background: linear-gradient(135deg, rgba(0,168,150,0.15), rgba(0,168,150,0.05));
                border: 2px solid rgba(0,168,150,0.25);
                border-radius: 12px;
            `;
            wrapper.innerHTML = `
                <label style="display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;font-size:15px;font-weight:500;color:#fff;">
                    <input type="checkbox" id="enableDragText" style="width:26px;height:26px;min-width:26px;accent-color:#00a896;cursor:pointer;">
                    <span>✋ <span style="color:#00a896;">Перетаскивать</span> ФИО и даты</span>
                    <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.3);background:rgba(0,0,0,0.3);padding:2px 10px;border-radius:20px;">👆 тапни и тяни</span>
                </label>
            `;
            textSection.appendChild(wrapper);
            console.log('✅ Чекбокс для ФИО добавлен');
        }
        
        // Чекбокс для эпитафии
        let epitaphSection = this.findSectionByText('Текст эпитафии') ||
                            this.findSectionByText('epitaphText') ||
                            this.findSectionByText('Задняя сторона');
        
        if (epitaphSection && !epitaphSection.querySelector('#enableDragEpitaph')) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                margin-top: 12px;
                padding: 14px 16px;
                background: linear-gradient(135deg, rgba(231,76,60,0.15), rgba(231,76,60,0.05));
                border: 2px solid rgba(231,76,60,0.25);
                border-radius: 12px;
            `;
            wrapper.innerHTML = `
                <label style="display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;font-size:15px;font-weight:500;color:#fff;">
                    <input type="checkbox" id="enableDragEpitaph" style="width:26px;height:26px;min-width:26px;accent-color:#e74c3c;cursor:pointer;">
                    <span>✋ <span style="color:#e74c3c;">Перетаскивать</span> эпитафию</span>
                    <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.3);background:rgba(0,0,0,0.3);padding:2px 10px;border-radius:20px;">👆 тапни и тяни</span>
                </label>
            `;
            epitaphSection.appendChild(wrapper);
            console.log('✅ Чекбокс для эпитафии добавлен');
        }
    }

    findSectionByText(text) {
        const allElements = document.querySelectorAll('.subsection, .section-content, .control-group, .subsection-title');
        for (const el of allElements) {
            if (el.textContent && el.textContent.includes(text)) {
                let parent = el.closest('.subsection') || el.closest('.section-content') || el;
                return parent;
            }
        }
        return null;
    }

    getEventPosition(event) {
        let clientX, clientY;
        
        if (event.touches) {
            const touch = event.touches[0] || event.changedTouches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: ((clientX - rect.left) / rect.width) * 2 - 1,
            y: -((clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    bindDragEvents() {
        const canvas = this.renderer?.domElement;
        if (!canvas) {
            console.warn('⚠️ Canvas не найден для Drag-and-Drop');
            return;
        }
        
        canvas.addEventListener('mousedown', this.onDragStart.bind(this));
        document.addEventListener('mousemove', this.onDragMove.bind(this));
        document.addEventListener('mouseup', this.onDragEnd.bind(this));
        
        canvas.addEventListener('touchstart', this.onDragStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.onDragMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onDragEnd.bind(this), { passive: true });
        
        console.log('✅ Drag события привязаны');
    }

    onDragStart(event) {
        if (!this.state || !this.controls || !this.renderer) return;
        
        const pos = this.getEventPosition(event);
        if (!pos) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        let clientY = event.clientY;
        if (event.touches && event.touches.length > 0) {
            clientY = event.touches[0].clientY;
        }
        const y = (clientY - rect.top) / rect.height;
        
        let type = null;
        const textCheck = document.getElementById('enableDragText');
        const epitaphCheck = document.getElementById('enableDragEpitaph');
        
        if (y > 0.15 && y < 0.55 && textCheck && textCheck.checked) {
            type = 'text';
        } else if (y > 0.55 && y < 0.9 && epitaphCheck && epitaphCheck.checked) {
            type = 'epitaph';
        }
        
        if (!type) {
            if (y > 0.15 && y < 0.55) {
                this.showDragIndicator('✋ Включите "Перетаскивать" в меню', 'idle');
                setTimeout(() => this.hideDragIndicator(), 1500);
            }
            return;
        }
        
        this.dragState.active = true;
        this.dragState.type = type;
        this.dragState.startX = pos.x;
        this.dragState.startY = pos.y;
        this.dragState.startOffsetX = type === 'text' ? this.state.textOffsetX : this.state.epitaphOffsetX;
        this.dragState.startOffsetY = type === 'text' ? this.state.textOffsetY : this.state.epitaphOffsetY;
        this.dragState.dragStartTime = Date.now();
        
        if (this.controls) {
            this.controls.enabled = false;
        }
        
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        const typeName = type === 'text' ? 'ФИО и даты' : 'эпитафию';
        this.showDragIndicator(`✋ Перетаскиваю ${typeName}...`, 'active');
        
        // Подсветка зон
        const overlay = document.getElementById('drag-hint-overlay');
        if (overlay) {
            const zones = overlay.children;
            if (zones.length >= 2) {
                if (type === 'text') {
                    zones[0].style.borderColor = 'rgba(0, 255, 200, 0.6)';
                    zones[0].style.background = 'rgba(0, 168, 150, 0.15)';
                    zones[1].style.borderColor = 'rgba(231, 76, 60, 0.15)';
                    zones[1].style.background = 'rgba(231, 76, 60, 0.02)';
                } else {
                    zones[1].style.borderColor = 'rgba(255, 100, 100, 0.6)';
                    zones[1].style.background = 'rgba(231, 76, 60, 0.15)';
                    zones[0].style.borderColor = 'rgba(0, 168, 150, 0.15)';
                    zones[0].style.background = 'rgba(0, 168, 150, 0.02)';
                }
            }
        }
        
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
        
        console.log(`✋ Начало перетаскивания ${type}`);
    }

    onDragMove(event) {
        if (!this.dragState.active) return;
        
        if (event.cancelable) {
            event.preventDefault();
        }
        
        const pos = this.getEventPosition(event);
        if (!pos) return;
        
        // ⭐ УВЕЛИЧЕННАЯ ЧУВСТВИТЕЛЬНОСТЬ И ДИАПАЗОН
        const sensitivity = 0.8; // меньше = больше смещение
        const dx = (pos.x - this.dragState.startX) / sensitivity;
        const dy = -(pos.y - this.dragState.startY) / sensitivity;
        
        // ⭐ УВЕЛИЧЕННЫЙ МАКСИМАЛЬНЫЙ ОФСЕТ (было 0.6, стало 1.2)
        const maxOffset = 1.5;
        let newX = Math.max(-maxOffset, Math.min(maxOffset, this.dragState.startOffsetX + dx));
        let newY = Math.max(-maxOffset, Math.min(maxOffset, this.dragState.startOffsetY + dy));
        
        // ⭐ ОБНОВЛЯЕМ СОСТОЯНИЕ
        if (this.dragState.type === 'text') {
            this.state.textOffsetX = newX;
            this.state.textOffsetY = newY;
            this.updateTextOffsetDisplay();
            this.state.frontTextureNeedsUpdate = true;
        } else {
            this.state.epitaphOffsetX = newX;
            this.state.epitaphOffsetY = newY;
            this.updateEpitaphOffsetDisplay();
            this.state.backTextureNeedsUpdate = true;
        }
        
        // ⭐ ФОРСИРУЕМ ОБНОВЛЕНИЕ ДЕКАЛЕЙ (ДЛЯ ВСЕХ ТИПОВ СТЕЛ)
        this.forceDecalUpdate();
        
        const typeName = this.dragState.type === 'text' ? 'ФИО' : 'Эпитафия';
        this.showDragIndicator(
            `✋ ${typeName}: X ${newX.toFixed(2)} Y ${newY.toFixed(2)}`,
            'dragging'
        );
        
        this.throttledUpdate();
    }

    onDragEnd() {
        if (!this.dragState.active) return;
        
        const type = this.dragState.type;
        const duration = Date.now() - this.dragState.dragStartTime;
        
        this.dragState.active = false;
        this.dragState.type = null;
        
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
        
        const typeName = type === 'text' ? 'ФИО' : 'Эпитафия';
        this.showDragIndicator(`✅ ${typeName} перемещён!`, 'idle');
        
        setTimeout(() => {
            this.hideDragIndicator();
        }, 1000);
        
        // Сбрасываем подсветку
        const overlay = document.getElementById('drag-hint-overlay');
        if (overlay) {
            const zones = overlay.children;
            if (zones.length >= 2) {
                zones[0].style.borderColor = 'rgba(0, 168, 150, 0.3)';
                zones[0].style.background = 'rgba(0, 168, 150, 0.05)';
                zones[1].style.borderColor = 'rgba(231, 76, 60, 0.3)';
                zones[1].style.background = 'rgba(231, 76, 60, 0.05)';
            }
        }
        
        // ⭐ ФИНАЛЬНОЕ ФОРСИРОВАННОЕ ОБНОВЛЕНИЕ
        this.forceDecalUpdate();
        this.throttledUpdate();
        
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
        
        console.log(`✋ Перетаскивание ${type} завершено (${duration}ms)`);
    }

    // ============================================================
    // ⭐ ФОРСИРОВАННОЕ ОБНОВЛЕНИЕ ДЕКАЛЕЙ (ДЛЯ ВСЕХ ТИПОВ СТЕЛ)
    // ============================================================
    
    forceDecalUpdate() {
        // Проверяем наличие всех необходимых объектов
        if (!window.monumentGroup || !window.decalsGroup) {
            return;
        }
        
        // ⭐ ОПРЕДЕЛЯЕМ ТИП СТЕЛЫ
        const isCustomStele = this.state.steleType && this.state.steleType.startsWith('custom_stl');
        const isRectangle = this.state.steleType === 'rectangle';
        
        // Если ни один из типов не подходит — пропускаем
        if (!isCustomStele && !isRectangle) {
            return;
        }
        
        // ⭐ ДЛЯ КАСТОМНЫХ СТЕЛ - ИСПОЛЬЗУЕМ positionDecalsOnCustomStele
        if (isCustomStele && window.positionDecalsOnCustomStele) {
            // Находим кастомную стелу
            let steleObj = null;
            window.monumentGroup.children.forEach(child => {
                if (child.userData && child.userData.isCustomStele && child.userData.modelRef) {
                    steleObj = child;
                }
            });
            
            if (steleObj && steleObj.userData.modelRef) {
                // Очищаем старые декали
                while(window.decalsGroup.children.length > 0) {
                    const child = window.decalsGroup.children[0];
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                    window.decalsGroup.remove(child);
                }
                
                // Сбрасываем кэш текстур
                this.state.frontTextureCache = null;
                this.state.backTextureCache = null;
                
                // Пересоздаём декали
                try {
                    window.positionDecalsOnCustomStele(steleObj, window.decalsGroup, this.state);
                } catch(e) {
                    console.warn('⚠️ Ошибка при обновлении декалей кастомной стелы:', e);
                }
            }
            return;
        }
        
        // ⭐ ДЛЯ ПРЯМОУГОЛЬНЫХ СТЕЛ - ПЕРЕСОЗДАЁМ ТЕКСТУРЫ ЧЕРЕЗ updateScene
        if (isRectangle) {
            // Помечаем текстуры для обновления
            this.state.frontTextureNeedsUpdate = true;
            this.state.backTextureNeedsUpdate = true;
            this.state.frontTextureCache = null;
            this.state.backTextureCache = null;
            
            // Вызываем updateScene для пересоздания текстур
            if (window.throttledUpdate) {
                window.throttledUpdate();
            } else if (window.updateScene) {
                window.updateScene();
            }
        }
    }

    updateTextOffsetDisplay() {
        const xVal = document.getElementById('textOffsetXVal');
        const yVal = document.getElementById('textOffsetYVal');
        if (xVal) xVal.textContent = this.state.textOffsetX.toFixed(2);
        if (yVal) yVal.textContent = this.state.textOffsetY.toFixed(2);
    }

    updateEpitaphOffsetDisplay() {
        const xVal = document.getElementById('epitaphOffsetXVal');
        const yVal = document.getElementById('epitaphOffsetYVal');
        if (xVal) xVal.textContent = this.state.epitaphOffsetX.toFixed(2);
        if (yVal) yVal.textContent = this.state.epitaphOffsetY.toFixed(2);
    }

    throttledUpdate() {
        if (window.throttledUpdate) {
            window.throttledUpdate();
        } else if (window.updateScene) {
            window.updateScene();
        }
    }

    // ============================================================
    // ⭐ ФИКСЫ
    // ============================================================
    
    initButtonFix() {
        document.querySelectorAll('.pos-btn, button').forEach(btn => {
            btn.style.minHeight = '44px';
            btn.style.minWidth = '44px';
            btn.style.touchAction = 'manipulation';
            
            btn.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.92)';
                this.style.opacity = '0.7';
                if (navigator.vibrate) navigator.vibrate(5);
            }, { passive: true });
            
            btn.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
                this.style.opacity = '1';
            }, { passive: true });
        });
    }

    initScrollFix() {
        if (!this.isIPhone) return;
        
        const menuScroll = document.getElementById('menuScroll');
        if (!menuScroll) return;
        
        menuScroll.style.overflowY = 'scroll';
        menuScroll.style.overflowX = 'hidden';
        menuScroll.style.WebkitOverflowScrolling = 'touch';
        menuScroll.style.touchAction = 'pan-y';
        
        setTimeout(() => {
            menuScroll.scrollTop = 1;
            setTimeout(() => { menuScroll.scrollTop = 0; }, 50);
        }, 300);
    }

    addCenterButtons() {
        // Кнопка для ФИО
        const textSection = this.findSectionByText('ФИО') || this.findSectionByText('fullName');
        if (textSection && !textSection.querySelector('.center-text-btn')) {
            const centerBtn = document.createElement('button');
            centerBtn.textContent = '📐 По центру';
            centerBtn.className = 'btn-secondary center-text-btn';
            centerBtn.style.cssText = `
                margin-top: 10px;
                padding: 12px;
                font-size: 14px;
                background: linear-gradient(135deg, #00a896, #008f7a);
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
                touch-action: manipulation;
            `;
            centerBtn.onclick = () => {
                if (this.state) {
                    this.state.textOffsetX = 0;
                    this.state.textOffsetY = 0;
                    this.state.frontTextureNeedsUpdate = true;
                    this.updateTextOffsetDisplay();
                    this.forceDecalUpdate();
                    this.throttledUpdate();
                    this.showToast('📐 Текст по центру', 'success');
                }
            };
            textSection.appendChild(centerBtn);
        }
        
        // Кнопка для эпитафии
        const epitaphSection = this.findSectionByText('Эпитафия') || this.findSectionByText('epitaphText');
        if (epitaphSection && !epitaphSection.querySelector('.center-epitaph-btn')) {
            const centerBtn = document.createElement('button');
            centerBtn.textContent = '📐 По центру';
            centerBtn.className = 'btn-secondary center-epitaph-btn';
            centerBtn.style.cssText = `
                margin-top: 10px;
                padding: 12px;
                font-size: 14px;
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
                touch-action: manipulation;
            `;
            centerBtn.onclick = () => {
                if (this.state) {
                    this.state.epitaphOffsetX = 0;
                    this.state.epitaphOffsetY = 0;
                    this.state.backTextureNeedsUpdate = true;
                    this.updateEpitaphOffsetDisplay();
                    this.forceDecalUpdate();
                    this.throttledUpdate();
                    this.showToast('📐 Эпитафия по центру', 'success');
                }
            };
            epitaphSection.appendChild(centerBtn);
        }
    }

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 120px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'success' ? '#00a896' : '#333'};
                color: white;
                padding: 14px 28px;
                border-radius: 14px;
                z-index: 10000;
                font-size: 15px;
                font-weight: 500;
                transition: opacity 0.3s;
                opacity: 1;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                max-width: 90%;
                text-align: center;
                pointer-events: none;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 400);
            }, 2000);
        }
    }
}

export default MobileImprovements;