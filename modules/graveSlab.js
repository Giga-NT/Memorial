import * as THREE from 'three';

import {
    getGraveSlabModel,
    loadGraveSlabModel,
    fitGraveSlabToDimensions,
    placeOnGround
} from './graveSlabLoader.js';

export async function createGraveSlab(params = {}) {
    const modelId =
        params.graveSlabModel || 'slab1';

    const modelInfo =
        getGraveSlabModel(modelId);

    if (!modelInfo) {
        console.error(
            `❌ Не найдена модель плиты: ${modelId}`
        );

        return null;
    }

    const width =
        Number(params.flowerWidth) ||
        modelInfo.width ||
        0.6;

    const length =
        Number(params.flowerLength) ||
        modelInfo.length ||
        0.9;

    const thickness =
        Number(params.graveSlabThickness) ||
        modelInfo.thickness ||
        0.06;

    const baseHeight =
        Number(params.baseHeight) || 0.15;

    const slab =
        await loadGraveSlabModel(modelId);

    if (!slab) {
        return null;
    }

    fitGraveSlabToDimensions(slab, {
        width,
        thickness,
        length
    });

    placeOnGround(slab);

    slab.position.set(
        0,
        baseHeight + 0.005,
        0
    );

    slab.name = 'graveSlab';

    slab.userData = {
        type: 'graveSlab',
        modelId,
        width,
        length,
        thickness,
        materialType:
            modelInfo.defaultMaterial || 'granite'
    };

    slab.traverse(object => {
        if (!object.isMesh) {
            return;
        }

        object.castShadow = true;
        object.receiveShadow = true;
    });

    return slab;
}