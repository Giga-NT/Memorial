// modules/drag/CustomSteleEpitaphDrag.js
// ============================================================
// DRAG ДЛЯ ЭПИТАФИЙ НА КАСТОМНЫХ СТЕЛАХ
// ============================================================

import { EpitaphBlockDrag } from './EpitaphBlockDrag.js';
import { findCustomStele } from './drag-utils.js';

export class CustomSteleEpitaphDrag extends EpitaphBlockDrag {
    constructor(options = {}) {
        super(options);
        this.type = 'epitaph_custom';
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
    }

    checkEnabled() {
        const checkbox = document.getElementById('enableDragEpitaph');
        const manager = window.multiMonumentManager;

        const targetState =
            manager?.currentMode === 'duplicator' &&
            manager.activeIndex >= 0
                ? manager.monuments?.[manager.activeIndex]?.data
                : this.state;

        const model = targetState?.steleModel || targetState?.steleType;

        return Boolean(
            checkbox?.checked &&
            typeof model === 'string' &&
            model.startsWith('custom_stl')
        );
    }

    getTargetContext() {
        const manager = window.multiMonumentManager;
        const isDuplicator =
            manager?.currentMode === 'duplicator' &&
            manager.activeIndex >= 0;
        const monument = isDuplicator
            ? manager.monuments?.[manager.activeIndex]
            : null;
        const targetGroup = isDuplicator ? monument?.group : this.monumentGroup;
        const decalsGroup = isDuplicator
            ? targetGroup?.children.find(
                child => child.name === 'decalsContainer'
            )
            : this.decalsGroup;

        return {
            isDuplicator,
            targetState: isDuplicator ? monument?.data : this.state,
            targetGroup,
            decalsGroup
        };
    }

    refreshDecals() {
        this.forceDecalUpdate();
    }

    forceDecalUpdate() {
        if (!window.positionDecalsOnCustomStele) return;

        const { targetState, targetGroup, decalsGroup } =
            this.getTargetContext();

        if (!targetState || !targetGroup || !decalsGroup) return;

        const steleObj = findCustomStele(targetGroup);
        if (!steleObj || !steleObj.userData.modelRef) return;

        targetState.frontTextureCache = null;
        targetState.backTextureCache = null;
        targetState.backTextureNeedsUpdate = true;

        try {
            window.positionDecalsOnCustomStele(
                steleObj,
                decalsGroup,
                targetState
            );
        } catch (e) {
            console.warn('⚠️ Ошибка обновления декалей:', e);
        }
    }
}
