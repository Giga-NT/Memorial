// modules/fenceBuilder.js
import * as THREE from 'three';

// Константы (копируем из старого скрипта)
const GLOBAL_SECTION_WIDTH = 0.25;
const fenceMaterials = {
    black_metal: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.9 })
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (из старого скрипта)
// ============================================================

function createBar(p1, p2, radius, material, fenceGroup) {
    const dist = p1.distanceTo(p2);
    if (dist < 0.01) return;
    const geo = new THREE.CylinderGeometry(radius, radius, dist, 8);
    const mesh = new THREE.Mesh(geo, material);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.lookAt(p2);
    mesh.rotateX(Math.PI / 2);
    mesh.castShadow = true;
    fenceGroup.add(mesh);
}

function createProfileBars(pStart, pEnd, state, fenceGroup) {
    const material = fenceMaterials[state.fenceMaterial] || fenceMaterials.steel;
    const radius = 0.015;
    const topStart = new THREE.Vector3(pStart.x, state.fenceHeight - 0.05, pStart.z);
    const topEnd = new THREE.Vector3(pEnd.x, state.fenceHeight - 0.05, pEnd.z);
    createBar(topStart, topEnd, radius, material, fenceGroup);
    const botStart = new THREE.Vector3(pStart.x, 0.05, pStart.z);
    const botEnd = new THREE.Vector3(pEnd.x, 0.05, pEnd.z);
    createBar(botStart, botEnd, radius, material, fenceGroup);
}

function createPipeSection(pStart, pEnd, state, fenceGroup) {
    const material = fenceMaterials[state.fenceMaterial] || fenceMaterials.steel;
    const radius = 0.015;
    const topStart = new THREE.Vector3(pStart.x, state.fenceHeight - 0.08, pStart.z);
    const topEnd = new THREE.Vector3(pEnd.x, state.fenceHeight - 0.08, pEnd.z);
    createBar(topStart, topEnd, radius, material, fenceGroup);
    const botStart = new THREE.Vector3(pStart.x, 0.12, pStart.z);
    const botEnd = new THREE.Vector3(pEnd.x, 0.12, pEnd.z);
    createBar(botStart, botEnd, radius, material, fenceGroup);
}

function createChainSection(pStart, pEnd, state, fenceGroup) {
    const linkGeo = new THREE.TorusGeometry(0.04, 0.008, 8, 12);
    const segmentDist = pStart.distanceTo(pEnd);
    const count = Math.floor(segmentDist / 0.08);
    const material = fenceMaterials[state.fenceMaterial] || fenceMaterials.steel;
    for(let k=0; k<count; k++) {
        const t = k / count;
        const sag = Math.sin(t * Math.PI) * 0.05;
        const lx = pStart.x + (pEnd.x - pStart.x) * t;
        const lz = pStart.z + (pEnd.z - pStart.z) * t;
        const ly = state.fenceHeight - 0.05 - sag;
        const link = new THREE.Mesh(linkGeo, material);
        link.position.set(lx, ly, lz);
        link.rotation.y = -Math.atan2(pEnd.z - pStart.z, pEnd.x - pStart.x);
        link.castShadow = true;
        fenceGroup.add(link);
    }
}

function placeSmallSection(position, direction, modelSource, is3DModel, state, fenceGroup) {
    if (!modelSource) return;
    const clone = modelSource.clone();
    const material = fenceMaterials[state.fenceMaterial];
    clone.traverse((child) => {
        if (child.isMesh) {
            if (child.material) child.material.dispose();
            child.material = material.clone();
            child.castShadow = true;
        }
    });
    const scaleY = state.fenceHeight / 0.5; 
    clone.scale.set(1.0, scaleY, 1.0);
    clone.position.copy(position);
    clone.position.y = (state.fenceHeight / 2);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), 
        direction
    );
    clone.quaternion.copy(quaternion);
    if (is3DModel) clone.rotateY(Math.PI / 2); 
    fenceGroup.add(clone);
}

function placeSectionModel(pStart, pEnd, heightScale, is3DModel, state, fenceGroup) {
    let sourceModel;
    
    // ⭐ ИСПРАВЛЕНИЕ: Если выбран model_3d, берём window.fence3DModel в любом случае!
    if (state.fenceType === 'model_3d') {
        sourceModel = window.fence3DModel;
    } else if (state.fenceType === 'casting') {
        sourceModel = window.castingModel;
    } else if (is3DModel) {
        sourceModel = window.fence3DModel;
    } else {
        sourceModel = window.loadedFenceModel;
    }
    
    if (!sourceModel) {
        console.warn("Модель для placeSectionModel не загружена!", state.fenceType);
        return;
    }
    
    const clone = sourceModel.clone();
    const material = fenceMaterials[state.fenceMaterial];
    clone.traverse((child) => {
        if (child.isMesh) {
            if (child.material) child.material.dispose();
            child.material = material.clone();
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    const midPoint = pStart.clone().add(pEnd).multiplyScalar(0.5);
    const distance = pStart.distanceTo(pEnd);
    const modelBaseWidth = 1.0; 
    clone.scale.set(distance / modelBaseWidth, heightScale/1.5, 1.0);
    clone.position.copy(midPoint);
    clone.position.y = (state.fenceHeight / 4);
    const direction = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), 
        direction
    );
    clone.quaternion.copy(quaternion);
    if (is3DModel) {
        clone.rotateY(Math.PI / 2); 
    }
    fenceGroup.add(clone);
}

// ============================================================
// ОСНОВНЫЕ ФУНКЦИИ ПОСТРОЕНИЯ
// ============================================================

function createSolidSide(pStart, pEnd, sideName, state, fenceGroup, skipStartPost = false, skipEndPost = false) {
    const totalLength = pStart.distanceTo(pEnd);
    if (totalLength < 0.3) return;
    const direction = pEnd.clone().sub(pStart).normalize();
    
    if (!skipStartPost) {
        const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08), fenceMaterials[state.fenceMaterial]);
        leftPost.position.copy(pStart);
        leftPost.position.y = state.fenceHeight / 2;
        leftPost.castShadow = true;
        fenceGroup.add(leftPost);
    }

    if (!skipEndPost) {
        const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08), fenceMaterials[state.fenceMaterial]);
        rightPost.position.copy(pEnd);
        rightPost.position.y = state.fenceHeight / 2;
        rightPost.castShadow = true;
        fenceGroup.add(rightPost);
    }
    
    // ============================================================
    // ⭐ 1. ЕСЛИ ВЫБРАНА 3D МОДЕЛЬ (11.glb)
    // ============================================================
    if (state.fenceType === 'model_3d') {
        // Проверяем, загружена ли модель
        if (!window.fence3DModel) {
            console.warn('⚠️ Модель 11.glb не загружена в window!');
            return;
        }
        
        const modelBaseWidth = 0.25; // Примерная ширина одной секции 11.glb
        let numSections = Math.floor(totalLength / modelBaseWidth);
        if (numSections < 1) numSections = 1;
        const actualStep = totalLength / numSections;
        const heightScale = state.fenceHeight / 0.6; // Масштабируем по высоте
        
        for (let i = 0; i < numSections; i++) {
            const centerPos = pStart.clone().add(direction.clone().multiplyScalar((i * actualStep) + (actualStep / 2)));
            
            // Клонируем и настраиваем
            const clone = window.fence3DModel.clone();
            const material = fenceMaterials[state.fenceMaterial];
            clone.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) child.material.dispose();
                    child.material = material.clone();
                    child.castShadow = true;
                }
            });
            
            // Подгоняем ширину секции под фактический шаг раскладки.
            clone.scale.set(actualStep / modelBaseWidth, heightScale, 1.0);
            clone.position.copy(centerPos);
            clone.position.y = (state.fenceHeight / 2);
            
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(1, 0, 0), 
                direction
            );
            clone.quaternion.copy(quaternion);
            clone.rotateY(Math.PI / 2); // Поворот для 3D-модели
            
            fenceGroup.add(clone);
        }
        return; // Выходим, чтобы не рисовать лишнее
    }
    
    // ============================================================
    // ⭐ 2. ЕСЛИ ВЫБРАНО ЛИТЬЁ (fence_section.glb) - ОСТАЛЬНАЯ ЛОГИКА
    // ============================================================
    if (state.fenceType === 'casting') {
        let numSections = Math.round(totalLength / 1.0); 
        if (numSections < 1) numSections = 1;
        const actualSectionWidth = totalLength / numSections;
        const heightScale = state.fenceHeight / 0.5; 
        for (let i = 0; i < numSections; i++) {
            const sectionStart = pStart.clone().add(direction.clone().multiplyScalar(i * actualSectionWidth));
            const sectionEnd = pStart.clone().add(direction.clone().multiplyScalar((i + 1) * actualSectionWidth));
            placeSectionModel(sectionStart, sectionEnd, heightScale, false, state, fenceGroup);
        }
        return; 
    }
    
    // ============================================================
    // ⭐ 3. ОСТАЛЬНЫЕ ТИПЫ (Цепь, Труба, Вензель)
    // ============================================================
    let stepWidth = GLOBAL_SECTION_WIDTH; 
    let numSections = Math.floor(totalLength / stepWidth); 
    const remainder = totalLength - (numSections * stepWidth);
    if (remainder > (stepWidth * 0.3)) numSections++;
    if (numSections < 1) numSections = 1;
    const actualStep = totalLength / numSections;
    
    if (state.fenceType === 'venzel' || state.fenceType === 'model_3d') {
        createProfileBars(pStart, pEnd, state, fenceGroup);
    }
    
    for (let i = 0; i < numSections; i++) {
        const centerPos = pStart.clone().add(direction.clone().multiplyScalar((i * actualStep) + (actualStep / 2)));
        if (state.fenceType === 'venzel') {
             placeSmallSection(centerPos, direction, window.venzelModel, false, state, fenceGroup);
        } 

        else if (state.fenceType === 'pipe') {
             createPipeSection(pStart, pEnd, state, fenceGroup);
             break; 
        } 
        else if (state.fenceType === 'chain') {
             createChainSection(pStart, pEnd, state, fenceGroup);
            break; 
        }
    }
}

function placeGateModel(sourceModel, pStart, pEnd, state, fenceGroup) {
    if (!sourceModel) return;

    const clone = sourceModel.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
        console.warn('⚠️ У модели калитки некорректные размеры');
        return;
    }

    // GLB ориентирован локально: X — ширина, Y — высота, Z — толщина.
    const targetWidth = Math.max(0.1, pStart.distanceTo(pEnd));
    const targetHeight = Math.max(0.1, Number(state.fenceHeight) || 0.6);
    const scaleX = targetWidth / size.x;
    const scaleY = targetHeight / size.y;

    const gateGroup = new THREE.Group();
    clone.scale.set(scaleX, scaleY, scaleX);
    clone.position.set(
        -center.x * scaleX,
        -bounds.min.y * scaleY,
        -center.z * scaleX
    );

    const selectedFenceMaterial = fenceMaterials[state.fenceMaterial] || fenceMaterials.steel;
    clone.traverse((child) => {
        if (child.isMesh) {
            // Сохраняем исходные карты и настройки прозрачности GLB,
            // меняя только цвет и металлические свойства под выбранную ограду.
            const applyFenceFinish = (sourceMaterial) => {
                if (!sourceMaterial) return sourceMaterial;
                const material = sourceMaterial.clone();
                if (material.color) material.color.copy(selectedFenceMaterial.color);
                if ('metalness' in material) material.metalness = selectedFenceMaterial.metalness;
                if ('roughness' in material) material.roughness = selectedFenceMaterial.roughness;
                material.needsUpdate = true;
                return material;
            };
            child.material = Array.isArray(child.material)
                ? child.material.map(applyFenceFinish)
                : applyFenceFinish(child.material);
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const midpoint = pStart.clone().add(pEnd).multiplyScalar(0.5);
    // Калитка слегка выдвинута наружу относительно плоскости секций.
    const outward = new THREE.Vector3(midpoint.x, 0, midpoint.z).normalize();
    const gateFrontOffset = Number(state.gateFrontOffset) || 0.04;
    gateGroup.position.set(
        midpoint.x + outward.x * gateFrontOffset,
        0,
        midpoint.z + outward.z * gateFrontOffset
    );
    const direction = pEnd.clone().sub(pStart).normalize();
    gateGroup.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        direction
    );
    // Разворачиваем створку лицевой стороной наружу: ручки не должны смотреть внутрь ограды.
    gateGroup.rotateY(Math.PI);
    gateGroup.add(clone);
    gateGroup.userData.isGateLeaf = true;
    fenceGroup.add(gateGroup);
}

function createSideWithGate(pStart, pEnd, sideName, state, fenceGroup) {
    const totalLength = pStart.distanceTo(pEnd);
    const gateWidth = parseFloat(state.gateWidth) || 0.8;

    // Готовые модели калиток уже содержат собственные опорные столбы.
    let gateModel = null;
    if (state.fenceType === 'venzel' || state.fenceType === 'casting') {
        gateModel = window.fenceGateModel;
    } else if (state.fenceType === 'model_3d') {
        gateModel = window.litleGateModel;
    }
    const hasBuiltInGatePosts = !!gateModel;
    if (gateWidth >= totalLength) {
        createSolidSide(pStart, pEnd, sideName, state, fenceGroup);
        return;
    }
    const remainingLength = totalLength - gateWidth;
    const halfRemaining = remainingLength / 2;
    const direction = pEnd.clone().sub(pStart).normalize();
    const maxGateOffset = Math.max(0, halfRemaining);
    const gateOffset = Math.max(-maxGateOffset, Math.min(maxGateOffset, Number(state.fenceGateOffset) || 0));
    const gateStartDistance = halfRemaining + gateOffset;
    const leftSideLength = gateStartDistance;
    const rightSideLength = totalLength - gateStartDistance - gateWidth;
    const gateStartPoint = pStart.clone().add(direction.clone().multiplyScalar(gateStartDistance));
    const gateEndPoint = gateStartPoint.clone().add(direction.clone().multiplyScalar(gateWidth));

    if (leftSideLength > 0.2) createSolidSide(pStart, gateStartPoint, sideName + '_left', state, fenceGroup, false, hasBuiltInGatePosts);
    else if (leftSideLength > 0.05 && !hasBuiltInGatePosts) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, state.fenceHeight, 0.06), fenceMaterials[state.fenceMaterial]);
        post.position.copy(gateStartPoint);
        post.position.y = state.fenceHeight / 2;
        post.castShadow = true;
        fenceGroup.add(post);
    }
    if (rightSideLength > 0.2) createSolidSide(gateEndPoint, pEnd, sideName + '_right', state, fenceGroup, hasBuiltInGatePosts, false);
    else if (rightSideLength > 0.05 && !hasBuiltInGatePosts) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, state.fenceHeight, 0.06), fenceMaterials[state.fenceMaterial]);
        post.position.copy(gateEndPoint);
        post.position.y = state.fenceHeight / 2;
        post.castShadow = true;
        fenceGroup.add(post);
    }
    // Для моделей с собственными столбами не добавляем дублирующие опоры.
    if (!hasBuiltInGatePosts) {
        const gatePostGeo = new THREE.BoxGeometry(0.08, state.fenceHeight, 0.08);
        const gp1 = new THREE.Mesh(gatePostGeo, fenceMaterials[state.fenceMaterial]);
        gp1.position.copy(gateStartPoint);
        gp1.position.y = state.fenceHeight / 2;
        gp1.castShadow = true;
        fenceGroup.add(gp1);
        const gp2 = new THREE.Mesh(gatePostGeo, fenceMaterials[state.fenceMaterial]);
        gp2.position.copy(gateEndPoint);
        gp2.position.y = state.fenceHeight / 2;
        gp2.castShadow = true;
        fenceGroup.add(gp2);
    }

    if (gateModel) {
        placeGateModel(gateModel, gateStartPoint, gateEndPoint, state, fenceGroup);
    } else if (state.fenceType === 'venzel' || state.fenceType === 'casting' || state.fenceType === 'model_3d') {
        console.warn('⚠️ Модель калитки ещё не загружена:', state.fenceType);
    }
}

// ============================================================
// ГЛАВНАЯ ЭКСПОРТИРУЕМАЯ ФУНКЦИЯ
// ============================================================

// ⭐ ДЕЛАЕМ ФУНКЦИЮ ДОСТУПНОЙ ГЛОБАЛЬНО
window.createFenceGroup = createFenceGroup;

export function createFenceGroup(state) {
    if (!state.fenceEnabled) return null;
    if (state.fenceType === 'none' && state.fenceGateSide === 'none') return null;
    
    const fenceGroup = new THREE.Group();
    fenceGroup.userData.isFence = true;
    
    const totalWidth = state.fenceWidth || 1.5;
    const totalLength = state.fenceLength || 2.5;
    const halfW = totalWidth / 2;
    const halfL = totalLength / 2;
    
    const corners = [
        new THREE.Vector3(-halfW, 0, -halfL),
        new THREE.Vector3(halfW, 0, -halfL),
        new THREE.Vector3(halfW, 0, halfL),
        new THREE.Vector3(-halfW, 0, halfL)
    ];
    
    const sides = [
        { start: corners[0], end: corners[1], name: 'front' },
        { start: corners[1], end: corners[2], name: 'right' },
        { start: corners[2], end: corners[3], name: 'back' },
        { start: corners[3], end: corners[0], name: 'left' }
    ];
    
    sides.forEach(side => {
        let isGate = false;
        if (state.fenceGateEnabled !== false) {
            if (state.fenceGateSide === 'front' && side.name === 'front') isGate = true;
            if (state.fenceGateSide === 'right' && side.name === 'right') isGate = true;
            if (state.fenceGateSide === 'back' && side.name === 'back') isGate = true;
            if (state.fenceGateSide === 'left' && side.name === 'left') isGate = true;
        }
        
        if (isGate && state.fenceGateSide !== 'none') {
            createSideWithGate(side.start, side.end, side.name, state, fenceGroup);
        } else {
            createSolidSide(side.start, side.end, side.name, state, fenceGroup);
        }
    });
    
    return fenceGroup;
}