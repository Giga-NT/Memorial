import * as THREE from 'three';
import {
    loadPBRMaterial,
    getTextureTypeFromMaterial,
    loadFlowerbedTexture
} from './textures.min.js';
import { getSiteSurfaceProfile } from './siteSurfaceProfiles.js';

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ТЕКСТУР
// ============================================================

function drawJointWithShadow(
    ctx,
    x1,
    y1,
    x2,
    y2,
    color,
    shadowColor,
    width,
    shadowOffset = 1
) {
    // --------------------------------------------------------
    // ТЕНЬ ШВА
    // --------------------------------------------------------

    ctx.save();

    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.55;

    ctx.beginPath();
    ctx.moveTo(
        x1 + shadowOffset,
        y1 + shadowOffset
    );
    ctx.lineTo(
        x2 + shadowOffset,
        y2 + shadowOffset
    );
    ctx.stroke();

    // --------------------------------------------------------
    // ОСНОВНОЙ ШОВ
    // --------------------------------------------------------

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
}

function addLightNoise(ctx, width, height) {
    const isMobile = window.innerWidth < 768;

    const imageData =
        ctx.getImageData(
            0,
            0,
            width,
            height
        );

    const data = imageData.data;

    const intensity =
        isMobile ? 4 : 6;

    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {
        const noise =
            (Math.random() - 0.5) *
            intensity;

        data[i] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i] + noise
                )
            );

        data[i + 1] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i + 1] + noise
                )
            );

        data[i + 2] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i + 2] + noise
                )
            );
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );
}

function addStoneTextureToCanvas(
    ctx,
    width,
    height
) {
    const isMobile =
        window.innerWidth < 768;

    const imageData =
        ctx.getImageData(
            0,
            0,
            width,
            height
        );

    const data =
        imageData.data;

    const intensity =
        isMobile ? 12 : 15;

    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {
        const noise1 =
            (Math.random() - 0.5) *
            intensity;

        const grainX =
            Math.floor(
                Math.random() * 10
            );

        const grainY =
            Math.floor(
                Math.random() * 10
            );

        const grainNoise =
            (grainX + grainY) / 20 - 0.5;

        const totalNoise =
            noise1 +
            grainNoise * 20;

        data[i] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i] + totalNoise
                )
            );

        data[i + 1] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i + 1] + totalNoise
                )
            );

        data[i + 2] =
            Math.max(
                0,
                Math.min(
                    255,
                    data[i + 2] + totalNoise
                )
            );
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУРЫ ДЛЯ ОСНОВАНИЯ
// ============================================================

export async function createUnifiedTextureWithJoints(
    graveWidth,
    graveLength,
    height,
    materialType,
    flowerWidth,
    flowerLength
) {
    const isMobile =
        window.innerWidth < 768;

    // --------------------------------------------------------
    // РАЗРЕШЕНИЕ ТЕКСТУРЫ
    // --------------------------------------------------------

    const texWidth =
        isMobile ? 1024 : 4096;

    const texHeight =
        isMobile ? 1024 : 4096;

    const canvas =
        document.createElement('canvas');

    canvas.width =
        texWidth;

    canvas.height =
        texHeight;

    const ctx =
        canvas.getContext(
            '2d',
            {
                willReadFrequently: true
            }
        );

    // ========================================================
    // ⭐ БАЗОВАЯ ТЕКСТУРА КАМНЯ
    // ========================================================

    let baseImage = null;

    try {
        const textureType =
            getTextureTypeFromMaterial(
                materialType
            );

        const pbrMaterial =
            await loadPBRMaterial(
                textureType
            );

        if (
            pbrMaterial &&
            pbrMaterial.map &&
            pbrMaterial.map.image
        ) {
            baseImage =
                pbrMaterial.map.image;
        }

    } catch (e) {
        // Используем fallback-цвет ниже
    }

    // ========================================================
    // ⭐ РИСУЕМ БАЗОВУЮ ТЕКСТУРУ
    // ========================================================

    if (baseImage) {

        ctx.drawImage(
            baseImage,
            0,
            0,
            texWidth,
            texHeight
        );

        addLightNoise(
            ctx,
            texWidth,
            texHeight
        );

    } else {

        const materialColors = {
            granite: '#1a1a1a',
            black_galaxy: '#111111',
            ninimyaki: '#1a2a1a',
            marble: '#e8e8e8',
            red_granite: '#8b0000',
            beige_granite: '#d4b896',
            gray_granite: '#808080',
        };

        ctx.fillStyle =
            materialColors[materialType] ||
            '#1a1a1a';

        ctx.fillRect(
            0,
            0,
            texWidth,
            texHeight
        );

        addStoneTextureToCanvas(
            ctx,
            texWidth,
            texHeight
        );
    }

    // ========================================================
    // ⭐ РАЗМЕР ПЛИТКИ
    // ========================================================

    const TILE_WIDTH = 0.3;
    const TILE_HEIGHT = 0.3;

    // ========================================================
    // ⭐ ОПРЕДЕЛЯЕМ СРЕДНЮЮ ЯРКОСТЬ
    // ========================================================

    let avgBrightness = 0.5;

    try {

        const imageData =
            ctx.getImageData(
                0,
                0,
                100,
                100
            );

        const data =
            imageData.data;

        let sum = 0;

        for (
            let i = 0;
            i < data.length;
            i += 4
        ) {
            const brightness =
                data[i] * 0.299 +
                data[i + 1] * 0.587 +
                data[i + 2] * 0.114;

            sum += brightness;
        }

        avgBrightness =
            sum /
            (data.length / 4) /
            255;

    } catch (e) {}

    // ========================================================
    // ⭐ ЦВЕТ ШВА
    // ========================================================

    let jointColor;
    let jointShadow;

    if (avgBrightness > 0.5) {

        jointColor = '#333333';
        jointShadow = '#666666';

    } else {

        jointColor = '#cccccc';
        jointShadow = '#777777';
    }

    // ========================================================
    // ⭐ ПЕРЕВОД МЕТРОВ В ПИКСЕЛИ
    // ========================================================

    const scaleX =
        texWidth /
        graveWidth;

    const scaleY =
        texHeight /
        graveLength;

    // ========================================================
    // ⭐ РЕАЛЬНАЯ ТОЛЩИНА ШВА
    //
    // 2 мм = физический размер шва
    //
    // 1 мм = 0.001 м
    // 2 мм = 0.002 м
    // 3 мм = 0.003 м
    // ========================================================

    const JOINT_WIDTH_MM = 2;

    const jointWidthX =
        Math.max(
            1,
            Math.round(
                scaleX *
                (JOINT_WIDTH_MM / 1000)
            )
        );

    const jointWidthY =
        Math.max(
            1,
            Math.round(
                scaleY *
                (JOINT_WIDTH_MM / 1000)
            )
        );

    // --------------------------------------------------------
    // Для одинаковой визуальной толщины используем
    // максимальное значение.
    // --------------------------------------------------------

    const jointWidth =
        Math.max(
            jointWidthX,
            jointWidthY
        );

    // --------------------------------------------------------
    // Небольшая тень рядом со швом
    // --------------------------------------------------------

    const jointShadowOffset =
        Math.max(
            1,
            Math.round(
                jointWidth * 0.35
            )
        );

    console.log(
        '🧱 Швы основания:',
        {
            widthMm: JOINT_WIDTH_MM,
            pixelsX: jointWidthX,
            pixelsY: jointWidthY,
            finalPixels: jointWidth,
            shadowPixels: jointShadowOffset
        }
    );

    // ========================================================
    // ⭐ ЗОНА ЦВЕТНИКА
    // ========================================================

    let flowerLeft = 0;
    let flowerRight = 0;
    let flowerTop = 0;
    let flowerBottom = 0;

    const hasFlower =
        flowerWidth > 0 &&
        flowerLength > 0;

    if (hasFlower) {

        const halfW =
            flowerWidth / 2;

        const halfL =
            flowerLength / 2;

        flowerLeft =
            (-halfW) *
            scaleX +
            texWidth / 2;

        flowerRight =
            (halfW) *
            scaleX +
            texWidth / 2;

        flowerTop =
            (-halfL) *
            scaleY +
            texHeight / 2;

        flowerBottom =
            (halfL) *
            scaleY +
            texHeight / 2;
    }

    // ========================================================
    // ⭐ ВЕРТИКАЛЬНЫЕ ШВЫ
    // ========================================================

    const cols =
        Math.ceil(
            graveWidth /
            TILE_WIDTH
        );

    for (
        let col = 1;
        col < cols;
        col++
    ) {

        const x =
            (
                col * TILE_WIDTH -
                graveWidth / 2
            ) *
            scaleX +
            texWidth / 2;

        const inFlowerZone =
            hasFlower &&
            x > flowerLeft &&
            x < flowerRight;

        if (!inFlowerZone) {

            drawJointWithShadow(
                ctx,
                x,
                0,
                x,
                texHeight,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );

        } else {

            drawJointWithShadow(
                ctx,
                x,
                0,
                x,
                flowerTop,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );

            drawJointWithShadow(
                ctx,
                x,
                flowerBottom,
                x,
                texHeight,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );
        }
    }

    // ========================================================
    // ⭐ ГОРИЗОНТАЛЬНЫЕ ШВЫ
    // ========================================================

    const rows =
        Math.ceil(
            graveLength /
            TILE_HEIGHT
        );

    for (
        let row = 1;
        row < rows;
        row++
    ) {

        const y =
            (
                row * TILE_HEIGHT -
                graveLength / 2
            ) *
            scaleY +
            texHeight / 2;

        const inFlowerZone =
            hasFlower &&
            y > flowerTop &&
            y < flowerBottom;

        if (!inFlowerZone) {

            drawJointWithShadow(
                ctx,
                0,
                y,
                texWidth,
                y,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );

        } else {

            drawJointWithShadow(
                ctx,
                0,
                y,
                flowerLeft,
                y,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );

            drawJointWithShadow(
                ctx,
                flowerRight,
                y,
                texWidth,
                y,
                jointColor,
                jointShadow,
                jointWidth,
                jointShadowOffset
            );
        }
    }

    // ========================================================
    // ⭐ ВНЕШНЯЯ РАМКА
    // ========================================================

    ctx.save();

    ctx.strokeStyle =
        jointColor;

    ctx.lineWidth =
        Math.max(
            jointWidth,
            isMobile ? 4 : 6
        );

    ctx.beginPath();

    ctx.moveTo(
        3,
        3
    );

    if (hasFlower) {

        ctx.lineTo(
            flowerLeft,
            3
        );

        ctx.moveTo(
            flowerRight,
            3
        );

        ctx.lineTo(
            texWidth - 3,
            3
        );

    } else {

        ctx.lineTo(
            texWidth - 3,
            3
        );
    }

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        3,
        texHeight - 3
    );

    if (hasFlower) {

        ctx.lineTo(
            flowerLeft,
            texHeight - 3
        );

        ctx.moveTo(
            flowerRight,
            texHeight - 3
        );

        ctx.lineTo(
            texWidth - 3,
            texHeight - 3
        );

    } else {

        ctx.lineTo(
            texWidth - 3,
            texHeight - 3
        );
    }

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        3,
        3
    );

    if (hasFlower) {

        ctx.lineTo(
            3,
            flowerTop
        );

        ctx.moveTo(
            3,
            flowerBottom
        );

        ctx.lineTo(
            3,
            texHeight - 3
        );

    } else {

        ctx.lineTo(
            3,
            texHeight - 3
        );
    }

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        texWidth - 3,
        3
    );

    if (hasFlower) {

        ctx.lineTo(
            texWidth - 3,
            flowerTop
        );

        ctx.moveTo(
            texWidth - 3,
            flowerBottom
        );

        ctx.lineTo(
            texWidth - 3,
            texHeight - 3
        );

    } else {

        ctx.lineTo(
            texWidth - 3,
            texHeight - 3
        );
    }

    ctx.stroke();

    ctx.restore();

    // ========================================================
    // ⭐ THREE.JS TEXTURE
    // ========================================================

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.wrapS =
        THREE.RepeatWrapping;

    texture.wrapT =
        THREE.RepeatWrapping;

    texture.repeat.set(
        1,
        1
    );

    // ========================================================
    // ⭐ НЕ РАЗМЫВАЕМ ШВЫ MIPMAP'АМИ
    // ========================================================

    texture.minFilter =
        THREE.LinearFilter;

    texture.magFilter =
        THREE.LinearFilter;

    texture.generateMipmaps =
        false;

    texture.anisotropy =
        isMobile ? 1 : 8;

    texture.needsUpdate =
        true;

    return texture;
}

// ============================================================
// ⭐ СОЗДАНИЕ ТЕКСТУРЫ БРУСЧАТКИ
// ============================================================

export function createPavingTexture(
    tileSize,
    tileType,
    jointColor,
    layout = 'brick'
) {
    const isMobile =
        window.innerWidth < 768;

    const texSize =
        isMobile ? 256 : 512;

    const cells =
        8;

    const cellPx =
        texSize / cells;

    const tileColors = {
        tile_black: '#2a2a2a',
        tile_gray: '#8a8a8a',
        tile_beige: '#c4b89a',
        tile_dark: '#3a3a3a',
        tile_light: '#c8c8c8',
        tile_marble: '#e8e8e0',
        tile_red: '#8b2a2a',
        tile_brown: '#6b4a3a',
        tile_blue: '#3a5a7a',
        tile_green: '#4a7a4a',
    };

    const baseColor =
        new THREE.Color(
            tileColors[tileType] ||
            '#8a8a8a'
        );

    const toSrgb255 = (
        value
    ) => {
        const v =
            Math.max(0, Math.min(1, value));

        const s =
            v <= 0.0031308
                ? v * 12.92
                : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

        return Math.round(s * 255);
    };

    const joint =
        jointColor ||
        '#666666';

    const layoutKey =
        ['straight', 'brick', 'diagonal', 'herringbone'].includes(layout)
            ? layout
            : 'brick';

    const elementSize =
        Number(tileSize) > 0
            ? Number(tileSize)
            : 0.3;

    const periods =
        6;

    let spanX;
    let spanY;

    if (layoutKey === 'straight') {
        spanX = spanY = cells * elementSize;
    } else if (layoutKey === 'diagonal') {
        spanX = spanY = periods * elementSize * Math.SQRT2;
    } else {
        spanX = spanY = cells * elementSize / 2;
    }

    const jointPx =
        Math.max(
            1,
            Math.round(
                0.008 * texSize / spanX
            )
        );

    const cornerPx =
        Math.max(
            0.5,
            Math.min(
                isMobile ? 1.5 : 2,
                jointPx * 0.6
            )
        );

    const canvas =
        document.createElement('canvas');

    canvas.width =
        texSize;

    canvas.height =
        texSize;

    const ctx =
        canvas.getContext(
            '2d',
            { willReadFrequently: true }
        );

    ctx.fillStyle =
        joint;

    ctx.fillRect(
        0,
        0,
        texSize,
        texSize
    );

    const brightnessFor = (
        a,
        b
    ) => {
        const hash =
            Math.sin(
                a * 127.1 +
                b * 311.7
            ) * 43758.5453;

        return 0.85 +
            (hash - Math.floor(hash)) *
            0.28;
    };

    const paintStone = (
        x,
        y,
        width,
        height,
        brightness
    ) => {
        if (width <= 0 || height <= 0) {
            return;
        }

        const radius =
            Math.min(
                cornerPx,
                width / 2,
                height / 2
            );

        const r =
            toSrgb255(baseColor.r * brightness);

        const g =
            toSrgb255(baseColor.g * brightness);

        const b =
            toSrgb255(baseColor.b * brightness);

        ctx.beginPath();

        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        ctx.fillStyle =
            `rgb(${r}, ${g}, ${b})`;

        ctx.fill();
    };

    const paintCell = (
        cellX,
        cellY,
        cellW,
        cellH
    ) => {
        const a =
            ((cellX % cells) + cells) % cells;

        const b =
            ((cellY % cells) + cells) % cells;

        paintStone(
            cellX * cellPx + jointPx / 2,
            cellY * cellPx + jointPx / 2,
            cellW * cellPx - jointPx,
            cellH * cellPx - jointPx,
            brightnessFor(a, b)
        );
    };

    if (layoutKey === 'straight') {

        for (let row = 0; row < cells; row++) {
            for (let col = 0; col < cells; col++) {
                paintCell(col, row, 1, 1);
            }
        }

    } else if (layoutKey === 'diagonal') {

        const diamondPx =
            texSize / (periods * Math.SQRT2);

        const range =
            periods + 4;

        ctx.save();
        ctx.translate(texSize / 2, texSize / 2);
        ctx.rotate(Math.PI / 4);

        for (let i = -range; i <= range; i++) {
            for (let j = -range; j <= range; j++) {
                const a =
                    ((i % periods) + periods) % periods;

                const b =
                    ((j % periods) + periods) % periods;

                paintStone(
                    i * diamondPx + jointPx / 2,
                    j * diamondPx + jointPx / 2,
                    diamondPx - jointPx,
                    diamondPx - jointPx,
                    brightnessFor(a, b)
                );
            }
        }

        ctx.restore();

    } else if (layoutKey === 'herringbone') {

        const period =
            4;

        for (let row = -period; row < cells + period; row++) {

            let start =
                -period * 2;

            start -=
                ((start + row) % period + period) % period;

            for (let x = start; x < cells + period * 2; x += period) {
                paintCell(x, row, 2, 1);
                paintCell(x + 2, row, 1, 2);
            }
        }

    } else {

        for (let row = 0; row < cells; row++) {

            const offset =
                (row % 2) * cellPx;

            for (let col = -2; col < cells + 2; col += 2) {
                paintStone(
                    col * cellPx + offset + jointPx / 2,
                    row * cellPx + jointPx / 2,
                    cellPx * 2 - jointPx,
                    cellPx - jointPx,
                    brightnessFor(
                        ((col % cells) + cells) % cells,
                        row % cells
                    )
                );
            }
        }
    }

    try {

        const image =
            ctx.getImageData(0, 0, texSize, texSize);

        const data =
            image.data;

        const strength =
            isMobile ? 10 : 14;

        for (let i = 0; i < data.length; i += 4) {

            const grain =
                (Math.random() - 0.5) * strength;

            data[i] =
                Math.max(0, Math.min(255, data[i] + grain));

            data[i + 1] =
                Math.max(0, Math.min(255, data[i + 1] + grain));

            data[i + 2] =
                Math.max(0, Math.min(255, data[i + 2] + grain));
        }

        ctx.putImageData(image, 0, 0);

    } catch (error) {
    }

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.colorSpace =
        THREE.SRGBColorSpace;

    texture.minFilter =
        THREE.LinearFilter;

    texture.magFilter =
        THREE.LinearFilter;

    texture.generateMipmaps =
        false;

    texture.anisotropy =
        isMobile ? 1 : 2;

    texture.userData = {
        spanX,
        spanY,
        layout: layoutKey
    };

    texture.needsUpdate =
        true;

    return Promise.resolve(texture);
}

// ============================================================
// ⭐ ШУМ КАМНЯ ДЛЯ ПЛИТКИ
// ============================================================

function addStoneNoiseToTile(
    ctx,
    x,
    y,
    w,
    h
) {
    if (
        w < 2 ||
        h < 2
    ) {
        return;
    }

    try {

        let imageData;

        try {

            imageData =
                ctx.getImageData(
                    Math.round(x),
                    Math.round(y),
                    Math.round(w),
                    Math.round(h),
                    {
                        willReadFrequently:
                            true
                    }
                );

        } catch (e) {

            imageData =
                ctx.getImageData(
                    Math.round(x),
                    Math.round(y),
                    Math.round(w),
                    Math.round(h)
                );
        }

        const data =
            imageData.data;

        const intensity =
            window.innerWidth < 768
                ? 6
                : 10;

        for (
            let i = 0;
            i < data.length;
            i += 4
        ) {

            const noise =
                (Math.random() - 0.5) *
                intensity;

            data[i] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i] + noise
                    )
                );

            data[i + 1] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i + 1] + noise
                    )
                );

            data[i + 2] =
                Math.max(
                    0,
                    Math.min(
                        255,
                        data[i + 2] + noise
                    )
                );
        }

        ctx.putImageData(
            imageData,
            Math.round(x),
            Math.round(y)
        );

    } catch (e) {}
}

// ============================================================
// ⭐ СОЗДАНИЕ ДОРОЖКИ
// ============================================================

export async function createPathBetweenGraveAndFence(
    params
) {
    const {
        pathEnabled,
        pathWidth,
        pathMaterial,
        pathSurfaceType = 'paver',
        pathTileSize,
        pathJointColor,
        pathTileLayout,
        fenceWidth,
        fenceLength
    } = params;

    if (!pathEnabled) {
        return null;
    }

    const totalWidth =
        fenceWidth || 1.5;

    const totalLength =
        fenceLength || 2.5;

    const extra =
        0.01;

    const outerHalfW =
        totalWidth / 2 +
        extra;

    const outerHalfL =
        totalLength / 2 +
        extra;

    const shape =
        new THREE.Shape();

    shape.moveTo(
        -outerHalfW,
        -outerHalfL
    );

    shape.lineTo(
        outerHalfW,
        -outerHalfL
    );

    shape.lineTo(
        outerHalfW,
        outerHalfL
    );

    shape.lineTo(
        -outerHalfW,
        outerHalfL
    );

    shape.closePath();

    const profile = getSiteSurfaceProfile(pathMaterial, pathSurfaceType);
    const topThickness = profile.top.thickness;

    const isTile =
        pathMaterial &&
        pathMaterial.startsWith(
            'tile_'
        );

    const tileStep =
        pathTileSize || 0.3;

    const pavingLayout =
        pathTileLayout || 'brick';

    let pavingTexture = null;

    if (isTile) {
        pavingTexture =
            await createPavingTexture(
                tileStep,
                pathMaterial,
                pathJointColor ||
                    '#666666',
                pavingLayout
            );
    }

    const pavingSpanX =
        pavingTexture &&
        pavingTexture.userData &&
        pavingTexture.userData.spanX
            ? pavingTexture.userData.spanX
            : tileStep;

    const pavingSpanY =
        pavingTexture &&
        pavingTexture.userData &&
        pavingTexture.userData.spanY
            ? pavingTexture.userData.spanY
            : tileStep;

    const repeatX =
        totalWidth /
        pavingSpanX;

    const repeatY =
        totalLength /
        pavingSpanY;

    // Extruded surface gives paving/gravel a real, measurable thickness.
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: topThickness,
        bevelEnabled: false,
        curveSegments: 1
    });

    const pos =
        geometry.attributes.position;

    const uv =
        geometry.attributes.uv;

    if (
        pos &&
        uv
    ) {

        const normal =
            geometry.attributes.normal;

        let minX = Infinity;
        let minY = Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;

        for (
            let i = 0;
            i < pos.count;
            i++
        ) {

            const x =
                pos.getX(i);

            const y =
                pos.getY(i);

            if (x < minX) {
                minX = x;
            }

            if (x > maxX) {
                maxX = x;
            }

            if (y < minY) {
                minY = y;
            }

            if (y > maxY) {
                maxY = y;
            }
        }

        const rangeX =
            maxX - minX;

        const rangeY =
            maxY - minY;

        if (
            rangeX > 0 &&
            rangeY > 0
        ) {

            // Sample the tile texture inside a single paving row on the
            // side walls, so the top joints continue down the exposed
            // edges instead of looking like a solid cast slab.
            const sideV0 =
                0.42;

            const sideV1 =
                0.46;

            for (
                let i = 0;
                i < pos.count;
                i++
            ) {

                const x =
                    pos.getX(i);

                const y =
                    pos.getY(i);

                const nx =
                    normal ? normal.getX(i) : 0;

                const ny =
                    normal ? normal.getY(i) : 0;

                const nz =
                    normal ? normal.getZ(i) : 1;

                const isCap =
                    Math.abs(nz) >
                    Math.abs(nx) &&
                    Math.abs(nz) >
                    Math.abs(ny);

                if (!isTile || isCap) {

                    uv.setXY(
                        i,
                        (x - minX) /
                            rangeX,
                        (y - minY) /
                            rangeY
                    );

                    continue;
                }

                const runsAlongY =
                    Math.abs(nx) >
                    Math.abs(ny);

                const along =
                    runsAlongY
                        ? (y - minY) /
                            rangeY
                        : (x - minX) /
                            rangeX;

                const z =
                    pos.getZ(i);

                const heightRatio =
                    topThickness > 0
                        ? Math.min(
                            1,
                            Math.max(
                                0,
                                z / topThickness
                            )
                        )
                        : 0;

                uv.setXY(
                    i,
                    along *
                        (runsAlongY
                            ? repeatY / repeatX
                            : 1),
                    (sideV0 +
                        (sideV1 - sideV0) *
                            heightRatio) /
                        repeatY
                );
            }

            uv.needsUpdate =
                true;
        }
    }

    let material;

    if (isTile) {

        const texture =
            pavingTexture;

        if (texture) {

            texture.wrapS =
                THREE.RepeatWrapping;

            texture.wrapT =
                THREE.RepeatWrapping;

            texture.repeat.set(
                repeatX,
                repeatY
            );
        }

        material =
            new THREE.MeshStandardMaterial({
                map: texture || null,
                roughness: 0.6,
                metalness: 0.05,
                side: THREE.DoubleSide,
            });

    } else {

        const fallbackColors = {
            gravel: 0x888888,
            grass: 0x4caf50,
            sand: 0xf4e4a0,
            marble_chips: 0xf5f5f5,
            flowers: 0x7cb342,
        };

        let texture = null;

        if (
            [
                'grass',
                'gravel',
                'marble_chips',
                'sand',
                'flowers'
            ].includes(
                pathMaterial
            )
        ) {

            texture =
                await loadFlowerbedTexture(
                    pathMaterial
                );
        }

        material =
            new THREE.MeshStandardMaterial({
                map: texture || null,
                color: texture
                    ? null
                    : (
                        fallbackColors[
                            pathMaterial
                        ] ||
                        0x888888
                    ),
                roughness: 0.7,
                metalness: 0.05,
                side: THREE.DoubleSide,
            });
    }

    const assembly = new THREE.Group();
    assembly.name = 'siteSurfaceAssembly';
    assembly.userData.isPath = true;
    assembly.userData.isSiteSurfaceAssembly = true;
    assembly.userData.surfaceMaterial = pathMaterial || 'tile_gray';
    assembly.userData.surfaceType = pathSurfaceType;

    const sideTexture =
        isTile && material.map
            ? material.map
            : null;

    const sideMaterial = new THREE.MeshStandardMaterial({
        map: sideTexture,
        color: sideTexture
            ? 0xffffff
            : (pathMaterial === 'sand' ? 0xc8ad73 : pathMaterial === 'grass' ? 0x6b5138 : 0x66645f),
        roughness: 0.9,
        metalness: 0
    });
    const mesh = new THREE.Mesh(geometry, [material, sideMaterial]);
    mesh.rotation.x = -Math.PI / 2;
    // The top face remains at local y=0, matching the former surface plane.
    mesh.position.y = -topThickness;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.isSurfaceTop = true;
    assembly.add(mesh);

    // The layers are intentionally visible at the perimeter. Lower layers
    // extend slightly beyond upper ones, as a readable construction section.
    let layerTop = mesh.position.y;
    for (let index = 0; index < profile.layers.length; index++) {
        const layer = profile.layers[index];
        const thickness = Math.max(0.001, Number(layer.thickness) || 0.001);
        const margin = index === 0 ? 0.02 : index === 1 ? 0.05 : 0.08;
        const layerWidth = totalWidth + extra * 2 + margin * 2;
        const layerLength = totalLength + extra * 2 + margin * 2;
        const layerGeometry = new THREE.BoxGeometry(layerWidth, thickness, layerLength);

        let layerTexture = null;
        if (layer.kind === 'sand') {
            layerTexture = await loadFlowerbedTexture('sand');
        } else if (layer.kind === 'gravel' || layer.kind === 'screenings') {
            layerTexture = await loadFlowerbedTexture('gravel');
        } else if (layer.kind === 'soil') {
            layerTexture = await loadFlowerbedTexture('soil');
        }

        const layerMaterial = new THREE.MeshStandardMaterial({
            color: layer.color ?? (layer.kind === 'geotextile' ? 0x414848 : 0x777777),
            map: layerTexture || null,
            roughness: 0.95,
            metalness: 0,
            side: THREE.DoubleSide
        });
        const layerMesh = new THREE.Mesh(layerGeometry, layerMaterial);
        layerMesh.position.y = layerTop - thickness / 2;
        layerMesh.receiveShadow = true;
        layerMesh.castShadow = false;
        layerMesh.userData.isSiteSurfaceLayer = true;
        layerMesh.userData.layerKey = layer.key;
        layerMesh.userData.layerLabel = layer.label;
        layerMesh.userData.thickness = thickness;
        assembly.add(layerMesh);
        layerTop -= thickness;
    }

    assembly.userData.totalBuildUpThickness = topThickness + profile.layers.reduce((sum, layer) => sum + layer.thickness, 0);
    return assembly;
}