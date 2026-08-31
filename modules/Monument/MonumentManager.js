// ============================================================
// ⭐ МОДУЛЬ: MULTI_MONUMENT_MANAGER
// ============================================================

class MultiMonumentManager {
    constructor(scene, renderer, controls) {
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        
        // Группа для всех памятников
        this.monumentsGroup = new THREE.Group();
        this.scene.add(this.monumentsGroup);
        
        // Список памятников
        this.monuments = [];
        this.activeIndex = -1;
        this.nextId = 1;
        
        // Текущие настройки из глобального состояния
        this.globalState = window.state || {};
        
        // Ссылка на оригинальный monumentGroup
        this.originalMonumentGroup = window.monumentGroup;
        
        // UI элементы
        this.createUI();
    }
    
    createUI() {
        // Ищем контейнер для панели управления памятниками
        const container = document.getElementById('monumentListContainer');
        if (!container) {
            this.createPanelContainer();
        }
        this.renderMonumentList();
        this.bindEvents();
    }
    
    createPanelContainer() {
        // Создаём панель в меню
        const menuScroll = document.getElementById('menuScroll');
        if (!menuScroll) return;
        
        // Находим блок "Основа памятника" и вставляем после него
        const sections = menuScroll.querySelectorAll('.accordion-section');
        let targetSection = null;
        for (const section of sections) {
            const header = section.querySelector('.section-header');
            if (header && header.textContent.includes('Основа памятника')) {
                targetSection = section;
                break;
            }
        }
        
        if (!targetSection) return;
        
        // Создаём новый раздел для управления несколькими памятниками
        const newSection = document.createElement('div');
        newSection.className = 'accordion-section';
        newSection.id = 'monumentManagerSection';
        newSection.innerHTML = `
            <div class="section-header" role="button" tabindex="0" aria-expanded="false">
                📋 Управление памятниками (${this.monuments.length})
            </div>
            <div class="section-content">
                <div id="monumentListContainer" style="margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #888; text-align: center; padding: 20px;">
                        Нет добавленных памятников
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="addMonumentBtn" style="flex: 2; background: #00a896; padding: 10px; font-size: 14px;">
                        ➕ Добавить памятник
                    </button>
                    <button id="duplicateMonumentBtn" style="flex: 1; background: #8e44ad; padding: 10px; font-size: 14px; display: none;">
                        📋 Копировать
                    </button>
                    <button id="deleteMonumentBtn" style="flex: 1; background: #e74c3c; padding: 10px; font-size: 14px; display: none;">
                        🗑️ Удалить
                    </button>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #666; text-align: center;">
                    💡 Кликни по памятнику в 3D, чтобы выбрать его
                </div>
            </div>
        `;
        
        // Вставляем после целевого раздела
        targetSection.parentNode.insertBefore(newSection, targetSection.nextSibling);
    }
    
    renderMonumentList() {
        const container = document.getElementById('monumentListContainer');
        if (!container) return;
        
        if (this.monuments.length === 0) {
            container.innerHTML = `
                <div style="font-size: 12px; color: #888; text-align: center; padding: 20px; border: 1px dashed #444; border-radius: 8px;">
                    Нет добавленных памятников
                </div>
            `;
            return;
        }
        
        let html = '';
        this.monuments.forEach((mon, index) => {
            const isActive = index === this.activeIndex;
            const name = mon.data.fullName || `Памятник ${index + 1}`;
            const material = mon.data.material || 'гранит';
            
            html += `
                <div class="monument-item" data-index="${index}" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    margin-bottom: 4px;
                    background: ${isActive ? 'rgba(0,168,150,0.3)' : 'rgba(255,255,255,0.05)'};
                    border-radius: 6px;
                    border: 1px solid ${isActive ? '#00a896' : 'transparent'};
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 13px;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: ${isActive ? '#00a896' : '#888'};">
                            ${isActive ? '▶' : '○'}
                        </span>
                        <span style="color: ${isActive ? '#fff' : '#aaa'};">
                            ${this.escapeHtml(name)}
                        </span>
                        <span style="font-size: 10px; color: #666;">${material}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="select-monument-btn" data-index="${index}" style="
                            background: none;
                            border: none;
                            color: ${isActive ? '#00a896' : '#666'};
                            cursor: pointer;
                            padding: 2px 6px;
                            font-size: 12px;
                            width: auto;
                            margin: 0;
                        ">👁️</button>
                        <button class="remove-monument-btn" data-index="${index}" style="
                            background: none;
                            border: none;
                            color: #e74c3c;
                            cursor: pointer;
                            padding: 2px 6px;
                            font-size: 12px;
                            width: auto;
                            margin: 0;
                        ">✖</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Обработчики для кликов по элементам списка
        container.querySelectorAll('.monument-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const index = parseInt(el.dataset.index);
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
        
        container.querySelectorAll('.remove-monument-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeMonument(index);
            });
        });
        
        // Обновляем счётчик в заголовке
        const header = document.querySelector('#monumentManagerSection .section-header');
        if (header) {
            header.textContent = `📋 Управление памятниками (${this.monuments.length})`;
        }
        
        // Показываем/скрываем кнопки
        const dupBtn = document.getElementById('duplicateMonumentBtn');
        const delBtn = document.getElementById('deleteMonumentBtn');
        if (dupBtn) dupBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
        if (delBtn) delBtn.style.display = this.monuments.length > 0 ? 'block' : 'none';
    }
    
    escapeHtml(text) {
        if (!text) return 'Без имени';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.substring(0, 30) + (text.length > 30 ? '...' : '');
    }
    
    bindEvents() {
        // Кнопка добавления
        document.getElementById('addMonumentBtn')?.addEventListener('click', () => {
            this.addMonument();
        });
        
        // Кнопка удаления
        document.getElementById('deleteMonumentBtn')?.addEventListener('click', () => {
            if (this.activeIndex >= 0) {
                this.removeMonument(this.activeIndex);
            }
        });
        
        // Кнопка копирования
        document.getElementById('duplicateMonumentBtn')?.addEventListener('click', () => {
            if (this.activeIndex >= 0) {
                this.duplicateMonument(this.activeIndex);
            }
        });
        
        // Клик по 3D сцене для выбора памятника
        const canvas = document.querySelector('#canvas-container canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                this.handleCanvasClick(e);
            });
        }
        
        // Синхронизация с глобальными настройками при изменении
        this.setupGlobalSync();
    }
    
    setupGlobalSync() {
        // Отслеживаем изменения в глобальном state
        const originalUpdate = window.throttledUpdate;
        if (originalUpdate) {
            window.throttledUpdate = () => {
                // Если есть активный памятник, обновляем его данные из глобального state
                if (this.activeIndex >= 0 && this.monuments[this.activeIndex]) {
                    this.syncActiveMonument();
                }
                originalUpdate();
            };
        }
        
        // Перехватываем обновление сцены
        const originalUpdateScene = window.updateScene;
        if (originalUpdateScene) {
            window.updateScene = async () => {
                // Сохраняем текущий активный памятник
                if (this.activeIndex >= 0 && this.monuments[this.activeIndex]) {
                    this.syncActiveMonument();
                }
                await originalUpdateScene();
            };
        }
    }
    
    syncActiveMonument() {
        if (this.activeIndex < 0 || !this.monuments[this.activeIndex]) return;
        
        const mon = this.monuments[this.activeIndex];
        // Сохраняем текущие настройки из глобального state
        mon.data = { ...window.state };
        mon.data.id = mon.id;
    }
    
    addMonument(position) {
        // Создаём копию текущего состояния
        const newData = { ...window.state };
        newData.id = this.nextId++;
        newData.name = `Памятник ${this.monuments.length + 1}`;
        
        // Если не указана позиция, размещаем рядом с существующими
        if (!position) {
            const count = this.monuments.length;
            const spacing = 2.0; // метры между памятниками
            const offsetX = (count % 3) * spacing - spacing;
            const offsetZ = Math.floor(count / 3) * spacing - spacing;
            position = { x: offsetX, z: offsetZ };
        }
        
        // Создаём группу для памятника
        const group = new THREE.Group();
        group.position.set(position.x || 0, 0, position.z || 0);
        group.userData.monumentId = newData.id;
        group.userData.isMonument = true;
        
        // Добавляем в сцену
        this.monumentsGroup.add(group);
        
        // Сохраняем памятник
        const monument = {
            id: newData.id,
            data: newData,
            group: group,
            meshes: [],
            position: { x: position.x || 0, z: position.z || 0 }
        };
        
        this.monuments.push(monument);
        
        // Выбираем новый памятник
        this.selectMonument(this.monuments.length - 1);
        
        // Перестраиваем сцену для нового памятника
        this.rebuildMonument(this.monuments.length - 1);
        
        // Обновляем UI
        this.renderMonumentList();
        
        console.log(`✅ Добавлен памятник #${newData.id}`);
        this.showToast(`➕ Добавлен памятник #${this.monuments.length}`, 'success');
        
        return monument;
    }
    
    duplicateMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const source = this.monuments[index];
        const newData = { ...source.data };
        newData.id = this.nextId++;
        newData.name = `Копия ${source.data.name || index + 1}`;
        
        // Смещаем копию
        const offset = 0.8;
        const count = this.monuments.length;
        const angle = (count / 2) * 0.8;
        const pos = {
            x: source.position.x + Math.cos(angle) * offset,
            z: source.position.z + Math.sin(angle) * offset
        };
        
        // Создаём группу
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        group.userData.monumentId = newData.id;
        group.userData.isMonument = true;
        
        this.monumentsGroup.add(group);
        
        const monument = {
            id: newData.id,
            data: newData,
            group: group,
            meshes: [],
            position: pos
        };
        
        this.monuments.push(monument);
        this.selectMonument(this.monuments.length - 1);
        this.rebuildMonument(this.monuments.length - 1);
        this.renderMonumentList();
        
        this.showToast(`📋 Памятник скопирован`, 'success');
    }
    
    removeMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        if (this.monuments.length <= 1) {
            this.showToast('❌ Должен быть хотя бы один памятник', 'error');
            return;
        }
        
        const mon = this.monuments[index];
        
        // Удаляем из сцены
        this.monumentsGroup.remove(mon.group);
        
        // Очищаем ресурсы
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
        
        // Удаляем из списка
        this.monuments.splice(index, 1);
        
        // Если удалили активный, выбираем другой
        if (this.activeIndex === index) {
            this.activeIndex = -1;
            if (this.monuments.length > 0) {
                this.selectMonument(Math.min(index, this.monuments.length - 1));
            }
        } else if (this.activeIndex > index) {
            this.activeIndex--;
        }
        
        this.renderMonumentList();
        this.showToast(`🗑️ Памятник удалён`, 'success');
    }
    
    selectMonument(index) {
        if (index < 0 || index >= this.monuments.length) {
            this.activeIndex = -1;
            // Сбрасываем глобальный state на первый памятник или дефолт
            if (this.monuments.length > 0) {
                this.loadMonumentToGlobal(0);
            }
            this.renderMonumentList();
            return;
        }
        
        this.activeIndex = index;
        this.loadMonumentToGlobal(index);
        this.renderMonumentList();
        this.highlightActiveMonument();
        
        console.log(`🎯 Выбран памятник #${this.monuments[index].id}`);
    }
    
    loadMonumentToGlobal(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const mon = this.monuments[index];
        const data = mon.data;
        
        // Загружаем данные в глобальный state
        Object.assign(window.state, data);
        
        // Обновляем UI элементы
        this.updateUIFromState(data);
        
        // Перестраиваем сцену
        if (window.throttledUpdate) {
            window.throttledUpdate();
        }
    }
    
    updateUIFromState(data) {
        // Обновляем все поля в UI
        const mappings = {
            'fullName': 'fullName',
            'datesText': 'dates',
            'epitaphText': 'epitaph',
            'widthRange': 'width',
            'heightRange': 'height',
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
            'pathColor': 'pathColor',
            'pathTileSize': 'pathTileSize',
            'pathJointColor': 'pathJointColor',
            'pathTileLayout': 'pathTileLayout',
            'photoScale': 'photoScale',
            'photoShape': 'photoShape',
            'photoWidthMm': 'photoWidthMm',
            'photoHeightMm': 'photoHeightMm',
            'nameFontSize': 'nameFontSize',
            'datesFontSize': 'datesFontSize',
            'epitaphFontSize': 'epitaphFontSize'
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
                        valDisplay.textContent = value.toFixed(2) + ' м';
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
        
        // Обновляем фото если есть
        if (data.textureUrl && window.photoManager) {
            // Обновляем фото через менеджер
        }
    }
    
    highlightActiveMonument() {
        // Сбрасываем подсветку всех памятников
        this.monuments.forEach((mon, idx) => {
            const isActive = idx === this.activeIndex;
            mon.group.children.forEach(child => {
                if (child.isMesh && child.material) {
                    // Добавляем эффект подсветки
                    if (isActive) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                m.emissive = new THREE.Color(0x00a896);
                                m.emissiveIntensity = 0.15;
                            });
                        } else {
                            child.material.emissive = new THREE.Color(0x00a896);
                            child.material.emissiveIntensity = 0.15;
                        }
                    } else {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                m.emissive = new THREE.Color(0x000000);
                                m.emissiveIntensity = 0;
                            });
                        } else {
                            child.material.emissive = new THREE.Color(0x000000);
                            child.material.emissiveIntensity = 0;
                        }
                    }
                }
            });
        });
    }
    
    handleCanvasClick(event) {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);
        const camera = window.camera || this.controls?.object;
        if (!camera) return;
        
        raycaster.setFromCamera(mouse, camera);
        
        // Собираем все меши памятников
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
            // Находим индекс памятника
            for (const entry of meshes) {
                if (entry.mesh === hit) {
                    this.selectMonument(entry.index);
                    return;
                }
            }
        }
    }
    
    rebuildMonument(index) {
        if (index < 0 || index >= this.monuments.length) return;
        
        const mon = this.monuments[index];
        
        // Очищаем группу
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
        
        // Создаём временный объект для рендеринга
        // Используем существующие функции создания
        const tempState = window.state;
        window.state = mon.data;
        
        // Создаём основание
        const graveW = mon.data.graveWidth || 0.9;
        const graveL = mon.data.graveLength || 1.5;
        const baseH = mon.data.baseHeight || 0.15;
        
        const baseGeo = new THREE.BoxGeometry(graveW, baseH, graveL);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.6,
            metalness: 0.05 
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = baseH / 2;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        mon.group.add(baseMesh);
        
        // Создаём стелу
        const steleW = mon.data.width || 0.6;
        const steleH = mon.data.height || 1.2;
        const steleD = mon.data.depth || 0.08;
        
        const steleGeo = new THREE.BoxGeometry(steleW, steleH, steleD);
        const materialColors = {
            granite: 0x1a1a1a,
            black_galaxy: 0x111111,
            ninimyaki: 0x1a2a1a,
            marble: 0xf5f5f5,
            red_granite: 0x8b0000,
            beige_granite: 0xd4b896,
            gray_granite: 0x808080
        };
        const color = materialColors[mon.data.material] || 0x1a1a1a;
        const steleMat = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.3,
            metalness: 0.05 
        });
        const steleMesh = new THREE.Mesh(steleGeo, steleMat);
        steleMesh.position.y = baseH + steleH / 2;
        steleMesh.position.z = -(graveL / 2 - steleD / 2 - 0.05);
        steleMesh.castShadow = true;
        steleMesh.receiveShadow = true;
        mon.group.add(steleMesh);
        
        // Добавляем простой текст (декаль) если есть имя
        if (mon.data.fullName) {
            // Создаём текстовую декаль
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(mon.data.fullName, 128, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const decalGeo = new THREE.PlaneGeometry(steleW * 0.7, steleH * 0.4);
            const decalMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true,
                side: THREE.DoubleSide
            });
            const decal = new THREE.Mesh(decalGeo, decalMat);
            decal.position.set(0, baseH + steleH * 0.5, -(steleD / 2 + 0.001));
            mon.group.add(decal);
        }
        
        // Восстанавливаем глобальное состояние
        window.state = tempState;
        
        console.log(`🔄 Перестроен памятник #${mon.id}`);
    }
    
    rebuildAllMonuments() {
        this.monuments.forEach((mon, idx) => {
            this.rebuildMonument(idx);
        });
    }
    
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
    
    getActiveMonument() {
        if (this.activeIndex >= 0 && this.activeIndex < this.monuments.length) {
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
    
    // Сохранение/загрузка проекта
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
        // Очищаем текущие памятники
        this.monuments.forEach(mon => {
            this.monumentsGroup.remove(mon.group);
        });
        this.monuments = [];
        this.activeIndex = -1;
        
        // Восстанавливаем из данных
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
                    position: monData.position,
                    meshes: []
                });
            });
            
            // Выбираем первый и перестраиваем
            if (this.monuments.length > 0) {
                this.selectMonument(0);
                this.rebuildAllMonuments();
            }
        }
        
        this.renderMonumentList();
        console.log(`📂 Загружено ${this.monuments.length} памятников`);
    }
}

// ============================================================
// ⭐ ИНИЦИАЛИЗАЦИЯ
// ============================================================

// Создаём глобальный экземпляр менеджера
window.multiMonumentManager = null;

function initMultiMonument() {
    if (window.multiMonumentManager) return;
    
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    // Создаём менеджер
    const manager = new MultiMonumentManager(
        window.scene || new THREE.Scene(),
        window.renderer,
        window.controls
    );
    
    window.multiMonumentManager = manager;
    
    // Добавляем первый памятник по умолчанию
    if (manager.monuments.length === 0) {
        manager.addMonument({ x: 0, z: 0 });
    }
    
    console.log('✅ MultiMonumentManager инициализирован');
}

// Запускаем после загрузки страницы
setTimeout(initMultiMonument, 1000);

// ============================================================
// ⭐ ИНТЕГРАЦИЯ С СУЩЕСТВУЮЩИМИ МЕХАНИЗМАМИ
// ============================================================

// Патчим существующие функции для поддержки нескольких памятников
(function patchExistingFunctions() {
    // Сохраняем оригинальные функции
    const originalUpdateScene = window.updateScene;
    const originalThrottledUpdate = window.throttledUpdate;
    
    // Переопределяем updateScene
    window.updateScene = async function() {
        const manager = window.multiMonumentManager;
        if (manager && manager.monuments.length > 0) {
            // Перестраиваем все памятники
            manager.rebuildAllMonuments();
            manager.renderMonumentList();
            return;
        }
        
        // Если менеджер не инициализирован, используем оригинальную функцию
        if (originalUpdateScene) {
            await originalUpdateScene();
        }
    };
    
    // Переопределяем throttledUpdate
    window.throttledUpdate = function() {
        const manager = window.multiMonumentManager;
        if (manager && manager.monuments.length > 0) {
            // Синхронизируем активный памятник
            manager.syncActiveMonument();
            // Перестраиваем все
            manager.rebuildAllMonuments();
            manager.renderMonumentList();
            return;
        }
        
        if (originalThrottledUpdate) {
            originalThrottledUpdate();
        }
    };
    
    console.log('🔧 Функции обновления сцены патчены для поддержки нескольких памятников');
})();

// ============================================================
// ⭐ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ПАМЯТНИКАМИ
// ============================================================

// Функция для быстрого добавления памятника
window.addMonument = function(x, z) {
    const manager = window.multiMonumentManager;
    if (!manager) {
        console.warn('⚠️ MultiMonumentManager не инициализирован');
        return null;
    }
    return manager.addMonument({ x: x || 0, z: z || 0 });
};

// Функция для удаления всех памятников
window.clearAllMonuments = function() {
    const manager = window.multiMonumentManager;
    if (!manager) return;
    
    while (manager.monuments.length > 1) {
        manager.removeMonument(manager.monuments.length - 1);
    }
    if (manager.monuments.length === 1) {
        // Очищаем данные первого
        const mon = manager.monuments[0];
        mon.data = { ...window.state };
        manager.rebuildMonument(0);
        manager.renderMonumentList();
    }
};

// Функция для экспорта всех памятников
window.exportAllMonuments = function() {
    const manager = window.multiMonumentManager;
    if (!manager) return null;
    return manager.toJSON();
};

// Функция для импорта памятников
window.importAllMonuments = function(data) {
    const manager = window.multiMonumentManager;
    if (!manager) return;
    manager.fromJSON(data);
};

console.log('✅ MultiMonumentManager готов к использованию!');
console.log('📖 Используйте:');
console.log('  - addMonument(x, z) - добавить памятник');
console.log('  - clearAllMonuments() - очистить все');
console.log('  - exportAllMonuments() - экспортировать');
console.log('  - importAllMonuments(data) - импортировать');