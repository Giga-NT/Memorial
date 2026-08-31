// Модуль управления фото
export class PhotoManager {
    constructor(state, updateCallback) {
        this.state = state;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.lastPointer = { x: 0, y: 0 };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupUI();
    }
    
    setupUI() {
        const shapeOptions = document.querySelectorAll('#photoShapeOptions .shape-option');
        shapeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const shape = opt.dataset.shape;
                this.setShape(shape);
            });
        });
        
        const widthInput = document.getElementById('photoWidthMm');
        const heightInput = document.getElementById('photoHeightMm');
        if (widthInput) widthInput.addEventListener('input', (e) => this.setCustomSize('width', e.target.value));
        if (heightInput) heightInput.addEventListener('input', (e) => this.setCustomSize('height', e.target.value));
        
        const scaleInput = document.getElementById('photoScale');
        if (scaleInput) scaleInput.addEventListener('input', (e) => this.setScale(e.target.value));
        
        // Чекбокс для движения фото
        const enableMovePhoto = document.getElementById('enableMovePhoto');
        if (enableMovePhoto) {
            enableMovePhoto.addEventListener('change', (e) => {
                this.state.enableMoveMode = e.target.checked;
                if (this.state.enableMoveMode) {
                    this.state.enableMoveEngraving = false;
                    this.state.enableMoveEpitaph = false;
                    const engravingCheck = document.getElementById('enableMoveEngravingGlobal');
                    if (engravingCheck) engravingCheck.checked = false;
                    const epitaphCheck = document.getElementById('enableMoveEpitaph');
                    if (epitaphCheck) epitaphCheck.checked = false;
                }
                const canvas = document.getElementById('canvas-container');
                if (canvas) canvas.style.cursor = this.state.enableMoveMode ? 'grab' : 'default';
            });
        }
    }
    
    setShape(shape) {
        this.state.photoShape = shape;
        
        // Обновляем UI
        document.querySelectorAll('#photoShapeOptions .shape-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.shape === shape);
        });
        
        const customDiv = document.getElementById('customPhotoSize');
        if (customDiv) customDiv.style.display = shape === 'custom' ? 'block' : 'none';
        
        if (this.updateCallback) this.updateCallback();
    }
    
    setCustomSize(dimension, value) {
        if (dimension === 'width') this.state.photoWidthMm = parseInt(value);
        else this.state.photoHeightMm = parseInt(value);
        if (this.updateCallback) this.updateCallback();
    }
    
    setScale(value) {
        this.state.photoScale = parseFloat(value);
        const scaleVal = document.getElementById('photoScaleVal');
        if (scaleVal) scaleVal.textContent = this.state.photoScale.toFixed(1);
        if (this.updateCallback) this.updateCallback();
    }
    
    getTouchCoords(e) {
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return { clientX, clientY };
    }
    
    setupEventListeners() {
        const canvas = document.getElementById('canvas-container');
        if (!canvas) return;
        
        // ========== TOUCH EVENTS ДЛЯ iOS ==========
        canvas.addEventListener('touchstart', (e) => {
            if (!this.state.enableMoveMode) return;
            this.isDragging = true;
            const { clientX, clientY } = this.getTouchCoords(e);
            this.lastPointer = { x: clientX, y: clientY };
            e.preventDefault();
            e.stopPropagation();
            canvas.style.cursor = 'grabbing';
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            
            const { clientX, clientY } = this.getTouchCoords(e);
            const deltaX = (clientX - this.lastPointer.x) * 0.005;
            const deltaY = (clientY - this.lastPointer.y) * 0.005;
            
            this.state.photoOffsetX += deltaX;
            this.state.photoOffsetY -= deltaY;
            
            // Ограничения
            this.state.photoOffsetX = Math.max(-0.5, Math.min(0.5, this.state.photoOffsetX));
            this.state.photoOffsetY = Math.max(-0.5, Math.min(0.5, this.state.photoOffsetY));
            
            if (this.updateCallback) this.updateCallback();
            this.lastPointer = { x: clientX, y: clientY };
        }, { passive: false });
        
        canvas.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvas.style.cursor = this.state.enableMoveMode ? 'grab' : 'default';
            }
        });
        
        canvas.addEventListener('touchcancel', () => {
            this.isDragging = false;
            canvas.style.cursor = this.state.enableMoveMode ? 'grab' : 'default';
        });
        
        // ========== MOUSE EVENTS ДЛЯ DESKTOP ==========
        canvas.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'CANVAS') return;
            if (this.state.enableMoveMode) {
                this.isDragging = true;
                this.lastPointer = { x: e.clientX, y: e.clientY };
                e.preventDefault();
                canvas.style.cursor = 'grabbing';
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const deltaX = (e.clientX - this.lastPointer.x) * 0.005;
            const deltaY = (e.clientY - this.lastPointer.y) * 0.005;
            
            this.state.photoOffsetX += deltaX;
            this.state.photoOffsetY -= deltaY;
            
            this.state.photoOffsetX = Math.max(-0.5, Math.min(0.5, this.state.photoOffsetX));
            this.state.photoOffsetY = Math.max(-0.5, Math.min(0.5, this.state.photoOffsetY));
            
            if (this.updateCallback) this.updateCallback();
            this.lastPointer = { x: e.clientX, y: e.clientY };
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvas.style.cursor = this.state.enableMoveMode ? 'grab' : 'default';
            }
        });
    }
    
    getPhotoSize() {
        let w, h;
        if (this.state.photoShape === 'custom') {
            w = this.state.photoWidthMm / 1000;
            h = this.state.photoHeightMm / 1000;
        } else {
            const sizes = { oval: { w: 0.12, h: 0.16 }, circle: { w: 0.13, h: 0.13 }, square: { w: 0.14, h: 0.14 } };
            w = sizes[this.state.photoShape].w;
            h = sizes[this.state.photoShape].h;
        }
        const scale = this.state.photoScale || 1.0;
        return { w: w * scale, h: h * scale };
    }
    
    drawOnCanvas(ctx, canvasWidth, canvasHeight, imageUrl, onComplete) {
        if (!imageUrl) return;
        const img = new Image();
        img.onload = () => {
            const { w, h } = this.getPhotoSize();
            const pixelW = w * (canvasWidth / (this.state.width || 0.6));
            const pixelH = h * (canvasHeight / (this.state.height || 1.2));
            const x = canvasWidth / 2 + this.state.photoOffsetX * canvasWidth / 2 - pixelW / 2;
            const y = canvasHeight / 2 - this.state.photoOffsetY * canvasHeight / 2 - pixelH / 2;
            
            ctx.save();
            if (this.state.photoShape === 'circle') {
                ctx.beginPath();
                ctx.arc(x + pixelW/2, y + pixelH/2, Math.min(pixelW, pixelH)/2, 0, Math.PI*2);
                ctx.clip();
            } else if (this.state.photoShape === 'oval') {
                ctx.beginPath();
                ctx.ellipse(x + pixelW/2, y + pixelH/2, pixelW/2, pixelH/2, 0, 0, Math.PI*2);
                ctx.clip();
            }
            ctx.drawImage(img, x, y, pixelW, pixelH);
            ctx.restore();
            
            // Рамка
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 4;
            if (this.state.photoShape === 'circle') {
                ctx.beginPath();
                ctx.arc(x + pixelW/2, y + pixelH/2, Math.min(pixelW, pixelH)/2, 0, Math.PI*2);
                ctx.stroke();
            } else if (this.state.photoShape === 'oval') {
                ctx.beginPath();
                ctx.ellipse(x + pixelW/2, y + pixelH/2, pixelW/2, pixelH/2, 0, 0, Math.PI*2);
                ctx.stroke();
            } else {
                ctx.strokeRect(x, y, pixelW, pixelH);
            }
            
            if (onComplete) onComplete();
        };
        img.src = imageUrl;
    }
}