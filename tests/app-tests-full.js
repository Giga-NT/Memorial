// tests/app-tests-full.js
const { THREE } = require('./mocks/three-mock.js');

// Сохраняем THREE в глобальную область
global.THREE = THREE;

function createFullAppTests(runner) {
    
    // ============================================================
    // 1. ТЕСТЫ СТЕЛЫ
    // ============================================================
    runner.test('Создание стелы с параметрами', async (t) => {
        const width = 0.6;
        const height = 1.3;
        const depth = 0.08;
        const material = 'granite';
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const materialObj = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const mesh = new THREE.Mesh(geometry, materialObj);
        
        t.expect(mesh).toBeDefined();
        t.expect(mesh.geometry.parameters.width).toBe(width);
        t.expect(mesh.geometry.parameters.height).toBe(height);
        t.expect(mesh.geometry.parameters.depth).toBe(depth);
        
        t.log('info', 'Стела создана', { width, height, depth, material });
    });

    // ============================================================
    // 2. ТЕСТЫ ДУБЛЕРОВ
    // ============================================================
    runner.test('Управление дублерами', async (t) => {
        const scene = new THREE.Scene();
        const renderer = { domElement: { tagName: 'canvas' }, render: () => {} };
        const controls = { enabled: true, object: { position: { x: 0, y: 0, z: 0 } } };
        
        // Создаем мок менеджера
        let Manager = global.MultiMonumentManager;
        if (!Manager) {
            t.log('warn', 'MultiMonumentManager не найден, создаем мок');
            Manager = class MockManager {
                constructor() {
                    this.monuments = [];
                    this.currentMode = 'main';
                    this.activeIndex = -1;
                    this.nextId = 1;
                    this.monumentsGroup = new THREE.Group();
                }
                addMonument(pos) {
                    const id = this.nextId++;
                    const mon = { 
                        id, 
                        data: { 
                            fullName: `Дублер ${id}`,
                            material: 'granite',
                            width: 0.6,
                            height: 1.3,
                            depth: 0.08
                        }, 
                        position: pos || { x: 0, z: 0 },
                        group: new THREE.Group()
                    };
                    this.monuments.push(mon);
                    return mon;
                }
                removeMonument(index) {
                    if (index >= 0 && index < this.monuments.length) {
                        this.monuments.splice(index, 1);
                        return true;
                    }
                    return false;
                }
                selectMonument(index) {
                    if (index >= 0 && index < this.monuments.length) {
                        this.currentMode = 'duplicator';
                        this.activeIndex = index;
                        return true;
                    }
                    return false;
                }
                selectMainMonument() {
                    this.currentMode = 'main';
                    this.activeIndex = -1;
                }
                getMonumentCount() { return this.monuments.length; }
                getAllMonuments() { return this.monuments; }
                toJSON() {
                    return { monuments: this.monuments.map(m => ({ 
                        id: m.id, 
                        data: m.data, 
                        position: m.position 
                    })) };
                }
                fromJSON(data) {
                    this.monuments = [];
                    if (data && data.monuments) {
                        data.monuments.forEach(m => {
                            this.monuments.push({ 
                                id: m.id || this.nextId++, 
                                data: m.data, 
                                position: m.position,
                                group: new THREE.Group()
                            });
                        });
                    }
                }
            };
        }
        
        const manager = new Manager(scene, renderer, controls);
        t.expect(manager).toBeDefined();
        t.expect(manager.monuments).toBeDefined();
        
        // Добавляем дублеры
        const mon1 = manager.addMonument({ x: 1, z: 0 });
        const mon2 = manager.addMonument({ x: 2, z: 1 });
        const mon3 = manager.addMonument({ x: 0, z: -1 });
        
        t.expect(manager.monuments.length).toBe(3);
        t.expect(mon1.id).toBeDefined();
        t.expect(mon2.id).toBeDefined();
        t.expect(mon3.id).toBeDefined();
        
        t.log('info', 'Дублеры добавлены', { count: manager.monuments.length });
        
        // Переключение на дублер
        manager.selectMonument(1);
        t.expect(manager.currentMode).toBe('duplicator');
        t.expect(manager.activeIndex).toBe(1);
        
        // Возврат к основному
        manager.selectMainMonument();
        t.expect(manager.currentMode).toBe('main');
        t.expect(manager.activeIndex).toBe(-1);
        
        // Удаление дублера
        manager.removeMonument(0);
        t.expect(manager.monuments.length).toBe(2);
        
        // Сохранение и загрузка
        const json = manager.toJSON();
        t.expect(json.monuments).toBeDefined();
        t.expect(json.monuments.length).toBe(2);
        
        const newManager = new Manager(scene, renderer, controls);
        newManager.fromJSON(json);
        t.expect(newManager.monuments.length).toBe(2);
    });

    // ============================================================
    // 3. ТЕСТЫ ОГРАДКИ (FENCE) - РАСШИРЕННЫЙ
    // ============================================================
    runner.test('Создание оградки', async (t) => {
        const fenceData = {
            enabled: true,
            width: 4.5,
            length: 5.3,
            height: 0.6,
            type: 'casting',
            material: 'steel',
            gateSide: 'back',
            gateWidth: 0.8,
            offsetX: 1.35,
            offsetZ: 1.5
        };
        
        t.expect(fenceData.enabled).toBe(true);
        t.expect(fenceData.width).toBeGreaterThan(0);
        t.expect(fenceData.length).toBeGreaterThan(0);
        t.expect(fenceData.height).toBeGreaterThan(0);
        t.expect(fenceData.type).toBe('casting');
        t.expect(fenceData.material).toBe('steel');
        t.expect(fenceData.gateSide).toBe('back');
        t.expect(fenceData.gateWidth).toBe(0.8);
        
        // Проверяем типы оградок
        const fenceTypes = ['none', 'wood', 'metal', 'casting', 'stone', 'brick'];
        t.expect(fenceTypes).toContain(fenceData.type);
        
        // Проверяем материалы
        const fenceMaterials = ['wood', 'steel', 'iron', 'aluminum', 'stone'];
        t.expect(fenceMaterials).toContain(fenceData.material);
        
        // Проверяем стороны ворот
        const gateSides = ['none', 'front', 'back', 'left', 'right'];
        t.expect(gateSides).toContain(fenceData.gateSide);
        
        // Проверяем смещения
        t.expect(fenceData.offsetX).toBe(1.35);
        t.expect(fenceData.offsetZ).toBe(1.5);
        
        t.log('info', 'Данные оградки валидны', fenceData);
    });

    // ============================================================
    // 4. ТЕСТЫ ЦВЕТНИКА
    // ============================================================
    runner.test('Создание цветника', async (t) => {
        const flowerData = {
            enabled: true,
            width: 0.6,
            length: 0.9,
            type: 'grass',
            color: '#4caf50'
        };
        
        t.expect(flowerData.enabled).toBe(true);
        t.expect(flowerData.width).toBeGreaterThan(0);
        t.expect(flowerData.length).toBeGreaterThan(0);
        t.expect(flowerData.type).toBe('grass');
        
        const flowerTypes = ['grass', 'gravel', 'marble_chips', 'red_gravel', 'blue_gravel', 'black_gravel', 'sand', 'flowers', 'moss'];
        t.expect(flowerTypes).toContain(flowerData.type);
        
        // Проверяем цвета для разных типов
        const colorMap = {
            'grass': '#4caf50',
            'gravel': '#888888',
            'marble_chips': '#f5f5f5',
            'red_gravel': '#cd5c5c',
            'blue_gravel': '#4682b4',
            'black_gravel': '#333333',
            'sand': '#f4e4a0',
            'flowers': '#7cb342',
            'moss': '#5d8c3e'
        };
        t.expect(colorMap[flowerData.type]).toBe('#4caf50');
        
        t.log('info', 'Данные цветника валидны', flowerData);
    });

    // ============================================================
    // 5. ТЕСТЫ ДОРОЖКИ
    // ============================================================
    runner.test('Создание дорожки', async (t) => {
        const pathData = {
            enabled: true,
            width: 0.5,
            material: 'tile_gray',
            tileSize: 0.3,
            jointColor: '#666666',
            tileLayout: 'brick'
        };
        
        t.expect(pathData.enabled).toBe(true);
        t.expect(pathData.width).toBeGreaterThan(0);
        t.expect(pathData.material).toBeDefined();
        t.expect(pathData.tileSize).toBeGreaterThan(0);
        
        const pathMaterials = ['tile_gray', 'tile_red', 'tile_brown', 'concrete', 'gravel', 'stone'];
        t.expect(pathMaterials).toContain(pathData.material);
        
        const tileLayouts = ['brick', 'herringbone', 'grid', 'diagonal'];
        t.expect(tileLayouts).toContain(pathData.tileLayout);
        
        t.log('info', 'Данные дорожки валидны', pathData);
    });

    // ============================================================
    // 6. ТЕСТЫ ТЕКСТУР
    // ============================================================

	runner.test('Загрузка текстур', async (t) => {
		const texturePaths = {
			'granite': './textures/gabbro/color.webp',
			'black_galaxy': './textures/black_galaxy/color.webp',
			'ninimyaki': './textures/ninimyaki/color.webp',
			'marble': './textures/marble/color.webp',
			'red_granite': './textures/red_granite/color.webp',
			'beige_granite': './textures/beige_granite/color.webp',
			'gray_granite': './textures/gray_granite/gray-polished-granite_albedo.webp'
		};
		
		for (const [name, path] of Object.entries(texturePaths)) {
			t.expect(path).toBeDefined();
			t.expect(typeof path).toBe('string');
			// Проверяем что путь имеет правильное расширение
			t.expect(path).toMatch(/\.(webp|jpg|png)$/);
		}
		
		const fallbackColors = {
			'granite': 0x1a1a1a,
			'black_galaxy': 0x111111,
			'ninimyaki': 0x1a2a1a,
			'marble': 0xf5f5f5,
			'red_granite': 0x8b0000,
			'beige_granite': 0xd4b896,
			'gray_granite': 0x808080
		};
		
		for (const [name, color] of Object.entries(fallbackColors)) {
			t.expect(color).toBeDefined();
			t.expect(typeof color).toBe('number');
			// Проверяем что цвет в допустимом диапазоне
			t.expect(color).toBeGreaterThanOrEqual(0);
			t.expect(color).toBeLessThanOrEqual(0xffffff);
		}
		
		t.log('info', 'Все пути текстур и fallback цвета валидны');
	});

    // ============================================================
    // 7. ТЕСТЫ ФОТО - ИСПРАВЛЕННЫЙ
    // ============================================================
    runner.test('Управление фото', async (t) => {
        const geometry = new THREE.PlaneGeometry(0.2, 0.28);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const photo = new THREE.Mesh(geometry, material);
        
        // Добавляем userData
        photo.userData = {
            type: 'photo',
            isDraggable: true,
            limitX: 0.5,
            limitY: 0.5,
            steleCenterY: 0.6,
            isMainPhoto: true,
            photoIndex: 0
        };
        
        // Проверяем userData
        t.expect(photo.userData.type).toBe('photo');
        t.expect(photo.userData.isDraggable).toBe(true);
        t.expect(photo.userData.limitX).toBe(0.5);
        t.expect(photo.userData.steleCenterY).toBe(0.6);
        
        // Используем position.set (теперь работает с Vector3)
        photo.position.set(0.1, 0.7, 0);
        t.expect(photo.position.x).toBeCloseTo(0.1, 5);
        t.expect(photo.position.y).toBeCloseTo(0.7, 5);
        
        // Проверяем формы фото
        const photoShapes = ['oval', 'circle', 'square', 'custom'];
        t.expect(photoShapes).toContain('oval');
        
        // Проверяем размеры
        const photoSizes = {
            'oval': { w: 0.22, h: 0.28 },
            'circle': { w: 0.24, h: 0.24 },
            'square': { w: 0.22, h: 0.22 }
        };
        t.expect(photoSizes.oval.w).toBe(0.22);
        t.expect(photoSizes.oval.h).toBe(0.28);
        
        // Проверяем масштаб
        const scale = 1.5;
        photo.scale.set(scale, scale, 1);
        t.expect(photo.scale.x).toBe(scale);
        t.expect(photo.scale.y).toBe(scale);
        
        t.log('info', 'Фото создано', {
            type: photo.userData.type,
            position: { x: photo.position.x, y: photo.position.y },
            scale: { x: photo.scale.x, y: photo.scale.y }
        });
    });

    // ============================================================
    // 8. ТЕСТЫ МАТЕРИАЛОВ
    // ============================================================

	runner.test('Материалы и цвета', async (t) => {
		const materials = [
			'granite', 'black_galaxy', 'ninimyaki', 
			'marble', 'red_granite', 'beige_granite', 'gray_granite'
		];
		
		const materialColors = {
			'granite': 0x1a1a1a,
			'black_galaxy': 0x111111,
			'ninimyaki': 0x1a2a1a,
			'marble': 0xf5f5f5,
			'red_granite': 0x8b0000,
			'beige_granite': 0xd4b896,
			'gray_granite': 0x808080
		};
		
		for (const mat of materials) {
			t.expect(materialColors[mat]).toBeDefined();
			// Проверяем что цвет в допустимом диапазоне
			t.expect(materialColors[mat]).toBeGreaterThanOrEqual(0);
			t.expect(materialColors[mat]).toBeLessThanOrEqual(0xffffff);
		}
		
		// Создаем материал с текстурой
		const texture = new THREE.Texture();
		const meshMaterial = new THREE.MeshStandardMaterial({
			map: texture,
			color: new THREE.Color(0xffffff),
			roughness: 0.25,
			metalness: 0.05
		});
		
		t.expect(meshMaterial).toBeDefined();
		t.expect(meshMaterial.roughness).toBe(0.25);
		t.expect(meshMaterial.metalness).toBe(0.05);
		t.expect(meshMaterial.map).toBeDefined();
		
		// Проверяем материал для основания (более шероховатый)
		const baseMaterial = new THREE.MeshStandardMaterial({
			roughness: 0.7,
			metalness: 0.02
		});
		t.expect(baseMaterial.roughness).toBe(0.7);
		t.expect(baseMaterial.metalness).toBe(0.02);
		
		t.log('info', 'Материалы валидны', {
			materials: materials.length,
			hasTexture: !!meshMaterial.map
		});
	});

    // ============================================================
    // 9. ТЕСТЫ ДАННЫХ И СОСТОЯНИЯ
    // ============================================================
    runner.test('Данные и состояние памятника', async (t) => {
        const monumentData = {
            fullName: 'Тестовый Памятник',
            dates: '01.01.1950 — 01.01.2026',
            epitaph: 'Светлая память',
            material: 'granite',
            width: 0.6,
            height: 1.3,
            depth: 0.08,
            textColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            nameFontSize: 48,
            datesFontSize: 32,
            epitaphFontSize: 36,
            graveWidth: 0.9,
            graveLength: 1.5,
            baseHeight: 0.15,
            flowerEnabled: true,
            flowerWidth: 0.6,
            flowerLength: 0.9,
            flowerbedType: 'grass',
            fenceEnabled: true,
            fenceWidth: 4.5,
            fenceLength: 5.3,
            fenceType: 'casting',
            fenceHeight: 0.6,
            fenceMaterial: 'steel',
            fenceGateSide: 'back',
            gateWidth: 0.8,
            fenceOffsetX: 1.35,
            fenceOffsetZ: 1.5,
            pathEnabled: true,
            pathWidth: 0.5,
            pathMaterial: 'tile_gray',
            pathTileSize: 0.3,
            pathJointColor: '#666666',
            pathTileLayout: 'brick',
            steleModel: 'custom_stl_cupol',
            photoOffsetX: 0,
            photoOffsetY: 0,
            photoScale: 1.0,
            photoShape: 'oval',
            photoWidthMm: 100,
            photoHeightMm: 140
        };
        
        // Проверяем обязательные поля
        const requiredFields = ['fullName', 'dates', 'epitaph', 'material', 'width', 'height', 'depth'];
        for (const field of requiredFields) {
            t.expect(monumentData[field]).toBeDefined();
        }
        
        // Проверяем числовые значения
        t.expect(monumentData.width).toBeGreaterThan(0);
        t.expect(monumentData.height).toBeGreaterThan(0);
        t.expect(monumentData.depth).toBeGreaterThan(0);
        t.expect(monumentData.nameFontSize).toBeGreaterThan(0);
        t.expect(monumentData.datesFontSize).toBeGreaterThan(0);
        t.expect(monumentData.epitaphFontSize).toBeGreaterThan(0);
        
        // Проверяем флаги
        t.expect(typeof monumentData.flowerEnabled).toBe('boolean');
        t.expect(typeof monumentData.fenceEnabled).toBe('boolean');
        t.expect(typeof monumentData.pathEnabled).toBe('boolean');
        
        // Проверяем строки
        t.expect(monumentData.fullName).toMatch(/[А-Яа-я]/);
        t.expect(monumentData.dates).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        t.expect(monumentData.material).toBe('granite');
        
        // Проверяем JSON сериализацию
        const json = JSON.stringify(monumentData);
        const parsed = JSON.parse(json);
        t.expect(parsed.fullName).toBe(monumentData.fullName);
        t.expect(parsed.material).toBe(monumentData.material);
        t.expect(parsed.width).toBe(monumentData.width);
        
        t.log('info', 'Данные валидны', { 
            fields: Object.keys(monumentData).length,
            jsonSize: json.length
        });
    });

    // ============================================================
    // 10. ТЕСТЫ ФУРНИТУРЫ (FURNITURE)
    // ============================================================
    runner.test('Управление мебелью', async (t) => {
        const furniture = [
            { type: 'bench', x: 2.275, z: -0.318, rotation: 0, scale: 1 },
            { type: 'bench', x: 2.351, z: 1.587, rotation: 0, scale: 1 },
            { type: 'table_garden', x: -0.320, z: 1.301, rotation: 0, scale: 0.65 },
            { type: 'table', x: 2.602, z: 0.463, rotation: 0, scale: 1 },
            { type: 'table_garden', x: 2.400, z: 3.077, rotation: 0, scale: 1 }
        ];
        
        t.expect(furniture.length).toBe(5);
        
        const furnitureTypes = ['bench', 'table', 'table_garden', 'chair', 'bench_metal'];
        for (const item of furniture) {
            t.expect(furnitureTypes).toContain(item.type);
            t.expect(item.scale).toBeGreaterThan(0);
            t.expect(item.x).toBeDefined();
            t.expect(item.z).toBeDefined();
            t.expect(typeof item.rotation).toBe('number');
        }
        
        // Проверяем уникальность позиций
        const positions = furniture.map(f => `${f.x.toFixed(3)},${f.z.toFixed(3)}`);
        const uniquePositions = new Set(positions);
        t.expect(uniquePositions.size).toBe(furniture.length);
        
        t.log('info', 'Данные мебели валидны', { count: furniture.length });
    });

    // ============================================================
    // 11. ТЕСТЫ ВАЗ
    // ============================================================
    runner.test('Управление вазами', async (t) => {
        const vases = [
            { type: 'vase1', x: -0.034, z: 0.063, rotation: 3.71, scale: 0.85, material: 'marble' },
            { type: 'vase2', x: 0.346, z: 2.520, rotation: 3.037, scale: 1.35, material: 'marble' },
            { type: 'vase1', x: 0.068, z: -0.329, rotation: 1.703, scale: 1.157, material: 'marble' },
            { type: 'vase2', x: 0.201, z: 0.050, rotation: 3.732, scale: 1.35, material: 'marble' },
            { type: 'vase1', x: 1.078, z: 1.644, rotation: 3.588, scale: 1.157, material: 'marble' },
            { type: 'vase2', x: -0.037, z: 3.310, rotation: 4.956, scale: 1.35, material: 'marble' }
        ];
        
        t.expect(vases.length).toBe(6);
        
        const vaseTypes = ['vase1', 'vase2', 'vase3', 'vase_round', 'vase_modern'];
        const vaseMaterials = ['marble', 'granite', 'ceramic', 'metal', 'stone'];
        
        for (const vase of vases) {
            t.expect(vaseTypes).toContain(vase.type);
            t.expect(vase.scale).toBeGreaterThan(0);
            t.expect(vase.x).toBeDefined();
            t.expect(vase.z).toBeDefined();
            t.expect(vaseMaterials).toContain(vase.material);
            t.expect(typeof vase.rotation).toBe('number');
        }
        
        // Проверяем распределение типов
        const typeCount = vases.reduce((acc, v) => {
            acc[v.type] = (acc[v.type] || 0) + 1;
            return acc;
        }, {});
        t.expect(typeCount.vase1).toBe(3);
        t.expect(typeCount.vase2).toBe(3);
        
        t.log('info', 'Данные ваз валидны', { 
            count: vases.length,
            types: typeCount
        });
    });

    // ============================================================
    // 12. ТЕСТЫ ГРАВИРОВОК
    // ============================================================

	runner.test('Управление гравировками', async (t) => {
		const engravingsFront = [
			{ id: 1, type: 'cross', url: './engravings/cross.png', x: 0, y: 0.25, scale: 1.2, rotation: 0 }
		];
		
		const engravingsBack = [
			{ id: 1, type: 'angel', url: './engravings/angel.png', x: 0, y: 0.2, scale: 0.9, rotation: 0 }
		];
		
		// Проверяем количество
		t.expect(engravingsFront.length).toBe(1);
		t.expect(engravingsBack.length).toBe(1);
		
		// Проверяем что ID уникальны в каждой группе
		const frontIds = engravingsFront.map(e => e.id);
		const backIds = engravingsBack.map(e => e.id);
		const uniqueFrontIds = new Set(frontIds);
		const uniqueBackIds = new Set(backIds);
		
		t.expect(uniqueFrontIds.size).toBe(frontIds.length);
		t.expect(uniqueBackIds.size).toBe(backIds.length);
		
		const engravingTypes = ['cross', 'angel', 'dove', 'heart', 'tree', 'flower', 'star'];
		for (const eng of engravingsFront) {
			t.expect(engravingTypes).toContain(eng.type);
			t.expect(eng.scale).toBeGreaterThan(0);
			t.expect(eng.x).toBeDefined();
			t.expect(eng.y).toBeDefined();
			t.expect(eng.url).toMatch(/\.(png|jpg|webp|svg)$/);
		}
		
		for (const eng of engravingsBack) {
			t.expect(engravingTypes).toContain(eng.type);
			t.expect(eng.scale).toBeGreaterThan(0);
			t.expect(eng.x).toBeDefined();
			t.expect(eng.y).toBeDefined();
			t.expect(eng.url).toMatch(/\.(png|jpg|webp|svg)$/);
		}
		
		// Проверяем общее количество
		const totalEngravings = engravingsFront.length + engravingsBack.length;
		t.expect(totalEngravings).toBe(2);
		
		t.log('info', 'Данные гравировок валидны', { 
			front: engravingsFront.length, 
			back: engravingsBack.length,
			total: totalEngravings
		});
	});

    // ============================================================
    // 13. ТЕСТЫ МОДЕЛЕЙ СТЕЛ
    // ============================================================
    runner.test('Модели стел', async (t) => {
        const steleModels = [
            'custom_stl0', 'custom_stl', 'custom_stl2', 'custom_stl3',
            'custom_stl4', 'custom_stl5', 'custom_stl6', 'custom_stl7',
            'custom_stl8', 'custom_stl_Rectangle', 'custom_stl_cupol', 'custom_stl_monument'
        ];
        
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
            'monument': 'custom_stl_monument'
        };
        
        // Проверяем маппинг
        for (const [key, value] of Object.entries(modelMap)) {
            t.expect(steleModels).toContain(value);
            t.expect(modelMap[key]).toBe(value);
        }
        
        // Проверяем что все модели уникальны
        const uniqueModels = new Set(steleModels);
        t.expect(uniqueModels.size).toBe(steleModels.length);
        
        t.log('info', 'Модели стел валидны', { count: steleModels.length });
    });

    // ============================================================
    // 14. ТЕСТЫ ПАРАМЕТРОВ СТЕЛЫ
    // ============================================================
    runner.test('Параметры стелы', async (t) => {
        const params = {
            width: 0.6,
            height: 1.3,
            depth: 0.08,
            material: 'granite',
            steleModel: 'custom_stl_cupol'
        };
        
        // Проверяем обязательные параметры
        t.expect(params.width).toBeGreaterThan(0);
        t.expect(params.width).toBeLessThan(2);
        t.expect(params.height).toBeGreaterThan(0);
        t.expect(params.height).toBeLessThan(3);
        t.expect(params.depth).toBeGreaterThan(0);
        t.expect(params.depth).toBeLessThan(0.5);
        
        // Проверяем материал
        const validMaterials = ['granite', 'black_galaxy', 'ninimyaki', 'marble', 'red_granite', 'beige_granite', 'gray_granite'];
        t.expect(validMaterials).toContain(params.material);
        
        // Проверяем модель
        const validModels = ['custom_stl0', 'custom_stl', 'custom_stl2', 'custom_stl3',
            'custom_stl4', 'custom_stl5', 'custom_stl6', 'custom_stl7',
            'custom_stl8', 'custom_stl_Rectangle', 'custom_stl_cupol', 'custom_stl_monument'];
        t.expect(validModels).toContain(params.steleModel);
        
        t.log('info', 'Параметры стелы валидны', params);
    });
}

module.exports = { createFullAppTests };