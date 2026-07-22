<<<<<<< HEAD
@echo off
echo Скачивание библиотек THREE.js...

mkdir static\libs 2>nul

curl -L -o static\libs\three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
curl -L -o static\libs\OrbitControls.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
curl -L -o static\libs\DecalGeometry.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/DecalGeometry.js
curl -L -o static\libs\STLLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js
curl -L -o static\libs\GLTFLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
curl -L -o static\libs\OBJLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js

echo ✅ Все библиотеки скачаны!
=======
@echo off
echo Скачивание библиотек THREE.js...

mkdir static\libs 2>nul

curl -L -o static\libs\three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
curl -L -o static\libs\OrbitControls.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
curl -L -o static\libs\DecalGeometry.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/DecalGeometry.js
curl -L -o static\libs\STLLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js
curl -L -o static\libs\GLTFLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
curl -L -o static\libs\OBJLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js

echo ✅ Все библиотеки скачаны!
>>>>>>> 8e734ba9ce21e78239c78bba23747082f52e579a
pause