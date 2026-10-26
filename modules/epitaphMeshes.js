import * as THREE from 'three';
import { buildBackEpitaphLayout } from './epitaphUtils.js';

export function createBackEpitaphMeshes(data = {}, options = {}) {
    const layout = buildBackEpitaphLayout(data, options);
    const centerX = Number(options.centerX) || 0;
    const centerY = Number(options.centerY) || 0;
    const z = Number(options.z) || 0;
    const renderOrder = Number(options.renderOrder) || 9;

    return layout.map((block, index) => {
        const texture = new THREE.CanvasTexture(block.canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            alphaTest: 0.05
        });

        const geometry = new THREE.PlaneGeometry(
            block.worldWidth,
            block.worldHeight
        );
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(
            centerX - block.defaultCenterX - block.offsetX,
            centerY + block.defaultCenterY - block.offsetY,
            z
        );
        mesh.rotation.y = Math.PI;
        mesh.renderOrder = renderOrder + index;

        mesh.userData.type = 'epitaphBlock';
        mesh.userData.isEpitaph = true;
        mesh.userData.isDraggable = true;
        mesh.userData.burialId = block.burialId;
        mesh.userData.epitaphIndex = block.epitaphIndex;
        mesh.userData.epitaphKey = block.key;
        mesh.userData.epitaphBaseX = centerX - block.defaultCenterX;
        mesh.userData.epitaphBaseY = centerY + block.defaultCenterY;
        mesh.userData.epitaphOffsetX = block.offsetX;
        mesh.userData.epitaphOffsetY = block.offsetY;

        return mesh;
    });
}

export function updateBackEpitaphMeshOffset(mesh, x, y) {
    if (!mesh?.userData || mesh.userData.type !== 'epitaphBlock') return;

    mesh.userData.epitaphOffsetX = Number(x) || 0;
    mesh.userData.epitaphOffsetY = Number(y) || 0;
    mesh.position.x = mesh.userData.epitaphBaseX - mesh.userData.epitaphOffsetX;
    mesh.position.y = mesh.userData.epitaphBaseY - mesh.userData.epitaphOffsetY;
}

export function findBackEpitaphMeshes(decalsGroup) {
    if (!decalsGroup?.children) return [];

    return decalsGroup.children.filter(
        child => child.userData?.type === 'epitaphBlock'
    );
}
