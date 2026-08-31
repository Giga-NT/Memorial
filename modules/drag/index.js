// modules/drag/index.js
// ============================================================
// ГЛАВНЫЙ ЭКСПОРТ DRAG-AND-DROP
// ============================================================

import { CustomSteleTextDrag } from './CustomSteleTextDrag.js';
import { CustomSteleEpitaphDrag } from './CustomSteleEpitaphDrag.js';
import { RectangleTextDrag } from './RectangleTextDrag.js';
import { RectangleEpitaphDrag } from './RectangleEpitaphDrag.js';
import { FenceDrag } from './FenceDrag.js';

export {
    CustomSteleTextDrag,
    CustomSteleEpitaphDrag,
    RectangleTextDrag,
    RectangleEpitaphDrag,
    FenceDrag
};

/**
 * Инициализировать все Drag-менеджеры
 */
export function initDragManagers(options = {}) {
    const {
        state,
        controls,
        renderer,
        monumentGroup,
        decalsGroup,
        onUpdate
    } = options;
    
    const managers = [];
    
    // Кастомные стелы
    const customTextDrag = new CustomSteleTextDrag({
        state,
        controls,
        renderer,
        monumentGroup,
        decalsGroup,
        onUpdate
    });
    managers.push(customTextDrag);
    
    const customEpitaphDrag = new CustomSteleEpitaphDrag({
        state,
        controls,
        renderer,
        monumentGroup,
        decalsGroup,
        onUpdate
    });
    managers.push(customEpitaphDrag);
    
    // Прямоугольные стелы
    const rectTextDrag = new RectangleTextDrag({
        state,
        controls,
        renderer,
        monumentGroup,
        decalsGroup,
        onUpdate
    });
    managers.push(rectTextDrag);
    
    const rectEpitaphDrag = new RectangleEpitaphDrag({
        state,
        controls,
        renderer,
        monumentGroup,
        decalsGroup,
        onUpdate
    });
    managers.push(rectEpitaphDrag);
    
    // ⭐ ДРАГ ДЛЯ ПЕРЕМЕЩЕНИЯ ОГРАДКИ (ИСПРАВЛЕННЫЙ)
    // Мы передаём onUpdate как функцию пересоздания!
    const fenceDrag = new FenceDrag({
        state: state,
        controls: controls,
        renderer: renderer,
        monumentGroup: monumentGroup,
        decalsGroup: decalsGroup,
        
        // ⭐ ВАЖНО: Передаём функцию onUpdate как колбэк для пересоздания.
        // Это гарантирует, что FenceDrag сможет вызвать её, даже если 
        // сборщик удалил глобальную переменную.
        onRebuildNeeded: onUpdate, 
        onUpdate: onUpdate 
    });
    managers.push(fenceDrag);
    
    // Сохраняем ссылку для доступа из глобального кода
    window._fenceDrag = fenceDrag;
    
    console.log('✅ Drag Managers инициализированы:', managers.length);
    return managers;
}