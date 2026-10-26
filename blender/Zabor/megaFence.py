
# -*- coding: utf-8 -*-
# GRAND IMPERIAL FENCE — Blender 5.1.1
# Черный кованый металл + золото + барочный орнамент
# Размеры в метрах. Создание сцены и экспорт GLB.

import bpy
import math
from mathutils import Vector

# =========================================================
# НАСТРОЙКИ
# =========================================================

W = 4.0
H = 2.35
D = 0.16

EXPORT_GLB = True
EXPORT_PATH = bpy.path.abspath("//Grand_Imperial_Fence.glb")

# Геометрия расположена в плоскости X/Z,
# глубина конструкции идет по оси Y.

Y_FRONT = -D / 2
Y_BACK = D / 2
Y_DECOR = -0.105

# =========================================================
# ОЧИСТКА СЦЕНЫ
# =========================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for datablocks in (
    bpy.data.materials,
    bpy.data.curves,
    bpy.data.meshes,
):
    for datablock in list(datablocks):
        if datablock.users == 0:
            datablocks.remove(datablock)

# =========================================================
# МАТЕРИАЛЫ
# =========================================================


def make_material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)

    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True

    # Создаем дерево узлов, если оно отсутствует
    if mat.node_tree is None:
        mat.node_tree = bpy.data.node_groups.new(
            name + "_NodeTree", "ShaderNodeTree"
        )

    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")

    # Если узла нет — создаем его
    if bsdf is None:
        nodes.clear()
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.location = (0, 0)

    # Создаем выход материала, если его нет
    output = nodes.get("Material Output")
    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")
        output.location = (300, 0)

    # Подключаем шейдер к выходу
    links = mat.node_tree.links
    if not any(link.from_node == bsdf and
               link.to_node == output for link in links):
        links.new(
            bsdf.outputs["BSDF"],
            output.inputs["Surface"]
        )

    # Настраиваем цвет и металлические свойства
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    return mat

# =========================================================
# СОЗДАНИЕ МАТЕРИАЛОВ
# =========================================================

black = make_material(
    "01 | Obsidian Black Iron",
    (0.018, 0.022, 0.028), 0.82, 0.24
)

gold = make_material(
    "02 | Royal Polished Gold",
    (0.72, 0.40, 0.09), 0.92, 0.19
)

gold_light = make_material(
    "03 | Champagne Gold",
    (0.95, 0.69, 0.28), 0.88, 0.22
)

stone = make_material(
    "04 | Dark Granite",
    (0.055, 0.060, 0.068), 0.18, 0.32
)

# =========================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =========================================================

def finish(obj, name, material, bevel=0.0):
    obj.name = name
    if material:
        obj.data.materials.append(material)

    if bevel > 0:
        mod = obj.modifiers.new("Soft forged edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2

        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")

    return obj


def cube(name, loc, scale, material, bevel=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(
        location=False, rotation=False, scale=True
    )
    return finish(obj, name, material, bevel)


def sphere(name, loc, radius, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=8,
        radius=radius, location=loc
    )
    obj = bpy.context.object
    return finish(obj, name, material)


def cylinder_between(name, a, b, radius, material, vertices=12):
    a = Vector(a)
    b = Vector(b)
    delta = b - a

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=delta.length,
        location=(a + b) / 2
    )
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = delta.to_track_quat('Z', 'Y')
    return finish(obj, name, material, 0.003)


def bar_x(name, x1, x2, z, y, radius, material):
    return cylinder_between(
        name, (x1, y, z), (x2, y, z), radius, material
    )


def bar_z(name, x, z1, z2, y, radius, material):
    return cylinder_between(
        name, (x, y, z1), (x, y, z2), radius, material
    )


def tube_path(name, points, radius, material, cyclic=False, resolution=2):
    """Объемная трубка вдоль списка трехмерных точек."""
    curve = bpy.data.curves.new(name + "_Curve", 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    curve.resolution_u = 12

    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)

    for p, co in zip(spline.points, points):
        p.co = (co[0], co[1], co[2], 1.0)

    spline.use_cyclic_u = cyclic

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def ring(name, cx, cz, rx, rz, y, radius, material, segments=64):
    pts = []
    for i in range(segments):
        t = math.tau * i / segments
        pts.append((
            cx + rx * math.cos(t),
            y,
            cz + rz * math.sin(t)
        ))
    return tube_path(name, pts, radius, material, True, 3)


def spiral(name, cx, cz, radius, turns, direction, y, thickness, material):
    """Спираль с плавным сужением к концу."""
    pts = []
    steps = 72

    for i in range(steps + 1):
        t = i / steps
        angle = direction * math.tau * turns * t
        r = radius * (1.0 - 0.86 * t)

        pts.append((
            cx + r * math.cos(angle),
            y,
            cz + r * math.sin(angle)
        ))

    tube_path(name, pts, thickness, material, False, 3)


def leaf(name, x, z, size, y, material, direction=1):
    """Стилизованный лист из двух плавных кривых."""
    pts1 = []
    pts2 = []

    for i in range(17):
        t = i / 16
        xx = x + direction * size * (t - 0.5)
        zz = z + size * 0.65 * math.sin(math.pi * t)
        pts1.append((xx, y, zz))
        pts2.append((
            xx,
            y,
            zz - size * 0.12 * math.sin(math.pi * t)
        ))

    tube_path(name + "_A", pts1, size * 0.045, material)
    tube_path(name + "_B", pts2, size * 0.035, material)


def finial(name, x, z, height, material):
    """Декоративный шпиль: основание, шарики и острие."""
    y = 0

    cylinder_between(
        name + "_Stem",
        (x, y, z),
        (x, y, z + height * 0.72),
        0.025, material
    )

    for frac, r in [(0.12, 0.055), (0.27, 0.042), (0.47, 0.032)]:
        sphere(
            name + "_Bead",
            (x, y, z + height * frac),
            r, material
        )

    # Сужающаяся верхушка
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.065,
        radius2=0.001,
        depth=height * 0.43,
        location=(x, y, z + height * 0.79)
    )
    finish(bpy.context.object, name + "_Point", material, 0.003)

# =========================================================
# ОСНОВАНИЕ И КАМЕННЫЕ КОЛОННЫ
# =========================================================

# Нижняя каменная полоса
cube(
    "Granite | Continuous plinth",
    (0, 0.02, 0.12),
    (W + 0.72, 0.34, 0.24),
    stone, 0.025
)

cube(
    "Granite | Upper ledge",
    (0, 0.015, 0.27),
    (W + 0.72, 0.38, 0.065),
    stone, 0.012
)

pillar_x = [-W / 2 - 0.18, W / 2 + 0.18]

for side, x in enumerate(pillar_x):
    prefix = "Left Pillar" if side == 0 else "Right Pillar"

    cube(
        prefix + " | Main shaft",
        (x, 0.015, 1.20),
        (0.36, 0.34, 1.95),
        stone, 0.025
    )

    # Профилированная капитель
    cube(
        prefix + " | Neck",
        (x, 0.015, 2.10),
        (0.42, 0.39, 0.09),
        black, 0.012
    )

    cube(
        prefix + " | Crown moulding",
        (x, 0.015, 2.18),
        (0.53, 0.43, 0.12),
        stone, 0.018
    )

    cube(
        prefix + " | Crown top",
        (x, 0.015, 2.25),
        (0.45, 0.40, 0.045),
        black, 0.008
    )

    # Золотые накладки на лицевой стороне колонны
    yy = -0.165

    cube(
        prefix + " | Gold plaque",
        (x, yy, 1.18),
        (0.15, 0.018, 1.25),
        black, 0.018
    )

    ring(
        prefix + " | Plaque outline",
        x, 1.18, 0.075, 0.58, yy - 0.012,
        0.009, gold
    )

    # Вертикальный золотой мотив
    tube_path(
        prefix + " | Gold ornament",
        [
            (x, yy - 0.025, 0.70),
            (x - 0.055, yy - 0.025, 0.90),
            (x, yy - 0.025, 1.05),
            (x + 0.055, yy - 0.025, 1.20),
            (x, yy - 0.025, 1.38),
            (x - 0.05, yy - 0.025, 1.53),
            (x, yy - 0.025, 1.70),
        ],
        0.012, gold_light
    )

    sphere(
        prefix + " | Ornament jewel",
        (x, yy - 0.035, 1.18),
        0.038, gold
    )

    # Высокие золотые шпили на колоннах
    finial(prefix + " | Grand finial", x, 2.28, 0.52, gold)

# =========================================================
# ОСНОВНАЯ РАМА
# =========================================================

left = -W / 2
right = W / 2

# Верхняя и нижняя балки
bar_x("Frame | Upper rail", left, right, 1.93, 0, 0.055, black)
bar_x("Frame | Lower rail", left, right, 0.38, 0, 0.060, black)

# Тонкие золотые линии на балках
bar_x("Gold | Upper inlay", left, right, 1.965, -0.055, 0.009, gold)
bar_x("Gold | Lower inlay", left, right, 0.415, -0.060, 0.008, gold)

# Боковые части рамы
for x in [left, right]:
    bar_z("Frame | Side rail", x, 0.35, 1.96, 0, 0.055, black)

# =========================================================
# ВЕРТИКАЛЬНЫЕ ПРУТЬЯ И ЗОЛОТЫЕ НАКЛАДКИ
# =========================================================

N = 17
xs = [
    left + 0.13 + i * ((W - 0.26) / (N - 1))
    for i in range(N)
]

for i, x in enumerate(xs):
    # Не ставим обычный прут точно в центр герба:
    # там располагается отдельная декоративная композиция.
    bar_z(
        f"Baluster {i + 1:02d} | Black iron",
        x, 0.43, 1.89, 0, 0.018, black
    )

    # Золотые манжеты на прутьях
    for z in [0.53, 0.82, 1.53, 1.82]:
        cylinder_between(
            f"Baluster {i + 1:02d} | Gold collar",
            (x, 0, z - 0.018),
            (x, 0, z + 0.018),
            0.027, gold, 12
        )

    # Золотая пика
    finial(
        f"Baluster {i + 1:02d} | Spear",
        x, 1.94, 0.27, gold
    )

    # Декоративный нижний шарик
    sphere(
        f"Baluster {i + 1:02d} | Base bead",
        (x, -0.01, 0.46),
        0.028, gold
    )

# =========================================================
# ВЕРХНИЙ БАРОЧНЫЙ ФРИЗ
# =========================================================

# Основа орнаментальной полосы
bar_x("Frieze | Lower edge", left + 0.04, right - 0.04,
      1.59, -0.045, 0.022, gold)

bar_x("Frieze | Upper edge", left + 0.04, right - 0.04,
      1.87, -0.045, 0.025, black)

# Повторяющиеся зеркальные завитки и розетки
frieze_count = 9
for i in range(frieze_count):
    x = left + 0.24 + i * ((W - 0.48) / (frieze_count - 1))

    ring(
        f"Frieze {i} | Rosette",
        x, 1.73, 0.052, 0.052, -0.085,
        0.010, gold
    )

    sphere(
        f"Frieze {i} | Rosette center",
        (x, -0.10, 1.73),
        0.022, gold_light
    )

    # Завитки по обе стороны розетки
    spiral(
        f"Frieze {i} | Left scroll",
        x - 0.09, 1.72, 0.085, 0.75, -1,
        -0.075, 0.010, black
    )

    spiral(
        f"Frieze {i} | Right scroll",
        x + 0.09, 1.72, 0.085, 0.75, 1,
        -0.075, 0.010, black
    )

# =========================================================
# НИЖНИЙ ОРНАМЕНТАЛЬНЫЙ ПОЯС
# =========================================================

bar_x("Bottom ornament | Top rail",
      left + 0.04, right - 0.04, 0.57, -0.04, 0.025, black)

bar_x("Bottom ornament | Gold rail",
      left + 0.04, right - 0.04, 0.32, -0.04, 0.010, gold)

for i in range(9):
    x = left + 0.24 + i * ((W - 0.48) / 8)

    spiral(
        f"Lower scroll {i} | A",
        x - 0.07, 0.43, 0.095, 0.8, -1,
        -0.08, 0.012, black
    )

    spiral(
        f"Lower scroll {i} | B",
        x + 0.07, 0.43, 0.095, 0.8, 1,
        -0.08, 0.012, black
    )

    ring(
        f"Lower scroll {i} | Gold rosette",
        x, 0.43, 0.028, 0.028, -0.105,
        0.009, gold
    )

# =========================================================
# ЦЕНТРАЛЬНЫЙ ГЕРБ
# =========================================================

cx = 0.0
cy = -0.12
cz = 1.05

# Большая овальная рамка
ring(
    "Royal Crest | Outer oval",
    cx, cz, 0.39, 0.47, cy,
    0.028, gold, 96
)

ring(
    "Royal Crest | Inner oval",
    cx, cz, 0.34, 0.42, cy - 0.008,
    0.010, black, 96
)

# Центральная розетка
sphere(
    "Royal Crest | Central jewel",
    (cx, cy - 0.025, cz),
    0.075, gold_light
)

ring(
    "Royal Crest | Jewel ring",
    cx, cz, 0.095, 0.095, cy - 0.02,
    0.012, gold
)

# Вертикальная ось герба
bar_z(
    "Royal Crest | Central stem",
    cx, 0.53, 1.67, cy - 0.015,
    0.018, gold
)

# Симметричные завитки вокруг герба
for side in [-1, 1]:
    spiral(
        f"Royal Crest | Upper scroll {side}",
        side * 0.13, 1.28, 0.19, 1.0, side,
        cy - 0.015, 0.018, black
    )

    spiral(
        f"Royal Crest | Lower scroll {side}",
        side * 0.16, 0.82, 0.19, 1.0, -side,
        cy - 0.02, 0.020, black
    )

    leaf(
        f"Royal Crest | Gold leaf {side}",
        side * 0.17, 1.13, 0.24,
        cy - 0.035, gold_light, side
    )

    leaf(
        f"Royal Crest | Lower gold leaf {side}",
        side * 0.17, 0.76, 0.22,
        cy - 0.035, gold, -side
    )

# Верхняя корона герба
finial(
    "Royal Crest | Crown spear",
    0, 1.62, 0.38, gold
)

# Нижний золотой акцент
sphere(
    "Royal Crest | Lower jewel",
    (0, cy - 0.04, 0.59),
    0.045, gold_light
)

# =========================================================
# КРУПНЫЕ НИЖНИЕ ЗАВИТКИ
# =========================================================

for side in [-1, 1]:
    # Большая наружная спираль
    spiral(
        f"Grand scroll | Outer {side}",
        side * 0.73, 0.76, 0.37, 1.15, side,
        -0.085, 0.026, black
    )

    # Золотая линия вдоль орнамента
    spiral(
        f"Grand scroll | Gold accent {side}",
        side * 0.73, 0.76, 0.32, 1.15, side,
        -0.115, 0.009, gold
    )

    # Переход к центральному гербу
    tube_path(
        f"Grand scroll | Connecting stem {side}",
        [
            (side * 0.15, -0.08, 0.57),
            (side * 0.28, -0.08, 0.67),
            (side * 0.43, -0.08, 0.78),
            (side * 0.60, -0.08, 0.85),
            (side * 0.78, -0.08, 0.82),
        ],
        0.024, black
    )

    leaf(
        f"Grand scroll | Leaf {side}",
        side * 0.50, 0.91, 0.30,
        -0.12, gold_light, side
    )

# =========================================================
# ЗОЛОТЫЕ ДЕКОРАТИВНЫЕ НАКЛАДКИ НА КОЛОННАХ
# =========================================================

for x in pillar_x:
    # Небольшие золотые розетки на капителях
    for dx in [-0.11, 0.11]:
        sphere(
            "Pillar | Capital gold stud",
            (x + dx, -0.21, 2.18),
            0.025, gold
        )

# =========================================================
# ОРГАНИЗАЦИЯ ОБЪЕКТОВ
# =========================================================

# Все детали остаются отдельными объектами для удобного редактирования.
# Можно выделить их все и экспортировать как одну модель.

bpy.ops.object.select_all(action='DESELECT')

# Устанавливаем единицы сцены в метры
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

screen = bpy.context.screen

if screen is not None:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 6.8
            area.spaces.active.region_3d.view_location = (0, 0, 1.25)

# Выделяем всю модель
bpy.ops.object.select_all(action='SELECT')

# Сохраняем Blender-проект
blend_path = bpy.path.abspath("//Grand_Imperial_Fence.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# Экспорт GLB
if EXPORT_GLB:
    bpy.ops.export_scene.gltf(
        filepath=EXPORT_PATH,
        export_format='GLB',
        use_selection=True,
        export_apply=True
    )

print("======================================")
print("GRAND IMPERIAL FENCE CREATED")
print("BLEND:", blend_path)
print("GLB:", EXPORT_PATH)
print("======================================")
