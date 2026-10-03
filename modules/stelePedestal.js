import * as THREE from 'three';

import {
    loadPBRMaterial,
    getTextureTypeFromMaterial
} from './textures.min.js';

const DEFAULT_HEIGHT = 0.12;
const DEFAULT_SIDE_MARGIN = 0.06;
const DEFAULT_DEPTH_MARGIN = 0.04;

export async function createStelePedestal(
    steleObj,
    params = {}
) {

    if (!steleObj) {
        return null;
    }

    const baseHeight =
        Number(params.baseHeight) || 0;

    const pedestalHeight =
        Number(params.stelePedestalHeight) ||
        DEFAULT_HEIGHT;

    const sideMargin =
        Number(params.stelePedestalSideMargin) ||
        DEFAULT_SIDE_MARGIN;

    const depthMargin =
        Number(params.stelePedestalDepthMargin) ||
        DEFAULT_DEPTH_MARGIN;

    const box =
        new THREE.Box3()
            .setFromObject(steleObj);

    if (box.isEmpty()) {
        console.warn(
            '⚠️ Не удалось определить размеры стелы'
        );

        return null;
    }

    const size =
        box.getSize(
            new THREE.Vector3()
        );

    const center =
        box.getCenter(
            new THREE.Vector3()
        );

    const pedestalWidth =
        size.x +
        sideMargin * 2;

    const pedestalDepth =
        size.z +
        depthMargin * 2;

    const geometry =
        new THREE.BoxGeometry(
            pedestalWidth,
            pedestalHeight,
            pedestalDepth
        );

    // ============================================================
    // МАТЕРИАЛ ТУМБЫ
    // ============================================================

    const materialType =
        getTextureTypeFromMaterial(
            params.material || 'granite'
        );

    const pbrMaterial =
        await loadPBRMaterial(
            materialType
        );

    const material =
        pbrMaterial
            ? pbrMaterial.clone()
            : new THREE.MeshStandardMaterial({
                color: 0x3a3a3a,
                roughness: 0.3,
                metalness: 0.03
            });

    const pedestal =
        new THREE.Mesh(
            geometry,
            material
        );

    pedestal.name =
        'stelePedestal';

    pedestal.userData.isStelePedestal =
        true;

    // ============================================================
    // ТУМБА СТОИТ НА ВЕРХНЕЙ ПОВЕРХНОСТИ ОСНОВАНИЯ
    // ============================================================

    pedestal.position.set(
        center.x,
        baseHeight +
        pedestalHeight / 2,
        center.z
    );

    pedestal.castShadow = true;
    pedestal.receiveShadow = true;

    console.log(
        '🎨 Тумба:',
        params.material
    );

    return pedestal;
}