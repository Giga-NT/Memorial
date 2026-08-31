import * as THREE from 'three';

export const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });

export function createExtrudedStele(w, h, d, drawFn) {
    const shape = new THREE.Shape();
    const halfW = w / 2;
    const halfH = h / 2;
    
    drawFn(shape, halfW, halfH);
    
    const geo = new THREE.ExtrudeGeometry(shape, { 
        depth: d, 
        bevelEnabled: true, 
        bevelThickness: 0.02, 
        bevelSize: 0.02, 
        bevelSegments: 4 
    });
    geo.center();
    return new THREE.Mesh(geo, defaultMaterial);
}