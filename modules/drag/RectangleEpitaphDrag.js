// modules/drag/RectangleEpitaphDrag.js
// ============================================================
// DRAG ДЛЯ ЭПИТАФИЙ НА ПРЯМОУГОЛЬНЫХ СТЕЛАХ
// ============================================================

import * as THREE from 'three';
import { EpitaphBlockDrag } from './EpitaphBlockDrag.js';
import { findRectangleStele } from './drag-utils.js';
import { hasBackEpitaphs } from '../epitaphUtils.js';
import { createBackEpitaphMeshes } from '../epitaphMeshes.js';

export class RectangleEpitaphDrag extends EpitaphBlockDrag {
    constructor(options = {}) {
        super(options);
        this.type = 'epitaph_rectangle';
        this.maxOffset = 0.8;
        this.sensitivity = 0.7;
    }

    checkEnabled() {
        const checkbox = document.getElementById('enableDragEpitaph');
        const { targetState } = this.getTargetContext();
        const model = targetState?.steleModel || targetState?.steleType;

        return Boolean(checkbox?.checked && model === 'rectangle');
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

    findStele(targetGroup, isDuplicator) {
        if (!isDuplicator) {
            return findRectangleStele(targetGroup);
        }

        let steleObj = null;
        let maxArea = 0;

        targetGroup?.traverse(child => {
            if (child.geometry?.type !== 'BoxGeometry') return;

            const box = new THREE.Box3().setFromObject(child);
            const size = new THREE.Vector3();
            box.getSize(size);
            const area = size.x * size.y * size.z;

            if (size.x > 0.3 && size.y > 0.8 && area > maxArea) {
                maxArea = area;
                steleObj = child;
            }
        });

        return steleObj;
    }

    refreshDecals() {
        const { isDuplicator, targetState, targetGroup, decalsGroup } =
            this.getTargetContext();

        if (!targetState || !targetGroup || !decalsGroup) return;

        const steleObj = this.findStele(targetGroup, isDuplicator);
        if (!steleObj) return;

        const center = steleObj.position;
        const depth = Number(targetState.depth) || 0.1;
        const backZ = center.z - depth / 2 - 0.015;

        const oldMeshes = decalsGroup.children.filter(
            child => child.userData?.type === 'epitaphBlock'
        );

        oldMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            decalsGroup.remove(mesh);
        });

        if (!hasBackEpitaphs(targetState)) return;

        const width = Number(targetState.width) || 0.6;
        const height = Number(targetState.height) || 1.2;

        const meshes = createBackEpitaphMeshes(targetState, {
            decalWidth: width * 0.85,
            decalHeight: height * 0.85,
            centerY: center.y,
            z: backZ + 0.014
        });

        meshes.forEach(mesh => decalsGroup.add(mesh));
        targetState.backTextureNeedsUpdate = false;
    }
}
