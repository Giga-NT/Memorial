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
    epitaphOffsetY: 0
});

function invalidateTextures() {
    textureCache?.invalidateFront?.();
    textureCache?.invalidateBack?.();
}

function updatePreview() {
    if (typeof throttledUpdate === "function") {
        throttledUpdate();
    } else {
        console.warn(
            "burialRecords: throttledUpdate ещё не назначен."
        );
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

    // Не заменяем сохранённое фото null-значением.
    // Фото обновляется отдельно при загрузке файла.
    person.textureUrl =
        person.textureUrl || person.photoUrl || null;

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

function renderList() {
    const list = document.getElementById("burialRecordsList");
    const count = document.getElementById("burialRecordsCount");

    if (!list || !state) return;

    ensureRecords();

    if (count) {
        count.textContent = String(state.burials.length);
    }

    list.innerHTML = state.burials.map((person, index) => {
        const selected = person.id === activeId;
        const title = person.fullName.trim()
            || `Человек ${index + 1} — не заполнен`;

        return `
            <div style="display:flex;gap:6px;margin:6px 0">
                <button
                    type="button"
                    data-select="${escapeHtml(person.id)}"
                    style="flex:1;padding:9px;text-align:left;
                    border:1px solid #aaa;border-radius:6px;
                    background:${selected ? '#eaf1ff' : '#fff'};
                    color:#222">
                    ${selected ? "✏️ " : ""}${escapeHtml(title)}
                </button>

                <button
                    type="button"
                    data-delete="${escapeHtml(person.id)}"
                    ${state.burials.length <= 1 ? "disabled" : ""}
                    title="Удалить запись">
                    ✕
                </button>
            </div>
        `;
    }).join("");

    list.querySelectorAll("[data-select]").forEach(button => {
        button.addEventListener("click", () => {
            saveFields();

            activeId = button.dataset.select;
            state.activeBurialId = activeId;

            showActive();
        });
    });

    list.querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => {
            if (state.burials.length <= 1) return;

            saveFields();

            const deletingId = button.dataset.delete;
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

        state.textureUrl =
            person.textureUrl || person.photoUrl || null;

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

    if (!Number.isFinite(fontSize) || fontSize <= 0) {
        return;
    }

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
        // Пользователь мог переключить запись во время чтения файла.
        // Поэтому сохраняем фото в ту запись, для которой началась загрузка.
        const targetPerson = state.burials.find(
            item => item.id === person.id
        );

        if (!targetPerson || typeof reader.result !== "string") {
            return;
        }

        targetPerson.textureUrl = reader.result;
        targetPerson.photoUrl = reader.result;

        // Обновляем общее состояние только если эта запись активна.
        if (state.activeBurialId === targetPerson.id) {
            state.textureUrl = reader.result;
            state.photoUrl = reader.result;

            invalidateTextures();
            updatePreview();
        }

        renderList();
    };

    reader.onerror = () => {
        console.error("Не удалось прочитать файл фотографии.");
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
        console.warn(
            "burialRecords: не найдены поля ФИО, дат или эпитафии."
        );
        return;
    }

    ensureRecords();

    const anchor = name.closest(".control-group")?.parentElement;

    if (!document.getElementById("burialRecordsPanel")) {
        const panel = document.createElement("div");

        panel.id = "burialRecordsPanel";
        panel.style.cssText =
            "margin:0 0 14px;padding:12px;border:1px solid #ccc;" +
            "border-radius:8px;background:#f7f9fc";

        panel.innerHTML = `
            <strong>👥 Люди на стеле</strong>

            <div style="margin:6px 0">
                Записей: <span id="burialRecordsCount">1</span>
            </div>

            <div id="burialRecordsList"></div>

            <button
                type="button"
                id="addBurialRecordBtn"
                style="width:100%;padding:10px;margin-top:8px">
                ＋ Добавить человека
            </button>

            <p style="font-size:12px;color:#555">
                Выбери запись и редактируй её ФИО, даты,
                эпитафию и фото.
            </p>
        `;

        if (anchor?.parentElement) {
            anchor.parentElement.insertBefore(panel, anchor);
        } else {
            name.parentElement?.insertBefore(panel, name);
        }
    }

    // Не добавляем повторные обработчики при повторной инициализации.
    if (!initialized) {
        document.getElementById("addBurialRecordBtn")?.addEventListener(
            "click",
            () => {
                saveFields();

                const person = makePerson();

                state.burials.push(person);
                activeId = person.id;
                state.activeBurialId = activeId;

                showActive();
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
            event => {
                saveActiveBurialFontSize(
                    "nameFontSize",
                    event.target.value
                );
            }
        );

        document.getElementById("datesFontSize")?.addEventListener(
            "input",
            event => {
                saveActiveBurialFontSize(
                    "datesFontSize",
                    event.target.value
                );
            }
        );

        initialized = true;
    }

    window.captureActiveBurialRecord = saveFields;

    window.refreshBurialRecordsUI = () => {
        ensureRecords();

        activeId = state.burials.some(
            person => person.id === state.activeBurialId
        )
            ? state.activeBurialId
            : state.burials[0].id;

        showActive();
    };

    renderList();
}
