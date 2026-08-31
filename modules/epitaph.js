import * as THREE from 'three';

// Модуль управления эпитафией (задняя сторона)
export class EpitaphManager {
    constructor(state, updateCallback, renderer, camera, monumentGroup, getSteleMeshCallback) {
        this.state = state;
        this.updateCallback = updateCallback;
        this.renderer = renderer;
        this.camera = camera;
        this.monumentGroup = monumentGroup;
        this.getSteleMeshCallback = getSteleMeshCallback;
        
        this.isDragging = false;
        this.lastPointer = { x: 0, y: 0 };
        
        console.log('EpitaphManager создан');
        this.init();
    }

    init() {
        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        const targetContainer = document.getElementById('epitaphPanelContainer');
        if (!targetContainer) {
            console.warn('epitaphPanelContainer не найден');
            return;
        }

        // Проверяем, создал ли пользователь уже свои элементы управления в HTML
        const existingTextarea = document.getElementById('epitaphText');
        const existingResetBtn = document.getElementById('btnEpitaphReset');
        const existingMoveCheckbox = document.getElementById('enableMoveEpitaph');

        // Если основных элементов нет, создаем стандартную панель
        if (!existingTextarea) {
            console.log('Создание стандартной панели эпитафии');
            const panel = document.createElement('div');
            panel.id = 'epitaphPanel';
            panel.style.cssText = 'background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-top: 15px;';
            panel.innerHTML = `
                <h4 style="margin: 0 0 10px 0;">📝 Эпитафия (задняя сторона)</h4>
                <div style="margin-bottom:10px;">
                    <textarea id="epitaphText" rows="3" style="width:100%; padding:8px; border-radius:6px; background:rgba(255,255,255,0.1); color:white; border:none; resize:vertical;">${this.state.epitaph || ''}</textarea>
                    <div style="font-size: 11px; margin-top: 5px; color: #aaa;">💡 Используйте / или Enter для переноса строки</div>
                </div>
                <div style="margin-bottom:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <label style="font-size:13px; display:flex; align-items:center; gap:5px; cursor:pointer; background:rgba(0,168,150,0.2); padding:8px; border-radius:6px;">
                        <input type="checkbox" id="enableMoveEpitaph" ${this.state.enableMoveEpitaph ? 'checked' : ''}>
                        ✋ Двигать эпитафию мышкой
                    </label>
                    <button id="resetEpitaphPosBtn" style="width:auto; padding:5px 10px; background:#e74c3c; margin:0;">Сбросить позицию</button>
                </div>
                <div style="font-size: 12px; color: #00a896; margin-top: 5px; text-align: center; background:rgba(0,0,0,0.2); padding:5px; border-radius:6px;" id="epitaphCoords">
                    📍 Позиция: X: ${this.state.epitaphOffsetX.toFixed(2)}, Y: ${this.state.epitaphOffsetY.toFixed(2)}
                </div>
            `;
            targetContainer.appendChild(panel);
            
            // Привязка к созданному textarea
            const newTextarea = document.getElementById('epitaphText');
            if (newTextarea) {
                newTextarea.addEventListener('input', (e) => {
                    this.state.epitaph = e.target.value;
                    if (this.updateCallback) this.updateCallback();
                });
            }
            
            const resetBtn = document.getElementById('resetEpitaphPosBtn');
            if (resetBtn) resetBtn.addEventListener('click', () => this.resetPosition());
            
            const moveCheck = document.getElementById('enableMoveEpitaph');
            if (moveCheck) {
                moveCheck.addEventListener('change', (e) => {
                    this.state.enableMoveEpitaph = e.target.checked;
                    if (this.state.enableMoveMode) this.state.enableMoveMode = false;
                    if (this.state.enableMoveEngraving) this.state.enableMoveEngraving = false;
                    const canvas = document.getElementById('canvas-container');
                    if (canvas) canvas.style.cursor = this.state.enableMoveEpitaph ? 'grab' : 'default';
                });
            }
        } else {
            console.log('Используются существующие элементы управления эпитафией из HTML');
            existingTextarea.value = this.state.epitaph;
            existingTextarea.addEventListener('input', (e) => {
                this.state.epitaph = e.target.value;
                if (this.updateCallback) this.updateCallback();
            });

            if (existingResetBtn) {
                existingResetBtn.addEventListener('click', () => this.resetPosition());
            }
            
            if (existingMoveCheckbox) {
                existingMoveCheckbox.checked = this.state.enableMoveEpitaph;
                existingMoveCheckbox.addEventListener('change', (e) => {
                    this.state.enableMoveEpitaph = e.target.checked;
                    if (this.state.enableMoveMode) this.state.enableMoveMode = false;
                    if (this.state.enableMoveEngraving) this.state.enableMoveEngraving = false;
                    const canvas = document.getElementById('canvas-container');
                    if (canvas) canvas.style.cursor = this.state.enableMoveEpitaph ? 'grab' : 'default';
                });
            }
        }
        
        this.updateCoordsDisplay();
    }

    setupEventListeners() {
        const canvas = document.getElementById('canvas-container');
        if (!canvas) return;
        
        // ========== TOUCH EVENTS ДЛЯ iOS ==========
        canvas.addEventListener('touchstart', (e) => {
            if (!this.state.enableMoveEpitaph) return;
            const touch = e.touches[0];
            const hit = this.getEpitaphAtPosition(touch.clientX, touch.clientY);
            if (hit) {
                this.isDragging = true;
                this.lastPointer = { x: touch.clientX, y: touch.clientY };
                e.preventDefault();
                e.stopPropagation();
                canvas.style.cursor = 'grabbing';
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const sensitivity = 0.003;
            const deltaX = (touch.clientX - this.lastPointer.x) * sensitivity;
            const deltaY = (touch.clientY - this.lastPointer.y) * sensitivity;
            
            this.state.epitaphOffsetX += deltaX;
            this.state.epitaphOffsetY -= deltaY;
            
            this.state.epitaphOffsetX = Math.max(-0.5, Math.min(0.5, this.state.epitaphOffsetX));
            this.state.epitaphOffsetY = Math.max(-0.6, Math.min(0.6, this.state.epitaphOffsetY));
            
            this.updateCoordsDisplay();
            
            if (this.updateCallback) this.updateCallback();
            this.lastPointer = { x: touch.clientX, y: touch.clientY };
        }, { passive: false });
        
        canvas.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvas.style.cursor = this.state.enableMoveEpitaph ? 'grab' : 'default';
            }
        });
        
        canvas.addEventListener('touchcancel', () => {
            this.isDragging = false;
            canvas.style.cursor = this.state.enableMoveEpitaph ? 'grab' : 'default';
        });
        
        // ========== MOUSE EVENTS ДЛЯ DESKTOP ==========
        canvas.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'CANVAS') return;
            if (this.state.enableMoveEpitaph) {
                const hit = this.getEpitaphAtPosition(e.clientX, e.clientY);
                if (hit) {
                    this.isDragging = true;
                    this.lastPointer = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                    canvas.style.cursor = 'grabbing';
                }
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const sensitivity = 0.003;
            const deltaX = (e.clientX - this.lastPointer.x) * sensitivity;
            const deltaY = (e.clientY - this.lastPointer.y) * sensitivity;
            
            this.state.epitaphOffsetX += deltaX;
            this.state.epitaphOffsetY -= deltaY;
            
            this.state.epitaphOffsetX = Math.max(-0.5, Math.min(0.5, this.state.epitaphOffsetX));
            this.state.epitaphOffsetY = Math.max(-0.6, Math.min(0.6, this.state.epitaphOffsetY));
            
            this.updateCoordsDisplay();
            
            if (this.updateCallback) this.updateCallback();
            this.lastPointer = { x: e.clientX, y: e.clientY };
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvas.style.cursor = this.state.enableMoveEpitaph ? 'grab' : 'default';
            }
        });
    }

    getEpitaphAtPosition(screenX, screenY) {
        if (!this.state.epitaph || !this.state.epitaph.trim()) return false;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((screenX - rect.left) / canvas.clientWidth) * 2 - 1;
        mouse.y = -((screenY - rect.top) / canvas.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, this.camera);
        
        const steleMesh = this.getSteleMeshCallback ? this.getSteleMeshCallback() : null;
        if (!steleMesh) return false;
        
        const intersects = raycaster.intersectObject(steleMesh, true);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const localPoint = steleMesh.worldToLocal(point.clone());
            
            if (localPoint.z < 0) {
                return true;
            }
        }
        return false;
    }

    resetPosition() {
        this.state.epitaphOffsetX = 0;
        this.state.epitaphOffsetY = 0;
        this.updateCoordsDisplay();
        if (this.updateCallback) this.updateCallback();
    }
    
    updateCoordsDisplay() {
        const xVal = document.getElementById('epitaphOffsetXVal');
        const yVal = document.getElementById('epitaphOffsetYVal');
        
        if (xVal && yVal) {
            xVal.textContent = this.state.epitaphOffsetX.toFixed(2);
            yVal.textContent = this.state.epitaphOffsetY.toFixed(2);
        } else {
            const coordsDiv = document.getElementById('epitaphCoords');
            if (coordsDiv) {
                coordsDiv.innerHTML = `📍 Позиция: X: ${this.state.epitaphOffsetX.toFixed(2)}, Y: ${this.state.epitaphOffsetY.toFixed(2)}`;
            }
        }
    }
}

export default EpitaphManager;