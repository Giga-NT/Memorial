// Модуль управления гравировками - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
export class EngravingsManager {
    constructor(state, updateCallback) {
        this.state = state;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.draggedId = null;
        this.lastPointer = { x: 0, y: 0 };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createUI();
    }
    
    generateId() {
        return 'eng_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    getActiveEngravings() {
        return this.state.activeEngravingSide === 'front' ? this.state.engravings : this.state.backEngravings;
    }
    
    getEngravingPositionInMeters(eng, steleWidth, steleHeight) {
        return {
            x: eng.x * (steleWidth / 2),
            y: eng.y * (steleHeight / 2)
        };
    }
    
    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
    
    setupEventListeners() {
        const canvas = document.getElementById('canvas-container');
        if (!canvas) return;
        
        // Функция перевода экранных координат в метры относительно центра стелы
        const screenToMeters = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            // Нормализованные координаты (-1 до 1)
            const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
            const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
            
            // Переводим в метры, учитывая реальные размеры стелы из state
            // eng.x/y хранятся в метрах, поэтому умножаем нормализованную координату на половину размера
            return {
                x: nx * (this.state.width / 2),
                y: ny * (this.state.height / 2)
            };
        };

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            if (!this.state.enableMoveEngraving) return;
            const { clientX, clientY } = this.getTouchCoords(e);
            const clickedEng = this.getEngravingAtPosition(clientX, clientY);
            if (clickedEng) {
                this.isDragging = true;
                this.draggedId = clickedEng.id;
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging || !this.draggedId) return;
            const { clientX, clientY } = this.getTouchCoords(e);
            e.preventDefault();
            e.stopPropagation();
            
            const engravings = this.getActiveEngravings();
            const eng = engravings.find(e => e.id === this.draggedId);
            if (eng) {
                const pos = screenToMeters(clientX, clientY);
                // Ограничиваем границами стелы в метрах
                eng.x = Math.max(-this.state.width/2, Math.min(this.state.width/2, pos.x));
                eng.y = Math.max(-this.state.height/2, Math.min(this.state.height/2, pos.y));
                
                if (this.updateCallback) this.updateCallback();
            }
        }, { passive: false });
        
        canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            this.draggedId = null;
        });
        
        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
            if (!this.state.enableMoveEngraving) return;
            const clickedEng = this.getEngravingAtPosition(e.clientX, e.clientY);
            if (clickedEng) {
                this.isDragging = true;
                this.draggedId = clickedEng.id;
                e.preventDefault();
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.draggedId) return;
            
            const engravings = this.getActiveEngravings();
            const eng = engravings.find(e => e.id === this.draggedId);
            if (eng) {
                const pos = screenToMeters(e.clientX, e.clientY);
                eng.x = Math.max(-this.state.width/2, Math.min(this.state.width/2, pos.x));
                eng.y = Math.max(-this.state.height/2, Math.min(this.state.height/2, pos.y));
                
                if (this.updateCallback) this.updateCallback();
            }
        });
        
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.draggedId = null;
        });
    }
    
    getEngravingAtPosition(screenX, screenY) {
        const engravings = this.getActiveEngravings();
        if (!engravings || engravings.length === 0) return null;
        
        const canvas = document.getElementById('canvas-container');
        if (!canvas) return null;
        
        // Переводим экран в метры для сравнения
        const rect = canvas.getBoundingClientRect();
        const mx = ((screenX - rect.left) / rect.width) * 2 - 1;
        const my = -((screenY - rect.top) / rect.height) * 2 + 1;
        
        // Переводим метры гравировки обратно в нормализованные координаты для сравнения
        // Или проще: переводим клик в метры и сравниваем с eng.x/y
        const clickPos = {
            x: mx * (this.state.width / 2),
            y: my * (this.state.height / 2)
        };
        
        let closest = null;
        // Радиус клика в метрах (примерно 3-4 см на экране)
        let minDist = 0.04; 
        
        engravings.forEach(eng => {
            if (eng.type === 'none') return;
            const dx = eng.x - clickPos.x;
            const dy = eng.y - clickPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) {
                minDist = dist;
                closest = eng;
            }
        });
        return closest;
    }
    
    // ========== ОТРИСОВКА ГРАВИРОВОК ==========
    
drawOnCanvas(ctx, canvasWidth, canvasHeight, engraving) {
    if (!engraving || engraving.type === 'none') return;
    
    ctx.save();
    ctx.translate(engraving.x * canvasWidth / 2 + canvasWidth / 2, 
                 -engraving.y * canvasHeight / 2 + canvasHeight / 2);
    
    if (engraving.flipX) ctx.scale(-1, 1);
    if (engraving.flipY) ctx.scale(1, -1);
    
    const scale = engraving.size || 1.0;
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5 * scale;
    
    // Просто вызываем новую функцию
    this.drawNormalEngraving(ctx, scale, engraving.type);
    
    ctx.restore();
}
    
    // ========== ВСЕ МЕТОДЫ РИСОВАНИЯ ==========

	// Добавь это в метод drawOnCanvas (вместо старых примитивов)
	drawNormalEngraving(ctx, scale, type) {
		ctx.lineWidth = 4 * scale;
		ctx.fillStyle = '#FFFFFF';
		ctx.strokeStyle = '#FFFFFF';
		
		switch(type) {
			case 'king_cross':
				// Царский крест с короной - просто и красиво
				ctx.beginPath();
				// Сам крест
				ctx.moveTo(0, -35 * scale);
				ctx.lineTo(0, 35 * scale);
				ctx.moveTo(-25 * scale, 0);
				ctx.lineTo(25 * scale, 0);
				ctx.moveTo(-18 * scale, 12 * scale);
				ctx.lineTo(18 * scale, 12 * scale);
				ctx.stroke();
				// Корона сверху
				ctx.beginPath();
				ctx.moveTo(-15 * scale, -40 * scale);
				ctx.lineTo(0, -55 * scale);
				ctx.lineTo(15 * scale, -40 * scale);
				ctx.lineTo(0, -45 * scale);
				ctx.fill();
				// Крест на короне
				ctx.beginPath();
				ctx.moveTo(0, -60 * scale);
				ctx.lineTo(0, -48 * scale);
				ctx.moveTo(-5 * scale, -55 * scale);
				ctx.lineTo(5 * scale, -55 * scale);
				ctx.stroke();
				break;
				
			case 'fancy_cross':
				// Красивый витиеватый крест
				ctx.beginPath();
				ctx.moveTo(0, -40 * scale);
				ctx.lineTo(0, 40 * scale);
				ctx.moveTo(-30 * scale, 0);
				ctx.lineTo(30 * scale, 0);
				ctx.stroke();
				// Украшения на концах
				for(let x of [-30, 30, 0]) {
					ctx.beginPath();
					ctx.arc(x, x === 0 ? -40 * scale : 0, 6 * scale, 0, Math.PI * 2);
					ctx.fill();
				}
				break;
				
			case 'dove_real':
				// Реалистичный голубь (простыми линиями)
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.quadraticCurveTo(-15 * scale, -20 * scale, -25 * scale, -15 * scale);
				ctx.lineTo(-10 * scale, -5 * scale);
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.quadraticCurveTo(15 * scale, -20 * scale, 25 * scale, -15 * scale);
				ctx.lineTo(10 * scale, -5 * scale);
				ctx.fill();
				ctx.beginPath();
				ctx.ellipse(0, 0, 8 * scale, 12 * scale, 0, 0, Math.PI * 2);
				ctx.fill();
				break;
				
			case 'angel_simple':
				// Простой, но симпатичный ангел
				ctx.beginPath();
				ctx.arc(0, -15 * scale, 10 * scale, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.ellipse(0, 5 * scale, 12 * scale, 15 * scale, 0, 0, Math.PI * 2);
				ctx.fill();
				// Крылья
				ctx.beginPath();
				ctx.moveTo(-10 * scale, -5 * scale);
				ctx.quadraticCurveTo(-25 * scale, -20 * scale, -15 * scale, 5 * scale);
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(10 * scale, -5 * scale);
				ctx.quadraticCurveTo(25 * scale, -20 * scale, 15 * scale, 5 * scale);
				ctx.fill();
				break;
		}
	}
    
    drawOrnateCross(ctx, scale) {
        ctx.lineWidth = 4 * scale;
        
        const gradient = ctx.createLinearGradient(-30 * scale, -40 * scale, 30 * scale, 40 * scale);
        gradient.addColorStop(0, '#f0e6d0');
        gradient.addColorStop(1, '#c9b896');
        ctx.strokeStyle = gradient;
        
        ctx.beginPath();
        ctx.moveTo(0, -40 * scale);
        ctx.lineTo(0, 35 * scale);
        ctx.moveTo(-30 * scale, 0);
        ctx.lineTo(30 * scale, 0);
        ctx.stroke();
        
        ctx.lineWidth = 3 * scale;
        for(let x of [-30, 30]) {
            ctx.beginPath();
            ctx.arc(x, 0, 6 * scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x - 5 * scale, -5 * scale, 3 * scale, 0, Math.PI * 2);
            ctx.arc(x + 5 * scale, -5 * scale, 3 * scale, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(0, -40 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-6 * scale, -34 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.arc(6 * scale, -34 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawLatinCross(ctx, scale) {
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, -45 * scale);
        ctx.lineTo(0, 30 * scale);
        ctx.moveTo(-25 * scale, -15 * scale);
        ctx.lineTo(25 * scale, -15 * scale);
        ctx.stroke();
        
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.rect(-5 * scale, -45 * scale, 10 * scale, 8 * scale);
        ctx.stroke();
    }
    
    drawOrthodoxCross(ctx, scale) {
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, -45 * scale);
        ctx.lineTo(0, 35 * scale);
        ctx.moveTo(-28 * scale, -10 * scale);
        ctx.lineTo(28 * scale, -10 * scale);
        ctx.moveTo(-18 * scale, 12 * scale);
        ctx.lineTo(18 * scale, 12 * scale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(10 * scale, 35 * scale);
        ctx.lineTo(-10 * scale, 25 * scale);
        ctx.stroke();
    }
    
    drawCelticCross(ctx, scale) {
        ctx.lineWidth = 5 * scale;
        
        ctx.beginPath();
        ctx.arc(0, -15 * scale, 28 * scale, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -45 * scale);
        ctx.lineTo(0, 35 * scale);
        ctx.moveTo(-28 * scale, -15 * scale);
        ctx.lineTo(28 * scale, -15 * scale);
        ctx.stroke();
        
        ctx.lineWidth = 3 * scale;
        this.drawCelticKnot(ctx, 0, -45 * scale, 8 * scale);
        this.drawCelticKnot(ctx, 0, 35 * scale, 8 * scale);
        this.drawCelticKnot(ctx, -28 * scale, -15 * scale, 8 * scale);
        this.drawCelticKnot(ctx, 28 * scale, -15 * scale, 8 * scale);
    }
    
    drawCelticKnot(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawDoveFlying(ctx, scale) {
        ctx.lineWidth = 2.5 * scale;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(8 * scale, -5 * scale, 15 * scale, -8 * scale);
        ctx.lineTo(8 * scale, -4 * scale);
        ctx.quadraticCurveTo(3 * scale, -3 * scale, 0, 0);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-15 * scale, -20 * scale, -25 * scale, -18 * scale);
        ctx.quadraticCurveTo(-12 * scale, -12 * scale, 0, 0);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(10 * scale, -18 * scale, 20 * scale, -15 * scale);
        ctx.quadraticCurveTo(10 * scale, -10 * scale, 0, 0);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-5 * scale, 0);
        ctx.quadraticCurveTo(-15 * scale, 5 * scale, -12 * scale, 10 * scale);
        ctx.quadraticCurveTo(-8 * scale, 5 * scale, -5 * scale, 0);
        ctx.fill();
        
        ctx.fillStyle = this.state.textColor;
        ctx.beginPath();
        ctx.arc(14 * scale, -9 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawDoveWithOlive(ctx, scale) {
        this.drawDoveFlying(ctx, scale);
        
        ctx.beginPath();
        ctx.moveTo(16 * scale, -7 * scale);
        ctx.quadraticCurveTo(20 * scale, -2 * scale, 18 * scale, 3 * scale);
        ctx.stroke();
        
        for(let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(18 * scale + i * 2, 3 * scale - i * 2, 3 * scale, 1.5 * scale, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawSacredHeart(ctx, scale) {
        ctx.lineWidth = 3 * scale;
        
        ctx.beginPath();
        ctx.moveTo(0, 10 * scale);
        ctx.bezierCurveTo(-25 * scale, -10 * scale, -35 * scale, -25 * scale, 0, -35 * scale);
        ctx.bezierCurveTo(35 * scale, -25 * scale, 25 * scale, -10 * scale, 0, 10 * scale);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-5 * scale, -32 * scale);
        ctx.quadraticCurveTo(0, -42 * scale, 5 * scale, -32 * scale);
        ctx.fill();
        
        ctx.lineWidth = 2.5 * scale;
        for(let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const x = Math.cos(angle) * 28 * scale;
            const y = Math.sin(angle) * 20 * scale - 10 * scale;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * 6 * scale, y + Math.sin(angle) * 4 * scale);
            ctx.stroke();
        }
    }
    
    drawFlamingHeart(ctx, scale) {
        this.drawSacredHeart(ctx, scale * 0.9);
        
        for(let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-8 * scale + i * 4, -30 * scale);
            ctx.quadraticCurveTo(-4 * scale + i * 2, -38 * scale, 0, -30 * scale);
            ctx.fill();
        }
    }
    
    drawPrayingAngel(ctx, scale) {
        ctx.lineWidth = 2.5 * scale;
        
        ctx.beginPath();
        ctx.moveTo(0, -15 * scale);
        ctx.quadraticCurveTo(-25 * scale, -35 * scale, -10 * scale, -5 * scale);
        ctx.quadraticCurveTo(-20 * scale, -20 * scale, 0, -15 * scale);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, -15 * scale);
        ctx.quadraticCurveTo(25 * scale, -35 * scale, 10 * scale, -5 * scale);
        ctx.quadraticCurveTo(20 * scale, -20 * scale, 0, -15 * scale);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(0, -8 * scale, 7 * scale, 9 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(0, -18 * scale, 12 * scale, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-4 * scale, -3 * scale);
        ctx.lineTo(0, 2 * scale);
        ctx.lineTo(4 * scale, -3 * scale);
        ctx.stroke();
        
        ctx.fillStyle = this.state.textColor;
        ctx.beginPath();
        ctx.arc(-2.5 * scale, -10 * scale, 1 * scale, 0, Math.PI * 2);
        ctx.arc(2.5 * scale, -10 * scale, 1 * scale, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawRose(ctx, scale) {
        for(let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const x = Math.cos(angle) * 12 * scale;
            const y = Math.sin(angle) * 8 * scale;
            ctx.beginPath();
            ctx.ellipse(x, y, 7 * scale, 5 * scale, angle, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(-15 * scale, 8 * scale, 6 * scale, 3 * scale, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(15 * scale, 8 * scale, 6 * scale, 3 * scale, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, 5 * scale);
        ctx.quadraticCurveTo(0, 15 * scale, 0, 20 * scale);
        ctx.stroke();
    }
    
    drawLily(ctx, scale) {
        for(let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(
                Math.cos(angle + 0.3) * 10 * scale,
                Math.sin(angle + 0.3) * 15 * scale,
                Math.cos(angle) * 18 * scale,
                Math.sin(angle) * 18 * scale
            );
            ctx.quadraticCurveTo(
                Math.cos(angle - 0.3) * 10 * scale,
                Math.sin(angle - 0.3) * 15 * scale,
                0, 0
            );
            ctx.fill();
        }
        
        for(let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(i * Math.PI * 2 / 3) * 12 * scale, 
                      Math.sin(i * Math.PI * 2 / 3) * 12 * scale);
            ctx.stroke();
        }
    }
    
    drawAlphaOmega(ctx, scale) {
        ctx.font = `${45 * scale}px "Times New Roman", serif`;
        ctx.fillStyle = this.state.textColor;
        ctx.fillText("Α", -18 * scale, 8 * scale);
        ctx.fillText("Ω", 10 * scale, 8 * scale);
        
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(-5 * scale, -15 * scale);
        ctx.lineTo(-5 * scale, 25 * scale);
        ctx.moveTo(-20 * scale, 5 * scale);
        ctx.lineTo(10 * scale, 5 * scale);
        ctx.stroke();
    }
    
    drawIchthys(ctx, scale) {
        ctx.beginPath();
        ctx.moveTo(-20 * scale, 0);
        ctx.quadraticCurveTo(-10 * scale, -15 * scale, 10 * scale, -8 * scale);
        ctx.quadraticCurveTo(20 * scale, 0, 10 * scale, 8 * scale);
        ctx.quadraticCurveTo(-10 * scale, 15 * scale, -20 * scale, 0);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-20 * scale, 0);
        ctx.lineTo(-28 * scale, -10 * scale);
        ctx.lineTo(-25 * scale, 0);
        ctx.lineTo(-28 * scale, 10 * scale);
        ctx.fill();
        
        ctx.fillStyle = this.state.textColor;
        ctx.beginPath();
        ctx.arc(5 * scale, -2 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = `${12 * scale}px "Times New Roman", serif`;
        ctx.fillText("ΙΧΘΥΣ", -8 * scale, -15 * scale);
    }
    
    drawDefaultSymbol(ctx, type, scale) {
        const symbols = { angel: '👼', dove: '🕊️', heart: '❤️', flower: '🌸', cross: '✝️' };
        ctx.font = `${55 * scale}px "Segoe UI Symbol"`;
        ctx.fillText(symbols[type] || '✝️', 0, 0);
    }
    
    drawAllOnCanvas(ctx, canvasWidth, canvasHeight, side) {
        const engravings = side === 'front' ? this.state.engravings : this.state.backEngravings;
        if (!engravings || engravings.length === 0) return;
        engravings.forEach(eng => this.drawOnCanvas(ctx, canvasWidth, canvasHeight, eng));
    }
    
    // ========== УПРАВЛЕНИЕ ГРАВИРОВКАМИ ==========
    
    add(type) {
        console.log(`➕ Добавление гравировки типа: ${type}`);
        
        const newEng = {
            id: this.generateId(),
            type: type,
            x: 0,
            y: 0.6,
            size: 1.0,
            flipX: false,
            flipY: false
        };
        
        if (this.state.activeEngravingSide === 'front') {
            this.state.engravings.push(newEng);
        } else {
            this.state.backEngravings.push(newEng);
        }
        
        this.updateUIList();
        if (this.updateCallback) this.updateCallback();
    }
    
    remove(id) {
        console.log(`❌ Удаление гравировки ID: ${id}`);
        if (this.state.activeEngravingSide === 'front') {
            this.state.engravings = this.state.engravings.filter(e => e.id !== id);
        } else {
            this.state.backEngravings = this.state.backEngravings.filter(e => e.id !== id);
        }
        this.updateUIList();
        if (this.updateCallback) this.updateCallback();
    }
    
    updateProp(id, prop, value) {
        const engravings = this.getActiveEngravings();
        const eng = engravings.find(e => e.id === id);
        if (eng) {
            if (prop === 'size') eng[prop] = parseFloat(value);
            else if (prop === 'flipX' || prop === 'flipY') eng[prop] = value;
            else eng[prop] = value;
            if (this.updateCallback) this.updateCallback();
        }
    }
    
    // ========== СОЗДАНИЕ UI ==========
    
    createUI() {
        const target = document.getElementById('multiEngravingPanelContainer');
        if (!target) {
            console.warn('multiEngravingPanelContainer не найден');
            return;
        }
        
        if (document.getElementById('multiEngravingPanel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'multiEngravingPanel';
        panel.style.cssText = 'background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-top: 15px;';
        

        target.appendChild(panel);
        
        // Заполняем кнопки
        const buttonsContainer = document.getElementById('engravingButtonsContainer');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = this.getSymbolButtons();
            buttonsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.engraving-add-btn');
                if (btn && btn.dataset.type) {
                    this.add(btn.dataset.type);
                }
            });
        }
        
        const sideSelect = document.getElementById('engravingSideSelect');
        if (sideSelect) {
            sideSelect.addEventListener('change', (e) => {
                this.state.activeEngravingSide = e.target.value;
                this.updateUIList();
                if (this.updateCallback) this.updateCallback();
            });
        }
        
        const moveCheckbox = document.getElementById('enableMoveEngravingGlobal');
        if (moveCheckbox) {
            moveCheckbox.addEventListener('change', (e) => {
                this.state.enableMoveEngraving = e.target.checked;
                if (this.state.enableMoveEngraving) {
                    if (this.state.enableMoveMode) this.state.enableMoveMode = false;
                    if (this.state.enableMoveEpitaph) this.state.enableMoveEpitaph = false;
                }
            });
        }
        
        this.updateUIList();
    }
    

    
    updateUIList() {
        const container = document.getElementById('multiEngravingList');
        if (!container) return;
        
        const engravings = this.getActiveEngravings();
        
        if (engravings.length === 0) {
            container.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">Нет гравировок. Нажмите на символ выше, чтобы добавить.</div>';
            return;
        }
        
        const typeNames = {
            'orthodox_cross': '☦️ Православный крест',
            'latin_cross': '✝️ Латинский крест', 
            'celtic_cross': '🔘 Кельтский крест',
            'ornate_cross': '✨ Орнаментальный крест',
            'dove_flying': '🕊️ Летящий голубь',
            'dove_olive': '🕊️ Голубь с ветвью',
            'sacred_heart': '❤️‍🔥 Священное сердце',
            'heart_flame': '❤️‍🔥 Пылающее сердце',
            'praying_angel': '👼 Молящийся ангел',
            'rose': '🌹 Роза',
            'lily': '⚜️ Лилия',
            'alpha_omega': 'ΑΩ Альфа и Омега',
            'ichthys': '🐟 Ихтис'
        };
        
        let html = '';
        engravings.forEach(eng => {
            html += `
                <div class="eng-item" data-id="${eng.id}" style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <strong style="color:white;">${typeNames[eng.type] || eng.type}</strong>
                        <button class="engraving-remove-btn" data-id="${eng.id}" style="width: auto; padding: 2px 8px; background: #e74c3c; margin: 0; cursor: pointer; border: none; border-radius: 4px; color:white;">✕</button>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <label style="font-size: 11px; color:white;">Размер: <input type="range" class="engraving-size" data-id="${eng.id}" min="0.5" max="2.0" step="0.1" value="${eng.size}" style="width: 80px;"></label>
                        <label style="font-size: 11px; color:white;"><input type="checkbox" class="engraving-flipX" data-id="${eng.id}" ${eng.flipX ? 'checked' : ''}> Зеркало X</label>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        // Делегирование событий
        container.onclick = (e) => {
            if (e.target.classList.contains('engraving-remove-btn')) {
                const id = e.target.dataset.id;
                this.remove(id);
            }
        };
        
        container.oninput = (e) => {
            if (e.target.classList.contains('engraving-size')) {
                const id = e.target.dataset.id;
                this.updateProp(id, 'size', e.target.value);
            }
            if (e.target.classList.contains('engraving-flipX')) {
                const id = e.target.dataset.id;
                this.updateProp(id, 'flipX', e.target.checked);
            }
        };
    }
}