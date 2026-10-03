import * as THREE from 'three';

import {
    loadPBRMaterial,
    getTextureTypeFromMaterial
} from './textures.min.js';

// ============================================================
// АВТОМАТИЧЕСКИЕ РАЗМЕРЫ ТУМБЫ
// ============================================================

// Минимальная высота тумбы — 120 мм
const MIN_PEDESTAL_HEIGHT = 0.12;

// Минимальная глубина тумбы — 150 мм
const MIN_PEDESTAL_DEPTH = 0.15;

// Тумба шире стелы на 10% с каждой стороны
const SIDE_MARGIN_RATIO = 0.10;

// Глубина тумбы относительно толщины стелы
const DEPTH_RATIO = 1.875;


export async function createStelePedestal(
    steleObj,
    params = {}
) {

    if (!steleObj) {
        return null;
    }

    const baseHeight =
        Number(params.baseHeight) || 0;

    // ============================================================
    // ОПРЕДЕЛЯЕМ РЕАЛЬНЫЕ РАЗМЕРЫ СТЕЛЫ
    // ============================================================

    const box =
        new THREE.Box3()
            .setFromObject(steleObj);

    if (box.isEmpty()) {
        console.warn(
            '⚠️ Не удалось определить размеры стелы'
        );

        return null;
    }

    const size =
        box.getSize(
            new THREE.Vector3()
        );

    const center =
        box.getCenter(
            new THREE.Vector3()
        );

    // ============================================================
    // АВТОМАТИЧЕСКАЯ ВЫСОТА ТУМБЫ
    // ============================================================

    const pedestalHeight =
        Number(params.stelePedestalHeight) ||
        Math.max(
            MIN_PEDESTAL_HEIGHT,
            size.y * 0.10
        );

    // ============================================================
    // АВТОМАТИЧЕСКИЙ БОКОВОЙ ЗАПАС
    // ============================================================

    const sideMargin =
        Number(params.stelePedestalSideMargin) ||
        size.x * SIDE_MARGIN_RATIO;

    // ============================================================
    // ШИРИНА ТУМБЫ
    // ============================================================

    const pedestalWidth =
        size.x +
        sideMargin * 2;

    // ============================================================
    // АВТОМАТИЧЕСКАЯ ГЛУБИНА ТУМБЫ
    // ============================================================

    const pedestalDepth =
        Number(params.stelePedestalDepth) ||
        Math.max(
            MIN_PEDESTAL_DEPTH,
            size.z * DEPTH_RATIO
        );

    // ============================================================
    // ГЕОМЕТРИЯ ТУМБЫ
    // ============================================================

    const geometry =
        new THREE.BoxGeometry(
            pedestalWidth,
            pedestalHeight,
            pedestalDepth
        );

    // ============================================================
    // МАТЕРИАЛ ТУМБЫ
    // ============================================================

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

    // ============================================================
    // СОЗДАЁМ ТУМБУ
    // ============================================================

    const pedestal =
        new THREE.Mesh(
            geometry,
            material
        );

    pedestal.name =
        'stelePedestal';

    pedestal.userData.isStelePedestal =
        true;

    // ============================================================
    // ПОЗИЦИЯ ТУМБЫ
    // ============================================================

    pedestal.position.set(
        center.x,
        baseHeight +
        pedestalHeight / 2,
        center.z + 0.015
    );

    pedestal.castShadow = true;
    pedestal.receiveShadow = true;

    // ============================================================
    // ОТЛАДКА РАЗМЕРОВ
    // ============================================================

    console.log(
        '🎨 Тумба:',
        params.material
    );

    console.log(
        '📐 Размеры стелы:',
        {
            width: size.x,
            height: size.y,
            depth: size.z
        }
    );

    console.log(
        '📐 Размеры тумбы:',
        {
            width: pedestalWidth,
            height: pedestalHeight,
            depth: pedestalDepth
        }
    );

    return pedestal;
}

