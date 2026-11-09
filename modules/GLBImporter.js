import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { exportObjectsToGLB, downloadBlob, sanitizeFileName } from './GLBExporter.js';
// В проекте локально присутствует OrbitControls, но TransformControls в комплект Three.js не включён.
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/TransformControls.js';

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
    constructor({ scene, camera, domElement, orbitControls, onToast }) {
        this.scene = scene;
        this.onToast = onToast || (() => {});
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

        this.transform.addEventListener('change', () => {
            if (this.renderer) this.renderer.render(this.scene, camera);
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

            const center = bounds.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.y -= bounds.min.y;
            model.position.z -= center.z;

            model.traverse(object => {
                if (!object.isMesh) return;
                object.castShadow = true;
                object.receiveShadow = true;
            });

            const pivot = new THREE.Group();
            pivot.name = file.name.replace(/\.glb$/i, '').slice(0, 100) || 'Импортированная GLB-модель';
            pivot.userData.glbImportedAsset = true;
            pivot.add(model);
            this.scene.add(pivot);

            const id = `glb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            this.assets.set(id, { id, name: file.name, pivot });
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

    select(id) {
        const item = this.assets.get(id);
        if (!item) return;
        this.activeId = id;
        this.transform.attach(item.pivot);
        const select = document.getElementById('glbImportedSelect');
        if (select) select.value = id;
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
            const baseName = sanitizeFileName(item.name.replace(/\\.glb$/i, ''));
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

    removeActive() {
        const item = this.assets.get(this.activeId);
        if (!item) {
            this.onToast('Сначала выберите импортированную модель', 'info');
            return;
        }
        this.transform.detach();
        this.scene.remove(item.pivot);
        disposeObject(item.pivot);
        this.assets.delete(item.id);
        document.querySelector(`#glbImportedSelect option[value="${CSS.escape(item.id)}"]`)?.remove();
        this.activeId = null;
        const next = this.assets.keys().next().value;
        if (next) this.select(next);
        this.onToast('Импортированная модель удалена', 'success');
    }
}
