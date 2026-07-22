// static/js/main.js - Полный JavaScript для проекта

// DOM элементы
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const applyBtn = document.getElementById('applyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const printBtn = document.getElementById('printBtn');
const statusText = document.getElementById('statusText');
const originalPreview = document.getElementById('originalPreview');
const enhancedPreview = document.getElementById('enhancedPreview');

const shapeSelect = document.getElementById('shapeSelect');
const blurSlider = document.getElementById('blurSlider');
const depthSlider = document.getElementById('depthSlider');
const haloSlider = document.getElementById('haloSlider');
const contrastSlider = document.getElementById('contrastSlider');
const brightnessSlider = document.getElementById('brightnessSlider');
const stoneSelect = document.getElementById('stoneSelect');
const scaleSlider = document.getElementById('scaleSlider');
const offsetXSlider = document.getElementById('offsetXSlider');
const offsetYSlider = document.getElementById('offsetYSlider');
const offsetZSlider = document.getElementById('offsetZSlider');

const cropTopSlider = document.getElementById('cropTopSlider');
const cropBottomSlider = document.getElementById('cropBottomSlider');
const cropLeftSlider = document.getElementById('cropLeftSlider');
const cropRightSlider = document.getElementById('cropRightSlider');
const cropTopValue = document.getElementById('cropTopValue');
const cropBottomValue = document.getElementById('cropBottomValue');
const cropLeftValue = document.getElementById('cropLeftValue');
const cropRightValue = document.getElementById('cropRightValue');

const blurValue = document.getElementById('blurValue');
const depthValue = document.getElementById('depthValue');
const haloValue = document.getElementById('haloValue');
const contrastValue = document.getElementById('contrastValue');
const brightnessValue = document.getElementById('brightnessValue');
const scaleValue = document.getElementById('scaleValue');
const offsetXValue = document.getElementById('offsetXValue');
const offsetYValue = document.getElementById('offsetYValue');
const offsetZValue = document.getElementById('offsetZValue');

const modeEngraving = document.getElementById('modeEngraving');
const modePhoto = document.getElementById('modePhoto');
const modeEngravingLabel = document.getElementById('modeEngravingLabel');
const modePhotoLabel = document.getElementById('modePhotoLabel');
const engravingSettings = document.getElementById('engravingSettings');
const photoSettings = document.getElementById('photoSettings');
const photoModeColor = document.getElementById('photoModeColor');
const photoModeBW = document.getElementById('photoModeBW');

const textureSelect = document.getElementById('textureSelect');

// Элементы для фото
const photoBrightnessSlider = document.getElementById('photoBrightnessSlider');
const photoContrastSlider = document.getElementById('photoContrastSlider');
const photoBrightnessValue = document.getElementById('photoBrightnessValue');
const photoContrastValue = document.getElementById('photoContrastValue');

// Проверка авторизации
const isAuthenticated = document.querySelector('.top-bar span[style*="color:#888"]') !== null;
const isGuest = window.location.pathname.includes('/guest');

// Переменные состояния
let currentFile = null;
let sessionId = null;
let engravingBase64 = null;
let maskBase64 = null;
let isProcessing = false;
let isUploading = false;
let currentShape = 'none';
let texturesList = [];
let currentTexturePath = null;
let isTextureApplying = false;

// === 3D переменные ===
let scene, camera, renderer, controls;
let stelaMesh = null;
let stelaMeshForDecal = null;
let stelaTextureLoaded = null;

// === КНОПКИ ===
const orderBtn = document.getElementById('orderBtn');
const orderModal = document.getElementById('orderModal');

// === ФУНКЦИИ ===
function getMode() {
    return modeEngraving.checked ? 'engraving' : 'photo';
}

function getPhotoMode() {
    return photoModeColor.checked ? 'color' : 'bw';
}

function updateModeUI() {
    const isEngraving = getMode() === 'engraving';
    
    modeEngravingLabel.classList.toggle('active', isEngraving);
    modePhotoLabel.classList.toggle('active', !isEngraving);
    
    engravingSettings.classList.toggle('hidden', !isEngraving);
    photoSettings.classList.toggle('hidden', isEngraving);
    
    statusText.textContent = isEngraving ? 
        '✅ Режим гравировки' : 
        '✅ Режим фото-декали';
}

modeEngraving.addEventListener('change', () => {
    updateModeUI();
    if (engravingBase64) applyToStela(engravingBase64);
});
modePhoto.addEventListener('change', () => {
    updateModeUI();
    if (engravingBase64) applyToStela(engravingBase64);
});

if (photoBrightnessSlider) {
    photoBrightnessSlider.addEventListener('input', () => {
        if (photoBrightnessValue) photoBrightnessValue.textContent = photoBrightnessSlider.value;
        if (engravingBase64 && getMode() === 'photo') applyToStela(engravingBase64);
    });
}
if (photoContrastSlider) {
    photoContrastSlider.addEventListener('input', () => {
        if (photoContrastValue) photoContrastValue.textContent = parseFloat(photoContrastSlider.value).toFixed(2);
        if (engravingBase64 && getMode() === 'photo') applyToStela(engravingBase64);
    });
}

function finalizeDecal(ctx, canvas, canvasSize) {
    try {
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        
        const stelaWidth = 1.2;
        const stelaHeight = 2.0;
        const stelaDepth = 0.2;
        
        const userScale = parseFloat(scaleSlider.value);
        const decalSize = Math.min(stelaWidth, stelaHeight) * 0.85 * userScale;
        
        const offsetXPos = parseFloat(offsetXSlider.value) * 0.3;
        const offsetYPos = parseFloat(offsetYSlider.value) * 0.3;
        const offsetZPos = parseFloat(offsetZSlider.value) * 0.05;
        
        const decalGeometry = new THREE.DecalGeometry(
            stelaMeshForDecal,
            new THREE.Vector3(offsetXPos, 0.8 + offsetYPos, stelaDepth/2 + 0.01 + offsetZPos),
            new THREE.Euler(0, 0, 0),
            new THREE.Vector3(decalSize, decalSize, 0.01)
        );
        
        const decalMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            side: THREE.DoubleSide,
            opacity: 1.0,
            color: 0xffffff
        });
        
        if (window.currentDecal) {
            scene.remove(window.currentDecal);
            window.currentDecal = null;
        }
        
        const decal = new THREE.Mesh(decalGeometry, decalMaterial);
        scene.add(decal);
        window.currentDecal = decal;
        
        statusText.textContent = '✅ Нанесено на стелу!';
        
        // Активируем кнопки только для авторизованных пользователей
        if (isAuthenticated) {
            printBtn.disabled = false;
            if (orderBtn) orderBtn.disabled = false;
        }
        
        // Скачать доступен для всех (демо)
        downloadBtn.disabled = false;
        
    } catch (e) {
        console.error('Ошибка в finalizeDecal:', e);
        statusText.textContent = '❌ Ошибка нанесения';
    }
}

function createShapeMask(width, height, shapeType) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#FFFFFF';
    
    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height);
    
    switch(shapeType) {
        case 'circle':
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'oval':
            ctx.beginPath();
            ctx.ellipse(cx, cy, width * 0.45, height * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'square':
            const sqSize = size * 0.45;
            ctx.fillRect(cx - sqSize, cy - sqSize, sqSize * 2, sqSize * 2);
            break;
        case 'rounded':
            const rSize = size * 0.45;
            const radius = 20;
            ctx.beginPath();
            ctx.moveTo(cx - rSize + radius, cy - rSize);
            ctx.lineTo(cx + rSize - radius, cy - rSize);
            ctx.quadraticCurveTo(cx + rSize, cy - rSize, cx + rSize, cy - rSize + radius);
            ctx.lineTo(cx + rSize, cy + rSize - radius);
            ctx.quadraticCurveTo(cx + rSize, cy + rSize, cx + rSize - radius, cy + rSize);
            ctx.lineTo(cx - rSize + radius, cy + rSize);
            ctx.quadraticCurveTo(cx - rSize, cy + rSize, cx - rSize, cy + rSize - radius);
            ctx.lineTo(cx - rSize, cy - rSize + radius);
            ctx.quadraticCurveTo(cx - rSize, cy - rSize, cx - rSize + radius, cy - rSize);
            ctx.fill();
            break;
        default:
            return null;
    }
    
    return canvas;
}

function applyTextureToStela(texturePath) {
    if (!stelaMesh) return;
    if (isTextureApplying) return;
    if (texturePath === currentTexturePath && stelaTextureLoaded) return;
    
    isTextureApplying = true;
    
    if (!texturePath) {
        const materials = stelaMesh.material;
        if (Array.isArray(materials)) {
            materials[4] = new THREE.MeshStandardMaterial({
                color: 0x888888,
                roughness: 0.6,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
            for (let i = 0; i < materials.length; i++) {
                if (i !== 4) {
                    materials[i] = new THREE.MeshStandardMaterial({
                        color: 0x444444,
                        roughness: 0.8,
                        metalness: 0.0,
                        side: THREE.DoubleSide
                    });
                }
            }
        }
        stelaMesh.material = materials;
        stelaTextureLoaded = null;
        currentTexturePath = null;
        isTextureApplying = false;
        return;
    }
    
    const loader = new THREE.TextureLoader();
    const fullPath = `/texture/${texturePath}`;
    
    loader.load(fullPath, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        
        const materials = stelaMesh.material;
        if (Array.isArray(materials)) {
            materials[4] = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.7,
                metalness: 0.0,
                side: THREE.DoubleSide
            });
            
            for (let i = 0; i < materials.length; i++) {
                if (i !== 4) {
                    materials[i] = new THREE.MeshStandardMaterial({
                        color: 0x333333,
                        roughness: 0.8,
                        metalness: 0.0,
                        side: THREE.DoubleSide
                    });
                }
            }
        }
        stelaMesh.material = materials;
        stelaTextureLoaded = texture;
        currentTexturePath = texturePath;
        
        console.log('✅ Текстура применена к стеле:', texturePath);
        isTextureApplying = false;
    }, undefined, (error) => {
        console.error('❌ Ошибка загрузки текстуры:', error);
        isTextureApplying = false;
    });
}

textureSelect.addEventListener('change', function() {
    const selectedTexture = this.value;
    if (selectedTexture) {
        const texture = texturesList.find(t => t.id === selectedTexture);
        if (texture) {
            const relPath = texture.path.replace(/^.*[\\\/]textures[\\\/]/, '');
            applyTextureToStela(relPath);
        }
    } else {
        applyTextureToStela(null);
    }
});

// === applyToStela ===
function applyToStela(base64Image) {
    if (!stelaMeshForDecal) {
        setTimeout(() => applyToStela(base64Image), 500);
        return;
    }

    const img = new Image();
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const srcW = img.width;
            const srcH = img.height;
            
            const canvasSize = Math.max(srcW, srcH) * 1.0;
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const scale = Math.min(canvasSize / srcW, canvasSize / srcH);
            const newW = srcW * scale;
            const newH = srcH * scale;
            const offsetX = (canvasSize - newW) / 2;
            const offsetY = (canvasSize - newH) / 2;
            ctx.drawImage(img, offsetX, offsetY, newW, newH);
            
            const shape = shapeSelect.value;
            const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
            const data = imageData.data;
            
            if (getMode() === 'photo') {
                let hasTransparency = false;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        hasTransparency = true;
                        break;
                    }
                }
                
                if (!hasTransparency && maskBase64) {
                    const maskImg = new Image();
                    maskImg.onload = () => {
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = canvasSize;
                        maskCanvas.height = canvasSize;
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCtx.drawImage(maskImg, 0, 0, canvasSize, canvasSize);
                        
                        const imgData = ctx.getImageData(0, 0, canvasSize, canvasSize);
                        const maskData = maskCtx.getImageData(0, 0, canvasSize, canvasSize);
                        const d = imgData.data;
                        const md = maskData.data;
                        
                        for (let i = 0; i < d.length; i += 4) {
                            if (md[i] < 30) {
                                d[i + 3] = 0;
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                        finalizeDecal(ctx, canvas, canvasSize);
                    };
                    maskImg.onerror = () => finalizeDecal(ctx, canvas, canvasSize);
                    maskImg.src = `data:image/png;base64,${maskBase64}`;
                    return;
                }
                finalizeDecal(ctx, canvas, canvasSize);
                return;
            }
            
            if (shape === 'none') {
                let hasTransparency = false;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        hasTransparency = true;
                        break;
                    }
                }
                
                if (hasTransparency) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 30) {
                            data[i + 3] = 0;
                        } else {
                            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                            if (avg > 128) {
                                data[i] = Math.min(255, data[i] + 40);
                                data[i + 1] = Math.min(255, data[i + 1] + 40);
                                data[i + 2] = Math.min(255, data[i + 2] + 40);
                            } else {
                                data[i] = Math.max(0, data[i] - 20);
                                data[i + 1] = Math.max(0, data[i + 1] - 20);
                                data[i + 2] = Math.max(0, data[i + 2] - 20);
                            }
                            data[i + 3] = 255;
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    finalizeDecal(ctx, canvas, canvasSize);
                    return;
                } else if (maskBase64) {
                    const maskImg = new Image();
                    maskImg.onload = () => {
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = canvasSize;
                        maskCanvas.height = canvasSize;
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCtx.drawImage(maskImg, 0, 0, canvasSize, canvasSize);
                        
                        const imgData = ctx.getImageData(0, 0, canvasSize, canvasSize);
                        const maskData = maskCtx.getImageData(0, 0, canvasSize, canvasSize);
                        const d = imgData.data;
                        const md = maskData.data;
                        
                        for (let i = 0; i < d.length; i += 4) {
                            if (md[i] < 30) {
                                d[i + 3] = 0;
                            } else {
                                const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
                                if (avg > 128) {
                                    d[i] = Math.min(255, d[i] + 50);
                                    d[i + 1] = Math.min(255, d[i + 1] + 50);
                                    d[i + 2] = Math.min(255, d[i + 2] + 50);
                                } else {
                                    d[i] = Math.max(0, d[i] - 30);
                                    d[i + 1] = Math.max(0, d[i + 1] - 30);
                                    d[i + 2] = Math.max(0, d[i + 2] - 30);
                                }
                                d[i + 3] = 255;
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                        finalizeDecal(ctx, canvas, canvasSize);
                    };
                    maskImg.onerror = () => finalizeDecal(ctx, canvas, canvasSize);
                    maskImg.src = `data:image/png;base64,${maskBase64}`;
                    return;
                }
            } else {
                const maskCanvas = createShapeMask(canvasSize, canvasSize, shape);
                if (maskCanvas) {
                    const maskData = maskCanvas.getContext('2d').getImageData(0, 0, canvasSize, canvasSize);
                    const md = maskData.data;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        if (md[i] === 0) {
                            data[i + 3] = 0;
                        } else {
                            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                            if (avg > 128) {
                                data[i] = Math.min(255, data[i] + 50);
                                data[i + 1] = Math.min(255, data[i + 1] + 50);
                                data[i + 2] = Math.min(255, data[i + 2] + 50);
                            } else {
                                data[i] = Math.max(0, data[i] - 30);
                                data[i + 1] = Math.max(0, data[i + 1] - 30);
                                data[i + 2] = Math.max(0, data[i + 2] - 30);
                            }
                            data[i + 3] = 255;
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
            }
            
            finalizeDecal(ctx, canvas, canvasSize);
        } catch (e) {
            console.error('Ошибка в applyToStela:', e);
            statusText.textContent = '❌ Ошибка обработки изображения';
        }
    };
    img.onerror = () => {
        statusText.textContent = '❌ Ошибка загрузки изображения';
    };
    img.src = `data:image/png;base64,${base64Image}`;
}

function init3D() {
    const container = document.getElementById('stelaViewer');
    if (!container) return;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.2, 4.5);
    camera.lookAt(0, 0.5, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.target.set(0, 0.5, 0);
    controls.update();

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 3, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x4444ff, 0.3);
    fillLight.position.set(-2, 1, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
    rimLight.position.set(0, -1, -2);
    scene.add(rimLight);

    const groundGeometry = new THREE.CircleGeometry(3, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x111122,
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.5
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    const stelaWidth = 1.2;
    const stelaHeight = 2.0;
    const stelaDepth = 0.2;
    
    const frontMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    const otherMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    
    const materials = [
        otherMat, otherMat,
        otherMat, otherMat,
        frontMat, otherMat
    ];
    
    const geometry = new THREE.BoxGeometry(stelaWidth, stelaHeight, stelaDepth);
    
    stelaMesh = new THREE.Mesh(geometry, materials);
    stelaMesh.position.set(0, 0.8, 0);
    stelaMesh.castShadow = true;
    stelaMesh.receiveShadow = true;
    
    scene.add(stelaMesh);
    stelaMeshForDecal = stelaMesh;
    
    const edgeGeo = new THREE.EdgesGeometry(geometry);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x444444 });
    const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
    wireframe.position.copy(stelaMesh.position);
    scene.add(wireframe);
    
    animate();
    
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    });
}

function animate() {
    if (!renderer) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// === ЗАГРУЗКА ТЕКСТУР ===
async function loadTextures() {
    try {
        const response = await fetch('/textures');
        if (!response.ok) {
            throw new Error('Ошибка загрузки текстур');
        }
        const data = await response.json();
        
        texturesList = data.textures;
        
        textureSelect.innerHTML = '<option value="">Без текстуры</option>';
        
        const categories = {};
        data.textures.forEach(texture => {
            const category = texture.category || 'root';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(texture);
        });
        
        for (const [category, textures] of Object.entries(categories)) {
            if (category !== 'root') {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category;
                textures.forEach(texture => {
                    const option = document.createElement('option');
                    option.value = texture.id;
                    option.textContent = texture.display_name || texture.name;
                    optgroup.appendChild(option);
                });
                textureSelect.appendChild(optgroup);
            } else {
                textures.forEach(texture => {
                    const option = document.createElement('option');
                    option.value = texture.id;
                    option.textContent = texture.display_name || texture.name;
                    textureSelect.appendChild(option);
                });
            }
        }
        
        textureSelect.value = '';
        
        console.log('✅ Текстуры загружены:', data.textures.length);
    } catch (error) {
        console.error('❌ Ошибка загрузки текстур:', error);
    }
}

// === ФУНКЦИИ ДЛЯ ПЕЧАТИ ===
function openPrintForm() {
    if (!engravingBase64) {
        statusText.textContent = '⚠️ Сначала создайте гравировку';
        return;
    }
    
    // Проверка авторизации для печати
    if (!isAuthenticated) {
        statusText.textContent = '⚠️ Для печати войдите в систему';
        if (confirm('⚠️ Для печати нужно войти или зарегистрироваться. Перейти на страницу входа?')) {
            window.location.href = '/login';
        }
        return;
    }
    
    const printForm = document.getElementById('printForm');
    printForm.classList.add('active');
    printForm.style.display = 'block';
    
    document.getElementById('printMode').textContent = getMode() === 'engraving' ? 'Гравировка' : 'Фото (декаль)';
    document.getElementById('printShape').textContent = shapeSelect.options[shapeSelect.selectedIndex].text;
    document.getElementById('printDepth').textContent = depthSlider.value;
    document.getElementById('printHalo').textContent = haloSlider.value;
    document.getElementById('printContrast').textContent = contrastSlider.value;
    document.getElementById('printBrightness').textContent = brightnessSlider.value;
    document.getElementById('printStone').textContent = stoneSelect.options[stoneSelect.selectedIndex].text;
    document.getElementById('printTexture').textContent = textureSelect.options[textureSelect.selectedIndex].text || 'Нет';
    
    document.getElementById('printScale').textContent = scaleSlider.value;
    document.getElementById('printOffsetX').textContent = offsetXSlider.value;
    document.getElementById('printOffsetY').textContent = offsetYSlider.value;
    document.getElementById('printOffsetZ').textContent = offsetZSlider.value;
    
    const cropTop = cropTopSlider.value + '%';
    const cropBottom = cropBottomSlider.value + '%';
    const cropLeft = cropLeftSlider.value + '%';
    const cropRight = cropRightSlider.value + '%';
    
    document.getElementById('printCropTop').textContent = cropTop;
    document.getElementById('printCropBottom').textContent = cropBottom;
    document.getElementById('printCropLeft').textContent = cropLeft;
    document.getElementById('printCropRight').textContent = cropRight;
    
    document.getElementById('printCropTopParam').textContent = cropTop;
    document.getElementById('printCropBottomParam').textContent = cropBottom;
    document.getElementById('printCropLeftParam').textContent = cropLeft;
    document.getElementById('printCropRightParam').textContent = cropRight;
    
    document.getElementById('printStelaHeight').textContent = '600 мм';
    document.getElementById('printStelaWidth').textContent = '1200 мм';
    document.getElementById('printStelaDepth').textContent = '8 мм';
    document.getElementById('printStelaMaterial').textContent = 'Гранит';
    
    const stelaWidth = 1200;
    const stelaHeight = 600;
    const scale = parseFloat(scaleSlider.value);
    const engravingWidth = Math.round(stelaWidth * 0.85 * scale);
    const engravingHeight = Math.round(stelaHeight * 0.85 * scale);
    
    document.getElementById('printEngravingWidth').textContent = engravingWidth + ' мм';
    document.getElementById('printEngravingHeight').textContent = engravingHeight + ' мм';
    document.getElementById('printEngravingScale').textContent = scale;
    
    const offsetX = parseFloat(offsetXSlider.value);
    const offsetY = parseFloat(offsetYSlider.value);
    const posX = offsetX > 0 ? `смещено вправо на ${Math.round(offsetX * 50)} мм` : 
                 offsetX < 0 ? `смещено влево на ${Math.round(Math.abs(offsetX) * 50)} мм` : 'по центру';
    const posY = offsetY > 0 ? `смещено вверх на ${Math.round(offsetY * 50)} мм` : 
                 offsetY < 0 ? `смещено вниз на ${Math.round(Math.abs(offsetY) * 50)} мм` : 'по центру';
    document.getElementById('printEngravingPosition').textContent = `X: ${posX}, Y: ${posY}`;
    
    const executorName = document.getElementById('executorName');
    const executorPosition = document.getElementById('executorPosition');
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    
    if (executorName) executorName.value = '';
    if (executorPosition) executorPosition.value = '';
    if (customerName) customerName.value = '';
    if (customerPhone) customerPhone.value = '';
    
    setTimeout(() => renderStelaForPrint(), 200);
    
    const agreeCheckbox = document.getElementById('agreeCheckbox');
    const printAgreeBtn = document.getElementById('printAgreeBtn');
    if (agreeCheckbox) agreeCheckbox.checked = false;
    if (printAgreeBtn) printAgreeBtn.disabled = true;
}

function renderStelaForPrint() {
    const canvas = document.getElementById('printCanvas');
    const container = document.getElementById('printStelaContainer');
    
    if (!canvas || !container) {
        console.error('Canvas или контейнер не найдены');
        return;
    }
    
    const rect = container.getBoundingClientRect();
    const width = rect.width || 500;
    const height = rect.height || 500;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    if (controls) {
        const wasAutoRotate = controls.autoRotate;
        controls.autoRotate = false;
        controls.update();
        
        renderer.render(scene, camera);
        
        const mainCanvas = renderer.domElement;
        ctx.drawImage(mainCanvas, 0, 0, width, height);
        
        controls.autoRotate = wasAutoRotate;
        controls.update();
    } else {
        ctx.fillStyle = '#333';
        ctx.font = '24px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('🔄 Загрузка 3D модели...', width/2, height/2);
    }
    
    console.log('✅ Стелла отрендерена для печати');
}

function closePrintForm() {
    const printForm = document.getElementById('printForm');
    printForm.classList.remove('active');
    printForm.style.display = 'none';
}

function printDocument() {
    window.print();
}

const agreeCheckbox = document.getElementById('agreeCheckbox');
if (agreeCheckbox) {
    agreeCheckbox.addEventListener('change', function() {
        const printAgreeBtn = document.getElementById('printAgreeBtn');
        if (printAgreeBtn) printAgreeBtn.disabled = !this.checked;
    });
}

// === СЛАЙДЕРЫ ===
if (blurSlider) blurSlider.addEventListener('input', () => blurValue.textContent = blurSlider.value);
if (depthSlider) depthSlider.addEventListener('input', () => depthValue.textContent = depthSlider.value);
if (haloSlider) haloSlider.addEventListener('input', () => haloValue.textContent = haloSlider.value);
if (contrastSlider) contrastSlider.addEventListener('input', () => contrastValue.textContent = contrastSlider.value);
if (brightnessSlider) brightnessSlider.addEventListener('input', () => brightnessValue.textContent = brightnessSlider.value);

if (cropTopSlider) {
    cropTopSlider.addEventListener('input', () => {
        if (cropTopValue) cropTopValue.textContent = cropTopSlider.value + '%';
        if (engravingBase64) recreateEngraving();
    });
}
if (cropBottomSlider) {
    cropBottomSlider.addEventListener('input', () => {
        if (cropBottomValue) cropBottomValue.textContent = cropBottomSlider.value + '%';
        if (engravingBase64) recreateEngraving();
    });
}
if (cropLeftSlider) {
    cropLeftSlider.addEventListener('input', () => {
        if (cropLeftValue) cropLeftValue.textContent = cropLeftSlider.value + '%';
        if (engravingBase64) recreateEngraving();
    });
}
if (cropRightSlider) {
    cropRightSlider.addEventListener('input', () => {
        if (cropRightValue) cropRightValue.textContent = cropRightSlider.value + '%';
        if (engravingBase64) recreateEngraving();
    });
}

if (scaleSlider) {
    scaleSlider.addEventListener('input', () => {
        if (scaleValue) scaleValue.textContent = parseFloat(scaleSlider.value).toFixed(2);
        if (engravingBase64) applyToStela(engravingBase64);
    });
}
if (offsetXSlider) {
    offsetXSlider.addEventListener('input', () => {
        if (offsetXValue) offsetXValue.textContent = parseFloat(offsetXSlider.value).toFixed(2);
        if (engravingBase64) applyToStela(engravingBase64);
    });
}
if (offsetYSlider) {
    offsetYSlider.addEventListener('input', () => {
        if (offsetYValue) offsetYValue.textContent = parseFloat(offsetYSlider.value).toFixed(2);
        if (engravingBase64) applyToStela(engravingBase64);
    });
}
if (offsetZSlider) {
    offsetZSlider.addEventListener('input', () => {
        if (offsetZValue) offsetZValue.textContent = parseFloat(offsetZSlider.value).toFixed(2);
        if (engravingBase64) applyToStela(engravingBase64);
    });
}

if (shapeSelect) {
    shapeSelect.addEventListener('change', () => {
        currentShape = shapeSelect.value;
        if (engravingBase64) {
            applyToStela(engravingBase64);
        }
    });
}

// === ЗАГРУЗКА ФАЙЛА ===
if (uploadArea) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#4CAF50'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#444'; });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault(); uploadArea.style.borderColor = '#444';
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
}
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        statusText.textContent = '❌ Загрузите изображение';
        return;
    }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (originalPreview) originalPreview.innerHTML = `<img src="${e.target.result}" alt="Оригинал">`;
        statusText.textContent = '✅ Фото загружено. Нажмите "Загрузить" для обработки';
        if (uploadBtn) uploadBtn.disabled = false;
        if (applyBtn) applyBtn.disabled = true;
        if (downloadBtn) downloadBtn.disabled = true;
        if (printBtn) printBtn.disabled = true;
    };
    reader.readAsDataURL(file);
}

// === КНОПКА ЗАГРУЗКИ ===
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        if (!currentFile || isUploading) return;
        isUploading = true;
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Загрузка...';
        statusText.textContent = '🔄 Обработка...';

        const formData = new FormData();
        formData.append('image', currentFile);

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Ошибка загрузки');
            }
            const data = await response.json();
            if (data.success) {
                sessionId = data.session_id;
                if (enhancedPreview) enhancedPreview.innerHTML = `<img src="data:image/jpeg;base64,${data.enhanced}" alt="Улучшенное">`;
                statusText.textContent = '✅ Готово! Нажмите "Создать" для генерации';
                uploadBtn.textContent = '✅ Готово';
                if (applyBtn) applyBtn.disabled = false;
            } else {
                throw new Error(data.error || 'Ошибка');
            }
        } catch (error) {
            statusText.textContent = '❌ ' + error.message;
            uploadBtn.textContent = '📤 Загрузить';
        } finally {
            isUploading = false;
            uploadBtn.disabled = false;
        }
    });
}

// === ПЕРЕСОЗДАНИЕ ===
async function recreateEngraving() {
    if (!sessionId || isProcessing) return;
    
    isProcessing = true;
    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = '⏳ Обновление...';
    }
    statusText.textContent = '⏳ Обновление...';

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('blur', blurSlider ? blurSlider.value : 3);
    formData.append('depth', depthSlider ? depthSlider.value : 0.9);
    formData.append('halo', haloSlider ? haloSlider.value : 35);
    formData.append('contrast', contrastSlider ? contrastSlider.value : 3.0);
    formData.append('brightness', brightnessSlider ? brightnessSlider.value : 0);
    formData.append('stone', stoneSelect ? stoneSelect.value : 'classic');
    formData.append('mode', getMode());
    formData.append('crop_top', cropTopSlider ? cropTopSlider.value : 2);
    formData.append('crop_bottom', cropBottomSlider ? cropBottomSlider.value : 2);
    formData.append('crop_left', cropLeftSlider ? cropLeftSlider.value : 2);
    formData.append('crop_right', cropRightSlider ? cropRightSlider.value : 2);
    formData.append('photo_brightness', photoBrightnessSlider ? photoBrightnessSlider.value : 0);
    formData.append('photo_contrast', photoContrastSlider ? photoContrastSlider.value : 1.0);
    formData.append('photo_mode', getPhotoMode());
    formData.append('texture', textureSelect ? textureSelect.value : '');

    try {
        const response = await fetch('/process', { method: 'POST', body: formData });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Ошибка обработки');
        }
        const data = await response.json();
        if (data.success) {
            engravingBase64 = data.engraving;
            maskBase64 = data.mask;
            if (downloadBtn) downloadBtn.disabled = false;
            if (isAuthenticated) {
                if (printBtn) printBtn.disabled = false;
            }
            statusText.textContent = '✅ Обновлено!';
            applyToStela(data.engraving);
        } else {
            throw new Error(data.error || 'Ошибка');
        }
    } catch (error) {
        statusText.textContent = '❌ ' + error.message;
    } finally {
        isProcessing = false;
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.textContent = '⚙️ Создать';
        }
    }
}

// === КНОПКА СОЗДАНИЯ ===
if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
        if (!sessionId) {
            statusText.textContent = '⚠️ Сначала загрузите фото';
            return;
        }
        if (isProcessing) return;

        isProcessing = true;
        applyBtn.disabled = true;
        applyBtn.textContent = '⏳ Создание...';
        statusText.textContent = '⏳ Создание...';

        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('blur', blurSlider ? blurSlider.value : 3);
        formData.append('depth', depthSlider ? depthSlider.value : 0.9);
        formData.append('halo', haloSlider ? haloSlider.value : 35);
        formData.append('contrast', contrastSlider ? contrastSlider.value : 3.0);
        formData.append('brightness', brightnessSlider ? brightnessSlider.value : 0);
        formData.append('stone', stoneSelect ? stoneSelect.value : 'classic');
        formData.append('mode', getMode());
        formData.append('crop_top', cropTopSlider ? cropTopSlider.value : 2);
        formData.append('crop_bottom', cropBottomSlider ? cropBottomSlider.value : 2);
        formData.append('crop_left', cropLeftSlider ? cropLeftSlider.value : 2);
        formData.append('crop_right', cropRightSlider ? cropRightSlider.value : 2);
        formData.append('photo_brightness', photoBrightnessSlider ? photoBrightnessSlider.value : 0);
        formData.append('photo_contrast', photoContrastSlider ? photoContrastSlider.value : 1.0);
        formData.append('photo_mode', getPhotoMode());
        formData.append('texture', textureSelect ? textureSelect.value : '');

        try {
            const response = await fetch('/process', { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Ошибка обработки');
            }
            const data = await response.json();
            if (data.success) {
                engravingBase64 = data.engraving;
                maskBase64 = data.mask;
                if (downloadBtn) downloadBtn.disabled = false;
                if (isAuthenticated) {
                    if (printBtn) printBtn.disabled = false;
                }
                statusText.textContent = '✅ Готово!';
                applyToStela(data.engraving);
            } else {
                throw new Error(data.error || 'Ошибка');
            }
        } catch (error) {
            statusText.textContent = '❌ ' + error.message;
        } finally {
            isProcessing = false;
            applyBtn.disabled = false;
            applyBtn.textContent = '⚙️ Создать';
        }
    });
}

// === СКАЧАТЬ ===
if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        if (!engravingBase64) return;
        const link = document.createElement('a');
        link.download = 'result.png';
        link.href = `data:image/png;base64,${engravingBase64}`;
        link.click();
    });
}

// === ПЕЧАТЬ ===
if (printBtn) {
    printBtn.addEventListener('click', openPrintForm);
}

// Переключение режима фото (цветное/ЧБ)
if (photoModeColor) {
    photoModeColor.addEventListener('change', () => {
        if (engravingBase64 && getMode() === 'photo') {
            applyToStela(engravingBase64);
        }
    });
}
if (photoModeBW) {
    photoModeBW.addEventListener('change', () => {
        if (engravingBase64 && getMode() === 'photo') {
            applyToStela(engravingBase64);
        }
    });
}

// ============================================
// ОФОРМЛЕНИЕ ЗАКАЗА
// ============================================

function openOrderModal() {
    // Проверка авторизации
    if (!isAuthenticated) {
        statusText.textContent = '⚠️ Для оформления заказа войдите в систему';
        if (confirm('⚠️ Для оформления заказа нужно войти или зарегистрироваться. Перейти на страницу входа?')) {
            window.location.href = '/login';
        }
        return;
    }
    
    if (!engravingBase64) {
        statusText.textContent = '⚠️ Сначала создайте гравировку';
        return;
    }
    
    document.getElementById('orderPreviewMode').textContent = 
        getMode() === 'engraving' ? 'Гравировка' : 'Фото-декаль';
    document.getElementById('orderPreviewStone').textContent = 
        stoneSelect.options[stoneSelect.selectedIndex].text;
    document.getElementById('orderPreviewScale').textContent = 
        scaleSlider.value;
    
    orderModal.style.display = 'flex';
}

function closeOrderModal() {
    orderModal.style.display = 'none';
}

if (document.getElementById('orderForm')) {
    document.getElementById('orderForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Проверка авторизации
        if (!isAuthenticated) {
            alert('⚠️ Для оформления заказа войдите в систему');
            window.location.href = '/login';
            return;
        }
        
        const clientName = document.getElementById('orderClientName').value.trim();
        const clientPhone = document.getElementById('orderClientPhone').value.trim();
        const clientEmail = document.getElementById('orderClientEmail').value.trim();
        const notes = document.getElementById('orderNotes').value.trim();
        
        if (!clientName || !clientPhone) {
            alert('⚠️ Заполните ФИО и телефон');
            return;
        }
        
        const orderData = {
            client_name: clientName,
            client_phone: clientPhone,
            client_email: clientEmail || '',
            notes: notes || '',
            mode: getMode(),
            shape: shapeSelect.value,
            stone: stoneSelect.value,
            texture: textureSelect.value,
            blur: parseFloat(blurSlider.value),
            depth: parseFloat(depthSlider.value),
            halo: parseInt(haloSlider.value),
            contrast: parseFloat(contrastSlider.value),
            brightness: parseInt(brightnessSlider.value),
            scale: parseFloat(scaleSlider.value),
            offset_x: parseFloat(offsetXSlider.value),
            offset_y: parseFloat(offsetYSlider.value),
            offset_z: parseFloat(offsetZSlider.value),
            crop_top: parseFloat(cropTopSlider.value),
            crop_bottom: parseFloat(cropBottomSlider.value),
            crop_left: parseFloat(cropLeftSlider.value),
            crop_right: parseFloat(cropRightSlider.value),
            photo_mode: getPhotoMode(),
            photo_brightness: parseInt(photoBrightnessSlider.value),
            photo_contrast: parseFloat(photoContrastSlider.value),
            engraving_image: engravingBase64,
            mask_image: maskBase64
        };
        
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Отправка...';
        statusText.textContent = '⏳ Оформление заказа...';
        
        try {
            const url = isGuest ? '/api/guest/order/create' : '/api/order/create';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                statusText.textContent = '✅ Заказ оформлен! Письмо отправлено на почту';
                closeOrderModal();
                document.getElementById('orderClientName').value = '';
                document.getElementById('orderClientPhone').value = '';
                document.getElementById('orderClientEmail').value = '';
                document.getElementById('orderNotes').value = '';
                orderBtn.textContent = '✅ Заказ отправлен';
                orderBtn.disabled = true;
            } else {
                statusText.textContent = '❌ ' + (data.error || 'Ошибка оформления');
            }
        } catch (error) {
            statusText.textContent = '❌ Ошибка: ' + error.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 Отправить заказ';
        }
    });
}

if (orderBtn) {
    orderBtn.addEventListener('click', openOrderModal);
}

// === ЗАПУСК ===
document.addEventListener('DOMContentLoaded', () => {
    init3D();
    updateModeUI();
    loadTextures();
    console.log('🚀 Готов к работе');
    console.log('👤 Авторизован:', isAuthenticated);
    console.log('👤 Гость:', isGuest);
});