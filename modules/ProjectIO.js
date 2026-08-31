// modules/ProjectIO.js
// ============================================================
// СОХРАНЕНИЕ / ЗАГРУЗКА ПРОЕКТА
// Версия формата: 3.1
//
// Поддерживает:
// - основной памятник
// - любое количество дублеров
// - отдельные параметры каждого памятника
// - ФИО / даты / эпитафию
// - модель / форму / материал
// - фотографию и её параметры
// - положение фотографии
// - гравировки
// - позицию каждого памятника
// - мебель / вазы
// - камеру
// ============================================================

export class ProjectIO {

    constructor(state, onLoadCallback) {
        this.state = state;
        this.onLoadCallback = onLoadCallback;

        if (!this.state.projectName) {
            this.state.projectName = 'Без названия';
        }
    }


    // ============================================================
    // ПОИСК МЕНЕДЖЕРА ДУБЛЕРОВ
    // ============================================================

    getMonumentManager() {
        const possibleManagers = [
            window.multiMonumentManager,
            window.monumentManager,
            window.duplicatorManager,
            window.multiMonument,
            window.monumentsManager
        ];

        for (const manager of possibleManagers) {
            if (
                manager &&
                Array.isArray(manager.monuments) &&
                manager.monumentsGroup
            ) {
                return manager;
            }
        }

        console.warn('⚠️ Менеджер дублеров не найден');
        return null;
    }


    // ============================================================
    // СИНХРОНИЗАЦИЯ STATE С UI
    // ============================================================

    syncStateFromUI() {

        const numericFields = [
            'width', 'height', 'depth',
            'graveWidth', 'graveLength', 'baseHeight',
            'flowerWidth', 'flowerLength',
            'fenceWidth', 'fenceLength', 'fenceHeight', 'gateWidth',
            'fenceOffsetX', 'fenceOffsetZ',
            'pathWidth', 'pathTileSize',
            'photoScale', 'furnitureScale', 'vaseScale',
            'nameFontSize', 'datesFontSize', 'epitaphFontSize',
            'photoOffsetX', 'photoOffsetY',
            'photoAbsoluteX', 'photoAbsoluteY',
            'textOffsetX', 'textOffsetY',
            'epitaphOffsetX', 'epitaphOffsetY',
            'photoWidthMm', 'photoHeightMm'
        ];

        numericFields.forEach(id => {
            const el = document.getElementById(id);

            if (!el) return;

            const val = parseFloat(el.value);

            if (!isNaN(val)) {
                this.state[id] = val;
            }
        });


        const textFields = [
            'fullName',
            'dates',
            'epitaph',
            'fontFamily',
            'textColor',
            'photoShape',
            'flowerbedType',
            'fenceType',
            'fenceMaterial',
            'fenceGateSide',
            'pathMaterial',
            'pathTileLayout',
            'steleType',
            'steleModel',
            'material',
            'textureUrl',
            'photoUrl'
        ];

        textFields.forEach(id => {
            const el = document.getElementById(id);

            if (el) {
                this.state[id] = el.value;
            }
        });


        // Название проекта
        const projectName = document.getElementById('projectName');

        if (projectName) {
            this.state.projectName =
                projectName.value || 'Без названия';
        }


        // Checkbox
        const checkboxFields = [
            'fenceEnabled',
            'pathEnabled',
            'flowerEnabled',
            'showFurniture',
            'showVases'
        ];

        checkboxFields.forEach(id => {
            const el = document.getElementById(id);

            if (el) {
                this.state[id] = el.checked;
            }
        });


        // Размер фото
        const photoWidthMm =
            document.getElementById('photoWidthMm');

        const photoHeightMm =
            document.getElementById('photoHeightMm');

        if (photoWidthMm) {
            this.state.photoWidthMm =
                parseInt(photoWidthMm.value) || 100;
        }

        if (photoHeightMm) {
            this.state.photoHeightMm =
                parseInt(photoHeightMm.value) || 140;
        }


        console.log('✅ State синхронизирован с UI');
    }


    // ============================================================
    // МЕБЕЛЬ
    // ============================================================

    getFurnitureData() {

        const furnitureData = [];

        if (
            window.furniture3DManager &&
            Array.isArray(window.furniture3DManager.furniture)
        ) {

            window.furniture3DManager.furniture.forEach(item => {

                furnitureData.push({
                    type: item.type || 'table',

                    x: typeof item.x === 'number'
                        ? item.x
                        : 0,

                    z: typeof item.z === 'number'
                        ? item.z
                        : 0,

                    rotation: typeof item.rotation === 'number'
                        ? item.rotation
                        : 0,

                    scale: typeof item.scale === 'number'
                        ? item.scale
                        : 1
                });

            });
        }

        return furnitureData;
    }


    // ============================================================
    // ВАЗЫ
    // ============================================================

    getVasesData() {

        const vasesData = [];

        if (
            window.vasesManager &&
            Array.isArray(window.vasesManager.vases)
        ) {

            window.vasesManager.vases.forEach(v => {

                vasesData.push({
                    type: v.vaseType || v.type || 'vase1',

                    x: typeof v.x === 'number'
                        ? v.x
                        : 0,

                    z: typeof v.z === 'number'
                        ? v.z
                        : 0,

                    rotation: typeof v.rotation === 'number'
                        ? v.rotation
                        : 0,

                    scale: typeof v.scale === 'number'
                        ? v.scale
                        : 1,

                    material:
                        v.material ||
                        this.state.vaseMaterial ||
                        'marble'
                });

            });
        }

        return vasesData;
    }


    // ============================================================
    // КАМЕРА
    // ============================================================

    getCameraState() {

        try {

            if (window.camera && window.controls) {

                return {
                    position:
                        window.camera.position.toArray(),

                    target:
                        window.controls.target.toArray()
                };

            }

        } catch (e) {
            console.warn(
                '⚠️ Не удалось сохранить камеру:',
                e
            );
        }

        return null;
    }


    // ============================================================
    // НАЗВАНИЕ СТЕЛЫ
    // ============================================================

    getSteleName() {

        const steleSelect =
            document.getElementById('steleTypeSelect');

        if (steleSelect) {

            const selected =
                steleSelect.options[
                    steleSelect.selectedIndex
                ];

            if (selected && selected.text) {
                return selected.text;
            }
        }


        const typeMap = {

            rectangle:
                'Прямоугольная',

            custom_stl1:
                'Стела 1 (классическая)',

            custom_stl2:
                'Стела 2 (с аркой)',

            custom_stl3:
                'Стела 3 (с крестом)',

            custom_stl4:
                'Стела 4 (с вензелем)',

            custom_stl5:
                'Стела 5 (с орнаментом)'
        };


        return (
            typeMap[this.state.steleType] ||
            this.state.steleType ||
            'Стандартная'
        );
    }


    // ============================================================
    // ГЛУБОКАЯ КОПИЯ
    // ============================================================

    cloneData(data) {

        if (!data) {
            return {};
        }

        try {

            return structuredClone(data);

        } catch (e) {

            try {

                return JSON.parse(
                    JSON.stringify(data)
                );

            } catch (e2) {

                console.warn(
                    '⚠️ Не удалось глубоко скопировать данные',
                    e2
                );

                return {
                    ...data
                };
            }
        }
    }


    // ============================================================
    // ПОЛУЧИТЬ РЕАЛЬНУЮ ПОЗИЦИЮ ПАМЯТНИКА
    // ============================================================

    getMonumentPosition(monument) {

        const groupPosition =
            monument?.group?.position;

        if (groupPosition) {

            return {
                x: Number(groupPosition.x) || 0,
                y: Number(groupPosition.y) || 0,
                z: Number(groupPosition.z) || 0
            };
        }


        if (monument?.position) {

            return {
                x: Number(monument.position.x) || 0,
                y: Number(monument.position.y) || 0,
                z: Number(monument.position.z) || 0
            };
        }


        return {
            x: 0,
            y: 0,
            z: 0
        };
    }


    // ============================================================
    // ПОЛУЧИТЬ ФОТО ДУБЛЕРА ИЗ 3D
    // ============================================================

    getPhotoMesh(monument) {

        if (!monument?.group) {
            return null;
        }

        let photoMesh = null;

        monument.group.traverse(child => {

            if (
                child.isMesh &&
                child.userData &&
                child.userData.isDuplicatorPhoto
            ) {
                photoMesh = child;
            }

        });

        return photoMesh;
    }


    // ============================================================
    // СИНХРОНИЗИРОВАТЬ РЕАЛЬНЫЕ ДАННЫЕ ФОТО
    // В DATA ПЕРЕД СОХРАНЕНИЕМ
    // ============================================================

    syncPhotoDataFromMesh(monument, data) {

        if (!monument || !data) {
            return data;
        }

        const photoMesh =
            this.getPhotoMesh(monument);

        if (!photoMesh) {
            return data;
        }


        // --------------------------------------------------------
        // Позиция X
        // --------------------------------------------------------

        data.photoOffsetX =
            Number(photoMesh.position.x) || 0;


        // --------------------------------------------------------
        // Позиция Y
        //
        // В createDecalsForDuplicator:
        //
        // center.y + photoOffsetY
        //
        // Поэтому сохраняем именно offset.
        // --------------------------------------------------------

        const steleCenterY =
            Number(
                photoMesh.userData?.steleCenterY
            ) || 0;

        data.photoOffsetY =
            (Number(photoMesh.position.y) || 0)
            - steleCenterY;


        // Абсолютные значения тоже сохраняем
        data.photoAbsoluteX =
            Number(photoMesh.position.x) || 0;

        data.photoAbsoluteY =
            Number(photoMesh.position.y) || 0;


        // --------------------------------------------------------
        // URL
        // --------------------------------------------------------

        if (
            !data.textureUrl &&
            data.photoUrl
        ) {
            data.textureUrl =
                data.photoUrl;
        }

        if (
            !data.photoUrl &&
            data.textureUrl
        ) {
            data.photoUrl =
                data.textureUrl;
        }


        // --------------------------------------------------------
        // НЕ берем photoScale из mesh.scale
        //
        // В createDecalsForDuplicator размер уже запекается
        // в geometry, поэтому mesh.scale обычно = 1.
        // Правильное значение находится в data.photoScale.
        // --------------------------------------------------------

        if (
            data.photoScale === undefined ||
            data.photoScale === null
        ) {
            data.photoScale = 1;
        }


        return data;
    }


    // ============================================================
    // ПОЛУЧИТЬ ВСЕ ДУБЛЕРЫ
    // ============================================================

    getDuplicatorsData() {

        const manager =
            this.getMonumentManager();

        if (!manager) {
            return [];
        }


        const result = [];


        manager.monuments.forEach(
            (monument, index) => {

                if (!monument) {
                    return;
                }


                const data =
                    this.cloneData(
                        monument.data || {}
                    );


                // Реальная позиция
                const position =
                    this.getMonumentPosition(
                        monument
                    );


                // ID
                const id =
                    monument.id ??
                    data.id ??
                    index + 1;

                data.id = id;


                // Реальное фото
                this.syncPhotoDataFromMesh(
                    monument,
                    data
                );


                result.push({

                    id,

                    type: 'duplicate',

                    position,

                    data

                });

            }
        );


        console.log(
            `📦 Подготовлено дублеров к сохранению: ${result.length}`
        );


        return result;
    }


    // ============================================================
    // СОБРАТЬ ОСНОВНОЙ ПАМЯТНИК
    // ============================================================

    getMainMonumentData() {

        const steleName =
            this.getSteleName();


        const data = {

            id: 1,

            type: 'main',

            steleType:
                this.state.steleType ||
                this.state.steleModel ||
                'rectangle',

            steleModel:
                this.state.steleModel ||
                this.state.steleType ||
                'rectangle',

            steleName,

            width:
                this.state.width ??
                0.6,

            height:
                this.state.height ??
                1.2,

            depth:
                this.state.depth ??
                0.08,

            material:
                this.state.material ||
                'marble',


            // ----------------------------------------------------
            // ТЕКСТ
            // ----------------------------------------------------

            fontFamily:
                this.state.fontFamily ||
                'Arial, sans-serif',

            fullName:
                this.state.fullName ||
                '',

            dates:
                this.state.dates ||
                '',

            epitaph:
                this.state.epitaph ||
                '',

            textColor:
                this.state.textColor ||
                '#ffffff',

            nameFontSize:
                this.state.nameFontSize ??
                48,

            datesFontSize:
                this.state.datesFontSize ??
                32,

            epitaphFontSize:
                this.state.epitaphFontSize ??
                40,

            textOffsetX:
                this.state.textOffsetX ??
                0,

            textOffsetY:
                this.state.textOffsetY ??
                0,

            epitaphOffsetX:
                this.state.epitaphOffsetX ??
                0,

            epitaphOffsetY:
                this.state.epitaphOffsetY ??
                0,


            // ----------------------------------------------------
            // ФОТО
            // ----------------------------------------------------

            hasPhoto:
                !!(
                    this.state.textureUrl ||
                    this.state.photoUrl
                ),

            photoUrl:
                this.state.photoUrl ||
                this.state.textureUrl ||
                null,

            textureUrl:
                this.state.textureUrl ||
                this.state.photoUrl ||
                null,

            photoShape:
                this.state.photoShape ||
                'oval',

            photoWidthMm:
                this.state.photoWidthMm ??
                100,

            photoHeightMm:
                this.state.photoHeightMm ??
                140,

            photoScale:
                this.state.photoScale ??
                1,

            photoOffsetX:
                this.state.photoOffsetX ??
                0,

            photoOffsetY:
                this.state.photoOffsetY ??
                0,

            photoAbsoluteX:
                this.state.photoAbsoluteX ??
                0,

            photoAbsoluteY:
                this.state.photoAbsoluteY ??
                0,


            // ----------------------------------------------------
            // ГРАВИРОВКИ
            // ----------------------------------------------------

            engravingsFront:
                this.cloneData(
                    this.state.engravingsFront ||
                    []
                ),

            engravingsBack:
                this.cloneData(
                    this.state.engravingsBack ||
                    []
                )
        };


        return {

            id: 1,

            type: 'main',

            data,

            position: {
                x: 0,
                y: 0,
                z: 0
            },

            group: {}

        };
    }


    // ============================================================
    // ИСПРАВЛЕНИЕ ТИПОВ
    // ============================================================

    fixDataTypes(data) {

        const numericFields = [

            'width',
            'height',
            'depth',

            'graveWidth',
            'graveLength',
            'baseHeight',

            'flowerWidth',
            'flowerLength',

            'fenceWidth',
            'fenceLength',
            'fenceHeight',
            'gateWidth',

            'fenceOffsetX',
            'fenceOffsetZ',

            'pathWidth',
            'pathTileSize',

            'photoScale',

            'photoWidthMm',
            'photoHeightMm',

            'photoOffsetX',
            'photoOffsetY',

            'photoAbsoluteX',
            'photoAbsoluteY',

            'furnitureScale',
            'vaseScale',

            'nameFontSize',
            'datesFontSize',
            'epitaphFontSize',

            'textOffsetX',
            'textOffsetY',

            'epitaphOffsetX',
            'epitaphOffsetY'
        ];


        numericFields.forEach(key => {

            if (
                data[key] !== undefined &&
                typeof data[key] === 'string'
            ) {

                const val =
                    parseFloat(data[key]);

                data[key] =
                    isNaN(val)
                        ? 0
                        : val;
            }

        });


        return data;
    }


    // ============================================================
    // СОХРАНЕНИЕ
    // ============================================================

    saveToFile() {

        try {

            // ----------------------------------------------------
            // 1. STATE ← UI
            // ----------------------------------------------------

            this.syncStateFromUI();


            // ----------------------------------------------------
            // 2. Основной памятник
            // ----------------------------------------------------

            const mainMonument =
                this.getMainMonumentData();


            // ----------------------------------------------------
            // 3. Дублеры
            // ----------------------------------------------------

            const duplicators =
                this.getDuplicatorsData();


            // ----------------------------------------------------
            // 4. Мебель / вазы / камера
            // ----------------------------------------------------

            const furnitureData =
                this.getFurnitureData();

            const vasesData =
                this.getVasesData();

            const cameraState =
                this.getCameraState();

            const steleName =
                this.getSteleName();


            // ----------------------------------------------------
            // 5. ПОЛНЫЙ JSON
            // ----------------------------------------------------

            const projectData = {

                version: '3.1',

                savedAt:
                    new Date().toISOString(),


                projectInfo: {

                    name:
                        this.state.projectName ||
                        'Без названия',

                    steleName,

                    steleType:
                        this.state.steleType ||
                        'rectangle',

                    fontFamily:
                        this.state.fontFamily ||
                        'Arial, sans-serif',

                    material:
                        this.state.material ||
                        'marble',

                    fullName:
                        this.state.fullName ||
                        '',

                    dates:
                        this.state.dates ||
                        '',

                    hasPhoto:
                        !!(
                            this.state.textureUrl ||
                            this.state.photoUrl
                        ),

                    createdAt:
                        new Date().toISOString()
                },


                projectName:
                    this.state.projectName ||
                    'Без названия',


                // ------------------------------------------------
                // СОХРАНЯЕМ ОБЩИЙ STATE
                // ------------------------------------------------

                ...this.cloneData(this.state),


                // ------------------------------------------------
                // ГЛАВНОЕ:
                // ОСНОВНОЙ + ВСЕ ДУБЛЕРЫ
                // ------------------------------------------------

                monuments: [
                    mainMonument,
                    ...duplicators
                ],


                furniture:
                    furnitureData,

                vases:
                    vasesData,

                camera:
                    cameraState,


                metadata: {

                    format: 'monument-project',

                    version: '3.1',

                    projectName:
                        this.state.projectName ||
                        'Без названия',

                    steleName,

                    steleType:
                        this.state.steleType ||
                        'rectangle',

                    fontFamily:
                        this.state.fontFamily ||
                        'Arial, sans-serif',

                    material:
                        this.state.material ||
                        'marble',

                    hasPhoto:
                        !!(
                            this.state.textureUrl ||
                            this.state.photoUrl
                        ),

                    hasFurniture:
                        furnitureData.length > 0,

                    hasVases:
                        vasesData.length > 0,

                    monumentCount:
                        1 + duplicators.length,

                    duplicateCount:
                        duplicators.length,

                    savedAt:
                        new Date().toISOString()
                }
            };


            // ----------------------------------------------------
            // Исправляем типы внутри основного state
            // ----------------------------------------------------

            this.fixDataTypes(projectData);


            // ----------------------------------------------------
            // Также исправляем типы у каждого памятника
            // ----------------------------------------------------

            projectData.monuments.forEach(monument => {

                if (monument.data) {
                    this.fixDataTypes(
                        monument.data
                    );
                }

            });


            // ----------------------------------------------------
            // ЛОГ ПЕРЕД СОХРАНЕНИЕМ
            // ----------------------------------------------------

            console.log(
                '💾 Сохраняем проект:',
                projectData
            );

            console.log(
                `🏛️ Памятников: ${projectData.monuments.length}`
            );

            console.log(
                `📋 Дублеров: ${duplicators.length}`
            );


            duplicators.forEach((monument, index) => {

                console.log(
                    `📋 Дублер #${index + 1}:`,
                    {
                        id: monument.id,
                        position: monument.position,
                        fullName:
                            monument.data.fullName,
                        dates:
                            monument.data.dates,
                        textureUrl:
                            monument.data.textureUrl,
                        photoShape:
                            monument.data.photoShape,
                        photoOffsetX:
                            monument.data.photoOffsetX,
                        photoOffsetY:
                            monument.data.photoOffsetY,
                        engravingsFront:
                            monument.data.engravingsFront?.length || 0,
                        engravingsBack:
                            monument.data.engravingsBack?.length || 0
                    }
                );

            });


            // ----------------------------------------------------
            // JSON
            // ----------------------------------------------------

            const jsonString =
                JSON.stringify(
                    projectData,
                    null,
                    2
                );


            const blob =
                new Blob(
                    [jsonString],
                    {
                        type:
                            'application/json'
                    }
                );


            const url =
                URL.createObjectURL(blob);


            const link =
                document.createElement('a');

            link.href = url;

            link.download =
                `monument_${Date.now()}.json`;

            document.body.appendChild(link);

            link.click();

            document.body.removeChild(link);

            URL.revokeObjectURL(url);


            showToast(
                `💾 Проект "${this.state.projectName}" сохранён! Дублеров: ${duplicators.length}`,
                'success'
            );


            return true;

        } catch (error) {

            console.error(
                '❌ Ошибка сохранения проекта:',
                error
            );

            showToast(
                '❌ Ошибка сохранения: ' +
                error.message,
                'error'
            );

            return false;
        }
    }


    // ============================================================
    // ОЧИСТКА ГРУППЫ ДУБЛЕРОВ
    // ============================================================

    clearDuplicators() {

        const manager =
            this.getMonumentManager();

        if (!manager) {
            return;
        }


        // Удаляем 3D-группы
        manager.monuments.forEach(monument => {

            if (monument?.group) {

                monument.group.traverse(child => {

                    if (child.geometry) {
                        child.geometry.dispose();
                    }

                    if (child.material) {

                        if (
                            Array.isArray(
                                child.material
                            )
                        ) {

                            child.material.forEach(
                                material => {
                                    material.dispose();
                                }
                            );

                        } else {

                            child.material.dispose();
                        }
                    }

                });


                if (
                    monument.group.parent
                ) {
                    monument.group.parent.remove(
                        monument.group
                    );
                }
            }

        });


        // На всякий случай очищаем оставшиеся children
        if (manager.monumentsGroup) {

            while (
                manager.monumentsGroup.children.length > 0
            ) {

                const child =
                    manager.monumentsGroup.children[0];

                child.traverse(node => {

                    if (node.geometry) {
                        node.geometry.dispose();
                    }

                    if (node.material) {

                        if (
                            Array.isArray(
                                node.material
                            )
                        ) {

                            node.material.forEach(
                                material =>
                                    material.dispose()
                            );

                        } else {

                            node.material.dispose();
                        }
                    }

                });

                manager.monumentsGroup.remove(
                    child
                );
            }
        }


        manager.monuments = [];

        manager.activeIndex = -1;

        manager.nextId = 1;


        console.log(
            '🧹 Все старые дублеры очищены'
        );
    }


    // ============================================================
    // ВОССТАНОВЛЕНИЕ ДУБЛЕРОВ
    // ============================================================

    async restoreDuplicators(monumentsData) {

        const manager =
            this.getMonumentManager();

        if (!manager) {

            console.error(
                '❌ Не найден MultiMonumentManager'
            );

            return;
        }


        if (
            !Array.isArray(monumentsData) ||
            monumentsData.length <= 1
        ) {
            return;
        }


        // Первый элемент — основной
        const duplicates =
            monumentsData.slice(1);


        console.log(
            `📥 Восстанавливаем дублеров: ${duplicates.length}`
        );


        for (
            let i = 0;
            i < duplicates.length;
            i++
        ) {

            const saved =
                duplicates[i];

            if (!saved) {
                continue;
            }


            // --------------------------------------------
            // Данные
            // --------------------------------------------

            const data =
                this.cloneData(
                    saved.data || {}
                );


            const id =
                Number(
                    saved.id ??
                    data.id ??
                    i + 1
                );


            data.id = id;


            // --------------------------------------------
            // Позиция
            // --------------------------------------------

            const position = {

                x:
                    Number(
                        saved.position?.x
                    ) || 0,

                y:
                    Number(
                        saved.position?.y
                    ) || 0,

                z:
                    Number(
                        saved.position?.z
                    ) || 0
            };


            // --------------------------------------------
            // Создаем THREE.Group
            // --------------------------------------------

            const group =
                new THREE.Group();

            group.position.set(
                position.x,
                position.y,
                position.z
            );


            group.userData.monumentId =
                id;

            group.userData.isMonument =
                true;

            group.userData.isDuplicator =
                true;


            manager.monumentsGroup.add(
                group
            );


            // --------------------------------------------
            // Создаем запись менеджера
            // --------------------------------------------

            const monument = {

                id,

                data,

                group,

                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                }

            };


            manager.monuments.push(
                monument
            );


            // --------------------------------------------
            // nextId
            // --------------------------------------------

            if (
                id >= manager.nextId
            ) {
                manager.nextId =
                    id + 1;
            }


            console.log(
                `📋 Создаём дублер #${i + 1}`,
                {
                    id,
                    position,
                    fullName:
                        data.fullName,
                    dates:
                        data.dates,
                    textureUrl:
                        data.textureUrl,
                    photoShape:
                        data.photoShape
                }
            );


            // --------------------------------------------
            // Строим 3D
            // --------------------------------------------

            try {

                await manager.rebuildSimpleMonument(
                    manager.monuments.length - 1
                );

            } catch (error) {

                console.error(
                    `❌ Ошибка восстановления дублера #${i + 1}:`,
                    error
                );
            }


            // Небольшая пауза между дублерами
            await new Promise(resolve =>
                setTimeout(resolve, 20)
            );
        }


        // Активным делаем последний
        if (
            manager.monuments.length > 0
        ) {

            manager.activeIndex =
                manager.monuments.length - 1;
        }


        // Перерисовываем список
        if (
            typeof manager.renderMonumentList ===
            'function'
        ) {

            manager.renderMonumentList();
        }


        console.log(
            `✅ Восстановлено дублеров: ${duplicates.length}`
        );
    }


    // ============================================================
    // ЗАГРУЗКА ФАЙЛА
    // ============================================================

    async loadFromFile(file) {

        return new Promise(resolve => {

            const reader =
                new FileReader();


            reader.onload = async e => {

                try {

                    const data =
                        JSON.parse(
                            e.target.result
                        );


                    console.log(
                        '📂 Загружаем проект:',
                        data
                    );


                    // ==================================================
                    // 1. ОПРЕДЕЛЯЕМ ФОРМАТ
                    // ==================================================

                    const monuments =
                        Array.isArray(
                            data.monuments
                        )
                            ? data.monuments
                            : [];


                    const mainSaved =
                        monuments.length > 0
                            ? monuments[0]
                            : null;


                    // ==================================================
                    // 2. СТАРЫЙ / НОВЫЙ ФОРМАТ
                    // ==================================================

                    let realData;


                    if (
                        mainSaved &&
                        mainSaved.data
                    ) {

                        // ----------------------------------------------
                        // НОВЫЙ ФОРМАТ 3.1
                        // ----------------------------------------------

                        realData =
                            this.cloneData(
                                mainSaved.data
                            );

                    } else {

                        // ----------------------------------------------
                        // СТАРЫЙ ФОРМАТ 3.0
                        // ----------------------------------------------

                        const ui =
                            data.ui ||
                            data;


                        realData = {

                            steleType:
                                ui.steleType ||
                                ui.steleModel ||
                                'custom_stl_monument',

                            steleModel:
                                ui.steleModel ||
                                ui.steleType ||
                                'custom_stl_monument',

                            width:
                                parseFloat(
                                    ui.widthRange
                                ) ||
                                parseFloat(
                                    ui.width
                                ) ||
                                0.85,

                            height:
                                parseFloat(
                                    ui.heightRange
                                ) ||
                                parseFloat(
                                    ui.height
                                ) ||
                                1.65,

                            depth:
                                parseFloat(
                                    ui.depth
                                ) ||
                                0.08,

                            material:
                                ui.materialSelect ||
                                ui.material ||
                                'beige_granite',

                            fenceEnabled:
                                ui.fenceEnabled ??
                                true,

                            fenceWidth:
                                parseFloat(
                                    ui.fenceWidth
                                ) || 1.5,

                            fenceLength:
                                parseFloat(
                                    ui.fenceLength
                                ) || 2.5,

                            fenceType:
                                ui.fenceType ||
                                'pipe',

                            fenceHeight:
                                parseFloat(
                                    ui.fenceHeight
                                ) || 0.6,

                            fenceMaterial:
                                ui.fenceMaterial ||
                                'steel',

                            fenceGateSide:
                                ui.fenceGateSide ||
                                'back',

                            gateWidth:
                                parseFloat(
                                    ui.gateWidth
                                ) || 0.8,

                            flowerEnabled:
                                ui.flowerEnabled ??
                                true,

                            flowerWidth:
                                parseFloat(
                                    ui.flowerWidth
                                ) || 0.6,

                            flowerLength:
                                parseFloat(
                                    ui.flowerLength
                                ) || 0.9,

                            flowerbedType:
                                ui.flowerbedType ||
                                'grass',

                            pathEnabled:
                                ui.pathEnabled ??
                                true,

                            pathWidth:
                                parseFloat(
                                    ui.pathWidth
                                ) || 0.5,

                            pathMaterial:
                                ui.pathMaterial ||
                                'tile_gray',

                            graveWidth:
                                parseFloat(
                                    ui.graveWidth
                                ) || 0.9,

                            graveLength:
                                parseFloat(
                                    ui.graveLength
                                ) || 1.5,

                            baseHeight:
                                parseFloat(
                                    ui.baseHeight
                                ) || 0.15,

                            fullName:
                                ui.fullName ||
                                '',

                            dates:
                                ui.datesText ||
                                ui.dates ||
                                '',

                            epitaph:
                                ui.epitaphText ||
                                ui.epitaph ||
                                '',

                            fontFamily:
                                ui.fontFamily ||
                                'Arial, sans-serif',

                            textColor:
                                ui.textColor ||
                                '#ffffff',

                            nameFontSize:
                                parseInt(
                                    ui.nameFontSize
                                ) || 48,

                            datesFontSize:
                                parseInt(
                                    ui.datesFontSize
                                ) || 32,

                            epitaphFontSize:
                                parseInt(
                                    ui.epitaphFontSize
                                ) || 40,

                            fenceOffsetX:
                                parseFloat(
                                    ui.fenceOffsetX
                                ) || 0,

                            fenceOffsetZ:
                                parseFloat(
                                    ui.fenceOffsetZ
                                ) || 0,

                            pathTileSize:
                                parseFloat(
                                    ui.pathTileSize
                                ) || 0.3,

                            pathJointColor:
                                ui.pathJointColor ||
                                '#666666',

                            pathTileLayout:
                                ui.pathTileLayout ||
                                'brick',

                            photoUrl:
                                ui.photoUrl ||
                                ui.textureUrl ||
                                null,

                            textureUrl:
                                ui.textureUrl ||
                                ui.photoUrl ||
                                null,

                            photoShape:
                                ui.photoShape ||
                                'oval',

                            photoWidthMm:
                                parseFloat(
                                    ui.photoWidthMm
                                ) || 100,

                            photoHeightMm:
                                parseFloat(
                                    ui.photoHeightMm
                                ) || 140,

                            photoScale:
                                parseFloat(
                                    ui.photoScale
                                ) || 1,

                            photoOffsetX:
                                parseFloat(
                                    ui.photoOffsetX
                                ) || 0,

                            photoOffsetY:
                                parseFloat(
                                    ui.photoOffsetY
                                ) || 0,

                            engravingsFront:
                                this.cloneData(
                                    ui.engravingsFront ||
                                    []
                                ),

                            engravingsBack:
                                this.cloneData(
                                    ui.engravingsBack ||
                                    []
                                )
                        };
                    }


                    // ==================================================
                    // 3. ВОССТАНАВЛИВАЕМ ВЕСЬ STATE
                    // ==================================================

                    // Сначала общий state из файла
                    Object.keys(data).forEach(key => {

                        // Служебные поля не кладём в state
                        if (
                            key === 'monuments' ||
                            key === 'metadata' ||
                            key === 'projectInfo' ||
                            key === 'camera' ||
                            key === 'furniture' ||
                            key === 'vases' ||
                            key === 'ui'
                        ) {
                            return;
                        }


                        // Не переносим мусорные служебные значения
                        if (
                            typeof data[key] ===
                            'function'
                        ) {
                            return;
                        }


                        this.state[key] =
                            this.cloneData(
                                data[key]
                            );
                    });


                    // Основные данные поверх общего state
                    Object.assign(
                        this.state,
                        realData
                    );


                    // Название проекта
                    this.state.projectName =
                        data.projectName ||
                        data.projectInfo?.name ||
                        this.state.projectName ||
                        'Без названия';


                    // Гарантируем фото
                    if (
                        !this.state.textureUrl &&
                        this.state.photoUrl
                    ) {

                        this.state.textureUrl =
                            this.state.photoUrl;
                    }

                    if (
                        !this.state.photoUrl &&
                        this.state.textureUrl
                    ) {

                        this.state.photoUrl =
                            this.state.textureUrl;
                    }


                    console.log(
                        '📝 Основной state восстановлен:',
                        this.state
                    );


                    // ==================================================
                    // 4. ОБНОВЛЯЕМ UI
                    // ==================================================

                    this.updateAllUIFromState();


                    // ==================================================
                    // 5. ОТКЛЮЧАЕМ АВТООБНОВЛЕНИЕ
                    // ==================================================

                    window._disableAutoMonument =
                        true;

                    window._forceMainUpdate =
                        true;


                    // ==================================================
                    // 6. ОЧИЩАЕМ СТАРЫХ ДУБЛЕРОВ
                    // ==================================================

                    this.clearDuplicators();


                    // ==================================================
                    // 7. ПЕРЕСТРАИВАЕМ ОСНОВНОЙ
                    // ==================================================

                    if (
                        typeof window.throttledUpdate ===
                        'function'
                    ) {

                        await window.throttledUpdate();

                    } else if (
                        typeof window.updateMonument ===
                        'function'
                    ) {

                        await window.updateMonument();

                    }


                    // ==================================================
                    // 8. ВОССТАНАВЛИВАЕМ ДУБЛЕРОВ
                    // ==================================================

                    if (
                        monuments.length > 1
                    ) {

                        await this.restoreDuplicators(
                            monuments
                        );
                    }


                    // ==================================================
                    // 9. ВОССТАНАВЛИВАЕМ КАМЕРУ
                    // ==================================================

                    if (
                        data.camera &&
                        window.camera &&
                        window.controls
                    ) {

                        const cameraPosition =
                            data.camera.position;

                        const cameraTarget =
                            data.camera.target;


                        if (
                            Array.isArray(
                                cameraPosition
                            ) &&
                            cameraPosition.length >= 3
                        ) {

                            window.camera.position.set(
                                cameraPosition[0],
                                cameraPosition[1],
                                cameraPosition[2]
                            );
                        }


                        if (
                            Array.isArray(
                                cameraTarget
                            ) &&
                            cameraTarget.length >= 3
                        ) {

                            window.controls.target.set(
                                cameraTarget[0],
                                cameraTarget[1],
                                cameraTarget[2]
                            );
                        }


                        window.controls.update();
                    }


                    // ==================================================
                    // 10. МЕБЕЛЬ / ВАЗЫ
                    //
                    // Их существующие менеджеры могут восстановить
                    // отдельно. Здесь сохраняем данные в state,
                    // чтобы они были доступны проекту.
                    // ==================================================

                    if (
                        Array.isArray(data.furniture)
                    ) {

                        this.state.savedFurniture =
                            this.cloneData(
                                data.furniture
                            );
                    }


                    if (
                        Array.isArray(data.vases)
                    ) {

                        this.state.savedVases =
                            this.cloneData(
                                data.vases
                            );
                    }


                    // ==================================================
                    // 11. СНИМАЕМ БЛОКИРОВКИ
                    // ==================================================

                    setTimeout(() => {

                        window._disableAutoMonument =
                            false;

                        window._forceMainUpdate =
                            false;

                    }, 500);


                    // ==================================================
                    // 12. CALLBACK
                    // ==================================================

                    if (
                        typeof this.onLoadCallback ===
                        'function'
                    ) {

                        try {

                            await this.onLoadCallback(
                                data
                            );

                        } catch (callbackError) {

                            console.warn(
                                '⚠️ Ошибка callback загрузки:',
                                callbackError
                            );
                        }
                    }


                    console.log(
                        '🎉 ПРОЕКТ ПОЛНОСТЬЮ ЗАГРУЖЕН'
                    );

                    console.log(
                        `🏛️ Всего памятников: ${Math.max(1, monuments.length)}`
                    );

                    console.log(
                        `📋 Дублеров: ${Math.max(0, monuments.length - 1)}`
                    );


                    showToast(
                        `✅ Проект загружен! Дублеров: ${Math.max(0, monuments.length - 1)}`,
                        'success'
                    );


                    resolve(true);


                } catch (error) {

                    console.error(
                        '❌ Ошибка загрузки проекта:',
                        error
                    );


                    window._disableAutoMonument =
                        false;

                    window._forceMainUpdate =
                        false;


                    showToast(
                        '❌ Ошибка загрузки: ' +
                        error.message,
                        'error'
                    );


                    resolve(false);
                }
            };


            reader.onerror = error => {

                console.error(
                    '❌ Ошибка чтения файла:',
                    error
                );

                showToast(
                    '❌ Не удалось прочитать файл',
                    'error'
                );

                resolve(false);
            };


            reader.readAsText(file);

        });
    }


    // ============================================================
    // ОБНОВЛЕНИЕ UI ИЗ STATE
    // ============================================================

    updateAllUIFromState() {

        const state =
            this.state;


        const setVal =
            (id, value) => {

                const el =
                    document.getElementById(id);

                if (!el) return;


                if (
                    el.type === 'checkbox'
                ) {

                    el.checked =
                        !!value;

                } else {

                    el.value =
                        value;
                }
            };


        const setText =
            (id, text) => {

                const el =
                    document.getElementById(id);

                if (el) {
                    el.textContent =
                        text;
                }
            };


        const setSelect =
            (id, value) => {

                const el =
                    document.getElementById(id);

                if (!el) return;

                el.value =
                    value;

                try {

                    el.dispatchEvent(
                        new Event('change')
                    );

                } catch (e) {}
            };


        // --------------------------------------------------------
        // НАЗВАНИЕ
        // --------------------------------------------------------

        setVal(
            'projectName',
            state.projectName ||
            'Без названия'
        );


        // --------------------------------------------------------
        // МАТЕРИАЛ
        // --------------------------------------------------------

        if (state.material) {

            setSelect(
                'materialSelect',
                state.material
            );
        }


        // --------------------------------------------------------
        // СТЕЛА
        // --------------------------------------------------------

        if (state.steleType) {

            setSelect(
                'steleTypeSelect',
                state.steleType
            );
        }


        // --------------------------------------------------------
        // РАЗМЕРЫ
        // --------------------------------------------------------

        if (
            state.width !== undefined
        ) {

            setVal(
                'widthRange',
                state.width
            );

            setText(
                'widthVal',
                Number(state.width).toFixed(1) +
                ' м'
            );
        }


        if (
            state.height !== undefined
        ) {

            setVal(
                'heightRange',
                state.height
            );

            setText(
                'heightVal',
                Number(state.height).toFixed(1) +
                ' м'
            );
        }


        // --------------------------------------------------------
        // ТЕКСТ
        // --------------------------------------------------------

        setVal(
            'fullName',
            state.fullName || ''
        );

        setVal(
            'datesText',
            state.dates || ''
        );

        setVal(
            'epitaphText',
            state.epitaph || ''
        );

        setSelect(
            'fontFamily',
            state.fontFamily ||
            'Arial, sans-serif'
        );

        setVal(
            'textColor',
            state.textColor ||
            '#FFFFFF'
        );


        if (
            state.nameFontSize !== undefined
        ) {

            setVal(
                'nameFontSize',
                state.nameFontSize
            );

            setText(
                'nameFontSizeVal',
                state.nameFontSize
            );
        }


        if (
            state.datesFontSize !== undefined
        ) {

            setVal(
                'datesFontSize',
                state.datesFontSize
            );

            setText(
                'datesFontSizeVal',
                state.datesFontSize
            );
        }


        if (
            state.epitaphFontSize !== undefined
        ) {

            setVal(
                'epitaphFontSize',
                state.epitaphFontSize
            );

            setText(
                'epitaphFontSizeVal',
                state.epitaphFontSize
            );
        }


        setText(
            'textOffsetXVal',
            Number(
                state.textOffsetX || 0
            ).toFixed(2)
        );

        setText(
            'textOffsetYVal',
            Number(
                state.textOffsetY || 0
            ).toFixed(2)
        );

        setText(
            'epitaphOffsetXVal',
            Number(
                state.epitaphOffsetX || 0
            ).toFixed(2)
        );

        setText(
            'epitaphOffsetYVal',
            Number(
                state.epitaphOffsetY || 0
            ).toFixed(2)
        );


        // --------------------------------------------------------
        // ФОТО
        // --------------------------------------------------------

        setSelect(
            'photoShape',
            state.photoShape ||
            'oval'
        );


        if (
            state.photoWidthMm !== undefined
        ) {

            setVal(
                'photoWidthMm',
                state.photoWidthMm
            );
        }


        if (
            state.photoHeightMm !== undefined
        ) {

            setVal(
                'photoHeightMm',
                state.photoHeightMm
            );
        }


        if (
            state.photoScale !== undefined
        ) {

            setVal(
                'photoScale',
                state.photoScale
            );

            setText(
                'photoScaleVal',
                Number(
                    state.photoScale
                ).toFixed(1)
            );
        }


        setText(
            'photoOffsetXVal',
            Number(
                state.photoOffsetX || 0
            ).toFixed(2)
        );


        setText(
            'photoOffsetYVal',
            Number(
                state.photoOffsetY || 0
            ).toFixed(2)
        );


        const customSize =
            document.getElementById(
                'customPhotoSize'
            );

        if (customSize) {

            customSize.style.display =
                state.photoShape === 'custom'
                    ? 'block'
                    : 'none';
        }


        document
            .querySelectorAll(
                '.shape-option'
            )
            .forEach(el => {

                el.classList.toggle(
                    'active',
                    el.dataset.shape ===
                    state.photoShape
                );

            });


        // --------------------------------------------------------
        // НАДГРОБИЕ
        // --------------------------------------------------------

        if (
            state.graveWidth !== undefined
        ) {

            setVal(
                'graveWidth',
                state.graveWidth
            );

            setText(
                'graveWidthVal',
                Number(
                    state.graveWidth
                ).toFixed(2) +
                ' м'
            );
        }


        if (
            state.graveLength !== undefined
        ) {

            setVal(
                'graveLength',
                state.graveLength
            );

            setText(
                'graveLengthVal',
                Number(
                    state.graveLength
                ).toFixed(2) +
                ' м'
            );
        }


        if (
            state.baseHeight !== undefined
        ) {

            setVal(
                'baseHeight',
                state.baseHeight
            );

            setText(
                'baseHeightVal',
                Number(
                    state.baseHeight
                ).toFixed(2) +
                ' м'
            );
        }


        // --------------------------------------------------------
        // ЦВЕТНИК
        // --------------------------------------------------------

        setVal(
            'flowerEnabled',
            state.flowerEnabled !== undefined
                ? state.flowerEnabled
                : true
        );


        if (
            state.flowerWidth !== undefined
        ) {

            setVal(
                'flowerWidth',
                state.flowerWidth
            );

            setText(
                'flowerWidthVal',
                Number(
                    state.flowerWidth
                ).toFixed(2) +
                ' м'
            );
        }


        if (
            state.flowerLength !== undefined
        ) {

            setVal(
                'flowerLength',
                state.flowerLength
            );

            setText(
                'flowerLengthVal',
                Number(
                    state.flowerLength
                ).toFixed(2) +
                ' м'
            );
        }


        setSelect(
            'flowerbedType',
            state.flowerbedType ||
            'grass'
        );


        setVal(
            'flowerColor',
            state.flowerColor ||
            '#4caf50'
        );


        const flowerControls =
            document.getElementById(
                'flowerControls'
            );

        if (flowerControls) {

            flowerControls.style.display =
                state.flowerEnabled
                    ? 'block'
                    : 'none';
        }


        // --------------------------------------------------------
        // ДОРОЖКА
        // --------------------------------------------------------

        setVal(
            'pathEnabled',
            state.pathEnabled !== undefined
                ? state.pathEnabled
                : true
        );


        if (
            state.pathWidth !== undefined
        ) {

            setVal(
                'pathWidth',
                state.pathWidth
            );

            setText(
                'pathWidthVal',
                Number(
                    state.pathWidth
                ).toFixed(2) +
                ' м'
            );
        }


        setSelect(
            'pathMaterial',
            state.pathMaterial ||
            'tile_gray'
        );


        setVal(
            'pathColor',
            state.pathColor ||
            '#888888'
        );


        if (
            state.pathTileSize !== undefined
        ) {

            setVal(
                'pathTileSize',
                state.pathTileSize
            );

            setText(
                'pathTileSizeVal',
                Number(
                    state.pathTileSize
                ).toFixed(2) +
                ' м'
            );
        }


        setVal(
            'pathJointColor',
            state.pathJointColor ||
            '#666666'
        );


        setSelect(
            'pathTileLayout',
            state.pathTileLayout ||
            'brick'
        );


        const pathControls =
            document.getElementById(
                'pathControls'
            );

        if (pathControls) {

            pathControls.style.display =
                state.pathEnabled
                    ? 'block'
                    : 'none';
        }


        // --------------------------------------------------------
        // ОГРАДКА
        // --------------------------------------------------------

        setVal(
            'fenceEnabled',
            state.fenceEnabled !== undefined
                ? state.fenceEnabled
                : true
        );


        if (
            state.fenceWidth !== undefined
        ) {

            setVal(
                'fenceWidth',
                state.fenceWidth
            );

            setText(
                'fenceWidthVal',
                Number(
                    state.fenceWidth
                ).toFixed(1) +
                ' м'
            );
        }


        if (
            state.fenceLength !== undefined
        ) {

            setVal(
                'fenceLength',
                state.fenceLength
            );

            setText(
                'fenceLengthVal',
                Number(
                    state.fenceLength
                ).toFixed(1) +
                ' м'
            );
        }


        setSelect(
            'fenceType',
            state.fenceType ||
            'pipe'
        );


        setSelect(
            'fenceMaterial',
            state.fenceMaterial ||
            'steel'
        );


        if (
            state.fenceHeight !== undefined
        ) {

            setVal(
                'fenceHeight',
                state.fenceHeight
            );

            setText(
                'fenceHeightVal',
                Number(
                    state.fenceHeight
                ).toFixed(1) +
                ' м'
            );
        }


        setSelect(
            'fenceGateSide',
            state.fenceGateSide ||
            'back'
        );


        if (
            state.gateWidth !== undefined
        ) {

            setVal(
                'gateWidth',
                state.gateWidth
            );

            setText(
                'gateWidthVal',
                Number(
                    state.gateWidth
                ).toFixed(1) +
                ' м'
            );
        }


        if (
            state.fenceOffsetX !== undefined
        ) {

            setVal(
                'fenceOffsetX',
                state.fenceOffsetX
            );

            setText(
                'fenceOffsetXDisplay',
                Number(
                    state.fenceOffsetX
                ).toFixed(2)
            );
        }


        if (
            state.fenceOffsetZ !== undefined
        ) {

            setVal(
                'fenceOffsetZ',
                state.fenceOffsetZ
            );

            setText(
                'fenceOffsetZDisplay',
                Number(
                    state.fenceOffsetZ
                ).toFixed(2)
            );
        }


        const fenceControls =
            document.getElementById(
                'fenceControls'
            );

        if (fenceControls) {

            fenceControls.style.display =
                state.fenceEnabled
                    ? 'block'
                    : 'none';
        }


        // --------------------------------------------------------
        // МЕБЕЛЬ
        // --------------------------------------------------------

        setVal(
            'showFurniture',
            state.showFurniture !== undefined
                ? state.showFurniture
                : true
        );


        if (
            state.furnitureScale !== undefined
        ) {

            setVal(
                'furnitureScale',
                state.furnitureScale
            );

            setText(
                'furnitureScaleVal',
                Number(
                    state.furnitureScale
                ).toFixed(2)
            );
        }


        // --------------------------------------------------------
        // ВАЗЫ
        // --------------------------------------------------------

        setVal(
            'showVases',
            state.showVases !== undefined
                ? state.showVases
                : true
        );


        if (
            state.vaseScale !== undefined
        ) {

            setVal(
                'vaseScale',
                state.vaseScale
            );

            setText(
                'vaseScaleVal',
                Number(
                    state.vaseScale
                ).toFixed(2)
            );
        }


        setSelect(
            'vaseMaterialSelect',
            state.vaseMaterial ||
            'marble'
        );


        // --------------------------------------------------------
        // ГРАВИРОВКИ
        // --------------------------------------------------------

        if (
            typeof updateEngravingsFrontList ===
            'function'
        ) {

            updateEngravingsFrontList();
        }


        if (
            typeof updateEngravingsBackList ===
            'function'
        ) {

            updateEngravingsBackList();
        }


        // --------------------------------------------------------
        // 3D МОДЕЛИ
        // --------------------------------------------------------

        if (
            state.modelScale !== undefined
        ) {

            setVal(
                'modelScale',
                state.modelScale
            );
        }


        if (
            state.modelPosY !== undefined
        ) {

            setVal(
                'modelPosY',
                state.modelPosY
            );
        }


        setSelect(
            'modelMaterial',
            state.modelMaterial ||
            'original'
        );


        setSelect(
            'modelFontFamily',
            state.modelFontFamily ||
            'Arial, sans-serif'
        );


        setVal(
            'modelFrontText',
            state.modelFrontText ||
            ''
        );


        if (
            state.modelFrontFontSize !== undefined
        ) {

            setVal(
                'modelFrontFontSize',
                state.modelFrontFontSize
            );
        }


        setVal(
            'modelBackName',
            state.modelBackName ||
            ''
        );


        setVal(
            'modelBackDates',
            state.modelBackDates ||
            ''
        );


        if (
            state.modelBackFontSize !== undefined
        ) {

            setVal(
                'modelBackFontSize',
                state.modelBackFontSize
            );
        }


        console.log(
            '✅ UI обновлён из состояния'
        );
    }
}


// ============================================================
// TOAST
// ============================================================

function showToast(message, type) {

    let toast =
        document.getElementById(
            'toast-notification'
        );


    if (!toast) {

        toast =
            document.createElement('div');

        toast.id =
            'toast-notification';


        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            z-index: 99999;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            opacity: 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.05);
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 90%;
            text-align: center;
        `;


        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;

    toast.style.opacity =
        '1';

    toast.style.transform =
        'translateX(-50%) translateY(0)';


    if (type === 'success') {

        toast.style.borderColor =
            'rgba(0,168,150,0.3)';

        toast.style.background =
            'rgba(0,168,150,0.15)';

    } else if (type === 'error') {

        toast.style.borderColor =
            'rgba(231,76,60,0.3)';

        toast.style.background =
            'rgba(231,76,60,0.15)';

    } else {

        toast.style.borderColor =
            'rgba(255,255,255,0.05)';

        toast.style.background =
            'rgba(0,0,0,0.85)';
    }


    clearTimeout(
        toast._timeout
    );


    toast._timeout =
        setTimeout(() => {

            toast.style.opacity =
                '0';

            toast.style.transform =
                'translateX(-50%) translateY(20px)';

        }, 3000);
}