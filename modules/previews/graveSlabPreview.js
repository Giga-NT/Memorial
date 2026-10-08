import {
    getGraveSlabModelList,
    getGraveSlabPreviewUrl
} from '../graveSlabLoader.js';

export function renderGraveSlabGrid() {
    const container = document.getElementById('graveSlabOptionsGrid');

    if (!container) {
        console.warn(
            '⚠️ Не найден #graveSlabOptionsGrid'
        );
        return;
    }

    const models = getGraveSlabModelList();

    container.innerHTML = '';

    if (!models.length) {
        container.innerHTML = `
            <div class="empty-model-list">
                Модели надгробных плит не найдены
            </div>
        `;

        return;
    }

    const selectedModel =
        window.state?.graveSlabModel || 'slab1';

    models.forEach(model => {
        const card = document.createElement('div');

        card.className = 'stele-grid-item grave-slab-option';

        if (model.id === selectedModel) {
            card.classList.add('selected');
        }

        card.dataset.modelId = model.id;

        const preview = getGraveSlabPreviewUrl(model.id);

        card.innerHTML = `
            <div class="stele-grid-preview">
                ${
                    preview
                        ? `
                            <img
                                src="${preview}"
                                alt="${escapeHtml(model.name)}"
                                loading="lazy"
                            >
                        `
                        : `
                            <div class="stele-placeholder">
                                🪦
                            </div>
                        `
                }
            </div>

            <div class="stele-grid-name">
                ${escapeHtml(model.name)}
            </div>
        `;

        card.addEventListener('click', () => {
            selectGraveSlabModelGrid(model.id);
        });

        container.appendChild(card);
    });
}

export function selectGraveSlabModelGrid(modelId) {
    console.log('🪦 ВЫБОР МОДЕЛИ НАДГРОБНОЙ ПЛИТЫ:', modelId);

    if (!modelId) {
        return;
    }

    if (!window.state) {
        console.warn(
            '⚠️ window.state не найден'
        );
        return;
    }

    window.state.graveSlabModel = modelId;

    updateGraveSlabGridSelection(modelId);

    document.dispatchEvent(
        new CustomEvent('graveSlabModelSelected', {
            detail: {
                modelId
            }
        })
    );

    if (typeof window.updateScene === 'function') {
        window.updateScene();
    }
}

export function updateGraveSlabGridSelection(modelId) {
    const container = document.getElementById(
        'graveSlabOptionsGrid'
    );

    if (!container) {
        return;
    }

    container
        .querySelectorAll('.grave-slab-option')
        .forEach(card => {
            card.classList.toggle(
                'selected',
                card.dataset.modelId === modelId
            );
        });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}