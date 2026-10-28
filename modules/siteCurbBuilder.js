import * as THREE from 'three';

const CURB_MATERIALS = {
    granite: { color: 0x454545, roughness: 0.28, metalness: 0.08 },
    concrete: { color: 0x8a8a86, roughness: 0.85, metalness: 0 },
    marble: { color: 0xd8d6d0, roughness: 0.3, metalness: 0.02 },
    brick: { color: 0x8a5142, roughness: 0.8, metalness: 0 }
};

/**
 * Creates a low curb around the site perimeter.
 * The curb follows fence dimensions but is independent of fence visibility.
 * If a gate is selected, an opening is left on that side.
 */
export function createSiteCurb(params = {}) {
    if (!params.curbVisible) return null;

    const width = Math.max(0.2, Number(params.fenceWidth) || 1.5);
    const length = Math.max(0.2, Number(params.fenceLength) || 2.5);
    const curbWidth = Math.max(0.03, Number(params.curbWidth) || 0.08);
    const curbHeight = Math.max(0.03, Number(params.curbHeight) || 0.12);
    const gateSide = params.curbGateOpeningEnabled ? (params.fenceGateSide || 'none') : 'none';
    const gateSpan = gateSide === 'left' || gateSide === 'right' ? length : width;
    const gateWidth = Math.min(Math.max(0, gateSpan - curbWidth * 2), Math.max(0, Number(params.gateWidth) || 0));
    const spec = CURB_MATERIALS[params.curbMaterial] || CURB_MATERIALS.granite;
    const material = new THREE.MeshStandardMaterial({ ...spec });

    const group = new THREE.Group();
    group.name = 'siteCurb';
    group.userData.isSiteCurb = true;
    group.userData.curbMaterial = params.curbMaterial || 'granite';

    const addPiece = (pieceWidth, pieceLength, x, z) => {
        if (!(pieceWidth > 0) || !(pieceLength > 0)) return;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(pieceWidth, curbHeight, pieceLength),
            material.clone()
        );
        mesh.position.set(x, curbHeight / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isSiteCurbPiece = true;
        group.add(mesh);
    };

    // Left and right sides, leaving a gate opening if the gate is on that side.
    const sideLength = Math.max(0, length - curbWidth * 2);
    if (gateSide === 'left' || gateSide === 'right') {
        const opening = Math.min(gateWidth, sideLength);
        const segment = Math.max(0, (sideLength - opening) / 2);
        const sign = gateSide === 'left' ? -1 : 1;
        const x = sign * (width / 2 - curbWidth / 2);
        const zOffset = (opening + segment) / 2;
        addPiece(curbWidth, segment, x, -(zOffset));
        addPiece(curbWidth, segment, x, zOffset);
    } else {
        addPiece(curbWidth, sideLength, -(width / 2 - curbWidth / 2), 0);
        addPiece(curbWidth, sideLength, width / 2 - curbWidth / 2, 0);
    }

    // Front and back sides, with an opening on the selected gate side.
    const frontBackWidth = Math.max(0, width - curbWidth * 2);
    const endSide = (zSign, isGateSide) => {
        const z = zSign * (length / 2 - curbWidth / 2);
        if (!isGateSide) {
            addPiece(frontBackWidth, curbWidth, 0, z);
            return;
        }
        const opening = Math.min(gateWidth, frontBackWidth);
        const segment = Math.max(0, (frontBackWidth - opening) / 2);
        const xOffset = (opening + segment) / 2;
        addPiece(segment, curbWidth, -xOffset, z);
        addPiece(segment, curbWidth, xOffset, z);
    };

    endSide(-1, gateSide === 'front');
    endSide(1, gateSide === 'back');

    if (group.children.length === 0) {
        material.dispose();
        return null;
    }

    material.dispose();
    return group;
}
