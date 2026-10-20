
import bpy
import math
from mathutils import Vector

# ============================================================
# VF-14 — фигурная гранитная стела без подставки
# Blender 5.1
# Габариты основного камня: примерно 1000 x 500 x 80 мм
# ============================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for datablocks in (bpy.data.curves, bpy.data.meshes, bpy.data.materials):
    pass

# Координаты:
# X — ширина, Y — толщина, Z — высота
W = 0.50
H = 1.00
T = 0.08
FRONT_Y = -T / 2

# ------------------------------------------------------------
# Материалы
# ------------------------------------------------------------

def make_material(name, color, roughness=0.26, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

granite = make_material(
    "Черный полированный гранит",
    (0.035, 0.040, 0.045),
    0.24
)

edge_granite = make_material(
    "Серый гранит декоративных полос",
    (0.24, 0.25, 0.26),
    0.30
)

# ------------------------------------------------------------
# Контур стелы
# Полигон описывает характерный асимметричный силуэт VF-14.
# ------------------------------------------------------------

outline = [
    (-0.235, 0.985),
    (-0.195, 1.000),
    (-0.125, 0.995),
    (-0.055, 0.972),
    ( 0.025, 0.950),
    ( 0.105, 0.935),
    ( 0.190, 0.930),
    ( 0.235, 0.915),
    ( 0.235, 0.885),
    ( 0.205, 0.865),
    ( 0.215, 0.790),
    ( 0.222, 0.680),
    ( 0.215, 0.550),
    ( 0.195, 0.425),
    ( 0.165, 0.345),
    ( 0.205, 0.305),
    ( 0.238, 0.270),
    ( 0.195, 0.245),
    ( 0.145, 0.215),
    ( 0.080, 0.180),
    ( 0.005, 0.145),
    (-0.065, 0.115),
    (-0.105, 0.100),
    (-0.145, 0.125),
    (-0.175, 0.180),
    (-0.195, 0.235),
    (-0.215, 0.295),
    (-0.205, 0.350),
    (-0.220, 0.440),
    (-0.232, 0.550),
    (-0.230, 0.665),
    (-0.220, 0.780),
    (-0.225, 0.870),
    (-0.245, 0.930),
]

def make_extruded_polygon(name, points, depth, material):
    n = len(points)
    y_front = -depth / 2
    y_back = depth / 2

    verts = []
    for x, z in points:
        verts.append((x, y_front, z))
    for x, z in points:
        verts.append((x, y_back, z))

    faces = []
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))

    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Нормали
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)

    bevel = obj.modifiers.new("Мягкая обработка кромок", 'BEVEL')
    bevel.width = 0.004
    bevel.segments = 3

    normals = obj.modifiers.new("Нормали граней", 'WEIGHTED_NORMAL')
    return obj

stele = make_extruded_polygon(
    "VF14_Стела_без_подставки",
    outline,
    T,
    granite
)

# ------------------------------------------------------------
# Декоративные объёмные полосы на лицевой стороне
# Кривые лежат близко к поверхности, имитируя фигурную обработку.
# ------------------------------------------------------------

def make_ribbon(name, points, radius, material, y=FRONT_Y - 0.002):
    curve = bpy.data.curves.new(name + "_Curve", 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 20

    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)

    for bp, (x, z) in zip(spline.bezier_points, points):
        bp.co = (x, y, z)
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj

# Две тонкие полосы вдоль волнистой верхушки
make_ribbon(
    "Верхняя_декоративная_полоса",
    [
        (-0.225, 0.952),
        (-0.145, 0.970),
        (-0.055, 0.950),
        ( 0.040, 0.923),
        ( 0.135, 0.910),
        ( 0.218, 0.905),
    ],
    0.0035,
    edge_granite,
    FRONT_Y - 0.001
)

make_ribbon(
    "Вторая_полоса_верхушки",
    [
        (-0.205, 0.925),
        (-0.125, 0.942),
        (-0.035, 0.922),
        ( 0.060, 0.897),
        ( 0.150, 0.885),
        ( 0.222, 0.882),
    ],
    0.0025,
    edge_granite,
    FRONT_Y - 0.001
)

# Нижние диагональные волны — ключевой декоративный элемент
make_ribbon(
    "Нижняя_широкая_волна",
    [
        (-0.185, 0.275),
        (-0.145, 0.245),
        (-0.090, 0.215),
        (-0.015, 0.180),
        ( 0.065, 0.205),
        ( 0.145, 0.250),
        ( 0.205, 0.285),
    ],
    0.008,
    edge_granite,
    FRONT_Y - 0.002
)

make_ribbon(
    "Нижняя_тонкая_волна",
    [
        (-0.180, 0.245),
        (-0.135, 0.215),
        (-0.075, 0.185),
        (-0.005, 0.155),
        ( 0.075, 0.180),
        ( 0.150, 0.220),
        ( 0.210, 0.260),
    ],
    0.004,
    edge_granite,
    FRONT_Y - 0.002
)

# ------------------------------------------------------------
# Сглаживание внешнего вида
# ------------------------------------------------------------

for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True

# Начальная точка обзора в окне 3D (если сцена открывается в UI)
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = 2.5

# ------------------------------------------------------------
# Сохранение файла Blender и экспорт GLB
# ------------------------------------------------------------

blend_path = bpy.path.abspath("//VF14_Stele.blend")
glb_path = bpy.path.abspath("//VF14_Stele.glb")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=True
)

print("Готово:")
print(blend_path)
print(glb_path)
