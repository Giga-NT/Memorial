import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const GLB_MIME_TYPE = 'model/gltf-binary';
const DEFAULT_TEXTURE_WAIT_MS = 5000;
const DEFAULT_MAX_TEXTURE_SIZE = 4096;

function getGlobalScope() {
    return typeof window !== 'undefined' ? window : globalThis;
}

function isObject3D(value) {
    return !!value && value.isObject3D === true;
}

function isDescendantOf(object, ancestor) {
    let current = object?.parent;

    while (current) {
        if (current === ancestor) return true;
        current = current.parent;
    }

    return false;
}

function hasRenderableContent(object) {
    let found = false;

    object.traverse((child) => {
        if (
            child.isMesh ||
            child.isPoints ||
            child.isLine ||
            child.isSprite
        ) {
            found = true;
        }
    });

    return found;
}

function hasExportableContent(object) {
    if (object.isLight) return true;
    return hasRenderableContent(object);
}

export function collectProjectRoots(scene, options = {}) {
    if (!isObject3D(scene)) {
        throw new Error('3D scene is not available');
    }

    const { includeEnvironment = true } = options;
    const scope = getGlobalScope();
    const roots = [];

    const addRoot = (object) => {
        if (!isObject3D(object)) return;

        const duplicate = roots.some((root) => (
            root === object ||
            isDescendantOf(object, root) ||
            isDescendantOf(root, object)
        ));

        if (!duplicate) roots.push(object);
    };

    addRoot(scope.monumentGroup);
    addRoot(scope.multiMonumentManager?.monumentsGroup);
    addRoot(scope.vasesManager?.vasesGroup);
    addRoot(scope.furniture3DManager?.furnitureGroup);

    if (includeEnvironment) {
        scene.children.forEach((child) => {
            if (!isObject3D(child) || !child.visible) return;
            if (child.isCamera || child.isAmbientLight || child.isHemisphereLight) return;
            addRoot(child);
        });
    }

    return roots.filter((root) => (
        root.visible !== false && hasExportableContent(root)
    ));
}

function collectMaterials(object, materials) {
    if (!object?.material) return;

    if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
            if (material) materials.add(material);
        });
        return;
    }

    materials.add(object.material);
}

function collectTextures(roots) {
    const materials = new Set();
    const textures = new Set();

    roots.forEach((root) => {
        root.traverse((object) => {
            collectMaterials(object, materials);
        });
    });

    materials.forEach((material) => {
        Object.values(material).forEach((value) => {
            if (value?.isTexture) textures.add(value);
        });
    });

    return textures;
}

function waitForImage(image) {
    if (!image || image.complete !== false) {
        return Promise.resolve();
    }

    if (typeof image.addEventListener !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const finish = () => {
            image.removeEventListener('load', finish);
            image.removeEventListener('error', finish);
            resolve();
        };

        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
    });
}

async function waitForTextures(textures, timeoutMs) {
    const images = new Set();

    textures.forEach((texture) => {
        if (texture.image) images.add(texture.image);
    });

    const pending = [...images].filter((image) => (
        image &&
        image.complete === false &&
        typeof image.addEventListener === 'function'
    ));

    if (pending.length === 0) return;

    const waitAll = Promise.all(pending.map(waitForImage));

    await Promise.race([
        waitAll,
        new Promise((resolve) => {
            setTimeout(resolve, Math.max(0, timeoutMs));
        })
    ]);
}

function snapshotUserData(roots) {
    const visited = new Set();
    const entries = [];

    const save = (item) => {
        if (!item || visited.has(item) || !item.userData) return;

        visited.add(item);
        entries.push([item, item.userData]);
        item.userData = {};
    };

    roots.forEach((root) => {
        root.traverse((object) => {
            save(object);
            save(object.geometry);

            if (Array.isArray(object.material)) {
                object.material.forEach(save);
            } else {
                save(object.material);
            }
        });
    });

    return () => {
        entries.forEach(([item, userData]) => {
            item.userData = userData;
        });
    };
}

function countRenderables(roots) {
    let count = 0;

    roots.forEach((root) => {
        root.traverse((object) => {
            if (
                object.isMesh ||
                object.isPoints ||
                object.isLine ||
                object.isSprite
            ) {
                count += 1;
            }
        });
    });

    return count;
}

export function sanitizeFileName(value) {
    const safe = String(value || '')
        .normalize('NFKC')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 80);

    return safe || 'monument';
}

export function buildGLBFileName(projectName, date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    const stamp = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-');
    const time = [
        pad(date.getHours()),
        pad(date.getMinutes())
    ].join('-');

    return `${sanitizeFileName(projectName)}_${stamp}_${time}.glb`;
}

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );
    const value = bytes / (1024 ** index);

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export async function exportObjectsToGLB(objects, options = {}) {
    const roots = (Array.isArray(objects) ? objects : [objects])
        .filter(isObject3D);

    if (roots.length === 0) {
        throw new Error('No 3D objects selected for export');
    }

    if (!roots.some(hasRenderableContent)) {
        throw new Error('No renderable objects selected for export');
    }

    const {
        maxTextureSize = DEFAULT_MAX_TEXTURE_SIZE,
        textureWaitMs = DEFAULT_TEXTURE_WAIT_MS
    } = options;

    const textures = collectTextures(roots);

    await waitForTextures(textures, textureWaitMs);

    roots.forEach((root) => {
        root.updateWorldMatrix(true, true);
    });

    const restoreUserData = snapshotUserData(roots);
    const exporter = new GLTFExporter();
    let data;

    try {
        data = await exporter.parseAsync(roots, {
            binary: true,
            trs: true,
            onlyVisible: true,
            maxTextureSize,
            animations: [],
            includeCustomExtensions: false
        });
    } finally {
        restoreUserData();
    }

    if (!(data instanceof ArrayBuffer)) {
        throw new Error('GLTF exporter returned an unsupported result');
    }

    return {
        blob: new Blob([data], { type: GLB_MIME_TYPE }),
        byteLength: data.byteLength,
        meshCount: countRenderables(roots),
        textureCount: textures.size
    };
}

export async function exportProjectToGLB(options = {}) {
    const scope = getGlobalScope();
    const scene = options.scene || scope.scene;
    const state = options.state || scope.state;
    const roots = collectProjectRoots(scene, {
        includeEnvironment: options.includeEnvironment !== false
    });

    const result = await exportObjectsToGLB(roots, options);

    return {
        ...result,
        fileName: options.fileName || buildGLBFileName(state?.projectName)
    };
}

export function downloadBlob(blob, fileName) {
    const scope = getGlobalScope();
    const documentRef = scope.document;

    if (!documentRef || !scope.URL?.createObjectURL) {
        throw new Error('File download is not available in this environment');
    }

    const url = scope.URL.createObjectURL(blob);
    const link = documentRef.createElement('a');
    const parent = documentRef.body || documentRef.documentElement;

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    parent.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        scope.URL.revokeObjectURL(url);
    }, 2000);
}

export async function downloadProjectAsGLB(options = {}) {
    const result = await exportProjectToGLB(options);

    downloadBlob(result.blob, result.fileName);

    return result;
}
