let state;
let textureCache;
let throttledUpdate;

let activeId = null;
let changingFields = false;
let initialized = false;

const makePerson = () => ({
    id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: "",
    dates: "",
    epitaph: "",
    textureUrl: null,
    photoUrl: null,
    photos: [],
    textOffsetX: 0,
    textOffsetY: 0,
    epitaphOffsetX: 0,
    epitaphOffsetY: 0,
    nameFontSize: 48,
    datesFontSize: 32
});

function invalidateTextures() {
    textureCache?.invalidateFront?.();
    textureCache?.invalidateBack?.();
}

function updatePreview() {
    if (typeof throttledUpdate === "function") {
        throttledUpdate();
    }
}

function ensureRecords() {
    if (!state) return;

    if (!Array.isArray(state.burials) || state.burials.length === 0) {
        state.burials = [{
            ...makePerson(),
            fullName: state.fullName || "",
            dates: state.dates || "",
            epitaph: state.epitaph || "",
            textureUrl: state.textureUrl || state.photoUrl || null,
            photoUrl: state.photoUrl || state.textureUrl || null,
            textOffsetX: Number(state.textOffsetX) || 0,
            textOffsetY: Number(state.textOffsetY) || 0,
            epitaphOffsetX: Number(state.epitaphOffsetX) || 0,
            epitaphOffsetY: Number(state.epitaphOffsetY) || 0
        }];
    }

	state.burials = state.burials.map(person => {
		const legacyPhoto = person.textureUrl || person.photoUrl || null;

		const photos = Array.isArray(person.photos)
			? person.photos
			: legacyPhoto
				? [{
					id: `photo-${person.id || Date.now()}-1`,
					url: legacyPhoto,
					x: 0,
					y: 0
				}]
				: [];

		return {
			...makePerson(),
			...person,
			id: person.id || makePerson().id,
			photos
		};
	});

    const savedActiveId = state.activeBurialId;

    if (!state.burials.some(person => person.id === activeId)) {
        activeId = state.burials.some(person => person.id === savedActiveId)
            ? savedActiveId
            : state.burials[0].id;
    }

    state.activeBurialId = activeId;
}

function getActive() {
    ensureRecords();
    return state?.burials?.find(person => person.id === activeId)
        || state?.burials?.[0]
        || null;
}

function saveFields() {
    if (changingFields || !state) return;

    const person = getActive();
    if (!person) return;

    const name = document.getElementById("fullName");
    const dates = document.getElementById("datesText");
    const epitaph = document.getElementById("epitaphText");

    if (name) person.fullName = name.value;
    if (dates) person.dates = dates.value;
    if (epitaph) person.epitaph = epitaph.value;

    person.textureUrl = person.textureUrl || person.photoUrl || null;
    person.photoUrl = person.textureUrl;
    state.activeBurialId = person.id;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ============================================================
// РЕНДЕР СПИСКА — теперь с классами под тёмную тему
// ============================================================
function renderList() {
    const list = document.getElementById("burialRecordsList");
    const count = document.getElementById("burialRecordsCount");

    if (!list || !state) return;

    ensureRecords();

    if (count) count.textContent = String(state.burials.length);

    list.innerHTML = state.burials.map((person, index) => {
        const selected = person.id === activeId;
        const title = (person.fullName || "").trim()
            || `Человек ${index + 1}`;
        const dates = (person.dates || "").trim();

        return `
            <div class="burial-card ${selected ? "is-active" : ""}"
                 data-select="${escapeHtml(person.id)}"
                 role="button"
                 tabindex="0">
                <div class="burial-card__preview">
                    ${person.photoUrl
                        ? `<img src="${escapeHtml(person.photoUrl)}" alt="">`
                        : `<span class="burial-card__placeholder">👤</span>`}
                </div>

                <div class="burial-card__info">
                    <div class="burial-card__name">${escapeHtml(title)}</div>
                    ${dates ? `<div class="burial-card__dates">${escapeHtml(dates)}</div>` : ""}
                </div>

                <div class="burial-card__actions">
                    <button type="button"
                            class="burial-card__btn burial-card__btn--del"
                            data-delete="${escapeHtml(person.id)}"
                            ${state.burials.length <= 1 ? "disabled" : ""}
                            title="Удалить запись">🗑️</button>
                </div>
            </div>
        `;
    }).join("");

    // Клик по карточке — выбрать
    list.querySelectorAll("[data-select]").forEach(card => {
        card.addEventListener("click", (e) => {
            if (e.target.closest("[data-delete]")) return;
            saveFields();
            activeId = card.dataset.select;
            state.activeBurialId = activeId;
            showActive();
        });
    });

    // Удаление
    list.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (state.burials.length <= 1) return;

            saveFields();

            const deletingId = btn.dataset.delete;
            const oldIndex = state.burials.findIndex(
                person => person.id === deletingId
            );

            state.burials = state.burials.filter(
                person => person.id !== deletingId
            );

            if (activeId === deletingId) {
                const nextIndex = Math.max(0, oldIndex - 1);
                activeId = state.burials[nextIndex].id;
                state.activeBurialId = activeId;
                showActive();
            } else {
                renderList();
            }

            updatePreview();
        });
    });
}

function showActive() {
    if (!state) return;

    ensureRecords();

    const person = getActive();
    if (!person) return;

    changingFields = true;

    try {
        state.activeBurialId = person.id;

        state.fullName = person.fullName || "";
        state.dates = person.dates || "";
        state.epitaph = person.epitaph || "";

        state.textureUrl = person.textureUrl || person.photoUrl || null;
        state.photoUrl = state.textureUrl;

        const name = document.getElementById("fullName");
        const dates = document.getElementById("datesText");
        const epitaph = document.getElementById("epitaphText");
        const upload = document.getElementById("textureUpload");

        if (name) name.value = state.fullName;
        if (dates) dates.value = state.dates;
        if (epitaph) epitaph.value = state.epitaph;
        if (upload) upload.value = "";
    } finally {
        changingFields = false;
    }

	invalidateTextures();
	renderList();
	renderPersonPhotos();
	updatePreview();
}

function saveActiveBurialFontSize(field, value) {
    const person = getActive();
    if (!person) return;

    const fontSize = Number(value);
    if (!Number.isFinite(fontSize) || fontSize <= 0) return;

    person[field] = fontSize;
    state.activeBurialId = person.id;
    state.frontTextureNeedsUpdate = true;

    invalidateTextures();
    updatePreview();
}


function renderPersonPhotos() {
    const container = document.getElementById("personPhotosList");
    const person = getActive();

    if (!container) return;

    if (!person) {
        container.innerHTML = "";
        return;
    }

    if (!Array.isArray(person.photos)) {
        person.photos = [];
    }

    container.innerHTML = `
        <div class="person-photos-title">
            Фото человека: ${person.photos.length} из 2
        </div>
        <div class="person-photos-grid">
            ${person.photos.map((photo, index) => `
                <div class="person-photo-item">
                    <img
                        src="${escapeHtml(photo.url)}"
                        alt="Фото ${index + 1}"
                    >
                    <span>Фото ${index + 1}</span>
                    <button
                        type="button"
                        data-remove-photo="${escapeHtml(photo.id)}"
                        title="Удалить фотографию"
                    >Удалить</button>
                </div>
            `).join("")}
        </div>
        ${person.photos.length >= 2
            ? "<div>Добавлено максимальное количество фотографий.</div>"
            : ""}
    `;
}

function syncLegacyPhotoFields(person) {
    const firstPhoto = person.photos?.[0]?.url || null;

    // Совместимость со старым кодом и старыми проектами.
    person.textureUrl = firstPhoto;
    person.photoUrl = firstPhoto;

    if (state.activeBurialId === person.id) {
        state.textureUrl = firstPhoto;
        state.photoUrl = firstPhoto;
    }
}

function handlePhotoUpload(event) {
    const files = Array.from(event.target.files || [])
        .filter(file => file.type.startsWith("image/"));

    const person = getActive();

    if (!person || files.length === 0) return;

    if (!Array.isArray(person.photos)) {
        person.photos = [];
    }

    const availableSlots = 2 - person.photos.length;

    if (availableSlots <= 0) {
        alert("У этого человека уже добавлены 2 фотографии.");
        event.target.value = "";
        return;
    }

    const filesToRead = files.slice(0, availableSlots);

    if (files.length > availableSlots) {
        alert("Можно добавить не больше 2 фотографий на человека. Будут загружены только доступные.");
    }

    const personId = person.id;

    Promise.all(filesToRead.map(file => new Promise(resolve => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(typeof reader.result === "string"
                ? reader.result
                : null);
        };

        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    }))).then(urls => {
        const targetPerson = state.burials.find(item => item.id === personId);

        if (!targetPerson) return;

        if (!Array.isArray(targetPerson.photos)) {
            targetPerson.photos = [];
        }

        urls.filter(Boolean).forEach(url => {
            if (targetPerson.photos.length >= 2) return;

            targetPerson.photos.push({
                id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url,
                x: 0,
                y: 0
            });
        });

        syncLegacyPhotoFields(targetPerson);
        renderPersonPhotos();
        renderList();
        invalidateTextures();
        updatePreview();

        event.target.value = "";
    });
}


export function initBurialRecords(
    appState,
    appTextureCache,
    appThrottledUpdate
) {
    state = appState;
    textureCache = appTextureCache;
    throttledUpdate = appThrottledUpdate;

    const name = document.getElementById("fullName");
    const dates = document.getElementById("datesText");
    const epitaph = document.getElementById("epitaphText");

    if (!name || !dates || !epitaph) {
        console.warn("burialRecords: не найдены поля ФИО, дат или эпитафии.");
        return;
    }

    ensureRecords();
	renderPersonPhotos();
	
    const anchor = name.closest(".control-group")?.parentElement;

    if (!document.getElementById("burialRecordsPanel")) {
        const panel = document.createElement("div");
        panel.id = "burialRecordsPanel";
        panel.className = "burial-panel";

        panel.innerHTML = `
            <div class="burial-panel__header">
                <span class="burial-panel__title">👥 Люди на стеле</span>
                <span class="burial-panel__count">
                    <span id="burialRecordsCount">1</span>
                </span>
            </div>

            <div id="burialRecordsList" class="burial-list"></div>

            <button type="button"
                    id="addBurialRecordBtn"
                    class="burial-panel__add-btn">
                ＋ Добавить человека
            </button>

            <div class="burial-panel__hint">
                💡 Выберите запись, чтобы редактировать её ниже
            </div>
        `;

        if (anchor?.parentElement) {
            anchor.parentElement.insertBefore(panel, anchor);
        } else {
            name.parentElement?.insertBefore(panel, name);
        }
    }

    if (!initialized) {
        document.getElementById("addBurialRecordBtn")?.addEventListener(
            "click",
            () => {
                saveFields();

                const person = makePerson();

                // Дефолтные значения, чтобы запись была видна
                person.fullName = "";
                person.dates = "";

                state.burials.push(person);
                activeId = person.id;
                state.activeBurialId = activeId;

                showActive();

                // Фокус на поле ФИО
                setTimeout(() => {
                    document.getElementById("fullName")?.focus();
                }, 50);
            }
        );

        [name, dates, epitaph].forEach(element => {
            element.addEventListener("input", () => {
                if (changingFields) return;
                saveFields();
                renderList();
            });
        });

        document.getElementById("textureUpload")?.addEventListener(
            "change",
            handlePhotoUpload
        );

		document.getElementById("personPhotosList")?.addEventListener(
			"click",
			event => {
				const button = event.target.closest("[data-remove-photo]");
				if (!button) return;

				const person = getActive();
				if (!person || !Array.isArray(person.photos)) return;

				const photoId = button.dataset.removePhoto;

				person.photos = person.photos.filter(
					photo => photo.id !== photoId
				);

				syncLegacyPhotoFields(person);

				renderPersonPhotos();
				renderList();
				invalidateTextures();
				updatePreview();
			}
		);

        document.getElementById("nameFontSize")?.addEventListener(
            "input",
            event => saveActiveBurialFontSize("nameFontSize", event.target.value)
        );

        document.getElementById("datesFontSize")?.addEventListener(
            "input",
            event => saveActiveBurialFontSize("datesFontSize", event.target.value)
        );

        initialized = true;
    }

    window.captureActiveBurialRecord = saveFields;

    window.refreshBurialRecordsUI = () => {
        ensureRecords();
        activeId = state.burials.some(p => p.id === state.activeBurialId)
            ? state.activeBurialId
            : state.burials[0].id;
        showActive();
    };

    renderList();
}