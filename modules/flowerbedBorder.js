import * as THREE from 'three';

import {
    loadPBRMaterial,
    getTextureTypeFromMaterial
} from './textures.min.js';

const DEFAULT_BORDER_WIDTH = 0.05;   // 5 см
const DEFAULT_BORDER_HEIGHT = 0.06;  // 6 см
const DEFAULT_BORDER_OVERLAP = 0.01;

export async function createFlowerbedBorder(params = {}) {

    if (!params.flowerEnabled) {
        return null;
    }

    const flowerWidth =
        Number(params.flowerWidth);

    const flowerLength =
        Number(params.flowerLength);

    const baseHeight =
        Number(params.baseHeight) || 0;

    if (
        !(flowerWidth > 0) ||
        !(flowerLength > 0)
    ) {
        return null;
    }

    const borderWidth =
        Number(params.flowerbedBorderWidth) ||
        DEFAULT_BORDER_WIDTH;

    const borderHeight =
        Number(params.flowerbedBorderHeight) ||
        DEFAULT_BORDER_HEIGHT;

    const overlap =
        Number(params.flowerbedBorderOverlap) ||
        DEFAULT_BORDER_OVERLAP;

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

    const group =
        new THREE.Group();

    group.name =
        'flowerbedBorder';

    group.userData.isFlowerbedBorder =
        true;

    const outerWidth =
        flowerWidth +
        borderWidth * 2;

    const y =
        baseHeight +
        borderHeight / 2;

    const pieces = [

        {
            width: outerWidth,
            length: borderWidth,
            x: 0,
            z:
                -(
                    flowerLength / 2 +
                    borderWidth / 2 -
                    overlap
                )
        },

        {
            width: outerWidth,
            length: borderWidth,
            x: 0,
            z:
                flowerLength / 2 +
                borderWidth / 2 -
                overlap
        },

        {
            width: borderWidth,
            length:
                flowerLength +
                borderWidth * 2 -
                overlap * 2,
            x:
                -(
                    flowerWidth / 2 +
                    borderWidth / 2 -
                    overlap
                ),
            z: 0
        },

        {
            width: borderWidth,
            length:
                flowerLength +
                borderWidth * 2 -
                overlap * 2,
            x:
                flowerWidth / 2 +
                borderWidth / 2 -
                overlap,
            z: 0
        }
    ];

    pieces.forEach(
        ({ width, length, x, z }) => {

            const mesh =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        width,
                        borderHeight,
                        length
                    ),
                    material.clone()
                );

            mesh.position.set(
                x,
                y,
                z
            );

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            mesh.userData.isFlowerbedBorderPiece =
                true;

            group.add(mesh);
        }
    );

    console.log(
        '🎨 Бордюр:',
        params.material
    );

    return group;
}