// tests/mocks/three-mock.js

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
}

class MockObject3D {
    constructor() {
        this.children = [];
        this.userData = {};
        this.position = new Vector3(0, 0, 0);
        this.rotation = new Vector3(0, 0, 0);
        this.scale = new Vector3(1, 1, 1);
        this.visible = true;
        this.name = '';
        this.parent = null;
    }
    add(child) {
        this.children.push(child);
        if (child) child.parent = this;
        return this;
    }
    remove(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            if (child) child.parent = null;
        }
        return this;
    }
    traverse(fn) {
        fn(this);
        this.children.forEach(child => {
            if (child && child.traverse) child.traverse(fn);
        });
    }
}

class MockMesh extends MockObject3D {
    constructor(geometry, material) {
        super();
        this.geometry = geometry || {};
        this.material = material || {};
        this.isMesh = true;
        this.type = 'Mesh';
    }
}

class MockGroup extends MockObject3D {
    constructor() {
        super();
        this.isGroup = true;
        this.type = 'Group';
    }
}

class MockScene extends MockObject3D {
    constructor() {
        super();
        this.isScene = true;
        this.type = 'Scene';
    }
}

class MockTexture {
    constructor() {
        this.image = null;
        this.wrapS = 1000;
        this.wrapT = 1000;
        this.repeat = { x: 1, y: 1 };
        this.minFilter = 1006;
        this.magFilter = 1006;
        this.anisotropy = 0;
        this.needsUpdate = false;
    }
}

class MockTextureLoader {
    load(path, onLoad, onProgress, onError) {
        const texture = new MockTexture();
        if (onLoad) setTimeout(() => onLoad(texture), 10);
        return texture;
    }
}

class MockCanvasTexture {
    constructor(canvas) {
        this.image = canvas;
        this.needsUpdate = true;
        this.wrapS = 1000;
        this.wrapT = 1000;
        this.repeat = { x: 1, y: 1 };
        this.minFilter = 1006;
        this.magFilter = 1006;
        this.anisotropy = 0;
    }
}

function BoxGeometry(w, h, d) {
    return {
        parameters: { width: w, height: h, depth: d },
        type: 'BoxGeometry'
    };
}

function PlaneGeometry(w, h) {
    return {
        parameters: { width: w, height: h },
        type: 'PlaneGeometry'
    };
}

function CircleGeometry(radius, segments) {
    return {
        parameters: { radius, segments },
        type: 'CircleGeometry'
    };
}

function MeshStandardMaterial(props) {
    return {
        ...props,
        isMaterial: true,
        type: 'MeshStandardMaterial'
    };
}

function MeshBasicMaterial(props) {
    return {
        ...props,
        isMaterial: true,
        type: 'MeshBasicMaterial'
    };
}

function Color(hex) {
    return { 
        hex, 
        toString: () => `#${hex.toString(16).padStart(6, '0')}`,
        setHex: function(h) { this.hex = h; return this; }
    };
}

const THREE = {
    Scene: MockScene,
    Group: MockGroup,
    Mesh: MockMesh,
    Object3D: MockObject3D,
    Texture: MockTexture,
    TextureLoader: MockTextureLoader,
    CanvasTexture: MockCanvasTexture,
    BoxGeometry,
    PlaneGeometry,
    CircleGeometry,
    MeshStandardMaterial,
    MeshBasicMaterial,
    Vector3,
    Color,
    RepeatWrapping: 1000,
    LinearFilter: 1006,
    DoubleSide: 2
};

module.exports = { THREE, Vector3 };