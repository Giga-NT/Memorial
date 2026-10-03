// modules/backgrounds.js
// Управление фонами стелы:
// - загрузка backgrounds.json
// - создание фонового слоя Three.js
// - удаление старого фона
// - выбор фона через UI с превью

import * as THREE from 'three';

let backgroundsList = [];
let backgroundsConfig = {};


/**
 * Загрузить конфигурацию фонов
 */
export async function loadBackgroundsConfig() {
    const response = await fetch('./backgrounds/backgrounds.json');

    if (!response.ok) {
        throw new Error(
            `Не удалось загрузить backgrounds.json: ${response.status}`
        );
    }

    const data = await response.json();

    backgroundsList = Array.isArray(data.backgrounds)
        ? data.backgrounds
        : [];

    backgroundsConfig = {};

    backgroundsList.forEach(background => {
        backgroundsConfig[background.id] = background;
    });

    console.log(
        `🎨 Загружено фонов: ${backgroundsList.length}`
    );

    return backgroundsList;
}


/**
 * Получить все фоны
 */
export function getBackgrounds() {
    return backgroundsList;
}


/**
 * Получить конкретный фон
 */
export function getBackgroundConfig(id) {
    return backgroundsConfig[id] || null;
}


/**
 * Создать Mesh фонового изображения
 *
 * Фон создаётся как отдельная плоскость.
 * renderOrder специально ниже фото и гравировок.
 */
export function createBackgroundMesh(
    backgroundId,
    width,
    height,
    frontZ,
    options = {}
) {
    const config = getBackgroundConfig(backgroundId);

    if (!config || !config.file) {
        return null;
    }

    const scale = config.defaultScale || 1;

    const geometry = new THREE.PlaneGeometry(
        width * scale,
        height * scale
    );

	const material = new THREE.MeshBasicMaterial({
		transparent: true,
		side: THREE.FrontSide,
		depthWrite: false,
		depthTest: true,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});

    const mesh = new THREE.Mesh(
        geometry,
        material
    );

    const offsetX =
        options.offsetX ??
        config.defaultOffsetX ??
        0;

    const offsetY =
        options.offsetY ??
        config.defaultOffsetY ??
        0;

    mesh.position.set(
        offsetX,
        offsetY,
        frontZ
    );

    /*
     * ВАЖНО:
     *
     * фон должен находиться:
     *
     * стела
     * ↓
     * фон       renderOrder 8
     * ↓
     * текст
     * ↓
     * гравировка renderOrder 10
     * ↓
     * фото       renderOrder 11
     */

    mesh.renderOrder = 8;

    mesh.userData.isSteleBackground = true;
    mesh.userData.backgroundId = backgroundId;

    const loader = new THREE.TextureLoader();

    loader.load(
        config.file,

        texture => {
            texture.colorSpace = THREE.SRGBColorSpace;

            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            material.map = texture;
            material.needsUpdate = true;

            console.log(
                `🎨 Фон загружен: ${backgroundId}`
            );
        },

        undefined,

        error => {
            console.warn(
                `⚠️ Не удалось загрузить фон: ${config.file}`,
                error
            );
        }
    );

    return mesh;
}


/**
 * Удалить существующий фон из группы
 */
export function clearBackgroundFromGroup(group) {
    if (!group) return;

    const backgrounds =
        group.children.filter(
            child =>
                child.userData?.isSteleBackground
        );

    backgrounds.forEach(mesh => {
        group.remove(mesh);

        if (mesh.geometry) {
            mesh.geometry.dispose();
        }

        if (mesh.material) {
            if (mesh.material.map) {
                mesh.material.map.dispose();
            }

            mesh.material.dispose();
        }
    });
}


/**
 * Установить фон на стелу
 */
export async function applyBackgroundToGroup(
    group,
    state,
    width,
    height,
    frontZ,
    centerY = 0
) {
    if (!group) {
        console.warn('⚠️ applyBackgroundToGroup: group отсутствует');
        return;
    }

    // Гарантируем, что backgrounds.json уже загружен
    if (!backgroundsList.length) {
        try {
            await loadBackgroundsConfig();
        } catch (error) {
            console.error(
                '❌ Не удалось загрузить конфигурацию фонов:',
                error
            );
            return;
        }
    }

    // Удаляем предыдущий фон
    clearBackgroundFromGroup(group);

    const backgroundId = state?.backgroundId || 'none';

    console.log('🎨 applyBackgroundToGroup:', {
        backgroundId,
        width,
        height,
        frontZ,
        availableBackgrounds: backgroundsList.map(bg => bg.id)
    });

    // Без фона
    if (backgroundId === 'none') {
        console.log('ℹ️ Выбран режим "Без фона"');
        return;
    }

    const config = getBackgroundConfig(backgroundId);

    if (!config) {
        console.warn(
            `⚠️ Конфигурация фона "${backgroundId}" не найдена`
        );
        return;
    }

    if (!config.file) {
        console.warn(
            `⚠️ У фона "${backgroundId}" отсутствует file`
        );
        return;
    }

    console.log('🎨 Конфигурация фона найдена:', config);

	const background = createBackgroundMesh(
		backgroundId,
		width,
		height,
		frontZ,
		{
			offsetX: state.backgroundOffsetX,
			offsetY: centerY + (
				state.backgroundOffsetY !== undefined
					? Number(state.backgroundOffsetY)
					: 0
			)
		}
	);

    if (!background) {
        console.warn(
            `⚠️ createBackgroundMesh() не создал фон "${backgroundId}"`
        );
        return;
    }

    group.add(background);

    console.log('✅ Фоновый Mesh добавлен в decalsGroup:', {
        backgroundId,
        renderOrder: background.renderOrder,
        position: background.position,
        size: {
            width,
            height
        }
    });
}


/**
 * Создать UI выбора фона
 *
 * В index.html должен существовать:
 *
 * <div id="backgroundOptionsGrid"></div>
 */
export function initBackgroundsUI(
    state,
    onChange
) {
    const grid =
        document.getElementById(
            'backgroundOptionsGrid'
        );

    if (!grid) {
        console.warn(
            '⚠️ Не найден #backgroundOptionsGrid'
        );

        return;
    }

    loadBackgroundsConfig()
        .then(list => {

            grid.innerHTML = '';

            list.forEach(background => {

                const button =
                    document.createElement(
                        'button'
                    );

                button.type = 'button';

                button.className =
                    'background-card';

                button.dataset.backgroundId =
                    background.id;

                button.title =
                    background.name;


                /*
                 * Превью
                 */
                if (
                    background.preview ||
                    background.file
                ) {
                    const image =
                        document.createElement(
                            'img'
                        );

                    image.src =
                        background.preview ||
                        background.file;

                    image.alt =
                        background.name;

                    image.loading = 'lazy';

                    button.appendChild(image);
                }


                /*
                 * Название
                 */
                const label =
                    document.createElement(
                        'span'
                    );

                label.textContent =
                    background.name;

                button.appendChild(label);


                /*
                 * Выбор
                 */
                button.addEventListener(
                    'click',
                    () => {

                        state.backgroundId =
                            background.id;

                        document
                            .querySelectorAll(
                                '.background-card'
                            )
                            .forEach(card => {

                                card.classList.toggle(
                                    'active',
                                    card === button
                                );

                            });


                        if (typeof onChange === 'function') {
                            onChange(
                                background
                            );
                        }
                    }
                );


                grid.appendChild(button);
            });


            /*
             * Отметить текущий фон
             */
            const activeId =
                state.backgroundId ||
                'none';

            grid
                .querySelectorAll(
                    '.background-card'
                )
                .forEach(card => {

                    card.classList.toggle(
                        'active',
                        card.dataset.backgroundId ===
                            activeId
                    );

                });
        })

        .catch(error => {

            console.error(
                '❌ Ошибка загрузки фонов:',
                error
            );

            grid.innerHTML =
                '<div class="empty">Не удалось загрузить фоны</div>';
        });
}

export function initBackgroundControls(state, onChange) {
    const scaleInput = document.getElementById('backgroundScale');
    const offsetXInput = document.getElementById('backgroundOffsetX');
    const offsetYInput = document.getElementById('backgroundOffsetY');

    const scaleValue = document.getElementById('backgroundScaleValue');
    const offsetXValue = document.getElementById('backgroundOffsetXValue');
    const offsetYValue = document.getElementById('backgroundOffsetYValue');

    const resetButton = document.getElementById('backgroundResetButton');

    if (!scaleInput || !offsetXInput || !offsetYInput) {
        console.warn('⚠️ Контролы фона не найдены');
        return;
    }

    const updateUI = () => {
        const scale =
            state.backgroundScale !== undefined
                ? Number(state.backgroundScale)
                : 0.98;

        const offsetX =
            state.backgroundOffsetX !== undefined
                ? Number(state.backgroundOffsetX)
                : 0;

        const offsetY =
            state.backgroundOffsetY !== undefined
                ? Number(state.backgroundOffsetY)
                : 0;

        scaleInput.value = scale;
        offsetXInput.value = offsetX;
        offsetYInput.value = offsetY;

        scaleValue.textContent =
            `${Math.round(scale * 100)}%`;

        offsetXValue.textContent =
            offsetX.toFixed(2);

        offsetYValue.textContent =
            offsetY.toFixed(2);
    };

    const handleChange = () => {
        state.backgroundScale =
            Number(scaleInput.value);

        state.backgroundOffsetX =
            Number(offsetXInput.value);

        state.backgroundOffsetY =
            Number(offsetYInput.value);

        updateUI();

        if (typeof onChange === 'function') {
            onChange();
        }
    };

    scaleInput.addEventListener('input', handleChange);
    offsetXInput.addEventListener('input', handleChange);
    offsetYInput.addEventListener('input', handleChange);

    resetButton?.addEventListener('click', () => {
        state.backgroundScale = 0.98;
        state.backgroundOffsetX = 0;
        state.backgroundOffsetY = 0;

        updateUI();

        if (typeof onChange === 'function') {
            onChange();
        }
    });

    updateUI();
}