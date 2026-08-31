/**
 * Heavy Model Loader - Загрузчик тяжёлых 3D моделей (GLB/GLTF)
 * Оптимизирован для моделей до 200 МБ с прогресс-баром и Draco сжатием
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class HeavyModelLoader {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.currentModel = null;
        this.options = {
            autoCenter: true,
            autoScale: true,
            maxSize: 3.0,
            showProgress: true,
            dracoEnabled: true,
            ...options
        };
        
        // Инициализация загрузчика с Draco сжатием
        this.initLoader();
        
        // Создаём UI для прогресса
        if (this.options.showProgress) {
            this.createProgressUI();
        }
    }
    
    initLoader() {
        this.loader = new GLTFLoader();
        
        if (this.options.dracoEnabled) {
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
            dracoLoader.setDecoderConfig({ type: 'js' });
            this.loader.setDRACOLoader(dracoLoader);
            console.log('✅ Draco загрузчик включён');
        }
    }
    
    createProgressUI() {
        // Создаём контейнер
        this.progressContainer = document.createElement('div');
        this.progressContainer.id = 'heavy-model-progress';
        this.progressContainer.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 30px;
            right: 30px;
            background: rgba(0,0,0,0.92);
            backdrop-filter: blur(12px);
            border-radius: 16px;
            padding: 20px 25px;
            z-index: 10000;
            font-family: monospace;
            border-left: 4px solid #d97706;
            display: none;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            pointer-events: auto;
        `;
        
        this.progressContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #fbbf24; font-size: 14px; font-weight: bold;">📦 ЗАГРУЗКА МОДЕЛИ</span>
                <span id="model-percent" style="color: #d97706; font-size: 14px; font-weight: bold;">0%</span>
            </div>
            <div class="hm-progress-bar" style="width: 100%; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                <div id="hm-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #d97706, #fbbf24); transition: width 0.3s; border-radius: 4px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span id="hm-status-text" style="color: #94a3b8; font-size: 12px;">⏳ Ожидание...</span>
                <span id="hm-file-size" style="color: #94a3b8; font-size: 11px;"></span>
            </div>
            <div id="hm-speed-info" style="color: #4ade80; font-size: 11px; font-family: monospace;"></div>
        `;
        
        document.body.appendChild(this.progressContainer);
        
        // Элементы
        this.progressFill = document.getElementById('hm-progress-fill');
        this.progressPercent = document.getElementById('model-percent');
        this.statusText = document.getElementById('hm-status-text');
        this.fileSizeSpan = document.getElementById('hm-file-size');
        this.speedInfo = document.getElementById('hm-speed-info');
    }
    
    showProgress(show) {
        if (this.progressContainer) {
            this.progressContainer.style.display = show ? 'block' : 'none';
        }
    }
    
    updateProgress(percent, message, loadedMB = null, totalMB = null, speed = null) {
        if (this.progressFill) this.progressFill.style.width = `${percent}%`;
        if (this.progressPercent) this.progressPercent.innerText = `${percent}%`;
        if (this.statusText) this.statusText.innerHTML = message;
        
        if (loadedMB !== null && totalMB !== null && this.fileSizeSpan) {
            this.fileSizeSpan.innerHTML = `${loadedMB} / ${totalMB} МБ`;
        }
        
        if (speed !== null && this.speedInfo) {
            this.speedInfo.innerHTML = `⚡ Скорость: ${speed.toFixed(1)} МБ/с`;
        }
    }
    
    /**
     * Загрузка модели из файла
     * @param {File} file - GLB/GLTF файл
     * @param {Object} options - дополнительные опции
     * @returns {Promise} - промис с загруженной моделью
     */
    loadFromFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('Файл не выбран'));
                return;
            }
            
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'glb' && ext !== 'gltf') {
                reject(new Error('Поддерживаются только GLB и GLTF файлы'));
                return;
            }
            
            const fileSizeMB = file.size / (1024 * 1024);
            console.log(`📁 Загрузка: ${file.name} (${fileSizeMB.toFixed(1)} МБ)`);
            
            this.showProgress(true);
            this.updateProgress(0, `🚀 Инициализация загрузчика...`, 0, fileSizeMB.toFixed(1));
            
            const url = URL.createObjectURL(file);
            let startTime = Date.now();
            let lastLoaded = 0;
            
            this.loader.load(url,
                (gltf) => {
                    // Успешная загрузка
                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = fileSizeMB / elapsed;
                    console.log(`✅ Загружено за ${elapsed.toFixed(1)}с (${speed.toFixed(1)} МБ/с)`);
                    
                    this.processModel(gltf.scene, options);
                    this.currentModel = gltf.scene;
                    
                    this.updateProgress(100, '✅ Модель успешно загружена!', fileSizeMB.toFixed(1), fileSizeMB.toFixed(1));
                    
                    setTimeout(() => {
                        this.showProgress(false);
                    }, 2000);
                    
                    URL.revokeObjectURL(url);
                    resolve(gltf.scene);
                },
                (xhr) => {
                    // Прогресс загрузки
                    if (xhr.lengthComputable) {
                        const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                        const loadedMB = xhr.loaded / (1024 * 1024);
                        const totalMB = xhr.total / (1024 * 1024);
                        
                        // Расчёт скорости
                        const now = Date.now();
                        const timeDelta = (now - startTime) / 1000;
                        const speed = (xhr.loaded - lastLoaded) / (1024 * 1024) / (1 / 3); // каждые ~3 секунды
                        lastLoaded = xhr.loaded;
                        
                        this.updateProgress(percent, `📥 Загрузка...`, loadedMB.toFixed(1), totalMB.toFixed(1), speed);
                    }
                },
                (error) => {
                    console.error('Ошибка загрузки:', error);
                    this.updateProgress(0, '❌ Ошибка загрузки! Проверьте файл');
                    this.statusText.style.color = '#ef4444';
                    
                    setTimeout(() => {
                        this.showProgress(false);
                    }, 3000);
                    
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Загрузка модели по URL
     * @param {string} url - URL модели
     * @param {Object} options - дополнительные опции
     */
    loadFromURL(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.showProgress(true);
            this.updateProgress(0, `🌐 Подключение к серверу...`);
            
            const startTime = Date.now();
            let lastLoaded = 0;
            
            this.loader.load(url,
                (gltf) => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    console.log(`✅ Модель загружена за ${elapsed.toFixed(1)}с`);
                    
                    this.processModel(gltf.scene, options);
                    this.currentModel = gltf.scene;
                    
                    this.updateProgress(100, '✅ Модель загружена!');
                    setTimeout(() => this.showProgress(false), 2000);
                    
                    resolve(gltf.scene);
                },
                (xhr) => {
                    if (xhr.lengthComputable) {
                        const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                        const loadedMB = xhr.loaded / (1024 * 1024);
                        const totalMB = xhr.total / (1024 * 1024);
                        
                        this.updateProgress(percent, `📥 Загрузка...`, loadedMB.toFixed(1), totalMB.toFixed(1));
                    }
                },
                (error) => {
                    console.error('Ошибка:', error);
                    this.updateProgress(0, '❌ Ошибка загрузки!');
                    setTimeout(() => this.showProgress(false), 3000);
                    reject(error);
                }
            );
        });
    }
    
    processModel(model, options = {}) {
        const opts = { ...this.options, ...options };
        
        // Вычисляем bounding box
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Автоматическое центрирование
        if (opts.autoCenter) {
            model.position.x -= center.x;
            model.position.z -= center.z;
            console.log(`📍 Модель центрирована`);
        }
        
        // Автоматическое масштабирование
        if (opts.autoScale) {
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > opts.maxSize) {
                const scale = opts.maxSize / maxDim;
                model.scale.set(scale, scale, scale);
                console.log(`📏 Модель масштабирована: ${scale.toFixed(2)}x`);
            }
        }
        
        // Включаем тени
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Оптимизация материалов для производительности
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.roughness = Math.min(mat.roughness, 0.6);
                        });
                    } else {
                        child.material.roughness = Math.min(child.material.roughness, 0.6);
                    }
                }
            }
        });
        
        // Добавляем в сцену
        this.scene.add(model);
        
        // Подсчёт полигонов (асинхронно)
        setTimeout(() => {
            let triCount = 0;
            model.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    const geom = child.geometry;
                    if (geom.index) triCount += geom.index.count / 3;
                    else if (geom.attributes.position) triCount += geom.attributes.position.count / 3;
                }
            });
            console.log(`🔺 Треугольников: ${triCount.toLocaleString()}`);
        }, 100);
        
        return { model, size, center };
    }
    
    /**
     * Удалить текущую модель из сцены
     */
    removeModel() {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            
            // Очистка геометрий и материалов
            this.currentModel.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            
            this.currentModel = null;
            console.log('🗑 Модель удалена из сцены');
            return true;
        }
        return false;
    }
    
    /**
     * Получить информацию о текущей модели
     */
    getModelInfo() {
        if (!this.currentModel) return null;
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        let triCount = 0;
        this.currentModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const geom = child.geometry;
                if (geom.index) triCount += geom.index.count / 3;
                else if (geom.attributes.position) triCount += geom.attributes.position.count / 3;
            }
        });
        
        return {
            size: { x: size.x, y: size.y, z: size.z },
            center: { x: center.x, y: center.y, z: center.z },
            triangles: triCount,
            vertices: triCount * 3
        };
    }
}

export default HeavyModelLoader;