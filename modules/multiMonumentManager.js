// modules/multiMonumentManager.js

import * as THREE from 'three';
import { loadFlowerbedTexture } from './textures.min.js';

// ⭐ КАРТА ТЕКСТУР
const TEXTURE_PATHS = {
    'granite': './textures/gabbro/color.webp',
    'black_galaxy': './textures/black_galaxy/color.webp',
    'ninimyaki': './textures/ninimyaki/color.webp',
    'marble': './textures/marble/color.webp',
    'red_granite': './textures/red_granite/color.webp',
    'beige_granite': './textures/beige_granite/color.webp',
    'gray_granite': './textures/gray_granite/gray-polished-granite_albedo.webp'
};

const FALLBACK_COLORS = {
    'granite': 0x1a1a1a,
    'black_galaxy': 0x111111,
    'ninimyaki': 0x1a2a1a,
    'marble': 0xf5f5f5,
    'red_granite': 0x8b0000,
    'beige_granite': 0xd4b896,
    'gray_granite': 0x808080
};

const textureCache = new Map();

function loadTextureForMaterial(materialType) {
    return new Promise((resolve) => {
        if (textureCache.has(materialType)) {
            resolve(textureCache.get(materialType));
            return;
        }
        
        const path = TEXTURE_PATHS[materialType];
        if (!path) {
            resolve(null);
            return;
        }
        
        const loader = new THREE.TextureLoader();
        loader.load(
            path,
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, 1);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = 4;
                textureCache.set(materialType, texture);
                resolve(texture);
            },
            undefined,
            () => {
                const altPath = path.replace('.webp', '.jpg');
                loader.load(
                    altPath,
                    (texture) => {
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(1, 1);
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.anisotropy = 4;
                        
                        textureCache.set(materialType, texture);
                        resolve(texture);
                    },
                    undefined,
                    () => {
                        resolve(null);
                    }
                );
            }
        );
    });
}

async function createSteleMaterialWithTexture(materialType, isBase = false) {
    const texture = await loadTextureForMaterial(materialType);
    
    const material = new THREE.MeshStandardMaterial({
        roughness: isBase ? 0.7 : 0.25,
        metalness: isBase ? 0.02 : 0.05
    });
    
    if (texture) {
        material.map = texture;
        material.color = new THREE.Color(0xffffff);
    } else {
        const color = FALLBACK_COLORS[materialType] || 0x888888;
        material.color = new THREE.Color(color);
    }
    
    material.needsUpdate = true;
    return material;
}

export class MultiMonumentManager {
	constructor(scene, renderer, controls) {
		this.scene = scene;
		this.renderer = renderer;
		this.controls = controls;
		
		// ⭐ ГРУППА ДЛЯ ДУБЛЕРОВ
		this.monumentsGroup = new THREE.Group();
		this.monumentsGroup.userData.isMonumentGroup = true;
		this.monumentsGroup.userData.isDuplicatorGroup = true;
		this.scene.add(this.monumentsGroup);
		
		this.monuments = [];
		this.mainPhotoMesh = null; 
		this.activeIndex = -1;
		this.nextId = 1;
		this.isUpdating = false;
		this.isRebuilding = false;
		this._isSleeping = false;
		this._isMoveModeActive = false;
		this._skipDuplicatorRebuild = false;

		// ⭐ ТЕКУЩИЙ РЕЖИМ
		this.currentMode = 'main';

		// ⭐ ДАННЫЕ ДУБЛЕРА
		this.pendingChanges = null;
		this.pendingIndex = -1;

		// ⭐ КЭШ ДАННЫХ ДУБЛЕРОВ
		this._duplicatorDataCache = {};

		// ⭐ БЛОКИРОВКИ
		this._blockStateUpdate = false;
		this._selectMonumentInProgress = false;

		// ⭐
		// После того как пользователь начал редактировать дублер,
		// возврат к MAIN в этом сценарии запрещён.
		//
		// Это специально простая защита:
		//
		// MAIN → ДУБЛЕР = разрешено
		// ДУБЛЕР → MAIN = запрещено
		//
		this._mainLockedAfterDuplicator = false;

		// ⭐ СТАРЫЕ BACKUP НЕ ИСПОЛЬЗУЕМ
		this._savedState = null;
		this._mainStateBackup = null;

		window._disableAutoMonument = false;
		window._isDuplicatorMode = false;
		
		this.createUI();
		this.bindEvents();

		// ⭐ ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ ДЛЯ ПЕРЕТАСКИВАНИЯ ФОТО
		this.setupPhotoDragHandlers();
	}

setupPhotoDragHandlers() {
	const canvas = this.renderer.domElement;
	if (!canvas) return;

	let isDragging = false;
	let selectedPhoto = null;
	let dragOffset = { x: 0, y: 0 };
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	const camera = this.controls.object;

	// ============================================================
	// 🔍 ПОИСК ФОТО
	// ============================================================
	const findPhoto = () => {
		const manager = window.multiMonumentManager;

		let searchGroup = window.monumentGroup;
		let foundType = 'main';

		// 🔒 DUPLICATOR: ищем фото только внутри активного дублера
		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.group
		) {
			searchGroup =
				manager.monuments[manager.activeIndex].group;

			foundType = 'duplicate';
		}

		if (searchGroup) {
			let foundPhoto = null;

			searchGroup.traverse(child => {
				if (foundPhoto) return;

				if (
					child.isMesh &&
					child.geometry?.type === 'CircleGeometry'
				) {
					if (!child.userData) {
						child.userData = {};
					}

					child.userData.type = 'photo';
					child.userData.isDraggable = true;
					child.userData.limitX = 0.5;
					child.userData.limitY = 0.8;
					child.userData.steleCenterY = 0.6;
					child.userData.isMainPhoto =
						foundType === 'main';
					child.userData._foundType = foundType;

					foundPhoto = child;
				}

				if (
					child.userData &&
					child.userData.type === 'photo'
				) {
					child.userData._foundType = foundType;
					child.userData.isMainPhoto =
						foundType === 'main';

					foundPhoto = child;
				}
			});

			if (foundPhoto) {
				console.log('📸 Фото найдено:', {
					type: foundType,
					uuid: foundPhoto.uuid,
					position: foundPhoto.position.toArray(),
					groupUuid: searchGroup.uuid
				});

				return foundPhoto;
			}
		}

		// Для MAIN оставляем fallback
		if (foundType === 'main' && this.mainPhotoMesh) {
			return this.mainPhotoMesh;
		}

		return null;
	};

	// ============================================================
	// ⭐ НАЧАЛО ПЕРЕТАСКИВАНИЯ
	// ============================================================
	canvas.addEventListener('pointerdown', (event) => {
		const enableMovePhoto =
			document.getElementById('enableMovePhoto');

		if (
			enableMovePhoto &&
			!enableMovePhoto.checked
		) {
			return;
		}

		if (
			window.furniture3DManager &&
			window.furniture3DManager.isDragging
		) {
			return;
		}

		const rect = canvas.getBoundingClientRect();

		const x =
			((event.clientX - rect.left) / rect.width) * 2 - 1;

		const y =
			-((event.clientY - rect.top) / rect.height) * 2 + 1;

		mouse.set(x, y);
		raycaster.setFromCamera(mouse, camera);

		// ========================================================
		// 🔒 В DUPLICATOR собираем Mesh только активного дублера
		// ========================================================
		const manager = window.multiMonumentManager;

		let searchGroup = window.monumentGroup;

		if (
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.group
		) {
			searchGroup =
				manager.monuments[manager.activeIndex].group;
		}

		const allMeshes = [];

		if (searchGroup) {
			searchGroup.traverse(child => {
				if (child.isMesh) {
					allMeshes.push(child);
				}
			});
		}

		// Добавляем найденное фото отдельно
		const photo = findPhoto();

		if (
			photo &&
			!allMeshes.includes(photo)
		) {
			allMeshes.push(photo);
		}

		const intersects =
			raycaster.intersectObjects(allMeshes);

		// ========================================================
		// ⭐ ПРОВЕРЯЕМ ПОПАДАНИЯ
		// ========================================================
		for (const hit of intersects) {
			if (
				hit.object === photo ||
				(
					hit.object.userData &&
					hit.object.userData.type === 'photo'
				)
			) {
				console.log(
					'✅ НАШЛИ ФОТО! Начинаем перетаскивание',
					{
						type: hit.object.userData?._foundType,
						uuid: hit.object.uuid
					}
				);

				isDragging = true;
				selectedPhoto = hit.object;

				dragOffset.x =
					hit.point.x -
					hit.object.position.x;

				dragOffset.y =
					hit.point.y -
					hit.object.position.y;

				this.mainPhotoMesh = hit.object;

				canvas.style.cursor = 'grabbing';

				if (this.controls) {
					this.controls.enabled = false;
				}

				break;
			}
		}

		if (!isDragging) {
			console.log(
				'❌ Фото не найдено среди попаданий'
			);
		}
	});

	// ============================================================
	// ⭐ ПЕРЕМЕЩЕНИЕ
	// ============================================================
	const onPointerMove = (event) => {
		if (!isDragging || !selectedPhoto) {
			return;
		}

		const rect =
			canvas.getBoundingClientRect();

		const x =
			((event.clientX - rect.left) / rect.width) * 2 - 1;

		const y =
			-((event.clientY - rect.top) / rect.height) * 2 + 1;

		const planeZ =
			selectedPhoto.position.z;

		const plane = new THREE.Plane(
			new THREE.Vector3(0, 0, 1),
			-planeZ
		);

		const mouseVec =
			new THREE.Vector3(x, y, 0.5);

		const r = new THREE.Raycaster();

		r.setFromCamera(
			mouseVec,
			camera
		);

		const intersectionPoint =
			new THREE.Vector3();

		r.ray.intersectPlane(
			plane,
			intersectionPoint
		);

		if (!intersectionPoint) {
			return;
		}

		let newX =
			intersectionPoint.x -
			dragOffset.x;

		let newY =
			intersectionPoint.y -
			dragOffset.y;

		const limitX =
			selectedPhoto.userData?.limitX || 0.3;

		const limitY =
			selectedPhoto.userData?.limitY || 0.3;

		const centerY =
			selectedPhoto.userData?.steleCenterY || 0.6;

		newX = Math.max(
			-limitX,
			Math.min(limitX, newX)
		);

		const minY =
			centerY - limitY;

		const maxY =
			centerY + limitY;

		newY = Math.max(
			minY,
			Math.min(maxY, newY)
		);

		selectedPhoto.position.x = newX;
		selectedPhoto.position.y = newY;

		// ========================================================
		// 🔒 СОХРАНЕНИЕ MAIN / DUPLICATOR
		// ========================================================
		const manager =
			window.multiMonumentManager;

		const isDuplicator =
			manager &&
			manager.currentMode === 'duplicator' &&
			manager.activeIndex >= 0 &&
			manager.monuments?.[manager.activeIndex]?.data;

		if (isDuplicator) {
			const duplicateState =
				manager.monuments[
					manager.activeIndex
				].data;

			duplicateState.photoOffsetX = newX;
			duplicateState.photoOffsetY =
				newY - centerY;
			duplicateState.photoAbsoluteX = newX;
			duplicateState.photoAbsoluteY = newY;

			this._duplicatorDataCache[
				manager.activeIndex
			] = {
				...duplicateState
			};

		} else if (window.state) {
			window.state.photoOffsetX = newX;
			window.state.photoOffsetY =
				newY - centerY;
			window.state.photoAbsoluteX = newX;
			window.state.photoAbsoluteY = newY;
		}

		// ========================================================
		// ⭐ ПРИНУДИТЕЛЬНЫЙ РЕНДЕР
		// ========================================================
		if (
			this.renderer &&
			this.scene &&
			this.controls
		) {
			this.renderer.render(
				this.scene,
				this.controls.object
			);
		}
	};

	// ============================================================
	// ⭐ КОНЕЦ ПЕРЕТАСКИВАНИЯ
	// ============================================================
	const onPointerUp = () => {
		if (
			isDragging &&
			selectedPhoto
		) {
			const centerY =
				selectedPhoto.userData?.steleCenterY || 0.6;

			const manager =
				window.multiMonumentManager;

			const isDuplicator =
				manager &&
				manager.currentMode === 'duplicator' &&
				manager.activeIndex >= 0 &&
				manager.monuments?.[manager.activeIndex]?.data;

			if (isDuplicator) {
				const duplicateState =
					manager.monuments[
						manager.activeIndex
					].data;

				duplicateState.photoOffsetX =
					selectedPhoto.position.x;

				duplicateState.photoOffsetY =
					selectedPhoto.position.y -
					centerY;

				duplicateState.photoAbsoluteX =
					selectedPhoto.position.x;

				duplicateState.photoAbsoluteY =
					selectedPhoto.position.y;

				this._duplicatorDataCache[
					manager.activeIndex
				] = {
					...duplicateState
				};

				console.log(
					'📸 Позиция фото дублера сохранена:',
					selectedPhoto.position.x,
					selectedPhoto.position.y
				);

			} else if (window.state) {
				window.state.photoOffsetX =
					selectedPhoto.position.x;

				window.state.photoOffsetY =
					selectedPhoto.position.y -
					centerY;

				window.state.photoAbsoluteX =
					selectedPhoto.position.x;

				window.state.photoAbsoluteY =
					selectedPhoto.position.y;

				console.log(
					'📸 Позиция фото сохранена:',
					selectedPhoto.position.x,
					selectedPhoto.position.y
				);
			}

			isDragging = false;
			canvas.style.cursor = 'default';

			if (this.controls) {
				this.controls.enabled = true;
			}

			selectedPhoto = null;
		}
	};

	window.addEventListener(
		'pointermove',
		onPointerMove
	);

	window.addEventListener(
		'pointerup',
		onPointerUp
	);

	this._photoDragHandlers = {
		onPointerMove,
		onPointerUp
	};
}

updatePhotoPosition(photoMesh, x, y) {
    const isMain =
        photoMesh.userData &&
        photoMesh.userData.isMainPhoto === true;
    
    const foundType =
        photoMesh.userData &&
        photoMesh.userData._foundType;
    
    if (isMain || foundType === 'main') {
        if (window.state) {
            window.state.photoOffsetX = x;
            window.state.photoOffsetY = y;
        }
        
        this.mainPhotoMesh = photoMesh;
        return;
    }
    
    if (this.activeIndex < 0) return;
    
    const index = this.activeIndex;
    const mon = this.monuments[index];
    
    if (!mon || !mon.data) return;
    
    mon.data.photoOffsetX = x;
    mon.data.photoOffsetY = y;
    this._duplicatorDataCache[index] = { ...mon.data };
    this.rebuildSimpleMonument(index);
}
    
    // ⭐ СОЗДАНИЕ UI
    createUI() {
        const container =
            document.getElementById('monumentListContainer');
        
        if (container) {
            this.renderMonumentList();
        }
    }

    // ⭐ ОТРИСОВКА СПИСКА
    renderMonumentList() {
        const container =
            document.getElementById('monumentListContainer');
        
        if (!container) return;
        
        const countEl =
            document.getElementById('monumentCount');
        
        if (countEl) {
            countEl.textContent = this.monuments.length || 1;
        }
        
        const isMainActive = this.currentMode === 'main';
        
        let html = `
            <div class="monument-item" data-index="-1" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                margin-bottom: 4px;
                background: ${isMainActive
                    ? 'rgba(0,168,150,0.3)'
                    : 'rgba(255,255,255,0.03)'};
                border-radius: 6px;
                border: 1px solid ${isMainActive
                    ? '#00a896'
                    : 'rgba(255,255,255,0.05)'};
                cursor: pointer;
                transition: all 0.2s;
                font-size: 13px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex: 1;
                    overflow: hidden;
                ">
                    <span style="
                        color: ${isMainActive ? '#00a896' : '#666'};
                    ">
                        ${isMainActive ? '▶' : '⬤'}
                    </span>
                    
                    <span style="
                        color: ${isMainActive ? '#fff' : '#aaa'};
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    ">
                        🪦 Основной памятник
                    </span>
                    
                    <span style="
                        font-size: 10px;
                        color: #666;
                        flex-shrink: 0;
                    ">
                        (управление)
                    </span>
                </div>
                
                <div style="
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                ">
                    <button class="select-main-btn" style="
                        background: none;
                        border: none;
                        color: ${isMainActive ? '#00a896' : '#666'};
                        cursor: pointer;
                        padding: 2px 6px;
                        font-size: 12px;
                        width: auto;
                        margin: 0;
                        border-radius: 4px;
                    " title="Выбрать основной">
                        👁️
                    </button>
                </div>
            </div>
        `;
        
        if (this.monuments.length === 0) {
            html += `
                <div style="
                    font-size: 12px;
                    color: #888;
                    text-align: center;
                    padding: 20px;
                    border: 1px dashed #444;
                    border-radius: 8px;
                    margin-top: 8px;
                ">
                    Нет добавленных дублеров
                </div>
            `;
        } else {
            this.monuments.forEach((mon, index) => {
                const isActive =
                    this.currentMode === 'duplicator' &&
                    index === this.activeIndex;
                
                const name =
                    mon.data?.fullName ||
                    mon.data?.name ||
                    `Памятник ${index + 1}`;
                
                const material =
                    mon.data?.material || 'гранит';
                
                const displayName =
                    name.length > 20
                        ? name.substring(0, 20) + '...'
                        : name;
                
                const hasPending =
                    this.pendingIndex === index &&
                    this.pendingChanges !== null;
                
                html += `
                    <div class="monument-item"
                         data-index="${index}"
                         style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 8px 12px;
                            margin-bottom: 4px;
                            background: ${isActive
                                ? 'rgba(0,168,150,0.3)'
                                : 'rgba(255,255,255,0.05)'};
                            border-radius: 6px;
                            border: 1px solid ${isActive
                                ? '#00a896'
                                : 'transparent'};
                            cursor: pointer;
                            transition: all 0.2s;
                            font-size: 13px;
                         ">
                        
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            flex: 1;
                            overflow: hidden;
                        ">
                            <span style="
                                color: ${isActive ? '#00a896' : '#888'};
                            ">
                                ${isActive ? '▶' : '○'}
                            </span>
                            
                            <span style="
                                color: ${isActive ? '#fff' : '#aaa'};
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            ">
                                ${this.escapeHtml(displayName)}
                                ${hasPending
                                    ? ' <span style="color:#f39c12;font-size:10px;">✏️*</span>'
                                    : ''}
                            </span>
                            
                            <span style="
                                font-size: 10px;
                                color: #666;
                                flex-shrink: 0;
                            ">
                                ${material}
                            </span>
                        </div>
                        
                        <div style="
                            display: flex;
                            gap: 4px;
                            flex-shrink: 0;
                        ">
                            <button
                                class="select-monument-btn"
                                data-index="${index}"
                                style="
                                    background: none;
                                    border: none;
                                    color: ${isActive ? '#00a896' : '#666'};
                                    cursor: pointer;
                                    padding: 2px 6px;
                                    font-size: 12px;
                                    width: auto;
                                    margin: 0;
                                    border-radius: 4px;
                                "
                                title="Выбрать">
                                👁️
                            </button>
                            
                            <button
                                class="duplicate-monument-btn"
                                data-index="${index}"
                                style="
                                    background: none;
                                    border: none;
                                    color: #888;
                                    cursor: pointer;
                                    padding: 2px 6px;
                                    font-size: 12px;
                                    width: auto;
                                    margin: 0;
                                    border-radius: 4px;
                                "
                                title="Дублировать">
                                📋
                            </button>
                            
                            <button
                                class="delete-monument-btn"
                                data-index="${index}"
                                style="
                                    background: none;
                                    border: none;
                                    color: #888;
                                    cursor: pointer;
                                    padding: 2px 6px;
                                    font-size: 12px;
                                    width: auto;
                                    margin: 0;
                                    border-radius: 4px;
                                "
                                title="Удалить">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
        
        // Обработчики
        const mainItem =
            container.querySelector('.monument-item[data-index="-1"]');
        
        if (mainItem) {
            mainItem.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.selectMainMonument();
            });
            
            const mainSelectBtn =
                mainItem.querySelector('.select-main-btn');
            
            if (mainSelectBtn) {
                mainSelectBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectMainMonument();
                });
            }
        }
        
        container
            .querySelectorAll('.monument-item[data-index]')
            .forEach(el => {
                const index = parseInt(el.dataset.index);
                
                if (index < 0) return;
                
                el.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    this.selectMonument(index);
                });
            });
        
        container
            .querySelectorAll('.select-monument-btn')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    this.selectMonument(index);
                });
            });
        
        container
            .querySelectorAll('.duplicate-monument-btn')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    this.duplicateMonument(index);
                });
            });
        
        container
            .querySelectorAll('.delete-monument-btn')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    
                    if (confirm(`Удалить дублер #${index + 1}?`)) {
                        this.removeMonument(index);
                    }
                });
            });
    
}


    // ⭐ СБОР ДАННЫХ ИЗ UI (ДЛЯ ДУБЛЕРОВ)
    collectUIData() {
        const data = {};
        
        const fullNameEl = document.getElementById('fullName');
        if (fullNameEl) data.fullName = fullNameEl.value;
        
        const datesEl = document.getElementById('datesText');
        if (datesEl) data.dates = datesEl.value;
        
        const epitaphEl = document.getElementById('epitaphText');
        if (epitaphEl) data.epitaph = epitaphEl.value;
        
        const widthEl = document.getElementById('widthRange');
        if (widthEl) data.width = parseFloat(widthEl.value);
        
        const heightEl = document.getElementById('heightRange');
        if (heightEl) data.height = parseFloat(heightEl.value);
        
        const depthEl = document.getElementById('depthRange');
        if (depthEl) data.depth = parseFloat(depthEl.value) || 0.1;
        
        const materialEl = document.getElementById('materialSelect');
        if (materialEl) data.material = materialEl.value;
        
        const textColorEl = document.getElementById('textColor');
        if (textColorEl) data.textColor = textColorEl.value;
        
        const fontEl = document.getElementById('fontFamily');
        if (fontEl) data.fontFamily = fontEl.value;
        
        const graveWEl = document.getElementById('graveWidth');
        if (graveWEl) data.graveWidth = parseFloat(graveWEl.value);
        
        const graveLEl = document.getElementById('graveLength');
        if (graveLEl) data.graveLength = parseFloat(graveLEl.value);
        
        const baseHEl = document.getElementById('baseHeight');
        if (baseHEl) data.baseHeight = parseFloat(baseHEl.value);
        
        const flowerEnabledEl = document.getElementById('flowerEnabled');
        if (flowerEnabledEl) data.flowerEnabled = flowerEnabledEl.checked;
        
        const flowerWEl = document.getElementById('flowerWidth');
        if (flowerWEl) data.flowerWidth = parseFloat(flowerWEl.value);
        
        const flowerLEl = document.getElementById('flowerLength');
        if (flowerLEl) data.flowerLength = parseFloat(flowerLEl.value);
        
        const flowerTypeEl = document.getElementById('flowerbedType');
        if (flowerTypeEl) data.flowerbedType = flowerTypeEl.value;
        
        const fenceEnabledEl = document.getElementById('fenceEnabled');
        if (fenceEnabledEl) data.fenceEnabled = fenceEnabledEl.checked;
        
        const fenceWEl = document.getElementById('fenceWidth');
        if (fenceWEl) data.fenceWidth = parseFloat(fenceWEl.value);
        
        const fenceLEl = document.getElementById('fenceLength');
        if (fenceLEl) data.fenceLength = parseFloat(fenceLEl.value);
        
        const fenceTypeEl = document.getElementById('fenceType');
        if (fenceTypeEl) data.fenceType = fenceTypeEl.value;
        
        const fenceHEl = document.getElementById('fenceHeight');
        if (fenceHEl) data.fenceHeight = parseFloat(fenceHEl.value);
        
        const fenceMatEl = document.getElementById('fenceMaterial');
        if (fenceMatEl) data.fenceMaterial = fenceMatEl.value;
        
		const gateSideEl = document.getElementById('fenceGateSide');
		if (gateSideEl) data.fenceGateSide = gateSideEl.value;

		// ⭐ Данные фото и позиции декалей берём из window.state
		data.textureUrl = window.state?.textureUrl || '';
		data.photoIndex = Number(window.state?.photoIndex) || 0;

		data.textOffsetX = Number(window.state?.textOffsetX) || 0;
		data.textOffsetY = Number(window.state?.textOffsetY) || 0;
		data.epitaphOffsetX = Number(window.state?.epitaphOffsetX) || 0;
		data.epitaphOffsetY = Number(window.state?.epitaphOffsetY) || 0;
		data.photoOffsetX = Number(window.state?.photoOffsetX) || 0;
		data.photoOffsetY = Number(window.state?.photoOffsetY) || 0;

		return data;
         
         container.innerHTML = html;
         
         // Обработчики
         const mainItem = container.querySelector('.monument-item[data-index="-1"]');
         if (mainItem) {
             mainItem.addEventListener('click', (e) => {
                 if (e.target.closest('button')) return;
                 this.selectMainMonument();
             });
             const mainSelectBtn = mainItem.querySelector('.select-main-btn');
             if (mainSelectBtn) {
                 mainSelectBtn.addEventListener('click', (e) => {
                     e.stopPropagation();
                     this.selectMainMonument();
                 });
             }
         }

         container.querySelectorAll('.monument-item[data-index]').forEach(el => {
             const index = parseInt(el.dataset.index);
             if (isNaN(index)) return;
             
             el.addEventListener('click', (e) => {
                 if (e.target.closest('button')) return;
                 this.selectMonument(index);
             });
         });
         
         container.querySelectorAll('.select-monument-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const index = parseInt(btn.dataset.index);
                 this.selectMonument(index);
             });
         });
         
         container.querySelectorAll('.apply-monument-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const index = parseInt(btn.dataset.index);
                 this.applyPendingChanges(index);
             });
         });
         
         container.querySelectorAll('.remove-monument-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const index = parseInt(btn.dataset.index);
                 this.removeMonument(index);
             });
         });
         
         const dupBtn = document.getElementById('duplicateMonumentBtn');
         const delBtn = document.getElementById('deleteMonumentBtn');
         if (dupBtn) dupBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
         if (delBtn) delBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
     }
     
     escapeHtml(text) {
         if (!text) return 'Без имени';
         const div = document.createElement('div');
         div.textContent = text;
         return div.innerHTML;
     }

	destroy() {
		// Очищаем обработчики перетаскивания фото
		if (this._photoDragHandlers) {
			window.removeEventListener('pointermove', this._photoDragHandlers.onPointerMove);
			window.removeEventListener('pointerup', this._photoDragHandlers.onPointerUp);
		}
	}
     
     // ⭐ ПРИВЯЗКА СОБЫТИЙ
     bindEvents() {
         document.getElementById('addMonumentBtn')?.addEventListener('click', () => {
             this.addMonument();
         });
         
         document.getElementById('deleteMonumentBtn')?.addEventListener('click', () => {
             if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                 this.removeMonument(this.activeIndex);
             }
         });
         
         document.getElementById('duplicateMonumentBtn')?.addEventListener('click', () => {
             if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                 this.duplicateMonument(this.activeIndex);
             }
         });
         
         document.getElementById('selectMainMonumentBtn')?.addEventListener('click', () => {
             this.selectMainMonument();
         });
         
         const canvas = document.querySelector('#canvas-container canvas');
         if (canvas) {
             canvas.addEventListener('click', (e) => {
                 this.handleCanvasClick(e);
             });
         }

         // ⭐ ПОДПИСКА НА ИЗМЕНЕНИЯ UI
         this._boundInputHandler = this._handleUIChange.bind(this);
         this._boundChangeHandler = this._handleUIChange.bind(this);
         
         const inputs = document.querySelectorAll('input, select, textarea');
         inputs.forEach(input => {
             input.removeEventListener('input', this._boundInputHandler);
             input.removeEventListener('change', this._boundChangeHandler);
             input.addEventListener('input', this._boundInputHandler);
             input.addEventListener('change', this._boundChangeHandler);
         });
         
         // ⭐ ПОДПИСКА НА ВЫБОР МОДЕЛИ В СЕТКЕ
         document.addEventListener('steleModelSelected', (e) => {
             const modelId = e.detail?.modelId;
             if (modelId && this.currentMode === 'duplicator' && this.activeIndex >= 0) {
                 // Сохраняем модель в pending
                 const uiData = this.collectUIData();
                 uiData.steleModel = modelId;
                 uiData.steleType = modelId;
                 this.pendingChanges = uiData;
                 this.pendingIndex = this.activeIndex;
                 this.renderMonumentList();
                 console.log('📐 Модель стелы сохранена в pending:', modelId);
             }
         });
     }

     // ⭐ ОБРАБОТЧИК ИЗМЕНЕНИЙ UI
	_handleUIChange(e) {
		// ⭐ ЕСЛИ ИЗМЕНЕНИЕ ОТ ЧЕКБОКСА "Включить перемещение фото" - НЕ СОХРАНЯЕМ
		if (e.target && e.target.id === 'enableMovePhoto') {
			console.log('⏸️ Чекбокс переключен, позиция НЕ сохраняется');
			return;
		}
		
		// ⭐ 1. ЕСЛИ МЫ В РЕЖИМЕ ДУБЛЕРА - СОХРАНЯЕМ В PENDING
		if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
			const uiData = this.collectUIData();
			this.pendingChanges = uiData;
			this.pendingIndex = this.activeIndex;
			this.renderMonumentList();
			
			console.log(`📝 Изменения сохранены для дублера #${this.activeIndex + 1}:`, uiData.fullName);
			console.log('📍 window.state НЕ ИЗМЕНЕН:', window.state?.fullName);
			return;
		}
		
		// ⭐ 2. ЕСЛИ МЫ В РЕЖИМЕ ОСНОВНОГО - ОБНОВЛЯЕМ STATE И СЦЕНУ
		if (this.currentMode === 'main') {
			this.syncStateFromUI();
			
			clearTimeout(this._updateTimeout);
			this._updateTimeout = setTimeout(() => {
				if (window.updateScene && !window._disableAutoMonument) {
					window.updateScene();
				}
			}, 100);
		}
	}

	syncStateFromUI() {
		// ⭐ ДУБЛЕР НЕ ИЗМЕНЯЕТ STATE ОСНОВНОГО
		if (this.currentMode === 'duplicator') {
			console.log('⏭️ syncStateFromUI пропущен: сейчас редактируется дублер');
			return;
		}

		// ⭐ ПОИСК ФОТО
		let photoMesh = null;
		let mainDecalsGroup = null;
		if (window.monumentGroup) {
			window.monumentGroup.children.forEach(child => {
				if (child.name === 'mainDecalsGroup') {
					mainDecalsGroup = child;
				}
			});
		}
		if (mainDecalsGroup) {
			for (const child of mainDecalsGroup.children) {
				if (child.userData && child.userData.type === 'photo') {
					photoMesh = child;
					break;
				}
			}
		}
		
		// ⭐ СОХРАНЯЕМ ПОЗИЦИЮ ТОЛЬКО ЕСЛИ ФОТО НА МЕСТЕ
		if (photoMesh && window.state) {
			// Проверяем, что фото видимо и позиция корректна
			if (photoMesh.visible !== false) {
				window.state.photoAbsoluteX = photoMesh.position.x;
				window.state.photoAbsoluteY = photoMesh.position.y;
				const centerY = photoMesh.userData?.steleCenterY || 0.6;
				window.state.photoOffsetX = photoMesh.position.x;
				window.state.photoOffsetY = photoMesh.position.y - centerY;
				console.log('📸 Позиция сохранена:', photoMesh.position.x, photoMesh.position.y);
			} else {
				console.log('⚠️ Фото не видимо, пропускаем сохранение');
			}
		}
		
		if (!window.state) return;
		
		const fullNameEl = document.getElementById('fullName');
		if (fullNameEl) window.state.fullName = fullNameEl.value;
		
		const datesEl = document.getElementById('datesText');
		if (datesEl) window.state.dates = datesEl.value;
		
		const epitaphEl = document.getElementById('epitaphText');
		if (epitaphEl) window.state.epitaph = epitaphEl.value;
		
		const textColorEl = document.getElementById('textColor');
		if (textColorEl) window.state.textColor = textColorEl.value;
		
		const widthEl = document.getElementById('widthRange');
		if (widthEl) window.state.width = parseFloat(widthEl.value);
		
		const heightEl = document.getElementById('heightRange');
		if (heightEl) window.state.height = parseFloat(heightEl.value);
		
		const depthEl = document.getElementById('depthRange');
		if (depthEl) window.state.depth = parseFloat(depthEl.value) || 0.1;
		
		const materialEl = document.getElementById('materialSelect');
		if (materialEl) window.state.material = materialEl.value;
		
		const fontEl = document.getElementById('fontFamily');
		if (fontEl) window.state.fontFamily = fontEl.value;
		
		const nameFontSizeEl = document.getElementById('nameFontSize');
		if (nameFontSizeEl) window.state.nameFontSize = parseInt(nameFontSizeEl.value);
		
		const datesFontSizeEl = document.getElementById('datesFontSize');
		if (datesFontSizeEl) window.state.datesFontSize = parseInt(datesFontSizeEl.value);
		
		const epitaphFontSizeEl = document.getElementById('epitaphFontSize');
		if (epitaphFontSizeEl) window.state.epitaphFontSize = parseInt(epitaphFontSizeEl.value);
		
		const textOffsetXEl = document.getElementById('textOffsetX');
		if (textOffsetXEl) window.state.textOffsetX = parseFloat(textOffsetXEl.value) || 0;
		
		const textOffsetYEl = document.getElementById('textOffsetY');
		if (textOffsetYEl) window.state.textOffsetY = parseFloat(textOffsetYEl.value) || 0;
		
		const epitaphOffsetXEl = document.getElementById('epitaphOffsetX');
		if (epitaphOffsetXEl) window.state.epitaphOffsetX = parseFloat(epitaphOffsetXEl.value) || 0;
		
		const epitaphOffsetYEl = document.getElementById('epitaphOffsetY');
		if (epitaphOffsetYEl) window.state.epitaphOffsetY = parseFloat(epitaphOffsetYEl.value) || 0;
		
		const graveWEl = document.getElementById('graveWidth');
		if (graveWEl) window.state.graveWidth = parseFloat(graveWEl.value);
		
		const graveLEl = document.getElementById('graveLength');
		if (graveLEl) window.state.graveLength = parseFloat(graveLEl.value);
		
		const baseHEl = document.getElementById('baseHeight');
		if (baseHEl) window.state.baseHeight = parseFloat(baseHEl.value);
		
		const flowerEnabledEl = document.getElementById('flowerEnabled');
		if (flowerEnabledEl) window.state.flowerEnabled = flowerEnabledEl.checked;
		
		const flowerWEl = document.getElementById('flowerWidth');
		if (flowerWEl) window.state.flowerWidth = parseFloat(flowerWEl.value);
		
		const flowerLEl = document.getElementById('flowerLength');
		if (flowerLEl) window.state.flowerLength = parseFloat(flowerLEl.value);
		
		const flowerbedTypeEl = document.getElementById('flowerbedType');
		if (flowerbedTypeEl) window.state.flowerbedType = flowerbedTypeEl.value;
		
		const fenceEnabledEl = document.getElementById('fenceEnabled');
		if (fenceEnabledEl) window.state.fenceEnabled = fenceEnabledEl.checked;
		
		const fenceWEl = document.getElementById('fenceWidth');
		if (fenceWEl) window.state.fenceWidth = parseFloat(fenceWEl.value);
		
		const fenceLEl = document.getElementById('fenceLength');
		if (fenceLEl) window.state.fenceLength = parseFloat(fenceLEl.value);
		
		const fenceTypeEl = document.getElementById('fenceType');
		if (fenceTypeEl) window.state.fenceType = fenceTypeEl.value;
		
		const fenceHEl = document.getElementById('fenceHeight');
		if (fenceHEl) window.state.fenceHeight = parseFloat(fenceHEl.value);
		
		const fenceMatEl = document.getElementById('fenceMaterial');
		if (fenceMatEl) window.state.fenceMaterial = fenceMatEl.value;
		
		const gateSideEl = document.getElementById('fenceGateSide');
		if (gateSideEl) window.state.fenceGateSide = gateSideEl.value;
		
		const gateWEl = document.getElementById('gateWidth');
		if (gateWEl) window.state.gateWidth = parseFloat(gateWEl.value);
		
		const fenceOffXEl = document.getElementById('fenceOffsetX');
		if (fenceOffXEl) window.state.fenceOffsetX = parseFloat(fenceOffXEl.value) || 0;
		
		const fenceOffZEl = document.getElementById('fenceOffsetZ');
		if (fenceOffZEl) window.state.fenceOffsetZ = parseFloat(fenceOffZEl.value) || 0;
		
		const pathEnabledEl = document.getElementById('pathEnabled');
		if (pathEnabledEl) window.state.pathEnabled = pathEnabledEl.checked;
		
		const pathWEl = document.getElementById('pathWidth');
		if (pathWEl) window.state.pathWidth = parseFloat(pathWEl.value);
		
		const pathMatEl = document.getElementById('pathMaterial');
		if (pathMatEl) window.state.pathMaterial = pathMatEl.value;
		
		const pathTileSizeEl = document.getElementById('pathTileSize');
		if (pathTileSizeEl) window.state.pathTileSize = parseFloat(pathTileSizeEl.value);
		
		const pathJointColorEl = document.getElementById('pathJointColor');
		if (pathJointColorEl) window.state.pathJointColor = pathJointColorEl.value;
		
		const pathTileLayoutEl = document.getElementById('pathTileLayout');
		if (pathTileLayoutEl) window.state.pathTileLayout = pathTileLayoutEl.value;
		
		const photoScaleEl = document.getElementById('photoScale');
		if (photoScaleEl) window.state.photoScale = parseFloat(photoScaleEl.value);
		
		const photoWidthMmEl = document.getElementById('photoWidthMm');
		if (photoWidthMmEl) window.state.photoWidthMm = parseInt(photoWidthMmEl.value) || 100;
		
		const photoHeightMmEl = document.getElementById('photoHeightMm');
		if (photoHeightMmEl) window.state.photoHeightMm = parseInt(photoHeightMmEl.value) || 140;
		
		// ⭐ ТИП СТЕЛЫ ДЛЯ ОСНОВНОГО
		const steleTypeEl = document.getElementById('steleTypeSelect');
		if (steleTypeEl) {
			window.state.steleType = steleTypeEl.value;
		}
		
		// ⭐ ПРОВЕРЯЕМ АКТИВНУЮ МОДЕЛЬ В СЕТКЕ
		const activeModel = document.querySelector('.stele-grid-item.active');
		if (activeModel && activeModel.dataset.model) {
			window.state.steleModel = activeModel.dataset.model;
			window.state.steleType = activeModel.dataset.model;
		}
		
		console.log('🔄 State синхронизирован из UI:', window.state.fullName);
	}


    // ⭐ СБОР ДАННЫХ ИЗ UI (ДЛЯ ДУБЛЕРОВ)
    collectUIData() {
        const data = {};
        
        const fullNameEl = document.getElementById('fullName');
        if (fullNameEl) data.fullName = fullNameEl.value;
        
        const datesEl = document.getElementById('datesText');
        if (datesEl) data.dates = datesEl.value;
        
        const epitaphEl = document.getElementById('epitaphText');
        if (epitaphEl) data.epitaph = epitaphEl.value;
        
        const widthEl = document.getElementById('widthRange');
        if (widthEl) data.width = parseFloat(widthEl.value);
        
        const heightEl = document.getElementById('heightRange');
        if (heightEl) data.height = parseFloat(heightEl.value);
        
        const depthEl = document.getElementById('depthRange');
        if (depthEl) data.depth = parseFloat(depthEl.value) || 0.1;
        
        const materialEl = document.getElementById('materialSelect');
        if (materialEl) data.material = materialEl.value;
        
        const textColorEl = document.getElementById('textColor');
        if (textColorEl) data.textColor = textColorEl.value;
        
        const fontEl = document.getElementById('fontFamily');
        if (fontEl) data.fontFamily = fontEl.value;
        
        const graveWEl = document.getElementById('graveWidth');
        if (graveWEl) data.graveWidth = parseFloat(graveWEl.value);
        
        const graveLEl = document.getElementById('graveLength');
        if (graveLEl) data.graveLength = parseFloat(graveLEl.value);
        
        const baseHEl = document.getElementById('baseHeight');
        if (baseHEl) data.baseHeight = parseFloat(baseHEl.value);
        
        const flowerEnabledEl = document.getElementById('flowerEnabled');
        if (flowerEnabledEl) data.flowerEnabled = flowerEnabledEl.checked;
        
        const flowerWEl = document.getElementById('flowerWidth');
        if (flowerWEl) data.flowerWidth = parseFloat(flowerWEl.value);
        
        const flowerLEl = document.getElementById('flowerLength');
        if (flowerLEl) data.flowerLength = parseFloat(flowerLEl.value);
        
        const flowerTypeEl = document.getElementById('flowerbedType');
        if (flowerTypeEl) data.flowerbedType = flowerTypeEl.value;
        
        const fenceEnabledEl = document.getElementById('fenceEnabled');
        if (fenceEnabledEl) data.fenceEnabled = fenceEnabledEl.checked;
        
        const fenceWEl = document.getElementById('fenceWidth');
        if (fenceWEl) data.fenceWidth = parseFloat(fenceWEl.value);
        
        const fenceLEl = document.getElementById('fenceLength');
        if (fenceLEl) data.fenceLength = parseFloat(fenceLEl.value);
        
        const fenceTypeEl = document.getElementById('fenceType');
        if (fenceTypeEl) data.fenceType = fenceTypeEl.value;
        
        const fenceHEl = document.getElementById('fenceHeight');
        if (fenceHEl) data.fenceHeight = parseFloat(fenceHEl.value);
        
        const fenceMatEl = document.getElementById('fenceMaterial');
        if (fenceMatEl) data.fenceMaterial = fenceMatEl.value;
        
        const gateSideEl = document.getElementById('fenceGateSide');
        if (gateSideEl) data.fenceGateSide = gateSideEl.value;
		
		        if (gateSideEl) data.fenceGateSide = gateSideEl.value;
        
        const gateWEl = document.getElementById('gateWidth');
        if (gateWEl) data.gateWidth = parseFloat(gateWEl.value);
        
        const fenceOffXEl = document.getElementById('fenceOffsetX');
        if (fenceOffXEl) data.fenceOffsetX = parseFloat(fenceOffXEl.value) || 0;
        
        const fenceOffZEl = document.getElementById('fenceOffsetZ');
        if (fenceOffZEl) data.fenceOffsetZ = parseFloat(fenceOffZEl.value) || 0;
        
        const pathEnabledEl = document.getElementById('pathEnabled');
        if (pathEnabledEl) data.pathEnabled = pathEnabledEl.checked;
        
        const pathWEl = document.getElementById('pathWidth');
        if (pathWEl) data.pathWidth = parseFloat(pathWEl.value);
        
        const pathMatEl = document.getElementById('pathMaterial');
        if (pathMatEl) data.pathMaterial = pathMatEl.value;
        
        const nameFontSizeEl = document.getElementById('nameFontSize');
        if (nameFontSizeEl) data.nameFontSize = parseInt(nameFontSizeEl.value);
        
        const datesFontSizeEl = document.getElementById('datesFontSize');
        if (datesFontSizeEl) data.datesFontSize = parseInt(datesFontSizeEl.value);
        
        const epitaphFontSizeEl = document.getElementById('epitaphFontSize');
        if (epitaphFontSizeEl) data.epitaphFontSize = parseInt(epitaphFontSizeEl.value);
        
        data.textOffsetX = parseFloat(document.getElementById('textOffsetX')?.value) || 0;
        data.textOffsetY = parseFloat(document.getElementById('textOffsetY')?.value) || 0;
        data.epitaphOffsetX = parseFloat(document.getElementById('epitaphOffsetX')?.value) || 0;
        data.epitaphOffsetY = parseFloat(document.getElementById('epitaphOffsetY')?.value) || 0;
        
        // ⭐ ТИП СТЕЛЫ - ВАЖНО ДЛЯ ДУБЛЕРОВ!
        const steleSelect = document.getElementById('steleTypeSelect');
        if (steleSelect) {
            data.steleModel = steleSelect.value;
            data.steleType = steleSelect.value;
        }
        
        // ⭐ ПРОВЕРЯЕМ АКТИВНУЮ МОДЕЛЬ В СЕТКЕ
        const activeModel = document.querySelector('.stele-grid-item.active');
        if (activeModel && activeModel.dataset.model) {
            data.steleModel = activeModel.dataset.model;
            data.steleType = activeModel.dataset.model;
        }
        
		// ⭐ ФОТО
		data.textureUrl = window.state?.textureUrl || null;
		data.photoIndex = Number(window.state?.photoIndex) || 0;

		const photoShapeEl = document.querySelector('.shape-option.active');
		if (photoShapeEl) {
			data.photoShape = photoShapeEl.dataset.shape || 'oval';
		}

		const photoScaleEl = document.getElementById('photoScale');
		if (photoScaleEl) data.photoScale = parseFloat(photoScaleEl.value);

		const photoWidthMmEl = document.getElementById('photoWidthMm');
		if (photoWidthMmEl) data.photoWidthMm = parseInt(photoWidthMmEl.value) || 100;

		const photoHeightMmEl = document.getElementById('photoHeightMm');
		if (photoHeightMmEl) data.photoHeightMm = parseInt(photoHeightMmEl.value) || 140;

		data.photoOffsetX = parseFloat(document.getElementById('photoOffsetX')?.value) || 0;
		data.photoOffsetY = parseFloat(document.getElementById('photoOffsetY')?.value) || 0;

		

		
		// ⭐ ГРАВИРОВКИ (если есть менеджер)
		if (window.engravingsManager) {
			const state = window.engravingsManager.state || {};
			data.engravingsFront = state.engravingsFront || [];
			data.engravingsBack = state.engravingsBack || [];
		} else {
			data.engravingsFront = state.engravingsFront || [];
			data.engravingsBack = state.engravingsBack || [];
		}
		
		// ⭐ ТЕКСТ
		data.textColor = document.getElementById('textColor')?.value || '#FFFFFF';
		data.fontFamily = document.getElementById('fontFamily')?.value || 'Arial, sans-serif';
		
		// ⭐ ОГРАДКА
		data.fenceEnabled = document.getElementById('fenceEnabled')?.checked || false;
		data.fenceWidth = parseFloat(document.getElementById('fenceWidth')?.value) || 1.5;
		data.fenceLength = parseFloat(document.getElementById('fenceLength')?.value) || 2.5;
		data.fenceType = document.getElementById('fenceType')?.value || 'none';
		data.fenceHeight = parseFloat(document.getElementById('fenceHeight')?.value) || 0.6;
		data.fenceMaterial = document.getElementById('fenceMaterial')?.value || 'steel';
		data.fenceGateSide = document.getElementById('fenceGateSide')?.value || 'none';
		data.gateWidth = parseFloat(document.getElementById('gateWidth')?.value) || 0.8;
		data.fenceOffsetX = parseFloat(document.getElementById('fenceOffsetX')?.value) || 0;
		data.fenceOffsetZ = parseFloat(document.getElementById('fenceOffsetZ')?.value) || 0;
		
		// ⭐ ДОРОЖКА
		data.pathEnabled = document.getElementById('pathEnabled')?.checked || false;
		data.pathWidth = parseFloat(document.getElementById('pathWidth')?.value) || 0.5;
		data.pathMaterial = document.getElementById('pathMaterial')?.value || 'tile_gray';
		data.pathTileSize = parseFloat(document.getElementById('pathTileSize')?.value) || 0.3;
		data.pathJointColor = document.getElementById('pathJointColor')?.value || '#666666';
		data.pathTileLayout = document.getElementById('pathTileLayout')?.value || 'brick';
		
		return data;
	}

	selectMainMonument() {

		console.log('🔄 === ВЫБОР ОСНОВНОГО ПАМЯТНИКА ===');

		console.log('📊 Текущий режим:', this.currentMode);
		console.log('📊 MAIN заблокирован:', this._mainLockedAfterDuplicator);
		console.log('📊 Текущий state:', window.state?.fullName || 'нет');
		console.log('📊 Дублеров:', this.monuments.length);

		// ============================================================
		// 🔒 MAIN ЗАБЛОКИРОВАН ПОСЛЕ ПЕРЕХОДА В ДУБЛЕР
		//
		// НИКАКОГО RESTORE STATE
		// НИКАКОГО updateScene()
		// НИКАКОГО Object.assign(window.state, ...)
		// ============================================================
		if (this._mainLockedAfterDuplicator) {

			console.warn(
				'🔒 MAIN заблокирован: после перехода к дублеру возврат запрещён'
			);

			this.showToast(
				'🔒 Основной памятник уже настроен. Возврат запрещён.',
				'info'
			);

			return;
		}

		// ============================================================
		// 😴 ЕСЛИ МЕНЕДЖЕР БЫЛ УСЫПЛЕН
		// ============================================================
		if (this._isSleeping) {

			this._isSleeping = false;

			this.scene.add(this.monumentsGroup);

			this.createUI();
		}

		// ============================================================
		// 🏠 ПЕРЕХОД В MAIN
		//
		// Этот блок теперь фактически работает только ДО первого
		// перехода в дублер.
		// ============================================================
		this.currentMode = 'main';
		this.activeIndex = -1;

		this.pendingChanges = null;
		this.pendingIndex = -1;

		this.mainPhotoMesh = null;

		console.log('✅ Режим установлен: main');

		// ============================================================
		// 🧹 КЭШ ДУБЛЕРОВ
		// ============================================================
		this._duplicatorDataCache = {};

		console.log('🧹 Кэш дублеров очищен');

		// ============================================================
		// 🔦 УБИРАЕМ ПОДСВЕТКУ ДУБЛЕРОВ
		// ============================================================
		this.monuments.forEach((mon) => {

			if (mon.group) {
				this.removeHighlight(mon.group);
			}

		});

		// ============================================================
		// 📋 ОБНОВЛЯЕМ СПИСОК
		//
		// renderMonumentList() должен быть только визуальным.
		// window.state здесь НЕ меняем.
		// ============================================================
		this.renderMonumentList();

		console.log('✅ Список обновлен');

		// ============================================================
		// 🔓 СНИМАЕМ ФЛАГИ ДУБЛИКАТОРА
		// ============================================================
		window._disableAutoMonument = false;
		window._isDuplicatorMode = false;

		console.log('🔓 Флаги дублекатора сняты');

		// ============================================================
		// 🔒 UI → STATE НЕ ДЕЛАЕМ
		// ============================================================
		console.log(
			'🔒 UI → STATE синхронизация пропущена'
		);

		console.log(
			'📍 MAIN state:',
			window.state?.fullName
		);

		console.log(
			'📐 steleType:',
			window.state?.steleType
		);

		console.log(
			'📐 steleModel:',
			window.state?.steleModel
		);

		console.log(
			'🖼️ textureUrl:',
			window.state?.textureUrl
		);

		// ============================================================
		// ❌ ВАЖНО:
		// ЗДЕСЬ НЕТ window.updateScene()
		//
		// Мы больше не делаем принудительную пересборку MAIN.
		// ============================================================

		console.log(
			'⏭️ MAIN не пересобираем при переключении'
		);

		console.log(
			'🔄 === КОНЕЦ ВЫБОРА ОСНОВНОГО ==='
		);

		this.showToast(
			'🪦 Выбран основной памятник',
			'info'
		);
	}


	findAllPhotoMeshes() {
		const photos = [];
		
		// 1. Фото в дублерах
		if (this.monuments) {
			this.monuments.forEach((mon, idx) => {
				mon.group.traverse((child) => {
					if (child.isMesh && child.userData && child.userData.isDraggable && child.userData.type === 'photo') {
						photos.push({ mesh: child, index: idx, type: 'duplicator' });
					}
				});
			});
		}
		
		// 2. Фото основного
		if (this.mainPhotoMesh) {
			// Убеждаемся, что userData заполнены
			if (!this.mainPhotoMesh.userData) this.mainPhotoMesh.userData = {};
			this.mainPhotoMesh.userData.isDraggable = true;
			this.mainPhotoMesh.userData.type = 'photo';
			this.mainPhotoMesh.userData.isMainPhoto = true;
			this.mainPhotoMesh.userData._foundType = 'main';
			photos.push({ mesh: this.mainPhotoMesh, index: -1, type: 'main' });
			console.log('📸 Фото основного добавлено в findAllPhotoMeshes');
		}
		
		console.log(`📸 findAllPhotoMeshes: ${photos.length} фото (основных: ${photos.filter(p => p.type === 'main').length}, дублеров: ${photos.filter(p => p.type === 'duplicator').length})`);
		return photos;
	}

	_cloneStateWithTextures(state) {
		if (!state) return null;

		const cloneTexture = (texture) => {
			if (!texture?.image) return texture;

			const source = texture.image;

			const canvas = document.createElement('canvas');
			canvas.width = source.width;
			canvas.height = source.height;

			const ctx = canvas.getContext('2d');
			ctx.drawImage(source, 0, 0);

			const cloned = new THREE.CanvasTexture(canvas);

			cloned.wrapS = texture.wrapS;
			cloned.wrapT = texture.wrapT;
			cloned.minFilter = texture.minFilter;
			cloned.magFilter = texture.magFilter;
			cloned.flipY = texture.flipY;

			if ('colorSpace' in texture) {
				cloned.colorSpace = texture.colorSpace;
			}

			cloned.needsUpdate = true;

			return cloned;
		};

		return {
			...state,

			frontTextureCache: cloneTexture(
				state.frontTextureCache
			),

			backTextureCache: cloneTexture(
				state.backTextureCache
			)
		};
	}

	// ⭐ ВЫБОР ДУБЛЕРА
	selectMonument(index) {

		// ============================================================
		// 🔍 ЗАЩИТА ОТ ДВОЙНОГО ВЫЗОВА
		// ============================================================
		if (this._selectMonumentInProgress) {
			console.warn(
				'⏭️ selectMonument пропущен: операция уже выполняется',
				index
			);
			return;
		}

		this._selectMonumentInProgress = true;

		console.log('🔄 Выбор дублера #' + (index + 1), {
			index,
			currentMode: this.currentMode,
			activeIndex: this.activeIndex
		});

		try {

			// ========================================================
			// ❌ НЕВЕРНЫЙ ИНДЕКС
			// ========================================================
			if (index < 0 || index >= this.monuments.length) {

				console.log(
					'🏠 Запрошен MAIN вместо дублера'
				);

				this.selectMainMonument();
				return;
			}

			// ========================================================
			// 🔒 ПЕРВЫЙ ПЕРЕХОД В ДУБЛЕР
			//
			// С этого момента MAIN блокируется.
			//
			// Никаких snapshot / restore здесь больше нет.
			// ========================================================
			if (!this._mainLockedAfterDuplicator) {

				this._mainLockedAfterDuplicator = true;

				console.log(
					'🔒 MAIN ЗАБЛОКИРОВАН после перехода в дублер'
				);
			}

			// ========================================================
			// 🔒 ПЕРЕХОД В РЕЖИМ ДУБЛЕРА
			// ========================================================
			this.currentMode = 'duplicator';
			this.activeIndex = index;

			window._isDuplicatorMode = true;
			window._disableAutoMonument = true;

			// ========================================================
			// 🧹 ОЧИЩАЕМ PENDING ОТ СТАРОГО ДУБЛЕРА
			// ========================================================
			this.pendingChanges = null;
			this.pendingIndex = index;

			// ========================================================
			// 📋 ЗАГРУЖАЕМ ДАННЫЕ ДУБЛЕРА В UI
			// ========================================================
			console.log(
				'📋 Загружаем данные дублера #' + (index + 1)
			);

			this.loadMonumentToUI(index);

			// ========================================================
			// 📋 ОБНОВЛЯЕМ СПИСОК
			// ========================================================
			this.renderMonumentList();

			// ========================================================
			// 🔦 ПОДСВЕЧИВАЕМ АКТИВНЫЙ ДУБЛЕР
			// ========================================================
			this.highlightActiveMonument();

			// ========================================================
			// 🔒 ГЛАВНЫЙ STATE НЕ ТРОГАЕМ
			// ========================================================
			console.log(
				'🔒 Режим дублера: window.state НЕ изменяется'
			);

			console.log(
				'📍 MAIN window.state после выбора дублера:',
				{
					fullName: window.state?.fullName,
					steleType: window.state?.steleType,
					steleModel: window.state?.steleModel,
					textureUrl:
						window.state?.textureUrl
							? 'есть'
							: 'нет'
				}
			);

			this.showToast(
				`✏️ Редактирование дублера #${index + 1}`,
				'info'
			);

		} finally {

			// ========================================================
			// 🔓 РАЗРЕШАЕМ СЛЕДУЮЩИЙ ВЫЗОВ
			// ========================================================
			setTimeout(() => {
				this._selectMonumentInProgress = false;
			}, 100);
		}
	}

    // ⭐ ЗАГРУЗКА ДАННЫХ ДУБЛЕРА В UI
	loadMonumentToUI(index) {
		if (index < 0 || index >= this.monuments.length) return;
		
		const mon = this.monuments[index];
		let data = this._duplicatorDataCache[index] || mon.data;
		
		console.log('📋 Загружаем данные дублера #' + (index + 1) + ' в UI:', data.fullName);
		
		this.isUpdating = true;
		
		const mappings = {
			'fullName': 'fullName',
			'datesText': 'dates',
			'epitaphText': 'epitaph',
			'widthRange': 'width',
			'heightRange': 'height',
			'depthRange': 'depth',
			'materialSelect': 'material',
			'textColor': 'textColor',
			'fontFamily': 'fontFamily',
			'graveWidth': 'graveWidth',
			'graveLength': 'graveLength',
			'baseHeight': 'baseHeight',
			'flowerWidth': 'flowerWidth',
			'flowerLength': 'flowerLength',
			'flowerEnabled': 'flowerEnabled',
			'flowerbedType': 'flowerbedType',
			'fenceWidth': 'fenceWidth',
			'fenceLength': 'fenceLength',
			'fenceEnabled': 'fenceEnabled',
			'fenceType': 'fenceType',
			'fenceHeight': 'fenceHeight',
			'fenceMaterial': 'fenceMaterial',
			'fenceGateSide': 'fenceGateSide',
			'gateWidth': 'gateWidth',
			'fenceOffsetX': 'fenceOffsetX',
			'fenceOffsetZ': 'fenceOffsetZ',
			'pathEnabled': 'pathEnabled',
			'pathWidth': 'pathWidth',
			'pathMaterial': 'pathMaterial',
			'nameFontSize': 'nameFontSize',
			'datesFontSize': 'datesFontSize',
			'epitaphFontSize': 'epitaphFontSize',
			'steleTypeSelect': 'steleModel',
			'textOffsetX': 'textOffsetX',
			'textOffsetY': 'textOffsetY',
			'epitaphOffsetX': 'epitaphOffsetX',
			'epitaphOffsetY': 'epitaphOffsetY',
			// ⭐ ДОБАВЛЯЕМ ФОТО
			'photoScale': 'photoScale',
			'photoWidthMm': 'photoWidthMm',
			'photoHeightMm': 'photoHeightMm',
			'photoOffsetX': 'photoOffsetX',
			'photoOffsetY': 'photoOffsetY'
		};
		
		for (const [elementId, stateKey] of Object.entries(mappings)) {
			const el = document.getElementById(elementId);
			if (!el) continue;
			const value = data[stateKey];
			if (value === undefined) continue;
			
			if (el.type === 'checkbox') {
				el.checked = !!value;
			} else if (el.type === 'range') {
				el.value = value;
				const valDisplay = document.getElementById(elementId.replace('Range', '') + 'Val');
				if (valDisplay) {
					if (typeof value === 'number') {
						if (value > 0 && value < 100) {
							valDisplay.textContent = value.toFixed(2) + ' м';
						} else {
							valDisplay.textContent = value;
						}
					}
				}
			} else if (el.type === 'color') {
				el.value = value;
			} else if (el.tagName === 'SELECT') {
				el.value = value;
			} else if (el.tagName === 'TEXTAREA') {
				el.value = value || '';
			} else {
				el.value = value;
			}
		}
		
		// ⭐ ЗАГРУЗКА ФОТО
		if (data.textureUrl) {
			// Показываем превью фото
			const photoPreview = document.getElementById('photoPreview');
			if (photoPreview) {
				photoPreview.src = data.textureUrl;
				photoPreview.style.display = 'block';
			}
			// Обновляем state для фото
			if (window.state) {
				window.state.textureUrl = data.textureUrl;
				window.state.modelPhotoUrl = data.textureUrl;
			}
		}
		
		// ⭐ ФОРМА ФОТО
		if (data.photoShape) {
			document.querySelectorAll('.shape-option').forEach(el => {
				el.classList.toggle('active', el.dataset.shape === data.photoShape);
			});
			const customSize = document.getElementById('customPhotoSize');
			if (customSize) {
				customSize.style.display = data.photoShape === 'custom' ? 'block' : 'none';
			}
		}
		
		// ⭐ ЦВЕТНИК
		const flowerControls = document.getElementById('flowerControls');
		if (flowerControls) {
			flowerControls.style.display = data.flowerEnabled !== false ? 'block' : 'none';
		}
		
		// ⭐ ОБНОВЛЯЕМ АКТИВНУЮ МОДЕЛЬ В СЕТКЕ
		if (data.steleModel) {
			this.updateSteleGridSelection(data.steleModel);
		}
		
		this.isUpdating = false;
	}
    
    // ⭐ ОБНОВЛЕНИЕ СЕТКИ СТЕЛ
    updateSteleGridSelection(modelId) {
        // Обновляем select
        const steleSelect = document.getElementById('steleTypeSelect');
        if (steleSelect) {
            const option = steleSelect.querySelector(`option[value="${modelId}"]`);
            if (option) {
                steleSelect.value = modelId;
            } else {
                const options = steleSelect.querySelectorAll('option');
                for (const opt of options) {
                    if (opt.dataset.model === modelId) {
                        steleSelect.value = opt.value;
                        break;
                    }
                }
            }
        }
        
        // Обновляем сетку
        const gridItems = document.querySelectorAll('.stele-grid-item');
        gridItems.forEach(item => {
            const isActive = item.dataset.model === modelId;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.style.border = '2px solid #00a896';
                item.style.boxShadow = '0 0 15px rgba(0,168,150,0.3)';
            } else {
                item.style.border = '2px solid transparent';
                item.style.boxShadow = 'none';
            }
        });
        
        console.log('🔄 Сетка обновлена, выбрана модель:', modelId);
    }

    // ⭐ ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ К ДУБЛЕРУ
    async applyPendingChanges(index) {
        if (index < 0 || index >= this.monuments.length) {
            this.showToast('❌ Дублер не найден', 'error');
            return;
        }

        console.log('🔄 Применяем изменения к дублеру #' + (index + 1));
        
        const mon = this.monuments[index];
        let dataToApply;
		        if (this.pendingIndex === index && this.pendingChanges) {
            dataToApply = { ...this.pendingChanges };
            console.log('📝 Используем pendingChanges');
        } else {
            dataToApply = { ...mon.data };
            console.log('📦 Используем текущие данные монумента');
        }
        
        // ⭐ Сохраняем позицию
        dataToApply.position = { ...mon.position };
        
        // ⭐ Сохраняем ID
        dataToApply.id = mon.id;
        
        console.log('📋 Данные для применения:', dataToApply);
        
        // Обновляем данные
        mon.data = { ...dataToApply };
        
        // ⭐ Очищаем pending
        this.pendingChanges = null;
        this.pendingIndex = -1;
        
        // ⭐ Кэш
        this._duplicatorDataCache[index] = { ...dataToApply };
        
		// ⭐ Перестраиваем монумент
		await this.rebuildSimpleMonument(index);
        
        // ⭐ Обновляем UI
        this.renderMonumentList();
        
        this.showToast(`✅ Изменения дублера #${index + 1} применены`, 'success');
        
        console.log('✅ Изменения применены к дублеру #' + (index + 1));
    }

    // ⭐ ДОБАВЛЕНИЕ НОВОГО ПАМЯТНИКА
    addMonument() {
        console.log('➕ === ДОБАВЛЕНИЕ НОВОГО ПАМЯТНИКА ===');
        
        // ⭐ Если мы сейчас редактируем дублер — сначала применяем изменения
        if (this.currentMode === 'duplicator' && this.activeIndex >= 0) {
            this.applyPendingChanges(this.activeIndex);
        }
        
        // ⭐ Создаем данные нового памятника на основе текущего UI
        const data = this.collectUIData();
        
        // ⭐ Уникальный ID
        const id = this.nextId++;
        
        // ⭐ Рассчитываем позицию
        const position = this.calculateNewPosition();
        
        console.log('📦 Новый памятник:', {
            id,
            position,
            fullName: data.fullName,
            steleModel: data.steleModel
        });
        
        // ⭐ Создаем группу
        const group = new THREE.Group();
        group.name = `DuplicatorMonument_${id}`;
        group.userData.monumentId = id;
        group.userData.isDuplicator = true;
        group.position.set(position.x, position.y, position.z);
        
        // ⭐ Добавляем в общую группу
        this.monumentsGroup.add(group);
        
        // ⭐ Создаем объект монумента
        const monument = {
            id,
            group,
            data: {
                ...data
            },
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            }
        };
        
        this.monuments.push(monument);
        
        // ⭐ Строим монумент
        this.rebuildSimpleMonument(this.monuments.length - 1);
        
        // ⭐ Выбираем новый монумент
        this.activeIndex = this.monuments.length - 1;
        this.currentMode = 'duplicator';
        
        window._isDuplicatorMode = true;
        window._disableAutoMonument = true;
        
        // ⭐ Загружаем в UI
        this.loadMonumentToUI(this.activeIndex);
        
        // ⭐ Обновляем список
        this.renderMonumentList();
        
        this.highlightActiveMonument();
        
        console.log('✅ Новый памятник добавлен:', id);
        
        this.showToast(`➕ Добавлен памятник #${this.activeIndex + 1}`, 'success');
        
        return monument;
    }

    // ⭐ РАСЧЕТ ПОЗИЦИИ НОВОГО ПАМЯТНИКА
    calculateNewPosition() {
        const spacing = 2.5;
        const count = this.monuments.length;
        
        // Размещаем по X
        const x = count * spacing;
        const z = 0;
        
        return {
            x,
            y: 0,
            z
        };
    }

    // ⭐ ДУБЛИРОВАНИЕ ПАМЯТНИКА
    duplicateMonument(index) {
        if (index < 0 || index >= this.monuments.length) {
            console.error('❌ Неверный индекс для дублирования:', index);
            return;
        }
        
        console.log('📋 === ДУБЛИРОВАНИЕ ПАМЯТНИКА ===');
        
        const source = this.monuments[index];
        
        // ⭐ Копируем данные
        const data = JSON.parse(JSON.stringify(source.data));
        
        // ⭐ Новый ID
        const id = this.nextId++;
        
        // ⭐ Новая позиция
        const position = {
            x: source.position.x + 2.5,
            y: source.position.y,
            z: source.position.z
        };
        
        // ⭐ Создаем группу
        const group = new THREE.Group();
        group.name = `DuplicatorMonument_${id}`;
        group.userData.monumentId = id;
        group.userData.isDuplicator = true;
        group.position.set(position.x, position.y, position.z);
        
        this.monumentsGroup.add(group);
        
        // ⭐ Создаем объект
        const monument = {
            id,
            group,
            data,
            position
        };
        
        this.monuments.push(monument);
        
        // ⭐ Строим
        this.rebuildSimpleMonument(this.monuments.length - 1);
        
        // ⭐ Выбираем копию
        this.activeIndex = this.monuments.length - 1;
        this.currentMode = 'duplicator';
        
        window._isDuplicatorMode = true;
        window._disableAutoMonument = true;
        
        this.loadMonumentToUI(this.activeIndex);
        this.renderMonumentList();
        this.highlightActiveMonument();
        
        console.log('✅ Памятник продублирован:', {
            sourceId: source.id,
            newId: id
        });
        
        this.showToast(`📋 Памятник #${index + 1} скопирован`, 'success');
        
        return monument;
    }

    // ⭐ УДАЛЕНИЕ ПАМЯТНИКА
    removeMonument(index) {
        if (index < 0 || index >= this.monuments.length) {
            console.error('❌ Неверный индекс для удаления:', index);
            return;
        }
        
        console.log('🗑️ === УДАЛЕНИЕ ПАМЯТНИКА ===');
        
        const monument = this.monuments[index];
        
        // ⭐ Удаляем группу из сцены
        if (monument.group) {
            this.monumentsGroup.remove(monument.group);
            
            // ⭐ Освобождаем ресурсы
            monument.group.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
        }
        
        // ⭐ Удаляем из массива
        this.monuments.splice(index, 1);
        
        // ⭐ Удаляем из кэша
        delete this._duplicatorDataCache[index];
        
        // ⭐ Пересоздаем индексы кэша
        const newCache = {};
        this.monuments.forEach((mon, i) => {
            if (this._duplicatorDataCache[i]) {
                newCache[i] = this._duplicatorDataCache[i];
            }
        });
        this._duplicatorDataCache = newCache;
        
        // ⭐ Корректируем активный индекс
        if (this.monuments.length === 0) {
            this.activeIndex = -1;
            this.selectMainMonument();
        } else if (this.activeIndex >= this.monuments.length) {
            this.activeIndex = this.monuments.length - 1;
            this.loadMonumentToUI(this.activeIndex);
        } else if (this.activeIndex === index) {
            this.activeIndex = Math.min(index, this.monuments.length - 1);
            this.loadMonumentToUI(this.activeIndex);
        }
        
        // ⭐ Обновляем UI
        this.renderMonumentList();
        
        console.log('✅ Памятник удален. Осталось:', this.monuments.length);
        
        this.showToast('🗑️ Памятник удален', 'success');
    }




    // ⭐ ПЕРЕСТРОЕНИЕ ДУБЛЕРА
	async rebuildSimpleMonument(index) {
		console.log('🚦 rebuildSimpleMonument START', {
			index,
			isRebuilding: this.isRebuilding
		});

		if (this.isRebuilding) {
			console.log('⏳ Пропуск (уже идёт перестроение)');
			return;
		}
		this.isRebuilding = true;

		if (index < 0 || index >= this.monuments.length) {
			this.isRebuilding = false;
			return;
		}
		
		const mon = this.monuments[index];
		
		while (mon.group.children.length > 0) {
			const child = mon.group.children[0];
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				if (Array.isArray(child.material)) {
					child.material.forEach(m => m.dispose());
				} else {
					child.material.dispose();
				}
			}
			mon.group.remove(child);
		}
		
		const data = mon.data;
		const materialType = data.material || 'granite';
		
		console.log(`🔨 Перестраиваем дублер #${mon.id} с данными:`, {
			fullName: data.fullName,
			dates: data.dates,
			epitaph: data.epitaph,
			steleModel: data.steleModel,
			hasPhoto: !!data.textureUrl,
			flowerEnabled: data.flowerEnabled,
			position: mon.group.position
		});
		
		// 1. ОСНОВАНИЕ
		const graveW = data.graveWidth || 0.9;
		const graveL = data.graveLength || 1.5;
		const baseH = data.baseHeight || 0.15;
		
		const baseGeo = new THREE.BoxGeometry(graveW, baseH, graveL);
		const baseMat = await createSteleMaterialWithTexture(materialType, true);
		
		const baseMesh = new THREE.Mesh(baseGeo, baseMat);
		baseMesh.position.y = baseH / 2;
		baseMesh.castShadow = true;
		baseMesh.receiveShadow = true;
		mon.group.add(baseMesh);
		
		// ⭐ 2. ЦВЕТНИК (ЕСЛИ ВКЛЮЧЕН)
		if (data.flowerEnabled !== false) {
			const flowerW = data.flowerWidth || 0.6;
			const flowerL = data.flowerLength || 0.9;
			
			if (flowerW > 0.05 && flowerL > 0.05) {
				try {
					const flowerBedGeo = new THREE.PlaneGeometry(flowerW, flowerL);
					const flowerbedTexture = await loadFlowerbedTexture(data.flowerbedType || 'grass');
					
					let flowerMat;
					if (flowerbedTexture) {
						flowerMat = new THREE.MeshStandardMaterial({
							map: flowerbedTexture,
							roughness: 0.7,
							metalness: 0.05
						});
					} else {
						const fallbackColors = {
							grass: 0x4caf50,
							gravel: 0x888888,
							marble_chips: 0xf5f5f5,
							red_gravel: 0xcd5c5c,
							blue_gravel: 0x4682b4,
							black_gravel: 0x333333,
							sand: 0xf4e4a0,
							flowers: 0x7cb342,
							moss: 0x5d8c3e
						};
						flowerMat = new THREE.MeshStandardMaterial({ 
							color: fallbackColors[data.flowerbedType || 'grass'] || 0x4caf50, 
							roughness: 0.8 
						});
					}
					
					const flowerBed = new THREE.Mesh(flowerBedGeo, flowerMat);
					flowerBed.rotation.x = -Math.PI / 2;
					flowerBed.position.set(0, baseH + 0.005, 0);
					flowerBed.receiveShadow = true;
					mon.group.add(flowerBed);
					
					console.log(`🌺 Цветник создан для дублера #${mon.id}`);
				} catch (e) {
					console.warn('⚠️ Ошибка создания цветника для дублера:', e);
				}
			}
		}
		
		// 3. СТЕЛА
		let steleName = data.steleModel || data.steleType || 'custom_stl_cupol';
		
		const modelMap = {
			'book': 'custom_stl0',
			'rectangle': 'custom_stl_Rectangle',
			'cupol': 'custom_stl_cupol',
			'stele1': 'custom_stl',
			'stele2': 'custom_stl2',
			'stele3': 'custom_stl3',
			'stele4': 'custom_stl4',
			'stele5': 'custom_stl5',
			'stele6': 'custom_stl6',
			'stele7': 'custom_stl7',
			'test': 'custom_stl8',
			'monument': 'custom_stl_monument',
			'custom_stl0': 'custom_stl0',
			'custom_stl': 'custom_stl',
			'custom_stl2': 'custom_stl2',
			'custom_stl3': 'custom_stl3',
			'custom_stl4': 'custom_stl4',
			'custom_stl5': 'custom_stl5',
			'custom_stl6': 'custom_stl6',
			'custom_stl7': 'custom_stl7',
			'custom_stl8': 'custom_stl8',
			'custom_stl_Rectangle': 'custom_stl_Rectangle',
			'custom_stl_cupol': 'custom_stl_cupol',
			'custom_stl_monument': 'custom_stl_monument'
		};
		
		if (modelMap[steleName]) {
			steleName = modelMap[steleName];
		}
		
		console.log(`📐 Используем модель стелы: ${steleName} (было: ${data.steleModel || data.steleType})`);
		
		const loader = window.customSteleLoader;
		if (!loader) {
			console.error('❌ customSteleLoader не найден!');
			this.isRebuilding = false;
			return;
		}
		
		const config = loader.customModels?.[steleName];
		if (!config) {
			console.warn(`⚠️ Модель ${steleName} не найдена, используем custom_stl_cupol`);
			steleName = 'custom_stl_cupol';
		}
		
		const modelType = config?.modelType || 'vertical';

		// Нужно добавить 7-й и 8-й параметры:
		const steleGroup = loader.createCustomSteleMesh(
			steleName,
			data.width || 0.6,
			data.height || 1.3,
			data.depth || 0.08,
			materialType,
			'vertical',
			null,   // ⭐ ДОБАВИТЬ: externalDecalsGroup = null
			true    // ⭐ ДОБАВИТЬ: skipDecals = true (НЕ создаем декали)
		);
		
		if (steleGroup) {
			steleGroup.traverse((child) => {
				if (child.isMesh) {
					const newMat = new THREE.MeshStandardMaterial({
						map: child.material?.map || null,
						color: child.material?.color || new THREE.Color(0xffffff),
						roughness: 0.25,
						metalness: 0.05,
					});
					child.material = newMat;
					child.material.needsUpdate = true;
				}
			});
		}

		steleGroup.position.set(0, baseH + 0.6, -(graveL / 2 - 0.09));
		mon.group.add(steleGroup);
		console.log(`✅ Стела '${steleName}' создана для дублера #${mon.id}`);
		
		await new Promise((resolve) => {
			this.waitForSteleGroup(mon.group, (foundSteleGroup) => {
				try {
					if (!foundSteleGroup) {
						console.warn(`⚠️ Стела не найдена для дублера #${mon.id}`);
						resolve();
						return;
					}

					// Удаляем старый контейнер декалей
					const oldDecals = mon.group.children.find(
						c => c.name === 'decalsContainer'
					);

					if (oldDecals) {
						mon.group.remove(oldDecals);
					}

					// Создаём НОВЫЙ контейнер с ФИО, датами, эпитафией и т.д.
					const decalsGroup = this.createDecalsForDuplicator(
						foundSteleGroup,
						data
					);

					if (decalsGroup) {
						mon.group.add(decalsGroup);

						console.log(
							`✍️ Декали созданы для дублера #${mon.id}:`,
							decalsGroup.children.length
						);
					}

				} catch (error) {
					console.error(
						`❌ Ошибка создания декалей дублера #${mon.id}:`,
						error
					);
				}

				resolve();
			});
		});
		console.log(`🏁 rebuildSimpleMonument ЗАВЕРШЁН для дублера #${mon.id}`);
		this.isRebuilding = false;
	}
	
	
    // ⭐ ОЖИДАНИЕ ЗАГРУЗКИ СТЕЛЫ
    waitForSteleGroup(group, callback, attempts = 0) {
        const maxAttempts = 20;
        const delay = 100;
        
        let foundSteleGroup = null;
        group.traverse((child) => {
            if (child.type === 'Group' && child.userData && child.userData.modelRef) {
                foundSteleGroup = child;
            }
        });
        
        if (foundSteleGroup) {
            callback(foundSteleGroup);
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(() => {
                this.waitForSteleGroup(group, callback, attempts + 1);
            }, delay);
        } else {
            callback(null);
        }
    }

// ⭐ СОЗДАНИЕ ДЕКАЛЕЙ ДЛЯ ДУБЛЕРА (С УЧЕТОМ СМЕЩЕНИЙ)
createDecalsForDuplicator(steleGroup, data) {
    if (!steleGroup || !data) return null;
    
    const decalsGroup = new THREE.Group();
    decalsGroup.name = 'decalsContainer';
    
    try {
        const boundingBox = new THREE.Box3().setFromObject(steleGroup);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const frontZ = boundingBox.max.z + 0.016;
        const backZ = boundingBox.min.z - 0.016;
        
        const width = data.width || 0.6;
        const height = data.height || 1.2;
        
        // ⭐ Передняя сторона (ФИО + Даты) С УЧЕТОМ СМЕЩЕНИЙ
        if ((data.fullName && data.fullName.trim()) || (data.dates && data.dates.trim())) {
            const texture = this.createDecalTextureFromData(data, 'front');
            const textWidth = width * 0.85;
            const textHeight = height * 0.85;
            const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
            const textMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05 
            });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            
            // ⭐ ПРИМЕНЯЕМ СМЕЩЕНИЯ ИЗ DATA
            const offsetX = (data.textOffsetX || 0) * width * 0.5;
            const offsetY = (data.textOffsetY || 0) * height * 0.5;
            
            textMesh.position.set(offsetX, center.y + offsetY, frontZ - 0.015);
            textMesh.renderOrder = 9;
            decalsGroup.add(textMesh);
        }
        
		// ⭐ ФОТО (С ПОДДЕРЖКОЙ ПЕРЕТАСКИВАНИЯ)
		if (data.textureUrl) {
			const loader = new THREE.TextureLoader();
			loader.load(data.textureUrl, (tex) => {
				tex.minFilter = THREE.LinearFilter;
				tex.magFilter = THREE.LinearFilter;
				
				let w, h;
				const shape = data.photoShape || 'oval';
				if (shape === 'custom') {
					w = (data.photoWidthMm || 100) / 1000;
					h = (data.photoHeightMm || 140) / 1000;
				} else {
					const presetSizes = { 
						'oval':   { w: 0.22, h: 0.28 }, 
						'circle': { w: 0.24, h: 0.24 }, 
						'square': { w: 0.22, h: 0.22 } 
					};
					const size = presetSizes[shape] || presetSizes.oval;
					w = size.w;
					h = size.h;
				}
				
				const scale = data.photoScale || 1.0;
				const finalW = w * scale;
				const finalH = h * scale;
				
				let geometry;
				if (shape === 'circle') {
					geometry = new THREE.CircleGeometry(Math.max(finalW, finalH) / 2, 32);
				} else if (shape === 'oval') {
					geometry = new THREE.CircleGeometry(0.5, 32);
					geometry.scale(finalW, finalH, 1);
				} else {
					geometry = new THREE.PlaneGeometry(finalW, finalH);
				}
				
				const photoMat = new THREE.MeshBasicMaterial({ 
					map: tex, 
					transparent: true, 
					side: THREE.DoubleSide, 
					depthWrite: false, 
					alphaTest: 0.05 
				});
				const photoMesh = new THREE.Mesh(geometry, photoMat);
				
				// ⭐ ПОЗИЦИЯ ФОТО
				const photoX = data.photoOffsetX || 0;
				const photoY = center.y + (data.photoOffsetY || 0);
				photoMesh.position.set(photoX, photoY, frontZ - 0.013);
				photoMesh.renderOrder = 11;
				
				// ⭐ ДЕЛАЕМ ФОТО ПЕРЕТАСКИВАЕМЫМ
				photoMesh.userData.isDraggable = true;
				photoMesh.userData.type = 'photo';
				photoMesh.userData.limitX = width / 2 - finalW / 2;
				photoMesh.userData.limitY = height / 2 - finalH / 2;
				photoMesh.userData.steleCenterY = center.y;
				photoMesh.userData.photoIndex = data.photoIndex || 0;
				
				decalsGroup.add(photoMesh);
			});
		}
        
        // ⭐ Задняя сторона (Эпитафия) С УЧЕТОМ СМЕЩЕНИЙ
        if (data.epitaph && data.epitaph.trim()) {
            const texture = this.createDecalTextureFromData(data, 'back');
            const textWidth = width * 0.85;
            const textHeight = height * 0.85;
            const textGeo = new THREE.PlaneGeometry(textWidth, textHeight);
            const textMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide, 
                depthWrite: false, 
                alphaTest: 0.05 
            });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            
            // ⭐ ПРИМЕНЯЕМ СМЕЩЕНИЯ ЭПИТАФИИ ИЗ DATA
            const epitaphOffsetX = (data.epitaphOffsetX || 0) * width * 0.5;
            const epitaphOffsetY = (data.epitaphOffsetY || 0) * height * 0.5;
            
            textMesh.position.set(epitaphOffsetX, center.y + epitaphOffsetY, backZ + 0.015);
            textMesh.rotation.y = Math.PI;
            textMesh.renderOrder = 9;
            decalsGroup.add(textMesh);
        }
        
        // ⭐ ГРАВИРОВКИ (перед)
        if (data.engravingsFront && data.engravingsFront.length > 0) {
            data.engravingsFront.forEach(eng => {
                const loader = new THREE.TextureLoader();
                loader.load(eng.url, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    const sizeM = 0.22 * (eng.scale || 1.0);
                    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                    const material = new THREE.MeshBasicMaterial({ 
                        map: tex, 
                        transparent: true, 
                        side: THREE.DoubleSide, 
                        depthWrite: false, 
                        alphaTest: 0.05
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(eng.x || 0, center.y + (eng.y || 0), frontZ - 0.014);
                    mesh.renderOrder = 10;
                    decalsGroup.add(mesh);
                });
            });
        }
        
        // ⭐ ГРАВИРОВКИ (зад)
        if (data.engravingsBack && data.engravingsBack.length > 0) {
            data.engravingsBack.forEach(eng => {
                const loader = new THREE.TextureLoader();
                loader.load(eng.url, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    const sizeM = 0.22 * (eng.scale || 1.0);
                    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
                    const material = new THREE.MeshBasicMaterial({ 
                        map: tex, 
                        transparent: true, 
                        side: THREE.DoubleSide, 
                        depthWrite: false, 
                        alphaTest: 0.05
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(eng.x || 0, center.y + (eng.y || 0), backZ + 0.014);
                    mesh.rotation.y = Math.PI;
                    mesh.renderOrder = 10;
                    decalsGroup.add(mesh);
                });
            });
        }
        
        return decalsGroup;
    } catch (error) {
        console.error('❌ Ошибка создания декалей:', error);
        return null;
    }
}
	    // ⭐ СОЗДАНИЕ ТЕКСТУРЫ ДЛЯ ДЕКАЛЕЙ
// ⭐ СОЗДАНИЕ ТЕКСТУРЫ ДЛЯ ДЕКАЛЕЙ ДУБЛЕРА
createDecalTextureFromData(data, type = 'front') {
    const canvas = document.createElement('canvas');
    const isMobile = window.innerWidth < 768;
    const canvasSize = isMobile ? 512 : 1024;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const textColor = data.textColor || '#FFFFFF';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 4 : 8;
    
    const fontFamily = data.fontFamily || 'Arial, sans-serif';
    
    // ⭐ СМЕЩЕНИЯ УЖЕ УЧТЕНЫ В ПОЗИЦИИ MESH, ПОЭТОМУ НА КАНВАСЕ НЕ СМЕЩАЕМ!
    // Текст рисуется по центру канваса
    let currentY = 80;
    
    if (type === 'front') {
        // ФИО
        if (data.fullName && data.fullName.trim()) {
            const safeFullName = data.fullName.trim();
            const fontSize = (data.nameFontSize || 48) * (isMobile ? 0.8 : 1.5);
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            
            const rawLines = safeFullName.split(/\r?\n/);
            const allLines = [];
            rawLines.forEach(line => {
                if (line.includes('/')) {
                    const subLines = line.split('/');
                    subLines.forEach(sub => {
                        if (sub.trim()) allLines.push(sub.trim());
                    });
                } else {
                    if (line.trim()) allLines.push(line.trim());
                }
            });
            
            allLines.forEach(line => {
                ctx.fillText(line, canvas.width / 2, currentY);
                currentY += (data.nameFontSize || 48) * (isMobile ? 0.9 : 1.8);
            });
            currentY += isMobile ? 12 : 25;
        }
        
        // Даты
        if (data.dates && data.dates.trim()) {
            const safeDates = data.dates.trim();
            const fontSize = (data.datesFontSize || 32) * (isMobile ? 0.8 : 1.3);
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.fillText(safeDates, canvas.width / 2, currentY);
        }
    } else {
        // Эпитафия
        if (data.epitaph && data.epitaph.trim()) {
            const safeEpitaph = data.epitaph.trim();
            const lines = safeEpitaph.split(/\r?\n|\//);
            const fontSize = (data.epitaphFontSize || 40) * (isMobile ? 0.8 : 1.2);
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            
            lines.forEach(line => {
                if (line.trim()) {
                    ctx.fillText(line.trim(), canvas.width / 2, currentY);
                    currentY += (data.epitaphFontSize || 40) * (isMobile ? 0.9 : 1.5);
                }
            });
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

    // ⭐ ПОДСВЕТКА АКТИВНОГО ДУБЛЕРА
    highlightActiveMonument() {
        this.monuments.forEach((mon, idx) => {
            const isActive = this.currentMode === 'duplicator' && idx === this.activeIndex;
            mon.group.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (isActive) {
                        child.material.emissive = new THREE.Color(0x00a896);
                        child.material.emissiveIntensity = 0.08;
                    } else {
                        child.material.emissive = new THREE.Color(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
            });
        });
    }

    removeHighlight(group) {
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    }

    // ⭐ ДОБАВЛЕНИЕ ДУБЛЕРА
    addMonument(position) {
        this.currentMode = 'duplicator';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        
        const uiData = this.collectUIData();
        
        const newData = {
            ...uiData,
            id: this.nextId++,
            name: `Памятник ${this.monuments.length + 1}`
        };
        
        if (!position) {
            const count = this.monuments.length;
            const spacing = 2.0;
            position = { x: (count + 1) * spacing, z: 0 };
        }
        
        const group = new THREE.Group();
        group.position.set(position.x || 0, 0, position.z || 0);
        group.userData.monumentId = newData.id;
        group.userData.isMonument = true;
        
        this.monumentsGroup.add(group);
        
        const monument = {
            id: newData.id,
            data: newData,
            group: group,
            position: { x: position.x || 0, z: position.z || 0 }
        };
        
        this.monuments.push(monument);
        this.activeIndex = this.monuments.length - 1;
        this.rebuildSimpleMonument(this.monuments.length - 1);
        this.renderMonumentList();
        
        window._disableAutoMonument = true;
        
        this.showToast(`➕ Добавлен дублер #${this.monuments.length}`, 'success');
        return monument;
    }

    // ⭐ ДУБЛИРОВАНИЕ
    duplicateMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        this.currentMode = 'duplicator';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        
        const source = this.monuments[index];
        const newData = { ...source.data };
        newData.id = this.nextId++;
        newData.name = `Копия ${source.data.name || index + 1}`;
        
        const offset = 0.8;
        const count = this.monuments.length;
        const angle = (count / 2) * 0.8;
        const pos = {
            x: source.position.x + Math.cos(angle) * offset,
            z: source.position.z + Math.sin(angle) * offset
        };
        
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        group.userData.monumentId = newData.id;
        group.userData.isMonument = true;
        
        this.monumentsGroup.add(group);
        
        const monument = {
            id: newData.id,
            data: newData,
            group: group,
            position: pos
        };
        
        this.monuments.push(monument);
        this.activeIndex = this.monuments.length - 1;
        this.rebuildSimpleMonument(this.monuments.length - 1);
        this.renderMonumentList();
        
        window._disableAutoMonument = true;
        
        this.showToast(`📋 Дублер скопирован`, 'success');
    }

    // ⭐ УДАЛЕНИЕ ДУБЛЕРА
    removeMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const mon = this.monuments[index];
        this.monumentsGroup.remove(mon.group);
        
        mon.group.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        
        this.monuments.splice(index, 1);
        
        if (this.activeIndex === index) {
            this.activeIndex = -1;
            if (this.monuments.length > 0) {
                this.activeIndex = Math.min(index, this.monuments.length - 1);
                this.loadMonumentToUI(this.activeIndex);
            } else {
                this.currentMode = 'main';
                window._disableAutoMonument = false;
                window._isDuplicatorMode = false;
                if (window.updateScene) window.updateScene();
            }
        } else if (this.activeIndex > index) {
            this.activeIndex--;
        }
        
        this.renderMonumentList();
        this.showToast(`🗑️ Дублер удалён`, 'success');
    }

    // ⭐ КЛИК ПО КАНВАСУ
    handleCanvasClick(event) {
        if (!this._isMoveModeActive) return;
        
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);
        const camera = window.camera || this.controls?.object;
        if (!camera) return;
        
        raycaster.setFromCamera(mouse, camera);
        
        const meshes = [];
        this.monuments.forEach((mon, idx) => {
            mon.group.traverse((child) => {
                if (child.isMesh) {
                    meshes.push({ mesh: child, index: idx });
                }
            });
        });
        
        const intersects = raycaster.intersectObjects(meshes.map(m => m.mesh));
        
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            for (const entry of meshes) {
                if (entry.mesh === hit) {
                    this.selectMonument(entry.index);
                    return;
                }
            }
        }
    }

    // ⭐ ПОКАЗ УВЕДОМЛЕНИЯ
    showToast(message, type) {
        let toast = document.getElementById('monument-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'monument-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                border-radius: 12px;
                z-index: 10001;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s;
                opacity: 0;
                background: rgba(0,0,0,0.85);
                color: white;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.05);
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2000);
    }

    // ⭐ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getActiveMonument() {
        if (this.currentMode === 'duplicator' && this.activeIndex >= 0 && this.activeIndex < this.monuments.length) {
            return this.monuments[this.activeIndex];
        }
        return null;
    }
    
    getAllMonuments() {
        return this.monuments;
    }
    
    getMonumentCount() {
        return this.monuments.length;
    }
    
    toJSON() {
        return {
            monuments: this.monuments.map(mon => ({
                id: mon.id,
                data: mon.data,
                position: mon.position
            }))
        };
    }
    
    fromJSON(data) {
        this.monuments.forEach(mon => {
            this.monumentsGroup.remove(mon.group);
        });
        this.monuments = [];
        this.activeIndex = -1;
        this.currentMode = 'main';
        this.pendingChanges = null;
        this.pendingIndex = -1;
        this._blockStateUpdate = false;
        this._duplicatorDataCache = {};
        
        if (data && data.monuments) {
            data.monuments.forEach(monData => {
                const group = new THREE.Group();
                group.position.set(monData.position.x || 0, 0, monData.position.z || 0);
                group.userData.monumentId = monData.id;
                group.userData.isMonument = true;
                this.monumentsGroup.add(group);
                
                this.monuments.push({
                    id: monData.id || this.nextId++,
                    data: monData.data,
                    group: group,
                    position: monData.position
                });
            });
            
            if (this.monuments.length > 0) {
                this.selectMonument(0);
                this.rebuildAllMonuments();
            }
        }
        
        this.renderMonumentList();
    }
    
    rebuildAllMonuments() {
        this.monuments.forEach((mon, idx) => {
            this.rebuildSimpleMonument(idx);
        });
    }
}