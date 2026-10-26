// modules/drag/CustomStelePhotoDrag.js
// ============================================================
// ФОТОГРАФИИ ПОГРЕБЁННЫХ:
// - несколько фотографий;
// - отдельные координаты для каждого человека;
// - совместимость со старыми проектами;
// - общая функция для основной стелы и дубликаторов.
// ============================================================

import * as THREE from 'three';

export class CustomStelePhotoDrag {
    constructor(options = {}) {
        this.renderer = options.renderer || null;
        this.camera = options.camera || null;
        this.controls = options.controls || null;

        this.isDragging = false;
        this.selectedPhoto = null;
        this.dragOffset = new THREE.Vector3();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.activeState = null;
        this.activeBurial = null;
        this.activeGroup = null;

        this.boundPointerDown =
            this.onPointerDown.bind(this);

        this.boundPointerMove =
            this.onPointerMove.bind(this);

        this.boundPointerUp =
            this.onPointerUp.bind(this);

        this.bindEvents();
		this.setupPhotoPositionControls();
    }

    // --------------------------------------------------------
    // ПОДКЛЮЧЕНИЕ СОБЫТИЙ
    // --------------------------------------------------------

    bindEvents() {
        const canvas = this.renderer?.domElement;

        if (!canvas) return;

        canvas.addEventListener(
            'pointerdown',
            this.boundPointerDown
        );

        window.addEventListener(
            'pointermove',
            this.boundPointerMove
        );

        window.addEventListener(
            'pointerup',
            this.boundPointerUp
        );
    }

    // --------------------------------------------------------
    // ПОЛУЧЕНИЕ ФОТОГРАФИЙ ЧЕЛОВЕКА
    // --------------------------------------------------------

    getPhotoUrl(person) {
        return person?.photoUrl ||
            person?.textureUrl ||
            null;
    }

    // --------------------------------------------------------
    // СОЗДАНИЕ ОДНОЙ ФОТОГРАФИИ
    // --------------------------------------------------------

    createPhotoMesh(person, index, options = {}) {
        const url = this.getPhotoUrl(person);

        if (!url) return null;

        const shape =
            person.photoShape ||
            options.photoShape ||
            'oval';

        const scale = Number(
            person.photoScale ??
            options.photoScale ??
            1
        );

        let width;
        let height;

        if (shape === 'custom') {
            width = Number(
                person.photoWidthMm ??
                options.photoWidthMm ??
                100
            ) / 1000;

            height = Number(
                person.photoHeightMm ??
                options.photoHeightMm ??
                140
            ) / 1000;
        } else {
            const sizes = {
                oval: {
                    width: 0.22,
                    height: 0.28
                },
                circle: {
                    width: 0.24,
                    height: 0.24
                },
                square: {
                    width: 0.22,
                    height: 0.22
                }
            };

            const size = sizes[shape] || sizes.oval;

            width = size.width;
            height = size.height;
        }



        let geometry;

        if (shape === 'circle') {
            geometry = new THREE.CircleGeometry(
                Math.max(width, height) / 2,
                64
            );
        } else if (shape === 'oval') {
            geometry = new THREE.CircleGeometry(0.5, 64);
            geometry.scale(width, height, 1);
        } else {
            geometry = new THREE.PlaneGeometry(
                width,
                height
            );
        }

        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            alphaTest: 0.05
        });

        const mesh = new THREE.Mesh(geometry, material);
		mesh.scale.set(scale, scale, 1);

        const defaultX = Number(
            person.photoPositionX ?? -0.28
        );

        const defaultY = Number(
            person.photoPositionY ??
            person.photoAbsoluteY ??
            options.defaultY ??
            0.6
        );

        mesh.position.set(
            defaultX,
            defaultY,
            Number(options.frontZ ?? 0.02)
        );

        mesh.renderOrder = 11 + index;

        // Метаданные связывают фотографию с конкретным человеком.
		mesh.userData.type = 'photo';
		mesh.userData.isDraggable = true;
		mesh.userData.isBurialPhoto = true;
		mesh.userData.burialId = person.id;
		mesh.userData.photoIndex = index;

		// Индивидуальный масштаб именно этого фото.
		mesh.userData.photoScale = scale;

        mesh.userData.limitX =
            Number(options.limitX ?? 0.3);

        mesh.userData.limitY =
            Number(options.limitY ?? 0.8);

        mesh.userData.steleCenterY =
            Number(options.centerY ?? 0.6);

        // Загружаем текстуру асинхронно.
        new THREE.TextureLoader().load(
            url,
            texture => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;

                // Если mesh уже удалён при обновлении сцены,
                // освобождаем загруженную текстуру.
                if (!mesh.parent) {
                    texture.dispose();
                    return;
                }

                material.map = texture;
                material.needsUpdate = true;
            },
            undefined,
            error => {
                console.error(
                    'Не удалось загрузить фотографию:',
                    person.id,
                    error
                );
            }
        );

        return mesh;
    }

    // --------------------------------------------------------
    // СОЗДАНИЕ ВСЕХ ФОТОГРАФИЙ
    // --------------------------------------------------------

    renderPhotos(decalsGroup, state, options = {}) {
        if (!decalsGroup || !state) return [];

        const burials = Array.isArray(state.burials)
            ? state.burials
            : [];

        const hasPersonPhotos = burials.some(
            person => this.getPhotoUrl(person)
        );

        const peopleToRender = hasPersonPhotos
            ? burials
            : (
                this.getPhotoUrl(state)
                    ? [{
                        id: 'legacy-photo',
                        photoUrl:
                            state.photoUrl || state.textureUrl,
                        textureUrl:
                            state.textureUrl || state.photoUrl,
                        photoPositionX:
                            state.photoAbsoluteX ??
                            state.photoOffsetX ??
                            0,
                        photoPositionY:
                            state.photoAbsoluteY ??
                            options.defaultY ??
                            0.6,
                        photoShape: state.photoShape,
                        photoScale: state.photoScale,
                        photoWidthMm: state.photoWidthMm,
                        photoHeightMm: state.photoHeightMm
                    }]
                    : []
            );

        const createdMeshes = [];

        peopleToRender.forEach((person, index) => {
            if (!this.getPhotoUrl(person)) return;

            const mesh = this.createPhotoMesh(
                person,
                index,
                options
            );

            if (!mesh) return;

            decalsGroup.add(mesh);
            createdMeshes.push(mesh);
        });

        return createdMeshes;
    }

    // --------------------------------------------------------
    // ПОИСК ЧЕЛОВЕКА ПО ID
    // --------------------------------------------------------

    findBurial(state, burialId) {
        if (!state || !Array.isArray(state.burials)) {
            return null;
        }

        return state.burials.find(
            person => person.id === burialId
        ) || null;
    }

    // --------------------------------------------------------
    // СОХРАНЕНИЕ КООРДИНАТ ОДНОЙ ФОТОГРАФИИ
    // --------------------------------------------------------

	savePhotoPosition(mesh, state) {
		if (!mesh || !state) return;

		const burialId =
			mesh.userData.burialId ?? this.selectedBurialId;

		const person = this.findBurial(state, burialId);

		if (person) {
			person.photoPositionX = mesh.position.x;
			person.photoPositionY = mesh.position.y;
			person.photoAbsoluteX = mesh.position.x;
			person.photoAbsoluteY = mesh.position.y;

			// Обновляем соответствующую запись в глобальном состоянии,
			// если активная стела использует отдельный объект данных.
			const globalBurials = window.state?.burials;

			if (Array.isArray(globalBurials)) {
				const globalPerson = globalBurials.find(
					item => item.id === burialId
				);

				if (globalPerson && globalPerson !== person) {
					globalPerson.photoPositionX = mesh.position.x;
					globalPerson.photoPositionY = mesh.position.y;
					globalPerson.photoAbsoluteX = mesh.position.x;
					globalPerson.photoAbsoluteY = mesh.position.y;
				}
			}

			return;
		}

		// Совместимость со старыми проектами.
		state.photoAbsoluteX = mesh.position.x;
		state.photoAbsoluteY = mesh.position.y;
		state.photoOffsetX = mesh.position.x;
		state.photoOffsetY =
			mesh.position.y -
			Number(mesh.userData.steleCenterY ?? 0);
	}


    // --------------------------------------------------------
    // ПЕРЕТАСКИВАНИЕ
    // --------------------------------------------------------
onPointerDown(event) {
    const canvas = this.renderer?.domElement;
    if (!canvas || !this.camera) return;

    // При каждом нажатии определяем актуальную группу:
    // основной памятник или выбранный дублер.
    const manager = window.multiMonumentManager;

    if (
        manager?.currentMode === 'duplicator' &&
        manager.activeIndex >= 0
    ) {
        const monument = manager.monuments?.[manager.activeIndex];

        if (!monument?.group || !monument?.data) return;

        const decalsGroup = monument.group.children.find(
            child =>
                child.name === 'decalsContainer' &&
                child.parent === monument.group
        );

        if (!decalsGroup) return;

        this.setActiveTarget({
            state: monument.data,
            decalsGroup,
            scene: this.scene
        });
    } else {
        // Для основной стелы используем её актуальное состояние.
        this.activeState = window.state || this.activeState;
        this.activeGroup =
            this.decalsGroup || this.activeGroup;
    }

    if (!this.activeGroup || !this.activeState) return;

    const checkbox = document.getElementById('enableMovePhoto');
    if (checkbox && !checkbox.checked) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    this.mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.activeGroup.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const photos = [];

    this.activeGroup.traverse(child => {
        if (
            child.isMesh &&
            child.userData?.type === 'photo' &&
            child.userData?.isDraggable
        ) {
            photos.push(child);
        }
    });

    const hits = this.raycaster.intersectObjects(photos, false);
    if (!hits.length) return;

	// Перетаскиваем именно то фото, по которому нажал пользователь.
	const hit = hits[0];

	if (!hit) return;

    // Берём существующий Mesh. Ничего не создаём и не удаляем.
    this.selectedPhoto = hit.object;
    this.selectedBurialId =
        this.selectedPhoto.userData.burialId ?? null;

    this.selectedPhoto.updateMatrixWorld(true);

    const worldPosition = new THREE.Vector3();
    this.selectedPhoto.getWorldPosition(worldPosition);

    const worldNormal = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(
            this.selectedPhoto.getWorldQuaternion(
                new THREE.Quaternion()
            )
        )
        .normalize();

    this.dragPlane = new THREE.Plane()
        .setFromNormalAndCoplanarPoint(worldNormal, worldPosition);

    // Обязательно Vector3: все расчёты выполняются в 3D.
    this.dragOffset.copy(hit.point).sub(worldPosition);

    // Запоминаем исходные координаты для прямого перемещения Mesh.
    this.dragStartPosition = this.selectedPhoto.position.clone();

    this.isDragging = true;

    if (this.controls) this.controls.enabled = false;
    canvas.style.cursor = 'grabbing';
}

onPointerMove(event) {
    if (!this.isDragging || !this.selectedPhoto || !this.dragPlane) {
        return;
    }

    const canvas = this.renderer?.domElement;
    if (!canvas || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    this.mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const worldPoint = new THREE.Vector3();

    if (!this.raycaster.ray.intersectPlane(this.dragPlane, worldPoint)) {
        return;
    }

    worldPoint.sub(this.dragOffset);

    const photo = this.selectedPhoto;
    const parent = photo.parent;

    if (!parent) return;

    // Меняем координаты того же самого объекта.
    // Сцену, геометрию и материал не пересоздаём.
    parent.updateMatrixWorld(true);

    const localPoint = parent.worldToLocal(worldPoint);

    if (
        !Number.isFinite(localPoint.x) ||
        !Number.isFinite(localPoint.y)
    ) {
        return;
    }

    photo.position.x = localPoint.x;
    photo.position.y = localPoint.y;

    // Сохраняем координаты конкретного человека.
    this.savePhotoPosition(photo, this.activeState);

    // Не вызываем renderer.render() вручную.
    // Не меняем renderOrder. Не перестраиваем сцену.
}

onPointerUp() {
    if (!this.isDragging) return;

    if (this.selectedPhoto) {
        this.savePhotoPosition(
            this.selectedPhoto,
            this.activeState
        );
    }

    this.isDragging = false;
    this.selectedPhoto = null;
    this.selectedBurialId = null;
    this.dragPlane = null;
    this.dragStartPosition = null;

    if (this.controls) this.controls.enabled = true;

    const canvas = this.renderer?.domElement;
    if (canvas) canvas.style.cursor = 'default';
}

	// --------------------------------------------------------
	// РУЧНАЯ НАСТРОЙКА КООРДИНАТ ФОТОГРАФИИ
	// --------------------------------------------------------

	setupPhotoPositionControls() {
		const personSelect = document.getElementById('photoPositionPerson');
		const xInput = document.getElementById('photoPositionXInput');
		const yInput = document.getElementById('photoPositionYInput');

		if (!personSelect || !xInput || !yInput) return;

		const getTarget = () => {
			const manager = window.multiMonumentManager;

			// Если выбран дубликатор — работаем с ним.
			if (
				manager?.currentMode === 'duplicator' &&
				manager.activeIndex >= 0
			) {
				const monument = manager.monuments?.[manager.activeIndex];

				const group = monument?.group?.children?.find(
					child =>
						child.name === 'decalsContainer' &&
						child.parent === monument.group
				);

				if (monument?.data && group) {
					this.setActiveTarget({
						state: monument.data,
						decalsGroup: group,
						scene: this.scene
					});
				}
			} else {
				// Иначе работаем с основной стелой.
				this.activeState = window.state || this.activeState;
				this.activeGroup = this.decalsGroup || this.activeGroup;
			}

			return {
				state: this.activeState,
				group: this.activeGroup
			};
		};

		// Получить фото выбранного человека.
		const getPhoto = () => {
			const { state, group } = getTarget();
			const id = personSelect.value;

			if (!state || !group || !id) return null;

			let photo = null;

			group.traverse(child => {
				if (
					child.isMesh &&
					child.userData?.type === 'photo' &&
					String(child.userData.burialId) === String(id)
				) {
					photo = child;
				}
			});

			return photo ? { photo, state } : null;
		};

		// Показать актуальные координаты в полях.
		const syncInputs = () => {
			const found = getPhoto();

			if (!found) {
				xInput.value = '';
				yInput.value = '';
				return;
			}

			xInput.value = found.photo.position.x.toFixed(3);
			yInput.value = found.photo.position.y.toFixed(3);
		};

		// Обновить список людей с фотографиями.
		const refreshPeople = () => {
			const { state, group } = getTarget();
			const previous = personSelect.value;
			const photoIds = new Set();

			group?.traverse(child => {
				if (
					child.isMesh &&
					child.userData?.type === 'photo' &&
					child.userData?.burialId != null
				) {
					photoIds.add(String(child.userData.burialId));
				}
			});

			personSelect.innerHTML =
				'<option value="">Выберите человека</option>';

			(state?.burials || [])
				.filter(person => photoIds.has(String(person.id)))
				.forEach(person => {
					const option = document.createElement('option');

					option.value = String(person.id);
					option.textContent =
						person.fullName ||
						person.name ||
						person.id;

					personSelect.appendChild(option);
				});

			const activeId = state?.activeBurialId != null
				? String(state.activeBurialId)
				: null;

			if (activeId && photoIds.has(activeId)) {
				personSelect.value = activeId;
			} else if (previous && photoIds.has(previous)) {
				personSelect.value = previous;
			} else {
				personSelect.value = '';
			}

			syncInputs();
		};

		// Применить координаты, введённые вручную.
		const applyCoordinates = () => {
			const found = getPhoto();

			if (!found) return;

			const x = Number(xInput.value);
			const y = Number(yInput.value);

			if (!Number.isFinite(x) || !Number.isFinite(y)) return;

			found.photo.position.x = x;
			found.photo.position.y = y;

			this.savePhotoPosition(found.photo, found.state);
			found.photo.updateMatrixWorld(true);
		};

		// Сдвинуть фотографию на заданный шаг.
		const move = (dx, dy) => {
			const found = getPhoto();

			if (!found) {
				refreshPeople();
				return;
			}

			found.photo.position.x += dx;
			found.photo.position.y += dy;

			this.savePhotoPosition(found.photo, found.state);

			syncInputs();
			found.photo.updateMatrixWorld(true);
		};

		// События интерфейса.
		personSelect.addEventListener('change', () => {
			const id = personSelect.value;

			if (id && typeof window.selectBurialRecordById === 'function') {
				window.selectBurialRecordById(id);
			}

			syncInputs();
		});

		xInput.addEventListener('change', applyCoordinates);
		yInput.addEventListener('change', applyCoordinates);

		document.getElementById('btnPhotoUp')
			?.addEventListener('click', () => move(0, 0.001));

		document.getElementById('btnPhotoDown')
			?.addEventListener('click', () => move(0, -0.001));

		document.getElementById('btnPhotoLeft')
			?.addEventListener('click', () => move(-0.001, 0));

		document.getElementById('btnPhotoRight')
			?.addEventListener('click', () => move(0.001, 0));

		document.getElementById('btnPhotoReset')
			?.addEventListener('click', () => {
				const found = getPhoto();

				if (!found) return;

				found.photo.position.set(
					-0.28,
					0.6,
					found.photo.position.z
				);

				this.savePhotoPosition(found.photo, found.state);
				syncInputs();
			});

		this.refreshPhotoPositionControls = refreshPeople;

		personSelect.addEventListener('focus', refreshPeople);

		document.getElementById('enableMovePhoto')
			?.addEventListener('change', refreshPeople);

		window.addEventListener('focus', refreshPeople);

		refreshPeople();
	}

    // --------------------------------------------------------
    // ВЫБОР АКТИВНОЙ СТЕЛЫ И СОСТОЯНИЯ
    // --------------------------------------------------------

    setActiveTarget({
        state,
        decalsGroup,
        scene = null
    } = {}) {
        this.activeState = state || null;
        this.activeGroup = decalsGroup || null;
        this.scene = scene || null;
    }

    // --------------------------------------------------------
    // ОЧИСТКА ОБРАБОТЧИКОВ
    // --------------------------------------------------------

    dispose() {
        const canvas = this.renderer?.domElement;

        canvas?.removeEventListener(
            'pointerdown',
            this.boundPointerDown
        );

        window.removeEventListener(
            'pointermove',
            this.boundPointerMove
        );

        window.removeEventListener(
            'pointerup',
            this.boundPointerUp
        );

        this.selectedPhoto = null;
        this.activeGroup = null;
        this.activeState = null;
    }
}
