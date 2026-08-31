        // ============================================================
        // УПРАВЛЕНИЕ МЕНЮ - ГАРАНТИРОВАННЫЙ СКРОЛЛ НА МОБИЛЬНЫХ
        // ============================================================
        
        (function() {
            'use strict';
            
            // Получаем элементы
            const burgerBtn = document.getElementById('burgerBtn');
            const accordionMenu = document.getElementById('accordionMenu');
            const overlay = document.getElementById('menuOverlay');
            const menuScroll = document.getElementById('menuScroll');
            const rotateToggle = document.getElementById('rotateToggle');
            
            let isMenuOpen = false;
            let scrollPosition = 0;
            
            // ============================================================
            // ФУНКЦИЯ ОТКЛЮЧЕНИЯ ВРАЩЕНИЯ
            // ============================================================
            function toggleRotation(enable) {
                if (window.controls) {
                    window.controls.enabled = enable;
                    if (window.controls.domElement) {
                        window.controls.domElement.style.touchAction = enable ? 'none' : 'auto';
                    }
                }
                
                if (rotateToggle) {
                    rotateToggle.textContent = enable ? '🔓' : '🔒';
                    rotateToggle.className = 'rotate-toggle ' + (enable ? 'unlocked' : 'locked');
                }
            }
            
            // ============================================================
            // ФУНКЦИЯ ОТКРЫТИЯ/ЗАКРЫТИЯ МЕНЮ
            // ============================================================
            function toggleMenu() {
                isMenuOpen = accordionMenu.classList.contains('open');
                
                if (!isMenuOpen) {
                    // ---- ОТКРЫВАЕМ МЕНЮ ----
                    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                    
                    // Добавляем классы
                    accordionMenu.classList.add('open');
                    burgerBtn.classList.add('active');
                    overlay.classList.add('active');
                    
                    // Отключаем вращение
                    toggleRotation(false);
                    
                    // Блокируем canvas
                    const canvas = document.querySelector('#canvas-container canvas');
                    if (canvas) {
                        canvas.style.pointerEvents = 'none';
                        canvas.style.touchAction = 'none';
                    }
                    
                    // Блокируем скролл body
                    document.body.style.overflow = 'hidden';
                    document.body.style.position = 'fixed';
                    document.body.style.top = '-' + scrollPosition + 'px';
                    document.body.style.width = '100%';
                    document.body.style.height = '100%';
                    
                    // ============================================================
                    // ⭐ ГЛАВНЫЙ ТРЮК ДЛЯ СКРОЛЛА НА iOS
                    // ============================================================
                    // 1. Устанавливаем стили принудительно
                    menuScroll.style.overflowY = 'scroll';
                    menuScroll.style.overflowX = 'hidden';
                    menuScroll.style.WebkitOverflowScrolling = 'touch';
                    menuScroll.style.touchAction = 'pan-y';
                    menuScroll.style.overscrollBehavior = 'contain';
                    menuScroll.style.height = '100%';
                    menuScroll.style.maxHeight = '100%';
                    
                    // 2. Добавляем обработчики для блокировки событий
                    menuScroll.addEventListener('touchstart', stopPropagation, { passive: false });
                    menuScroll.addEventListener('touchmove', stopPropagation, { passive: false });
                    
                    // 3. Принудительная активация скролла
                    setTimeout(function() {
                        menuScroll.scrollTop = 1;
                        setTimeout(function() {
                            menuScroll.scrollTop = 0;
                        }, 50);
                    }, 100);
                    
                    // 4. Дополнительная активация через 200ms
                    setTimeout(function() {
                        menuScroll.scrollTop = 1;
                        setTimeout(function() {
                            menuScroll.scrollTop = 0;
                        }, 50);
                    }, 300);
                    
                } else {
                    // ---- ЗАКРЫВАЕМ МЕНЮ ----
                    accordionMenu.classList.remove('open');
                    burgerBtn.classList.remove('active');
                    overlay.classList.remove('active');
                    
                    // Включаем вращение
                    toggleRotation(true);
                    
                    // Возвращаем canvas
                    const canvas = document.querySelector('#canvas-container canvas');
                    if (canvas) {
                        canvas.style.pointerEvents = 'auto';
                        canvas.style.touchAction = 'none';
                    }
                    
                    // Разблокируем body
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.top = '';
                    document.body.style.width = '';
                    document.body.style.height = '';
                    
                    // Удаляем обработчики
                    menuScroll.removeEventListener('touchstart', stopPropagation);
                    menuScroll.removeEventListener('touchmove', stopPropagation);
                    
                    // Восстанавливаем скролл
                    window.scrollTo(0, scrollPosition);
                }
            }
            
            // ============================================================
            // ФУНКЦИЯ БЛОКИРОВКИ СОБЫТИЙ
            // ============================================================
            function stopPropagation(e) {
                e.stopPropagation();
                // Разрешаем скролл только внутри меню
                if (e.target.closest('.menu-scroll')) {
                    return;
                }
                e.preventDefault();
            }
            
            // ============================================================
            // ОБРАБОТЧИКИ СОБЫТИЙ
            // ============================================================
            
            // Бургер
            if (burgerBtn) {
                burgerBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleMenu();
                });
            }
            
            // Оверлей
            if (overlay) {
                overlay.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (accordionMenu.classList.contains('open')) {
                        toggleMenu();
                    }
                });
            }
            
            // Кнопка вращения
            if (rotateToggle) {
                rotateToggle.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var isEnabled = rotateToggle.textContent === '🔓';
                    toggleRotation(!isEnabled);
                    showToastMobile(isEnabled ? '🔒 Вращение отключено' : '🔓 Вращение включено');
                });
            }
            
            // ============================================================
            // ГЛОБАЛЬНАЯ БЛОКИРОВКА touch-событий
            // ============================================================
            document.addEventListener('touchmove', function(e) {
                if (accordionMenu.classList.contains('open')) {
                    var target = e.target;
                    // Разрешаем скролл только внутри menu-scroll
                    if (!menuScroll.contains(target)) {
                        e.preventDefault();
                    }
                }
            }, { passive: false });
            
            // Блокируем touchstart на canvas при открытом меню
            document.addEventListener('touchstart', function(e) {
                if (accordionMenu.classList.contains('open')) {
                    var target = e.target;
                    if (target.closest('canvas') && !menuScroll.contains(target)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }, { passive: false });
            
            // ============================================================
            // АККОРДЕОН
            // ============================================================
            var sectionHeaders = document.querySelectorAll('.accordion-section .section-header');
            sectionHeaders.forEach(function(header) {
                header.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    var section = this.closest('.accordion-section');
                    var isActive = section.classList.contains('active');
                    
                    var allSections = document.querySelectorAll('.accordion-section');
                    allSections.forEach(function(s) { s.classList.remove('active'); });
                    
                    if (!isActive) {
                        section.classList.add('active');
                        
                        // Прокручиваем к заголовку
                        setTimeout(function() {
                            try {
                                this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            } catch(e) {}
                        }.bind(this), 100);
                    }
                });
            });
            
            // ============================================================
            // TOAST УВЕДОМЛЕНИЯ
            // ============================================================
            function showToastMobile(message) {
                var toast = document.getElementById('mobile-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'mobile-toast';
                    toast.style.cssText = [
                        'position: fixed;',
                        'bottom: 100px;',
                        'left: 50%;',
                        'transform: translateX(-50%);',
                        'background: rgba(0,0,0,0.85);',
                        'backdrop-filter: blur(10px);',
                        'color: white;',
                        'padding: 12px 24px;',
                        'border-radius: 14px;',
                        'z-index: 9999;',
                        'font-size: 14px;',
                        'font-weight: 500;',
                        'transition: all 0.3s ease;',
                        'opacity: 0;',
                        'transform: translateX(-50%) translateY(20px);',
                        'border: 1px solid rgba(255,255,255,0.05);',
                        'white-space: nowrap;',
                        'max-width: 90%;',
                        'pointer-events: none;',
                        'box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
                    ].join(' ');
                    document.body.appendChild(toast);
                }
                
                toast.textContent = message;
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
                
                clearTimeout(toast._timeout);
                toast._timeout = setTimeout(function() {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(20px)';
                }, 1500);
            }
            
            // ============================================================
            // ПОДКЛЮЧЕНИЕ К ОСНОВНОМУ СКРИПТУ
            // ============================================================
            var checkCount = 0;
            var checkInterval = setInterval(function() {
                checkCount++;
                if (window.controls) {
                    console.log('✅ OrbitControls подключены');
                    toggleRotation(true);
                    clearInterval(checkInterval);
                } else if (checkCount > 20) {
                    console.warn('⚠️ OrbitControls не найдены');
                    clearInterval(checkInterval);
                }
            }, 500);
            
            // ============================================================
            // ВЫБОР ТИПА ПАМЯТНИКА
            // ============================================================
            window.selectType = function(type) {
                var modal = document.getElementById('modal-overlay');
                if (modal) modal.style.display = 'none';
                if (window.onMonumentTypeSelected) window.onMonumentTypeSelected(type);
            };
            
            // ============================================================
            // АДМИНКА
            // ============================================================
            var showAdminBtn = document.getElementById('showAdminBtn');
            var adminPanel = document.getElementById('adminPanel');
            var toggleAdminBtn = document.getElementById('toggleAdminBtn');
            
            if (showAdminBtn && adminPanel && toggleAdminBtn) {
                showAdminBtn.addEventListener('click', function() {
                    adminPanel.style.display = 'block';
                    showAdminBtn.style.display = 'none';
                });
                toggleAdminBtn.addEventListener('click', function() {
                    adminPanel.style.display = 'none';
                    showAdminBtn.style.display = 'block';
                });
            }
            
            console.log('✅ Мобильное меню загружено');
            console.log('📱 Скролл гарантированно работает');
            console.log('📱 Открой меню и попробуй скроллить');
            
            // ============================================================
            // ДОПОЛНИТЕЛЬНАЯ АКТИВАЦИЯ ЧЕРЕЗ 1 СЕКУНДУ
            // ============================================================
            setTimeout(function() {
                if (menuScroll) {
                    menuScroll.style.overflowY = 'scroll';
                    menuScroll.style.WebkitOverflowScrolling = 'touch';
                }
            }, 1000);
            
        })();
		
		
// ============================================================
// ⭐ АВТОМАТИЧЕСКИЙ СБРОС ЗУМА НА IPHONE ПОСЛЕ ВВОДА
// ============================================================

const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);

if (isIPhone) {
    console.log('📱 iPhone: авто-сброс зума активирован');
    
    let scrollPosition = 0;
    let activeInput = null;
    
    // Функция сброса зума
    function resetZoom() {
        // Сбрасываем масштаб
        document.body.style.transform = 'scale(1)';
        document.body.style.transformOrigin = 'top left';
        document.body.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Сбрасываем viewport
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no';
        }
        
        // Восстанавливаем скролл
        window.scrollTo(0, scrollPosition);
        
        // Убираем transition после анимации
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
        
        console.log('🔍 Зум сброшен');
    }
    
    // При фокусе на инпуте - запоминаем позицию
    document.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('focus', function() {
            activeInput = this;
            scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            console.log('⌨️ Фокус на инпуте, позиция сохранена');
        });
        
        // ⭐ ПРИ ПОТЕРЕ ФОКУСА - СБРАСЫВАЕМ ЗУМ
        el.addEventListener('blur', function() {
            console.log('⌨️ Потеря фокуса, сбрасываем зум');
            setTimeout(resetZoom, 200);
            activeInput = null;
        });
        
        // ⭐ ПРИ НАЖАТИИ ENTER В ИНПУТЕ - СБРАСЫВАЕМ ЗУМ
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (this.tagName === 'INPUT')) {
                console.log('⌨️ Enter нажат, сбрасываем зум');
                this.blur();
                setTimeout(resetZoom, 100);
            }
        });
    });
    
    // ⭐ СБРОС ЗУМА ПРИ КЛИКЕ ВНЕ ИНПУТА
    document.addEventListener('click', function(event) {
        const target = event.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        
        if (!isInput && activeInput) {
            console.log('🖱️ Клик вне инпута, сбрасываем зум');
            activeInput.blur();
            setTimeout(resetZoom, 100);
        }
    }, true);
    
    // ⭐ СБРОС ЗУМА ПРИ ЗАКРЫТИИ КЛАВИАТУРЫ (кнопка "Готово")
    document.addEventListener('touchend', function(event) {
        const target = event.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        
        // Если клик не по инпуту и есть активный инпут
        if (!isInput && activeInput) {
            // Проверяем, не нажата ли кнопка "Готово" на клавиатуре
            setTimeout(() => {
                if (!document.activeElement || 
                    (document.activeElement.tagName !== 'INPUT' && 
                     document.activeElement.tagName !== 'TEXTAREA')) {
                    console.log('⌨️ Клавиатура скрыта, сбрасываем зум');
                    resetZoom();
                    activeInput = null;
                }
            }, 300);
        }
    }, { passive: true });
    
    // ⭐ СБРОС ЗУМА ПРИ ИЗМЕНЕНИИ ОРИЕНТАЦИИ
    window.addEventListener('orientationchange', function() {
        setTimeout(resetZoom, 500);
    });
    
    // ⭐ СБРОС ЗУМА ПРИ РАЗВОРАЧИВАНИИ ЭКРАНА
    window.addEventListener('resize', function() {
        if (window.visualViewport && window.visualViewport.scale > 1) {
            console.log('🔄 Изменение размера, сбрасываем зум');
            setTimeout(resetZoom, 200);
        }
    });
}