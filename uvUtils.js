// uvUtils.js - ПОЛНАЯ ПЕРЕРАБОТАННАЯ ВЕРСИЯ
import * as THREE from 'three';

/**
 * Генерация UV-координат для геометрии с правильной проекцией
 */
export function generateUVs(geometry, projection = 'front', options = {}) {
    const pos = geometry.attributes.position;
    if (!pos) {
        console.warn('Нет позиций для генерации UV');
        return;
    }
    
    // Если UV уже есть и мы не принудительно пересоздаем
    if (geometry.attributes.uv && !options.force) {
        // Проверяем, есть ли некорректные UV
        const uv = geometry.attributes.uv;
        let hasInvalid = false;
        for (let i = 0; i < Math.min(uv.count, 10); i++) {
            const u = uv.getX(i);
            const v = uv.getY(i);
            if (isNaN(u) || isNaN(v) || u < -1 || u > 2 || v < -1 || v > 2) {
                hasInvalid = true;
                break;
            }
        }
        if (!hasInvalid) return; // UV корректны
    }
    
    // Получаем bounding box
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const min = box.min;
    const max = box.max;
    
    const sizeX = max.x - min.x || 0.001;
    const sizeY = max.y - min.y || 0.001;
    const sizeZ = max.z - min.z || 0.001;
    
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    const normal = geometry.attributes.normal;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        let u, v;
        
        // Определяем тип проекции
        switch(projection) {
            case 'front': // Проекция на XY (вид спереди) - для стел
                u = (x - min.x) / sizeX;
                v = 1 - (y - min.y) / sizeY;
                break;
                
            case 'side': // Проекция на YZ (вид сбоку)
                u = (z - min.z) / sizeZ;
                v = 1 - (y - min.y) / sizeY;
                break;
                
            case 'top': // Проекция на XZ (вид сверху)
                u = (x - min.x) / sizeX;
                v = (z - min.z) / sizeZ;
                break;
                
            case 'box': // Для BoxGeometry - по нормалям
                if (normal) {
                    const nx = Math.abs(normal.getX(i));
                    const ny = Math.abs(normal.getY(i));
                    const nz = Math.abs(normal.getZ(i));
                    
                    if (nx > ny && nx > nz) {
                        // Грань X
                        u = (z - min.z) / sizeZ;
                        v = 1 - (y - min.y) / sizeY;
                    } else if (ny > nx && ny > nz) {
                        // Грань Y
                        u = (x - min.x) / sizeX;
                        v = (z - min.z) / sizeZ;
                    } else {
                        // Грань Z
                        u = (x - min.x) / sizeX;
                        v = 1 - (y - min.y) / sizeY;
                    }
                } else {
                    u = (x - min.x) / sizeX;
                    v = 1 - (y - min.y) / sizeY;
                }
                break;
                
            case 'extrude': // Для ExtrudeGeometry - проекция на переднюю грань
                // Используем проекцию на XY, но с учетом глубины
                const centerZ = (min.z + max.z) / 2;
                const depthFactor = 1 - Math.abs(z - centerZ) / sizeZ * 0.3;
                u = (x - min.x) / sizeX;
                v = 1 - (y - min.y) / sizeY;
                // Немного сжимаем UV к центру для лучшего вида
                u = 0.5 + (u - 0.5) * depthFactor;
                v = 0.5 + (v - 0.5) * depthFactor;
                break;
                
            default:
                u = (x - min.x) / sizeX;
                v = 1 - (y - min.y) / sizeY;
        }
        
        // Ограничиваем значения
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
    
    // Обновляем нормали для корректного освещения
    geometry.computeVertexNormals();
}

/**
 * Создание материала для стелы с текстурой
 */
export function createSteleMaterial(texture, options = {}) {
    const defaults = {
        roughness: 0.2,
        metalness: 0.05,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
    };
    
    const material = new THREE.MeshStandardMaterial({
        ...defaults,
        ...options,
        map: texture || null,
    });
    
    if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.needsUpdate = true;
    }
    
    return material;
}

/**
 * Применить текстуру к мешу с правильными UV
 */
export function applyTextureToMesh(mesh, texture, projection = 'front') {
    if (!mesh || !mesh.geometry) return;
    
    // Генерируем UV
    generateUVs(mesh.geometry, projection);
    
    // Создаем материал с текстурой
    const material = createSteleMaterial(texture);
    mesh.material = material;
    mesh.material.needsUpdate = true;
}

/**
 * Обновить UV для всей группы
 */
export function updateUVsForGroup(group, projection = 'front') {
    group.traverse((child) => {
        if (child.isMesh && child.geometry) {
            generateUVs(child.geometry, projection);
        }
    });
}