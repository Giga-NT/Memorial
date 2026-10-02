import * as THREE from 'three';

const DEFAULT_BORDER_WIDTH = 0.08;
const DEFAULT_BORDER_HEIGHT = 0.06;
const DEFAULT_BORDER_OVERLAP = 0.01;

export function createFlowerbedBorder(params = {}) {
    if (!params.flowerEnabled) return null;

    const flowerWidth = Number(params.flowerWidth);
    const flowerLength = Number(params.flowerLength);
    const baseHeight = Number(params.baseHeight) || 0;

    if (!(flowerWidth > 0) || !(flowerLength > 0)) return null;

    const borderWidth = Number(params.flowerbedBorderWidth) || DEFAULT_BORDER_WIDTH;
    const borderHeight = Number(params.flowerbedBorderHeight) || DEFAULT_BORDER_HEIGHT;
    const overlap = Number(params.flowerbedBorderOverlap) || DEFAULT_BORDER_OVERLAP;
    const material = params.material || 'granite';

    const colors = {
        granite: 0x1a1a1a,
        black_galaxy: 0x111111,
        ninimyaki: 0x1a2a1a,
        marble: 0xf5f5f5,
        red_granite: 0x8b0000,
        beige_granite: 0xd4b896,
        gray_granite: 0x808080
    };

    const mat = new THREE.MeshStandardMaterial({
        color: colors[material] || colors.granite,
        roughness: 0.28,
        metalness: 0.04
    });

    const group = new THREE.Group();
    group.name = 'flowerbedBorder';
    group.userData.isFlowerbedBorder = true;

    const outerWidth = flowerWidth + borderWidth * 2;
    const outerLength = flowerLength + borderWidth * 2;
    const y = baseHeight + borderHeight / 2;

    const pieces = [
        { width: outerWidth, length: borderWidth, x: 0, z: -(flowerLength / 2 + borderWidth / 2 - overlap) },
        { width: outerWidth, length: borderWidth, x: 0, z:  (flowerLength / 2 + borderWidth / 2 - overlap) },
        { width: borderWidth, length: flowerLength + borderWidth * 2 - overlap * 2, x: -(flowerWidth / 2 + borderWidth / 2 - overlap), z: 0 },
        { width: borderWidth, length: flowerLength + borderWidth * 2 - overlap * 2, x:  (flowerWidth / 2 + borderWidth / 2 - overlap), z: 0 }
    ];

    pieces.forEach(({ width, length, x, z }) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, borderHeight, length), mat.clone());
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });

    return group;
}
