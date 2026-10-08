import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const MODEL_LIST_URL = './models/graveSlabs/grave-slabs.json';
const MODEL_BASE_PATH = './models/graveSlabs/';

let models = [];
let modelsLoaded = false;

const modelCache = new Map();

/**
 * Загружает список моделей плит из JSON.
 */
export async function loadGraveSlabModelList() {
    if (modelsLoaded) {
        return models;
    }

    try {
        const response = await fetch(MODEL_LIST_URL, {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(
                `Не удалось загрузить ${MODEL_LIST_URL}: HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data.models)) {
            throw new Error('В grave-slabs.json отсутствует массив models');
        }

        models = data.models.map(model => ({
            ...model,

            path: `${MODEL_BASE_PATH}${model.file}`,

            previewPath: model.preview
                ? `${MODEL_BASE_PATH}${model.preview}`
                : null,

            width: Number(model.width) || 0.6,
            length: Number(model.length) || 0.9,
            thickness: Number(model.thickness) || 0.06,

            modelType: model.modelType || 'horizontal',

            defaultMaterial: model.defaultMaterial || 'granite'
        }));

        modelsLoaded = true;

        console.log(
            `✅ Загружено моделей надгробных плит: ${models.length}`
        );

        return models;
    } catch (error) {
        console.error(
            '❌ Ошибка загрузки списка моделей надгробных плит:',
            error
        );

        models = [];
        modelsLoaded = false;

        return [];
    }
}

/**
 * Возвращает список моделей.
 */
export function getGraveSlabModelList() {
    return models;
}

/**
 * Возвращает описание конкретной модели.
 */
export function getGraveSlabModel(modelId) {
    return models.find(model => model.id === modelId) || null;
}

/**
 * Возвращает URL превью.
 */
export function getGraveSlabPreviewUrl(modelId) {
    const model = getGraveSlabModel(modelId);

    return model?.previewPath || null;
}

/**
 * Загружает GLB модели.
 */
export async function loadGraveSlabModel(modelId) {
    const modelInfo = getGraveSlabModel(modelId);

    if (!modelInfo) {
        console.error(
            `❌ Модель надгробной плиты "${modelId}" не найдена в JSON`
        );

        return null;
    }

    if (modelCache.has(modelId)) {
        return cloneModel(modelCache.get(modelId));
    }

    try {
        console.log(
            `📦 Загрузка модели надгробной плиты: ${modelInfo.file}`
        );

        const gltf = await loader.loadAsync(modelInfo.path);

        const root = gltf.scene;

        if (!root) {
            throw new Error('GLB не содержит scene');
        }

        root.traverse(object => {
            if (!object.isMesh) {
                return;
            }

            object.castShadow = true;
            object.receiveShadow = true;
        });

        modelCache.set(modelId, root);

        console.log(
            `✅ Модель надгробной плиты загружена: ${modelId}`
        );

        return cloneModel(root);
    } catch (error) {
        console.error(
            `❌ Ошибка загрузки GLB "${modelInfo.file}":`,
            error
        );

        return null;
    }
}

/**
 * Клонирование загруженной модели.
 */
function cloneModel(source) {
    const clone = source.clone(true);

    clone.traverse(object => {
        if (!object.isMesh) {
            return;
        }

        if (object.geometry) {
            object.geometry = object.geometry.clone();
        }

        if (Array.isArray(object.material)) {
            object.material = object.material.map(material =>
                material?.clone ? material.clone() : material
            );
        } else if (object.material?.clone) {
            object.material = object.material.clone();
        }

        object.castShadow = true;
        object.receiveShadow = true;
    });

    return clone;
}

/**
 * Рассчитывает реальные размеры модели по bounding box.
 */
export function getModelDimensions(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();

    box.getSize(size);

    return {
        width: size.x,
        height: size.y,
        length: size.z
    };
}

/**
 * Масштабирует GLB под размеры,
 * указанные в JSON.
 *
 * width  -> X
 * thickness -> Y
 * length -> Z
 */
export function fitGraveSlabToDimensions(
    object,
    {
        width,
        thickness,
        length
    }
) {
    const dimensions = getModelDimensions(object);

    if (
        dimensions.width <= 0 ||
        dimensions.height <= 0 ||
        dimensions.length <= 0
    ) {
        console.warn(
            '⚠️ Невозможно определить размеры модели плиты'
        );

        return object;
    }

    const scaleX = width / dimensions.width;
    const scaleY = thickness / dimensions.height;
    const scaleZ = length / dimensions.length;

    object.scale.set(
        scaleX,
        scaleY,
        scaleZ
    );

    return object;
}

/**
 * Поднимает модель так,
 * чтобы её нижняя точка оказалась на Y=0.
 */
export function placeOnGround(object) {
    const box = new THREE.Box3().setFromObject(object);

    if (!Number.isFinite(box.min.y)) {
        return object;
    }

    object.position.y -= box.min.y;

    return object;
}

/**
 * Очистить кэш моделей.
 */
export function clearGraveSlabModelCache() {
    modelCache.clear();
}

/**
 * Полностью перезагрузить JSON.
 */
export async function reloadGraveSlabModelList() {
    modelsLoaded = false;
    models = [];
    clearGraveSlabModelCache();

    return loadGraveSlabModelList();
}