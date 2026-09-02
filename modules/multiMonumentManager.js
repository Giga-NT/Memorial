// modules/multiMonumentManager.js

import * as THREE from 'three';
import { loadFlowerbedTexture } from './textures.min.js';

// ⭐ КАРТА ТЕКСТУР
const TEXTURE_PATHS = {
    'granite': './textures/gabbro/color.webp',
    'black_galaxy': './textures/black_galaxy/color.webp',
    'ninimyaki': './textures/ninimyaki/color.webp',
    'marble': './textures/marble/color.webp',
    'red_granite': './textures/red_granite/color.webp',
    'beige_granite': './textures/beige_granite/color.webp',
    'gray_granite': './textures/gray_granite/gray-polished-granite_albedo.webp'
};

const FALLBACK_COLORS = {
    'granite': 0x1a1a1a,
    'black_galaxy': 0x111111,
    'ninimyaki': 0x1a2a1a,
    'marble': 0xf5f5f5,
    'red_granite': 0x8b0000,
    'beige_granite': 0xd4b896,
    'gray_granite': 0x808080
};

const textureCache = new Map();

function loadTextureForMaterial(materialType) {
    return new Promise((resolve) => {
        if (textureCache.has(materialType)) {
            resolve(textureCache.get(materialType));
            return;
        }
        
        const path = TEXTURE_PATHS[materialType];
        if (!path) {
            resolve(null);
            return;
        }
        
        const loader = new THREE.TextureLoader();
        loader.load(
            path,
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, 1);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = 4;
                textureCache.set(materialType, texture);
                resolve(texture);
            },
            undefined,
            () => {
                const altPath = path.replace('.webp', '.jpg');
                loader.load(
                    altPath,
                    (texture) => {
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(1, 1);
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.anisotropy = 4;
                        textureCache.set(materialType, texture);
                        resolve(texture);
                    },
                    undefined,
                    () => {
                        resolve(null);
                    }
                );
            }
        );
    });
}

async function createSteleMaterialWithTexture(materialType, isBase = false) {
    const texture = await loadTextureForMaterial(materialType);
    
    const material = new THREE.MeshStandardMaterial({
        roughness: isBase ? 0.7 : 0.25,
        metalness: isBase ? 0.02 : 0.05
    });
    
    if (texture) {
        material.map = texture;
        material.color = new THREE.Color(0xffffff);
    } else {
        const color = FALLBACK_COLORS[materialType] || 0x888888;
        material.color = new THREE.Color(color);
    }
    
    material.needsUpdate = true;
    return material;
}

export class MultiMonumentManager {
    constructor(scene, renderer, controls) {
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        
        // ⭐ ГРУППА ДЛЯ ДУБЛЕРОВ
        this.monumentsGroup = new THREE.Group();
        this.monumentsGroup.userData.isMonumentGroup = true;
        this.monumentsGroup.userData.isDuplicatorGroup = true;
        this.scene.add(this.monumentsGroup);
        
        this.monuments = [];
        this.mainPhotoMesh = null; 
        this.activeIndex = -1;
        this.nextId = 1;
        this.isUpdating = false;
        this.isRebuilding = false;
        this._isSleeping = false;
        this._isMoveModeActive = false;
        this._skipDuplicatorRebuild = false;
        this._pendingPhotoUrl = null;
        
        this.currentMode = 'main';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        this._savedState = null;
        this._duplicatorDataCache = {};
        this._blockStateUpdate = false;
        
        window._disableAutoMonument = true;
        window._isDuplicatorMode = false;
        
        this.createUI();
        this.bindEvents();
    
        this.setupPhotoDragHandlers();
        this.setupDuplicatorPhotoDragHandlers();
        // this.setupTextDragHandlers();
    }

    // ... (the rest of the original file content remains unchanged)

}

// ==================== PATCH: Align duplicator decals with main monument sizing ===================
// This patch appends a small runtime override to reposition decals created by
// createDecalsForDuplicator so their centers match the placement logic used
// for the main monument. We append this to avoid editing the big source logic
// directly; it's minimal and safe to apply on load.

(function() {
    try {
        // Wait until THREE and MultiMonumentManager are available
        const applyPatch = () => {
            const mgrClass = typeof MultiMonumentManager !== 'undefined' ? MultiMonumentManager : (window && window.MultiMonumentManager ? window.MultiMonumentManager : null);
            const THREElib = (typeof THREE !== 'undefined') ? THREE : (window && window.THREE ? window.THREE : null);
            if (!mgrClass || !THREElib) {
                // retry later
                if (typeof window !== 'undefined') {
                    setTimeout(applyPatch, 200);
                }
                return;
            }

            const proto = mgrClass.prototype;
            if (!proto) return;

            const orig = proto.createDecalsForDuplicator;
            if (!orig || orig.__patched_for_decals) return;

            proto.createDecalsForDuplicator = async function(steleGroup, data) {
                const decalsGroup = await orig.call(this, steleGroup, data);

                try {
                    if (!decalsGroup || !steleGroup) return decalsGroup;

                    // Compute real model bounding box & sizes
                    steleGroup.updateWorldMatrix(true, true);
                    const boundingBox = new THREElib.Box3().setFromObject(steleGroup);
                    const centerWorld = boundingBox.getCenter(new THREElib.Vector3());
                    const size = boundingBox.getSize(new THREElib.Vector3());
                    const frontWorldZ = boundingBox.max.z + 0.016;
                    const backWorldZ = boundingBox.min.z - 0.016;

                    decalsGroup.updateWorldMatrix(true, true);

                    const worldToDecalLocal = (worldPosition) => {
                        const res = worldPosition.clone();
                        decalsGroup.worldToLocal(res);
                        return res;
                    };

                    for (const child of decalsGroup.children) {
                        if (!child || !child.userData) continue;

                        let desiredWorld = null;

                        // Name / front text
                        if (child.userData.id === 'frontText' || child.userData.textType === 'name') {
                            const offsetX = (Number(data.textOffsetX) || 0) * size.x * 0.3;
                            const offsetY = (Number(data.textOffsetY) || 0) * size.y * 0.3;
                            desiredWorld = new THREElib.Vector3(centerWorld.x + offsetX, centerWorld.y + offsetY, frontWorldZ - 0.01);
                        }

                        // Back text / epitaph
                        else if (child.userData.id === 'backText' || child.userData.textType === 'epitaph') {
                            const offsetX = (Number(data.textOffsetX) || 0) * size.x * 0.3;
                            const offsetY = (Number(data.textOffsetY) || 0) * size.y * 0.3;
                            desiredWorld = new THREElib.Vector3(centerWorld.x + offsetX, centerWorld.y + offsetY, backWorldZ + 0.01);
                        }

                        // Photo
                        else if (child.userData.id === 'photo' || child.userData.textType === 'photo') {
                            const photoOffsetX = (Number(data.photoOffsetX) || 0) * size.x * 0.5;
                            const photoOffsetY = (Number(data.photoOffsetY) || 0) * size.y * 0.5;
                            desiredWorld = new THREElib.Vector3(centerWorld.x + photoOffsetX, centerWorld.y + photoOffsetY, frontWorldZ - 0.002);
                        }

                        if (desiredWorld) {
                            try {
                                child.position.copy(worldToDecalLocal(desiredWorld));
                            } catch (err) {
                                console.warn('⚠️ Error applying decal position patch:', err);
                            }
                        }
                    }

                    // Trigger a quick render if possible
                    if (this.renderer && this.controls && typeof this.renderer.render === 'function') {
                        try { this.renderer.render(this.scene, this.controls.object); } catch (e) {}
                    }

                } catch (e) {
                    console.warn('⚠️ duplicator decals patch failed:', e);
                }

                return decalsGroup;
            };

            proto.createDecalsForDuplicator.__patched_for_decals = true;
            console.log('✅ duplicator decals patch applied');
        };

        applyPatch();
    } catch (err) {
        console.warn('⚠️ Failed to apply duplicator decals patch:', err);
    }
})();
