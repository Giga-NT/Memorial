// modules/backgrounds.js
// Фоны стелы: загрузка конфигурации, превью и создание слоя под фото/гравировками.

import * as THREE from 'three';

let backgroundsConfig = {};
let backgroundsList = [];

export function getBackgrounds() {
    return backgroundsList;
}

export function getBackgroundConfig(id) {
    return backgroundsConfig[id] || null;
}

export async function loadBackgroundsConfig() {
    const response = await fetch('./backgrounds/backgrounds.json');
    if (!response.ok) throw new Error('Не удалось загрузить backgrounds.json');

    const data = await response.json();
    backgroundsList = Array.isArray(data.backgrounds) ? data.backgrounds : [];

    backgroundsConfig = {};
    backgroundsList.forEach(item => {
        backgroundsConfig[item.id] = item;
    });

    return backgroundsList;
}

export function createBackgroundMesh(backgroundId, width, height, frontZ, options = {}) {
    const config = getBackgroundConfig(backgroundId);
    if (!config || !config.file) return null;

    const loader = new THREE.TextureLoader();
    const geometry = new THREE.PlaneGeometry(
        width * (config.defaultScale || 1),
        height * (config.defaultScale || 1)
    );

    const material = new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
        options.offsetX ?? config.defaultOffsetX ?? 0,
        options.offsetY ?? config.defaultOffsetY ?? height * 0.5,
        frontZ
    );
    mesh.renderOrder = 8;

    mesh.userData.isSteleBackground = true;
    mesh.userData.backgroundId = backgroundId;

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
        },
        undefined,
        error => {
            console.warn('⚠️ Не удалось загрузить фон:', config.file, error);
        }
    );

    return mesh;
}

export function clearBackgroundFromGroup(group) {
    if (!group) return;

    const old = group.children.filter(child => child.userData?.isSteleBackground);
    old.forEach(mesh => {
        group.remove(mesh);
        mesh.geometry?.dispose();
        const texture = mesh.material?.map;
        texture?.dispose();
        mesh.material?.dispose();
    });
}

export function applyBackgroundToGroup(group, state, width, height, frontZ) {
    if (!group) return;

    clearBackgroundFromGroup(group);

    if (!state?.backgroundId || state.backgroundId === 'none') return;

    const mesh = createBackgroundMesh(
        state.backgroundId,
        width,
        height,
        frontZ,
        {
            offsetX: state.backgroundOffsetX,
            offsetY: state.backgroundOffsetY
        }
    );

    if (mesh) group.add(mesh);
}

export function initBackgroundsUI(state, onChange) {
    const grid = document.getElementById('backgroundOptionsGrid');
    if (!grid) return;

    loadBackgroundsConfig()
        .then(list => {
            grid.innerHTML = '';

            list.forEach(item => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'background-card';
                button.dataset.backgroundId = item.id;
                button.title = item.name;

                const preview = document.createElement('img');
                preview.src = item.preview || item.file || '';
                preview.alt = item.name;
                preview.loading = 'lazy';

                const label = document.createElement('span');
                label.textContent = item.name;

                button.append(preview, label);

                button.addEventListener('click', () => {
                    state.backgroundId = item.id;
                    document.querySelectorAll('.background-card').forEach(el => {
                        el.classList.toggle('active', el === button);
                    });
                    onChange?.(item);
                });

                grid.appendChild(button);
            });

            const activeId = state.backgroundId || 'none';
            grid.querySelectorAll('.background-card').forEach(button => {
                button.classList.toggle('active', button.dataset.backgroundId === activeId);
            });
        })
        .catch(error => {
            console.error('❌ Ошибка загрузки фонов:', error);
            grid.innerHTML = '<div class="empty">Не удалось загрузить фоны</div>';
        });
}
