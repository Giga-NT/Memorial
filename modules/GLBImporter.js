import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { exportObjectsToGLB, downloadBlob, sanitizeFileName } from './GLBExporter.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const MAX_GLB_SIZE = 100 * 1024 * 1024;
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

function validateBinaryGLB(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_SIZE) {
        throw new Error('Файл пустой или превышает лимит 100 МБ');
    }

    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== GLB_MAGIC) {
        throw new Error('Выбранный файл не является бинарным GLB');
    }
    if (view.getUint32(4, true) !== 2) {
        throw new Error('Поддерживается только GLB версии 2');
    }
    if (view.getUint32(8, true) !== buffer.byteLength) {
        throw new Error('Повреждён заголовок GLB: размер файла не совпадает');
    }

    let offset = 12;
    let json = null;
    while (offset + 8 <= buffer.byteLength) {
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        offset += 8;
        if (chunkLength > buffer.byteLength - offset) {
            throw new Error('Повреждён GLB: неверная длина блока');
        }
        if (chunkType === JSON_CHUNK) {
            const text = new TextDecoder().decode(new Uint8Array(buffer, offset, chunkLength)).trim();
            json = JSON.parse(text);
            break;
        }
        offset += chunkLength;
    }

    if (!json || typeof json !== 'object') {
        throw new Error('В GLB не найден JSON-блок');
    }

    const inspect = value => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
            value.forEach(inspect);
            return;
        }
        for (const [key, child] of Object.entries(value)) {
            if (key === 'uri' && typeof child === 'string' && !child.startsWith('data:')) {
                throw new Error('GLB содержит внешние файлы. Упакуйте текстуры и буферы внутрь GLB и повторите загрузку.');
            }
            inspect(child);
        }
    };
    inspect(json);
}

function disposeObject(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.filter(Boolean).forEach(material => {
            materials.add(material);
            Object.values(material).forEach(value => {
                if (value?.isTexture) textures.add(value);
            });
        });
    });

    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
}

export class GLBImportManager {
    constructor({ scene, camera, domElement, orbitControls, onToast, onActiveModel }) {
        this.scene = scene;
        this.onToast = onToast || (() => {});
        this.onActiveModel = typeof onActiveModel === 'function' ? onActiveModel : () => {};
        this.loader = new GLTFLoader();
        this.assets = new Map();
        this.activeId = null;

        this.transform = new TransformControls(camera, domElement);
        // В Three.js r160 TransformControls сам является Object3D и добавляется в сцену напрямую.
        this.helper = this.transform;
        this.helper.userData.excludeFromGLBExport = true;
        this.scene.add(this.helper);

        this.transform.addEventListener('dragging-changed', event => {
            orbitControls.enabled = !event.value;
        });

    }

    bindUI() {
        const input = document.getElementById('glbImportInput');
        document.getElementById('importGlbBtn')?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await this.loadFile(file);
        });

        document.getElementById('glbImportedSelect')?.addEventListener('change', event => {
            this.select(event.target.value);
        });
        document.getElementById('glbPartSelect')?.addEventListener('change', event => {
            this.selectPart(event.target.value);
        });
        document.getElementById('glbTranslateBtn')?.addEventListener('click', () => this.transform.setMode('translate'));
        document.getElementById('glbRotateBtn')?.addEventListener('click', () => this.transform.setMode('rotate'));
        document.getElementById('glbScaleBtn')?.addEventListener('click', () => this.transform.setMode('scale'));
        document.getElementById('glbRemoveBtn')?.addEventListener('click', () => this.removeActive());
        document.getElementById('glbExportSelectedBtn')?.addEventListener('click', () => this.exportActive());
    }

    async loadFile(file) {
        if (!/\.glb$/i.test(file.name)) {
            this.onToast('Выберите файл с расширением .glb', 'error');
            return;
        }
        if (file.size > MAX_GLB_SIZE) {
            this.onToast('Размер GLB не должен превышать 100 МБ', 'error');
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            validateBinaryGLB(buffer);
            const gltf = await new Promise((resolve, reject) => {
                this.loader.parse(buffer, '', resolve, reject);
            });

            const model = gltf.scene;
            if (!model) throw new Error('В файле не найдена 3D-сцена');

            const bounds = new THREE.Box3().setFromObject(model);
            if (bounds.isEmpty()) throw new Error('В GLB нет видимой геометрии');
            const originalSize = bounds.getSize(new THREE.Vector3());

            const center = bounds.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.y -= bounds.min.y;
            model.position.z -= center.z;

            const meshTargets = [];
            model.traverse(object => {
                if (!object.isMesh) return;
                object.castShadow = true;
                object.receiveShadow = true;
                meshTargets.push({
                    object,
                    name: object.name || `Mesh ${meshTargets.length + 1}`
                });
            });

            // GLB работает как временная замена сцены конструктора.
            // Предыдущие импортированные файлы удаляем, но исходную сцену не уничтожаем.
            this.removeAllImported(false);
            this.hideOriginalScene();

            const pivot = new THREE.Group();
            pivot.name = file.name.replace(/\.glb$/i, '').slice(0, 100) || 'Импортированная GLB-модель';
            pivot.userData.glbImportedAsset = true;
            pivot.add(model);
            this.scene.add(pivot);
            this.onActiveModel(pivot);

            const id = `glb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            this.assets.set(id, {
                id, name: file.name, pivot, meshTargets,
                modelRoot: model,
                originalSize: originalSize.clone(),
                originalModelScale: model.scale.clone()
            });
            window.calculatePrice?.();
            const select = document.getElementById('glbImportedSelect');
            if (select) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = file.name;
                select.appendChild(option);
                select.value = id;
            }
            this.select(id);
            this.onToast('GLB загружен. Используйте перемещение, вращение и масштабирование.', 'success');
        } catch (error) {
            console.error('GLB import failed:', error);
            this.onToast(error?.message || 'Не удалось загрузить GLB', 'error');
        }
    }

    applyStoneMaterial(materialKey) {
        const item = this.assets.get(this.activeId);
        if (!item) return false;
        const presets = {
            granite: { color: 0x1a1a1a, roughness: 0.2, metalness: 0.05 },
            rombak: { color: 0x090909, roughness: 0.16, metalness: 0.06 },
            black_galaxy: { color: 0x111111, roughness: 0.15, metalness: 0.08 },
            ninimyaki: { color: 0x1a2a1a, roughness: 0.25, metalness: 0.03 },
            marble: { color: 0xf5f5f5, roughness: 0.15, metalness: 0.02 },
            red_granite: { color: 0x8b0000, roughness: 0.25, metalness: 0.05 },
            beige_granite: { color: 0xd4b896, roughness: 0.2, metalness: 0.03 },
            gray_granite: { color: 0x808080, roughness: 0.2, metalness: 0.04 }
        };
        const preset = presets[materialKey];
        if (!preset) return false;
        item.modelRoot.traverse(object => {
            if (!object.isMesh || !object.material) return;
            const apply = source => {
                const material = source.clone();
                if (material.color) material.color.setHex(preset.color);
                if ('roughness' in material) material.roughness = preset.roughness;
                if ('metalness' in material) material.metalness = preset.metalness;
                material.needsUpdate = true;
                return material;
            };
            object.material = Array.isArray(object.material)
                ? object.material.map(apply)
                : apply(object.material);
        });
        return true;
    }

    applyDimensions(width, height, depth) {
        const item = this.assets.get(this.activeId);
        if (!item) return false;
        const values = [width, height, depth].map(Number);
        if (values.some(value => !Number.isFinite(value) || value <= 0)) return false;
        const size = item.originalSize;
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) return false;
        item.modelRoot.scale.set(
            item.originalModelScale.x * values[0] / size.x,
            item.originalModelScale.y * values[1] / size.y,
            item.originalModelScale.z * values[2] / size.z
        );
        item.modelRoot.updateMatrixWorld(true);
        return true;
    }

    select(id) {
        const item = this.assets.get(id);
        if (!item) return;
        this.activeId = id;
        this.transform.attach(item.pivot);
        const select = document.getElementById('glbImportedSelect');
        if (select) select.value = id;

        const partSelect = document.getElementById('glbPartSelect');
        if (partSelect) {
            partSelect.replaceChildren();
            const wholeOption = document.createElement('option');
            wholeOption.value = '__model__';
            wholeOption.textContent = 'Вся модель';
            partSelect.appendChild(wholeOption);
            item.meshTargets.forEach((target, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = target.name;
                partSelect.appendChild(option);
            });
            partSelect.value = '__model__';
        }
    }

    selectPart(value) {
        const item = this.assets.get(this.activeId);
        if (!item) return;
        if (value === '__model__') {
            this.transform.attach(item.pivot);
            return;
        }
        const index = Number(value);
        const target = Number.isInteger(index) ? item.meshTargets[index] : null;
        if (target?.object) this.transform.attach(target.object);
    }

    async exportActive() {
        const item = this.assets.get(this.activeId);
        if (!item) {
            this.onToast('Сначала выберите импортированную модель', 'info');
            return;
        }
        const button = document.getElementById('glbExportSelectedBtn');
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        }
        try {
            const result = await exportObjectsToGLB(item.pivot);
            const baseName = sanitizeFileName(item.name.replace(/\.glb$/i, ''));
            downloadBlob(result.blob, `${baseName}_edited.glb`);
            this.onToast(`Модель экспортирована: ${baseName}_edited.glb`, 'success');
        } catch (error) {
            console.error('GLB selected export failed:', error);
            this.onToast(error?.message || 'Не удалось экспортировать выбранную модель', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.removeAttribute('aria-busy');
            }
        }
    }

    hideOriginalScene() {
        if (this.sceneVisibilitySnapshot) return;
        this.sceneVisibilitySnapshot = new Map();

        this.scene.children.forEach(child => {
            if (child === this.helper || child.userData?.glbImportedAsset ||
                child.isLight || child.isCamera) return;
            this.sceneVisibilitySnapshot.set(child, child.visible);
            child.visible = false;
        });
    }

    restoreOriginalScene() {
        if (!this.sceneVisibilitySnapshot) return;
        this.sceneVisibilitySnapshot.forEach((wasVisible, object) => {
            if (object.parent === this.scene) object.visible = wasVisible;
        });
        this.sceneVisibilitySnapshot = null;
    }

    removeAllImported(restoreScene = true) {
        this.transform.detach();
        this.assets.forEach(item => {
            this.scene.remove(item.pivot);
            disposeObject(item.pivot);
        });
        this.assets.clear();
        this.activeId = null;

        const select = document.getElementById('glbImportedSelect');
        if (select) {
            select.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Нет загруженных моделей';
            select.appendChild(placeholder);
        }
        const partSelect = document.getElementById('glbPartSelect');
        if (partSelect) {
            partSelect.replaceChildren();
            const option = document.createElement('option');
            option.value = '__model__';
            option.textContent = 'Вся модель';
            partSelect.appendChild(option);
        }

        if (restoreScene) {
            this.onActiveModel(null);
            this.restoreOriginalScene();
        }
        window.calculatePrice?.();
    }

    removeActive() {
        if (!this.assets.size) {
            this.onToast('Сначала загрузите GLB-модель', 'info');
            return;
        }
        this.removeAllImported(true);
        this.onToast('Импортированная модель удалена. Исходная сцена восстановлена.', 'success');
    }
}
