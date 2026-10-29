import * as THREE from 'three';
import { loadPBRMaterial } from './textures.min.js';

const CURB_MATERIALS = {
    granite: { texture: 'granite', color: 0x454545, roughness: 0.28, metalness: 0.08 },
    black_galaxy: { texture: 'black_galaxy', color: 0x242424, roughness: 0.25, metalness: 0.05 },
    red_granite: { texture: 'red_granite', color: 0x8b0000, roughness: 0.28, metalness: 0.04 },
    beige_granite: { texture: 'beige_granite', color: 0xd4b896, roughness: 0.28, metalness: 0.03 },
    gray_granite: { texture: 'gray_granite', color: 0x808080, roughness: 0.28, metalness: 0.04 },
    marble: { texture: 'marble', color: 0xd8d6d0, roughness: 0.3, metalness: 0.02 },
    concrete: { procedural: 'concrete', color: 0x8a8a86, roughness: 0.85, metalness: 0 },
    brick: { procedural: 'brick', color: 0x8a5142, roughness: 0.8, metalness: 0 }
};

function createProceduralTexture(type) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (type === 'brick') {
        ctx.fillStyle = '#8a5142';
        ctx.fillRect(0, 0, 256, 256);
        const brickH = 32;
        for (let row = 0; row < 8; row++) {
            const offset = row % 2 ? -32 : 0;
            for (let x = offset; x < 288; x += 64) {
                ctx.fillStyle = ['#995b4a', '#804536', '#a2614e'][Math.floor(Math.random() * 3)];
                ctx.fillRect(x + 1, row * brickH + 1, 62, brickH - 2);
            }
        }
        ctx.strokeStyle = '#c5b4a8';
        ctx.lineWidth = 2;
        for (let y = 0; y <= 256; y += brickH) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
        }
        for (let row = 0; row < 8; row++) {
            const offset = row % 2 ? 0 : 32;
            for (let x = offset; x <= 256; x += 64) {
                ctx.beginPath(); ctx.moveTo(x, row * brickH); ctx.lineTo(x, (row + 1) * brickH); ctx.stroke();
            }
        }
    } else {
        ctx.fillStyle = '#8a8a86';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1800; i++) {
            const shade = 100 + Math.floor(Math.random() * 65);
            ctx.fillStyle = `rgba(${shade},${shade},${shade - 3},${Math.random() * 0.18})`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.set(1, 1);
    return texture;
}

/**
 * Creates a low curb around the site perimeter.
 * Stone options reuse the same PBR texture assets as the stele.
 * When the fence is hidden, front/back curbs extend across the side-curb widths.
 */
export async function createSiteCurb(params = {}) {
    if (!params.curbVisible) return null;

    const width = Math.max(0.2, Number(params.fenceWidth) || 1.5);
    const length = Math.max(0.2, Number(params.fenceLength) || 2.5);
    const curbWidth = Math.max(0.03, Number(params.curbWidth) || 0.08);
    const curbHeight = Math.max(0.03, Number(params.curbHeight) || 0.12);
    const gateSide = params.curbGateOpeningEnabled ? (params.fenceGateSide || 'none') : 'none';
    const gateSpan = gateSide === 'left' || gateSide === 'right' ? length : width;
    const gateWidth = Math.min(Math.max(0, gateSpan - curbWidth * 2), Math.max(0, Number(params.gateWidth) || 0));
    const materialKey = params.curbMaterial || 'granite';
    const spec = CURB_MATERIALS[materialKey] || CURB_MATERIALS.granite;

    let baseMaterial;
    if (spec.texture) {
        try {
            baseMaterial = await loadPBRMaterial(spec.texture);
        } catch (error) {
            console.warn('Не удалось загрузить текстуру бордюра:', spec.texture, error);
        }
    }
    if (!baseMaterial) {
        const map = spec.procedural ? createProceduralTexture(spec.procedural) : null;
        baseMaterial = new THREE.MeshStandardMaterial({
            color: spec.color,
            roughness: spec.roughness,
            metalness: spec.metalness,
            ...(map ? { map } : {})
        });
    }

    const group = new THREE.Group();
    group.name = 'siteCurb';
    group.userData.isSiteCurb = true;
    group.userData.curbMaterial = materialKey;

    const addPiece = (pieceWidth, pieceLength, x, z) => {
        if (!(pieceWidth > 0) || !(pieceLength > 0)) return;
        const pieceMaterial = baseMaterial.clone();
        if (pieceMaterial.map) {
            pieceMaterial.map = pieceMaterial.map.clone();
            pieceMaterial.map.needsUpdate = true;
        }
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(pieceWidth, curbHeight, pieceLength),
            pieceMaterial
        );
        mesh.position.set(x, curbHeight / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isSiteCurbPiece = true;
        group.add(mesh);
    };

    const sideLength = Math.max(0, length - curbWidth * 2);
    if (gateSide === 'left' || gateSide === 'right') {
        const opening = Math.min(gateWidth, sideLength);
        const segment = Math.max(0, (sideLength - opening) / 2);
        const sign = gateSide === 'left' ? -1 : 1;
        const x = sign * (width / 2 - curbWidth / 2);
        const zOffset = (opening + segment) / 2;
        addPiece(curbWidth, segment, x, -zOffset);
        addPiece(curbWidth, segment, x, zOffset);
    } else {
        addPiece(curbWidth, sideLength, -(width / 2 - curbWidth / 2), 0);
        addPiece(curbWidth, sideLength, width / 2 - curbWidth / 2, 0);
    }

    // With the fence visible, keep the old inset ends. Without it, extend
    // front/back pieces by one curb width at each end to meet side pieces.
    const frontBackWidth = Math.max(0, width - (params.fenceEnabled ? curbWidth * 2 : 0));
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
        group.traverse(obj => {
            obj.geometry?.dispose();
            if (obj.material) obj.material.dispose();
        });
        return null;
    }

    return group;
}
