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

    state.burials = state.burials.map(person => ({
        ...makePerson(),
        ...person,
        id: person.id || makePerson().id
    }));

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

function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const person = getActive();
    if (!person) return;

    const reader = new FileReader();

    reader.onload = () => {
        const targetPerson = state.burials.find(
            item => item.id === person.id
        );
        if (!targetPerson || typeof reader.result !== "string") return;

        targetPerson.textureUrl = reader.result;
        targetPerson.photoUrl = reader.result;

        if (state.activeBurialId === targetPerson.id) {
            state.textureUrl = reader.result;
            state.photoUrl = reader.result;
            invalidateTextures();
            updatePreview();
        }

        renderList();
    };

    reader.readAsDataURL(file);
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