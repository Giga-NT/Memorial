import * as THREE from 'three';
import { DragManager } from './DragManager.js';
import { getEventPosition } from './drag-utils.js';
import {
    collectBackEpitaphs,
    getActiveEpitaphSelection,
    getEpitaphBlockOffset,
    selectEpitaphBlock,
    setEpitaphBlockOffset
} from '../epitaphUtils.js';
import {
    findBackEpitaphMeshes,
    updateBackEpitaphMeshOffset
} from '../epitaphMeshes.js';

export class EpitaphBlockDrag extends DragManager {
    constructor(options = {}) {
        super(options);
        this.camera = options.camera || null;
        this.raycaster = new THREE.Raycaster();
        this.setupPositionButtons();
    }

    checkEnabled() {
        return false;
    }

    getTargetContext() {
        return {
            isDuplicator: false,
            targetState: this.state,
            targetGroup: this.monumentGroup,
            decalsGroup: this.decalsGroup
        };
    }

    onOffsetsUpdated() {
        const manager = window.multiMonumentManager;
        const { isDuplicator, targetState } = this.getTargetContext();

        if (!isDuplicator || !targetState || !manager) return;

        const index = manager.activeIndex;
        const burials = Array.isArray(targetState.burials)
            ? targetState.burials.map(burial => ({
                ...burial,
                epitaphs: Array.isArray(burial.epitaphs)
                    ? burial.epitaphs.map(item => (
                        typeof item === 'string' ? item : { ...item }
                    ))
                    : []
            }))
            : targetState.burials;

        manager._duplicatorDataCache ??= {};
        manager._duplicatorDataCache[index] = {
            ...targetState,
            burials
        };

        if (manager.pendingIndex === index && manager.pendingChanges) {
            manager.pendingChanges.burials = burials;
            manager.pendingChanges.epitaphOffsetX =
                Number(targetState.epitaphOffsetX) || 0;
            manager.pendingChanges.epitaphOffsetY =
                Number(targetState.epitaphOffsetY) || 0;
        }
    }

    refreshDecals() {}

    resolveSelectedBlock(targetState) {
        const selection = getActiveEpitaphSelection();
        const blocks = collectBackEpitaphs(targetState);

        if (blocks.length === 0) {
            return {
                burialId: targetState?.activeBurialId ??
                    targetState?.burials?.[0]?.id ?? null,
                epitaphIndex: 0
            };
        }

        const selectedBlock = blocks.find(block =>
            String(block.burialId) === String(selection.burialId) &&
            Number(block.epitaphIndex) === Number(selection.epitaphIndex)
        );

        if (selectedBlock) {
            return {
                burialId: selectedBlock.burialId,
                epitaphIndex: selectedBlock.epitaphIndex
            };
        }

        const activeBlock = blocks.find(block =>
            String(block.burialId) === String(targetState?.activeBurialId)
        ) || blocks[0];

        return {
            burialId: activeBlock.burialId,
            epitaphIndex: activeBlock.epitaphIndex
        };
    }

    getBlockMesh(decalsGroup, burialId, epitaphIndex) {
        return findBackEpitaphMeshes(decalsGroup).find(mesh =>
            String(mesh.userData.burialId) === String(burialId) &&
            Number(mesh.userData.epitaphIndex) === Number(epitaphIndex)
        ) || null;
    }

    onStart(event) {
        if (!this.checkEnabled()) return;

        const { decalsGroup } = this.getTargetContext();
        if (!decalsGroup || !this.camera) return;

        const position = getEventPosition(event, this.renderer);
        if (!position) return;

        this.raycaster.setFromCamera(
            new THREE.Vector2(position.x, position.y),
            this.camera
        );

        const cameraPosition = this.camera.position;
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const planeNormal = new THREE.Vector3();
        const toCamera = new THREE.Vector3();

        const meshes = findBackEpitaphMeshes(decalsGroup)
            .filter(mesh => {
                if (mesh.visible === false) return false;

                mesh.getWorldPosition(worldPosition);
                mesh.getWorldQuaternion(worldQuaternion);
                planeNormal.set(0, 0, 1).applyQuaternion(worldQuaternion);
                toCamera.copy(cameraPosition).sub(worldPosition);

                return planeNormal.dot(toCamera) > 0;
            });

        const hit = this.raycaster.intersectObjects(meshes, false)[0];

        if (!hit?.object) return;

        const mesh = hit.object;
        const burialId = mesh.userData.burialId;
        const epitaphIndex = Number(mesh.userData.epitaphIndex) || 0;
        const offset = mesh.userData;

        selectEpitaphBlock(burialId, epitaphIndex);

        this.dragState.active = true;
        this.dragState.type = this.type;
        this.dragState.epitaphMesh = mesh;
        this.dragState.burialId = burialId;
        this.dragState.epitaphIndex = epitaphIndex;
        this.dragState.startX = position.x;
        this.dragState.startY = position.y;
        this.dragState.startOffsetX =
            Number(offset.epitaphOffsetX) || 0;
        this.dragState.startOffsetY =
            Number(offset.epitaphOffsetY) || 0;
        this.dragState.dragStartTime = Date.now();

        if (this.controls) this.controls.enabled = false;

        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        if (navigator.vibrate) navigator.vibrate(10);

        this.updateDisplay();
    }

    onMove(event) {
        if (!this.dragState.active) return;

        if (event.cancelable) event.preventDefault();

        const position = getEventPosition(event, this.renderer);
        if (!position) return;

        const dx = (position.x - this.dragState.startX) / this.sensitivity;
        const dy = -(position.y - this.dragState.startY) / this.sensitivity;

        const x = Math.max(
            -this.maxOffset,
            Math.min(this.maxOffset, this.dragState.startOffsetX + dx)
        );
        const y = Math.max(
            -this.maxOffset,
            Math.min(this.maxOffset, this.dragState.startOffsetY + dy)
        );

        this.applyBlockOffset(x, y);
    }

    onEnd() {
        if (!this.dragState.active) return;

        this.dragState.active = false;
        this.dragState.epitaphMesh = null;
        this.updateDisplay();

        if (this.controls) this.controls.enabled = true;

        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';

        if (navigator.vibrate) navigator.vibrate(5);
    }

    applyBlockOffset(x, y) {
        const { targetState, decalsGroup } = this.getTargetContext();
        const { burialId, epitaphIndex, epitaphMesh } = this.dragState;

        if (!targetState) return;

        setEpitaphBlockOffset(targetState, burialId, epitaphIndex, x, y);

        if (Number(epitaphIndex) === 0) {
            targetState.epitaphOffsetX = x;
            targetState.epitaphOffsetY = y;
        }

        if (epitaphMesh) {
            updateBackEpitaphMeshOffset(epitaphMesh, x, y);
        } else {
            const mesh = this.getBlockMesh(decalsGroup, burialId, epitaphIndex);
            if (mesh) {
                updateBackEpitaphMeshOffset(mesh, x, y);
            } else {
                this.refreshDecals();
            }
        }

        this.onOffsetsUpdated();
        this.updateDisplay();
    }

    setupPositionButtons() {
        const step = 0.01;

        document.addEventListener('click', event => {
            const button = event.target?.closest?.(
                '#btnEpitaphUp, #btnEpitaphDown, ' +
                '#btnEpitaphLeft, #btnEpitaphRight, #btnEpitaphReset'
            );

            if (!button || !this.checkEnabled()) return;

            const { targetState, decalsGroup } = this.getTargetContext();
            if (!targetState) return;

            const block = this.resolveSelectedBlock(targetState);
            if (block.burialId != null) {
                selectEpitaphBlock(block.burialId, block.epitaphIndex);
            }

            const offset = getEpitaphBlockOffset(
                targetState,
                block.burialId,
                block.epitaphIndex
            );

            let x = offset.x;
            let y = offset.y;

            switch (button.id) {
                case 'btnEpitaphUp':
                    y -= step;
                    break;
                case 'btnEpitaphDown':
                    y += step;
                    break;
                case 'btnEpitaphLeft':
                    x -= step;
                    break;
                case 'btnEpitaphRight':
                    x += step;
                    break;
                case 'btnEpitaphReset':
                    x = 0;
                    y = 0;
                    break;
            }

            this.dragState.burialId = block.burialId;
            this.dragState.epitaphIndex = block.epitaphIndex;
            this.dragState.epitaphMesh = this.getBlockMesh(
                decalsGroup,
                block.burialId,
                block.epitaphIndex
            );

            this.applyBlockOffset(x, y);
        });
    }

    updateDisplay() {
        const { targetState } = this.getTargetContext();
        const block = this.resolveSelectedBlock(targetState);
        const offset = getEpitaphBlockOffset(
            targetState,
            block.burialId,
            block.epitaphIndex
        );

        const xVal = document.getElementById('epitaphOffsetXVal');
        const yVal = document.getElementById('epitaphOffsetYVal');

        if (xVal) xVal.textContent = offset.x.toFixed(2);
        if (yVal) yVal.textContent = offset.y.toFixed(2);
    }
}
