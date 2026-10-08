import * as THREE from 'three';

const DEFAULT_THICKNESS = 0.06;
const DEFAULT_OFFSET = 0.005;

const STONE_COLORS = {
    granite: 0x1a1a1a,
    black_galaxy: 0x111111,
    ninimyaki: 0x1a2a1a,
    marble: 0xf5f5f5,
    red_granite: 0x8b0000,
    beige_granite: 0xd4b896,
    gray_granite: 0x808080
};

export function createGraveSlab(params = {}) {

    const width =
        Number(params.flowerWidth) || 0.6;

    const length =
        Number(params.flowerLength) || 0.9;

    const baseHeight =
        Number(params.baseHeight) || 0.15;

    const thickness =
        Number(params.graveSlabThickness) ||
        DEFAULT_THICKNESS;

    const materialType =
        params.slabMaterial ||
        params.borderMaterial ||
        params.baseMaterial ||
        'granite';

    if (width <= 0 || length <= 0) {
        console.warn(
            '⚠️ Некорректные размеры надгробной плиты:',
            {
                width,
                length
            }
        );

        return null;
    }

    const color =
        STONE_COLORS[materialType] ??
        STONE_COLORS.granite;

    const material =
        new THREE.MeshStandardMaterial({
            color,
            roughness: 0.2,
            metalness: 0.05
        });

    const geometry =
        new THREE.BoxGeometry(
            width,
            thickness,
            length
        );

    const slab =
        new THREE.Mesh(
            geometry,
            material
        );

    slab.position.set(
        0,
        baseHeight +
        DEFAULT_OFFSET +
        thickness / 2,
        0
    );

    slab.castShadow = true;
    slab.receiveShadow = true;

    slab.name = 'graveSlab';

    slab.userData = {
        type: 'graveSlab',
        width,
        length,
        thickness,
        materialType
    };

    return slab;
}