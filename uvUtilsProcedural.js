// uvUtilsProcedural.js - ДОБАВЛЯЕМ СПЕЦИАЛЬНУЮ ОБРАБОТКУ ДЛЯ BoxGeometry
import * as THREE from 'three';

/**
 * Специальная генерация UV для BoxGeometry (прямоугольная стела)
 * Текстура правильно отображается на всех гранях
 */
export function generateBoxUVs(geometry, width, height, depth) {
    const pos = geometry.attributes.position;
    if (!pos) return;
    
    const normal = geometry.attributes.normal;
    if (!normal) {
        generateSimpleUVs(geometry);
        return;
    }
    
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    
    // Для BoxGeometry определяем грани по нормалям
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        const nx = Math.abs(normal.getX(i));
        const ny = Math.abs(normal.getY(i));
        const nz = Math.abs(normal.getZ(i));
        
        let u, v;
        
        // Определяем грань по доминирующей нормали
        if (nx > ny && nx > nz) {
            // Правая/левая грань (X)
            // Проекция на YZ
            u = (z / depth) + 0.5;
            v = (y / height) + 0.5;
        } else if (ny > nx && ny > nz) {
            // Верхняя/нижняя грань (Y)
            // Проекция на XZ
            u = (x / width) + 0.5;
            v = (z / depth) + 0.5;
            // Для нижней грани переворачиваем
            if (normal.getY(i) < 0) {
                v = 1 - v;
            }
        } else {
            // Передняя/задняя грань (Z) - основная
            u = (x / width) + 0.5;
            v = (y / height) + 0.5;
            // Для задней грани переворачиваем
            if (normal.getZ(i) < 0) {
                u = 1 - u;
            }
        }
        
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
}

/**
 * Универсальная генерация UV с определением типа геометрии
 */
export function generateSmartUVs(geometry, width, height, depth, options = {}) {
    const pos = geometry.attributes.position;
    if (!pos) return;
    
    // Определяем тип геометрии
    const isBox = geometry.type === 'BoxGeometry' || 
                  (geometry.attributes.normal && 
                   geometry.attributes.position.count === 24); // BoxGeometry имеет 24 вершины
    
    if (isBox) {
        // Для BoxGeometry используем специальный метод
        generateBoxUVs(geometry, width, height, depth);
        return;
    }
    
    const normal = geometry.attributes.normal;
    if (!normal) {
        generateSimpleUVs(geometry);
        return;
    }
    
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const min = box.min;
    const max = box.max;
    
    const sizeX = max.x - min.x || 0.001;
    const sizeY = max.y - min.y || 0.001;
    const sizeZ = max.z - min.z || 0.001;
    
    // Проверяем, является ли геометрия ExtrudeGeometry
    const isExtrude = geometry.type === 'ExtrudeGeometry' || 
                      geometry.userData?.isExtrude ||
                      (sizeZ < sizeX * 0.3 && sizeZ < sizeY * 0.3);
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        const nx = (x - min.x) / sizeX;
        const ny = (y - min.y) / sizeY;
        const nz = (z - min.z) / sizeZ;
        
        const nxNorm = Math.abs(normal.getX(i));
        const nyNorm = Math.abs(normal.getY(i));
        const nzNorm = Math.abs(normal.getZ(i));
        
        let u, v;
        
        // Определяем доминирующую нормаль
        if (nzNorm > nxNorm && nzNorm > nyNorm) {
            // Передняя/задняя грань (Z)
            if (isExtrude) {
                u = nx;
                v = ny;
            } else {
                u = nx;
                v = 1 - ny;
            }
        } else if (nxNorm > nyNorm && nxNorm > nzNorm) {
            // Левая/правая грань (X)
            u = nz;
            v = 1 - ny;
        } else {
            // Верхняя/нижняя грань (Y)
            u = nx;
            v = nz;
        }
        
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
    geometry.computeVertexNormals();
}

function generateSimpleUVs(geometry) {
    const pos = geometry.attributes.position;
    if (!pos) return;
    
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const min = box.min;
    const max = box.max;
    
    const sizeX = max.x - min.x || 0.001;
    const sizeY = max.y - min.y || 0.001;
    
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        
        const u = (x - min.x) / sizeX;
        const v = 1 - (y - min.y) / sizeY;
        
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
}

export function generateCustomModelUVs(geometry, modelType = 'vertical') {
    const pos = geometry.attributes.position;
    if (!pos) return;
    
    const normal = geometry.attributes.normal;
    const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const min = box.min;
    const max = box.max;
    
    const sizeX = max.x - min.x || 0.001;
    const sizeY = max.y - min.y || 0.001;
    const sizeZ = max.z - min.z || 0.001;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        const nx = (x - min.x) / sizeX;
        const ny = (y - min.y) / sizeY;
        const nz = (z - min.z) / sizeZ;
        
        let u, v;
        
        if (normal) {
            const nxNorm = Math.abs(normal.getX(i));
            const nyNorm = Math.abs(normal.getY(i));
            const nzNorm = Math.abs(normal.getZ(i));
            
            if (modelType === 'horizontal') {
                if (nyNorm > nxNorm && nyNorm > nzNorm) {
                    u = nx;
                    v = nz;
                } else {
                    u = nx;
                    v = 1 - ny;
                }
            } else {
                if (nzNorm > nxNorm && nzNorm > nyNorm) {
                    u = nx;
                    v = 1 - ny;
                } else if (nxNorm > nyNorm && nxNorm > nzNorm) {
                    u = nz;
                    v = 1 - ny;
                } else {
                    u = nx;
                    v = nz;
                }
            }
        } else {
            u = nx;
            v = 1 - ny;
        }
        
        uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', uv);
    geometry.attributes.uv.needsUpdate = true;
}