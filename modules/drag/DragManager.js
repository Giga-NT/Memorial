// modules/drag/DragManager.js
// ============================================================
// БАЗОВЫЙ КЛАСС ДЛЯ DRAG-AND-DROP
// ============================================================

import { getEventPosition, showToast } from './drag-utils.js';

export class DragManager {
    constructor(options = {}) {
        this.state = options.state || null;
        this.controls = options.controls || null;
        this.renderer = options.renderer || null;
        this.monumentGroup = options.monumentGroup || null;
        this.decalsGroup = options.decalsGroup || null;
        this.onUpdate = options.onUpdate || null;
        
        // ⭐ ПРОВЕРЯЕМ, ЧТО state ПЕРЕДАН
        if (!this.state) {
            console.warn('⚠️ DragManager: state не передан!');
            return;
        }
        
        // ⭐ ПРОВЕРЯЕМ, ЧТО renderer ПЕРЕДАН
        if (!this.renderer) {
            console.warn('⚠️ DragManager: renderer не передан!');
            return;
        }
        
        this.dragState = {
            active: false,
            type: null,
            startX: 0,
            startY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
            currentOffsetX: 0,
            currentOffsetY: 0,
            isDragging: false,
            dragStartTime: 0
        };
        
        this.isActive = false;
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
        
        this.bindEvents();
    }

    /**
     * Привязать события
     */
    bindEvents() {
        const canvas = this.renderer?.domElement;
        if (!canvas) {
            console.warn('⚠️ Canvas не найден для DragManager');
            return;
        }
        
        canvas.addEventListener('mousedown', this.onStart.bind(this));
        document.addEventListener('mousemove', this.onMove.bind(this));
        document.addEventListener('mouseup', this.onEnd.bind(this));
        
        canvas.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onEnd.bind(this), { passive: true });
    }

    /**
     * Старт перетаскивания
     */
    onStart(event) {
        if (!this.checkEnabled()) return;
        
        const pos = getEventPosition(event, this.renderer);
        if (!pos) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        let clientY = event.clientY;
        if (event.touches && event.touches.length > 0) {
            clientY = event.touches[0].clientY;
        }
        const y = (clientY - rect.top) / rect.height;
        
        const type = this.getDragType(y, event);
        if (!type) return;
        
        this.dragState.active = true;
        this.dragState.type = type;
        this.dragState.startX = pos.x;
        this.dragState.startY = pos.y;
        this.dragState.dragStartTime = Date.now();
        
        // Сохраняем начальные смещения
        const offsets = this.getOffsets(type);
        this.dragState.startOffsetX = offsets.x;
        this.dragState.startOffsetY = offsets.y;
        this.dragState.currentOffsetX = offsets.x;
        this.dragState.currentOffsetY = offsets.y;
        
        // Блокируем управление камерой
        if (this.controls) {
            this.controls.enabled = false;
        }
        
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
        
        this.onDragStart(type);
        console.log(`✋ Начало перетаскивания ${type}`);
    }

    /**
     * Перемещение
     */
    onMove(event) {
        if (!this.dragState.active) return;
        
        if (event.cancelable) {
            event.preventDefault();
        }
        
        const pos = getEventPosition(event, this.renderer);
        if (!pos) return;
        
        const dx = (pos.x - this.dragState.startX) / this.sensitivity;
        const dy = -(pos.y - this.dragState.startY) / this.sensitivity;
        
        let newX = this.dragState.startOffsetX + dx;
        let newY = this.dragState.startOffsetY + dy;
        
        newX = Math.max(-this.maxOffset, Math.min(this.maxOffset, newX));
        newY = Math.max(-this.maxOffset, Math.min(this.maxOffset, newY));
        
        this.dragState.currentOffsetX = newX;
        this.dragState.currentOffsetY = newY;
        
        this.updateOffsets(this.dragState.type, newX, newY);
        this.onDragMove(this.dragState.type, newX, newY);
    }

    /**
     * Завершение
     */
    onEnd() {
        if (!this.dragState.active) return;
        
        const type = this.dragState.type;
        const duration = Date.now() - this.dragState.dragStartTime;
        
        this.dragState.active = false;
        
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
        
        this.onDragEnd(type);
        
        if (this.onUpdate) {
            this.onUpdate();
        }
        
        if (navigator.vibrate) {
            navigator.vibrate(5);
        }
        
        console.log(`✋ Перетаскивание ${type} завершено (${duration}ms)`);
    }

    /**
     * Методы для переопределения в наследниках
     */
    checkEnabled() { return true; }
    getDragType(y, event) { return null; }
    getOffsets(type) { return { x: 0, y: 0 }; }
    updateOffsets(type, x, y) {}
    onDragStart(type) {}
    onDragMove(type, x, y) {}
    onDragEnd(type) {}
}