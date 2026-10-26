import bpy
import math
from mathutils import Vector

W = 1.0
H = 1.0

FRAME_R = 0.016
INNER_R = 0.0045
BAR_R = 0.0075
SCROLL_R = 0.0055

WHEEL_R = 0.135
ROSE_R = 0.105

CENTER_Z = H * 0.5
ROSE_TOP_Z = CENTER_Z + 0.315
ROSE_BOTTOM_Z = CENTER_Z - 0.315
ROSE_SIDE_X = 0.335
ROSE_TOP_X = 0.21

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0


def make_metal(name, color, rough=0.38, metal=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    return mat


iron = make_metal("Кованое железо", (0.028, 0.030, 0.034), 0.42, 1.0)
iron_light = make_metal("Кованое железо светлое", (0.075, 0.078, 0.085), 0.34, 1.0)


def add_tube(name, points, radius, material, closed=False):
    curve = bpy.data.curves.new(name + "_curve", 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.use_fill_caps = True

    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1.0)
    spline.use_cyclic_u = closed

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_bar(name, p1, p2, radius, material):
    return add_tube(name, [p1, p2], radius, material)


def add_ring(name, cx, cz, radius, tube, material, y=0.0, segments=48):
    points = []
    for i in range(segments):
        angle = math.tau * i / segments
        points.append((cx + radius * math.cos(angle), y, cz + radius * math.sin(angle)))
    return add_tube(name, points, tube, material, closed=True)


def add_spiral(name, cx, cz, r_start, r_end, turns, tube, material,
               y=0.0, phase=0.0, clockwise=False, segments_per_turn=48):
    segments = max(16, int(turns * segments_per_turn))
    direction = -1.0 if clockwise else 1.0
    points = []
    for i in range(segments + 1):
        t = i / segments
        angle = phase + direction * math.tau * turns * t
        radius = r_start + (r_end - r_start) * t
        points.append((cx + radius * math.cos(angle), y, cz + radius * math.sin(angle)))
    return add_tube(name, points, tube, material)


def add_sphere(name, center, radius, material, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        location=center,
        segments=segments,
        ring_count=rings
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def add_rose(name, cx, cz, radius, clockwise=False):
    add_ring(name + "_обод", cx, cz, radius, SCROLL_R, iron)
    add_spiral(
        name + "_спираль", cx, cz,
        radius * 0.10, radius * 0.86,
        3.0, SCROLL_R * 0.92, iron,
        phase=math.radians(90), clockwise=clockwise
    )
    add_sphere(name + "_центр", (cx, 0.0, cz), radius * 0.075, iron_light, 12, 8)


def add_volute(name, cx, cz, radius, start, end, tube, material,
               y=0.0, clockwise=False):
    direction = -1.0 if clockwise else 1.0
    segments = max(12, int(abs(end - start) * 10))
    points = []
    for i in range(segments + 1):
        t = i / segments
        angle = start + direction * (end - start) * t
        r = radius * (1.0 - 0.72 * t)
        points.append((cx + r * math.cos(angle), y, cz + r * math.sin(angle)))
    return add_tube(name, points, tube, material)


frame_x = W * 0.5 - FRAME_R
frame_z0 = FRAME_R
frame_z1 = H - FRAME_R

add_bar("Рамка_низ", (-frame_x, 0, frame_z0), (frame_x, 0, frame_z0), FRAME_R, iron)
add_bar("Рамка_верх", (-frame_x, 0, frame_z1), (frame_x, 0, frame_z1), FRAME_R, iron)
add_bar("Рамка_лево", (-frame_x, 0, frame_z0), (-frame_x, 0, frame_z1), FRAME_R, iron)
add_bar("Рамка_право", (frame_x, 0, frame_z0), (frame_x, 0, frame_z1), FRAME_R, iron)

for index, (cx, cz) in enumerate([
    (-frame_x, frame_z0),
    (frame_x, frame_z0),
    (-frame_x, frame_z1),
    (frame_x, frame_z1),
]):
    add_sphere("Угол_рамки_" + str(index), (cx, 0, cz), FRAME_R, iron)

inner_x = W * 0.5 - 0.046
inner_z0 = 0.046
inner_z1 = H - 0.046

add_bar("Внутренняя_рамка_низ", (-inner_x, 0, inner_z0), (inner_x, 0, inner_z0), INNER_R, iron)
add_bar("Внутренняя_рамка_верх", (-inner_x, 0, inner_z1), (inner_x, 0, inner_z1), INNER_R, iron)
add_bar("Внутренняя_рамка_лево", (-inner_x, 0, inner_z0), (-inner_x, 0, inner_z1), INNER_R, iron)
add_bar("Внутренняя_рамка_право", (inner_x, 0, inner_z0), (inner_x, 0, inner_z1), INNER_R, iron)

for index, (cx, cz) in enumerate([
    (-inner_x, inner_z0),
    (inner_x, inner_z0),
    (-inner_x, inner_z1),
    (inner_x, inner_z1),
]):
    add_sphere("Угол_внутренней_" + str(index), (cx, 0, cz), INNER_R, iron)

for index, (outer, inner) in enumerate([
    ((-frame_x, frame_z0), (-inner_x, inner_z0)),
    ((frame_x, frame_z0), (inner_x, inner_z0)),
    ((-frame_x, frame_z1), (-inner_x, inner_z1)),
    ((frame_x, frame_z1), (inner_x, inner_z1)),
]):
    add_bar(
        "Связь_рамок_" + str(index),
        (outer[0], 0, outer[1]), (inner[0], 0, inner[1]),
        INNER_R * 0.95, iron
    )

rose_centers = [
    (-ROSE_TOP_X, ROSE_TOP_Z),
    (ROSE_TOP_X, ROSE_TOP_Z),
    (-ROSE_SIDE_X, CENTER_Z),
    (ROSE_SIDE_X, CENTER_Z),
    (-ROSE_TOP_X, ROSE_BOTTOM_Z),
    (ROSE_TOP_X, ROSE_BOTTOM_Z),
]

for index, (cx, cz) in enumerate(rose_centers):
    add_rose("Роза_" + str(index), cx, cz, ROSE_R, clockwise=cx < 0)

lattice_pairs = [
    (rose_centers[0], rose_centers[5]),
    (rose_centers[1], rose_centers[4]),
    (rose_centers[2], rose_centers[3]),
]

for index, (a, b) in enumerate(lattice_pairs):
    pa = Vector((a[0], 0, a[1]))
    pb = Vector((b[0], 0, b[1]))
    direction = (pb - pa).normalized()
    distance = (pb - pa).length
    half = distance * 0.5
    start_a = pa + direction * ROSE_R
    end_a = pa + direction * (half - WHEEL_R)
    start_b = pb - direction * (half - WHEEL_R)
    end_b = pb - direction * ROSE_R
    add_bar("Луч_" + str(index) + "_a", tuple(start_a), tuple(end_a), BAR_R, iron)
    add_bar("Луч_" + str(index) + "_b", tuple(start_b), tuple(end_b), BAR_R, iron)

hexagon_order = [0, 2, 4, 5, 3, 1]
for index in range(6):
    a = rose_centers[hexagon_order[index]]
    b = rose_centers[hexagon_order[(index + 1) % 6]]
    pa = Vector((a[0], 0, a[1]))
    pb = Vector((b[0], 0, b[1]))
    direction = (pb - pa).normalized()
    add_bar(
        "Шестигранник_" + str(index),
        tuple(pa + direction * ROSE_R),
        tuple(pb - direction * ROSE_R),
        BAR_R * 0.88, iron
    )

for index, (cx, cz) in enumerate(rose_centers):
    if abs(cx) < 0.3:
        if cz > CENTER_Z:
            p1 = (cx, 0, cz + ROSE_R)
            p2 = (cx, 0, inner_z1)
        else:
            p1 = (cx, 0, cz - ROSE_R)
            p2 = (cx, 0, inner_z0)
    else:
        p1 = (cx + math.copysign(ROSE_R, cx), 0, cz)
        p2 = (math.copysign(inner_x, cx), 0, cz)
    add_bar("Связь_розы_" + str(index), p1, p2, INNER_R * 0.95, iron)

add_ring("Колесо_обод", 0.0, CENTER_Z, WHEEL_R, BAR_R * 1.15, iron)
add_ring("Колесо_внутренний_обод", 0.0, CENTER_Z, 0.046, BAR_R * 0.82, iron)

for index in range(8):
    angle = math.tau * index / 8
    p1 = (0.046 * math.cos(angle), 0, CENTER_Z + 0.046 * math.sin(angle))
    p2 = (WHEEL_R * math.cos(angle), 0, CENTER_Z + WHEEL_R * math.sin(angle))
    add_bar("Спица_" + str(index), p1, p2, BAR_R * 0.78, iron)

for index in range(8):
    angle = math.tau * index / 8
    add_sphere(
        "Заклёпка_" + str(index),
        (0.092 * math.cos(angle), 0, CENTER_Z + 0.092 * math.sin(angle)),
        0.0105, iron_light, 12, 8
    )

add_sphere("Ступица", (0.0, 0.0, CENTER_Z), 0.021, iron_light, 20, 12)

corner_volutes = [
    (-0.408, 0.890, math.radians(180), math.radians(-120), True),
    (0.408, 0.890, math.radians(0), math.radians(300), False),
    (-0.408, 0.110, math.radians(180), math.radians(480), False),
    (0.408, 0.110, math.radians(0), math.radians(-300), True),
]

for index, (cx, cz, start, end, clockwise) in enumerate(corner_volutes):
    add_volute(
        "Угловой_завиток_" + str(index),
        cx, cz, 0.047, start, end, SCROLL_R * 0.9, iron,
        clockwise=clockwise
    )

add_spiral(
    "Верхний_бутон", 0.0, 0.918,
    0.010, 0.032, 1.7, SCROLL_R * 0.85, iron,
    phase=math.radians(-90), clockwise=True
)
add_spiral(
    "Нижний_бутон", 0.0, 0.082,
    0.010, 0.032, 1.7, SCROLL_R * 0.85, iron,
    phase=math.radians(90), clockwise=False
)

for obj in list(bpy.context.scene.objects):
    if obj.type == 'CURVE':
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shade_smooth()
        obj.select_set(False)

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH'][0]
bpy.ops.object.join()

panel = bpy.context.active_object
panel.name = "Fence_Panel"
panel.data.name = "Fence_Panel"
panel.location = (0.0, 0.0, 0.0)
panel.rotation_euler = (0.0, 0.0, 0.0)
panel.scale = (1.0, 1.0, 1.0)

bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.000001)
bpy.ops.mesh.fill_holes(sides=0)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

panel.data.validate(verbose=False)
panel.data.update()

blend_path = bpy.path.abspath("//Fence_Panel.blend")
glb_path = bpy.path.abspath("//Fence_Panel.glb")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)

bpy.ops.object.select_all(action='DESELECT')
panel.select_set(True)
bpy.context.view_layer.objects.active = panel

bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True
)

print("Готово:")
print(blend_path)
print(glb_path)
print("Габариты панели:", tuple(round(v, 4) for v in panel.dimensions))
