// steleTypes.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
import * as THREE from 'three';
import { createSteleMaterial } from './uvUtils.js';
import { generateSmartUVs, generateCustomModelUVs } from './uvUtilsProcedural.js';
import { loadPBRMaterial } from './textures.js';
import { createCustomSteleMesh } from './customSteleLoader.js';

// ============================================================
// 1. ПРЯМОУГОЛЬНАЯ СТЕЛА
// ============================================================
export const Rectangle = {
    id: 'rectangle',
    name: "📐 Прямоугольная (Стандарт)",
    icon: "📐",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType = 'granite') => {
        const geo = new THREE.BoxGeometry(w, h, d);
        
        // Для BoxGeometry используем универсальный метод
        generateSmartUVs(geo, w, h, d);
        
        const material = createSteleMaterial(null);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        loadPBRMaterial(materialType).then(pbrMat => {
            if (pbrMat?.map) {
                const tex = pbrMat.map.clone();
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(1, 1);
                mesh.material.map = tex;
                mesh.material.needsUpdate = true;
            }
        });
        
        return mesh;
    }
};

// ============================================================
// 2. ФУНКЦИЯ ДЛЯ ФИГУРНЫХ СТЕЛ
// ============================================================
function createShapeStele(shapeBuilder, w, h, d, materialType = 'granite') {
    const shape = shapeBuilder(w, h);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.005,
        bevelSegments: 4,
    });
    
    // Помечаем геометрию как ExtrudeGeometry
    geo.userData.isExtrude = true;
    
    // Используем универсальный метод
    generateSmartUVs(geo, w, h, d);
    geo.computeVertexNormals();
    
    const material = createSteleMaterial(null);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    loadPBRMaterial(materialType).then(pbrMat => {
        if (pbrMat?.map) {
            const tex = pbrMat.map.clone();
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1, 1);
            mesh.material.map = tex;
            mesh.material.needsUpdate = true;
        }
    });
    
    return mesh;
}

// ============================================================
// 3. ВСЕ ФИГУРНЫЕ СТЕЛЫ (экспорты)
// ============================================================
export const F41OvalTop = {
    id: 'f41_oval_top',
    name: "🏛️ Овальный верх (F41)",
    icon: "🏛️",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            const radius = halfW * 0.6;
            
            shape.moveTo(-halfW, -halfH);
            shape.lineTo(-halfW, halfH * 0.4);
            shape.quadraticCurveTo(-halfW, halfH, -radius, halfH);
            shape.quadraticCurveTo(0, halfH * 1.1, radius, halfH);
            shape.quadraticCurveTo(halfW, halfH, halfW, halfH * 0.4);
            shape.lineTo(halfW, -halfH);
            shape.lineTo(-halfW, -halfH);
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const F45Ellipse = {
    id: 'f45_ellipse',
    name: "⭕ Полный овал (F45)",
    icon: "⭕",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            
            const points = 40;
            for (let i = 0; i <= points; i++) {
                const t = (i / points) * Math.PI * 2;
                const x = Math.cos(t) * halfW;
                const y = Math.sin(t) * halfH;
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const F53Wave = {
    id: 'f53_wave',
    name: "🌊 Волна сверху (F53)",
    icon: "🌊",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            const segments = 20;
            
            shape.moveTo(-halfW, -halfH);
            shape.lineTo(-halfW, halfH * 0.3);
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const x = -halfW + t * w;
                const y = halfH * 0.3 + Math.sin(t * Math.PI * 3) * halfH * 0.25;
                shape.lineTo(x, y);
            }
            
            shape.lineTo(halfW, -halfH);
            shape.lineTo(-halfW, -halfH);
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const F56Arch = {
    id: 'f56_arch',
    name: "⛪ Высокая арка (F56)",
    icon: "⛪",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            const archHeight = halfH * 0.8;
            const archWidth = halfW * 0.9;
            
            shape.moveTo(-halfW, -halfH);
            shape.lineTo(-halfW, halfH * 0.2);
            
            const points = 30;
            for (let i = 0; i <= points; i++) {
                const t = i / points;
                const angle = Math.PI + t * Math.PI;
                const x = Math.cos(angle) * archWidth;
                const y = halfH * 0.2 + Math.sin(angle) * archHeight + archHeight;
                shape.lineTo(x, y);
            }
            
            shape.lineTo(halfW, -halfH);
            shape.lineTo(-halfW, -halfH);
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const F58CurvedSides = {
    id: 'f58_curved_sides',
    name: "〰️ Изогнутые бока (F58)",
    icon: "〰️",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            const curve = halfW * 0.15;
            
            shape.moveTo(-halfW, -halfH);
            shape.quadraticCurveTo(-halfW - curve, 0, -halfW, halfH);
            shape.lineTo(halfW, halfH);
            shape.quadraticCurveTo(halfW + curve, 0, halfW, -halfH);
            shape.lineTo(-halfW, -halfH);
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const F40Cross = {
    id: 'f40_cross',
    name: "✝️ С крестом (F40)",
    icon: "✝️",
    defaultWidth: 0.6,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        return createShapeStele((w, h) => {
            const shape = new THREE.Shape();
            const halfW = w / 2;
            const halfH = h / 2;
            
            shape.moveTo(-halfW, -halfH);
            shape.lineTo(-halfW, halfH);
            shape.lineTo(halfW, halfH);
            shape.lineTo(halfW, -halfH);
            shape.lineTo(-halfW, -halfH);
            
            const crossW = halfW * 0.3;
            const crossH = halfH * 0.6;
            const hole = new THREE.Path();
            hole.moveTo(-crossW, -crossH);
            hole.lineTo(-crossW, crossH);
            hole.lineTo(crossW, crossH);
            hole.lineTo(crossW, -crossH);
            hole.lineTo(-crossW, -crossH);
            
            const topH = halfH * 0.3;
            hole.moveTo(-crossW * 0.4, crossH);
            hole.lineTo(-crossW * 0.4, halfH);
            hole.lineTo(crossW * 0.4, halfH);
            hole.lineTo(crossW * 0.4, crossH);
            
            shape.holes.push(hole);
            
            return shape;
        }, w, h, d, materialType);
    }
};

export const DoubleF16 = {
    id: 'double_f16',
    name: "👥 Двойная F16",
    icon: "👥",
    defaultWidth: 0.9,
    defaultHeight: 1.2,
    defaultDepth: 0.1,
    createMesh: (w, h, d, materialType) => {
        const group = new THREE.Group();
        const halfW = w / 4;
        
        const leftStele = Rectangle.createMesh(halfW * 1.6, h, d, materialType);
        leftStele.position.x = -halfW * 0.7;
        group.add(leftStele);
        
        const rightStele = Rectangle.createMesh(halfW * 1.6, h, d, materialType);
        rightStele.position.x = halfW * 0.7;
        group.add(rightStele);
        
        return group;
    }
};

// ============================================================
// 4. КАСТОМНЫЕ МОДЕЛИ
// ============================================================
export const CustomStel = {
    id: 'custom_stl',
    name: "🗿 Классическая стела (3D модель)",
    icon: "🗿",
    defaultWidth: 0.6,
    defaultHeight: 1.3,
    defaultDepth: 0.08,
    createMesh: (width, height, depth, materialType = 'granite') => {
        return createCustomSteleMesh('custom_stl', width, height, depth, materialType, 'vertical');
    }
};

export const CustomStel2 = {
    id: 'custom_stl2',
    name: "🗿 Ангел стела (3D модель)",
    icon: "👼",
    defaultWidth: 0.6,
    defaultHeight: 1.3,
    defaultDepth: 0.08,
    createMesh: (width, height, depth, materialType = 'granite') => {
        return createCustomSteleMesh('custom_stl2', width, height, depth, materialType, 'vertical');
    }
};

// ============================================================
// 5. СЛОВАРЬ И ЭКСПОРТЫ
// ============================================================
export const steleTypes = {
    [Rectangle.id]: Rectangle,
    [F41OvalTop.id]: F41OvalTop,
    [F45Ellipse.id]: F45Ellipse,
    [F53Wave.id]: F53Wave,
    [F56Arch.id]: F56Arch,
    [F58CurvedSides.id]: F58CurvedSides,
    [F40Cross.id]: F40Cross,
    [DoubleF16.id]: DoubleF16,
    [CustomStel.id]: CustomStel,
    [CustomStel2.id]: CustomStel2,
};

export function getSteleTypesList() {
    return Object.values(steleTypes).map(type => ({
        id: type.id,
        name: type.name,
        icon: type.icon,
        defaultWidth: type.defaultWidth,
        defaultHeight: type.defaultHeight
    }));
}

export function createSteleMesh(typeId, w, h, d, materialType = 'granite') {
    const type = steleTypes[typeId];
    if (type && type.createMesh) {
        return type.createMesh(w, h, d, materialType);
    }
    console.warn(`Тип ${typeId} не найден, использую Rectangle`);
    return Rectangle.createMesh(w, h, d, materialType);
}