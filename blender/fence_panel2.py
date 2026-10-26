
import bpy
import math
from mathutils import Vector

# ============================================================
# REALISTIC WROUGHT IRON FENCE
# Blender 5.1+
# Units: meters
# ============================================================

W = 1.60
H = 1.80
DEPTH = 0.045

FRAME_R = 0.020
BAR_R = 0.008
ORNAMENT_R = 0.0065
ACCENT_R = 0.004

EXPORT_GLB = True
JOIN_FOR_EXPORT = True

# Main structural positions
X_FRAME = W / 2 - FRAME_R
Z_BOTTOM = FRAME_R
Z_TOP = H - FRAME_R

Y_FRAME = 0.0
Y_ORNAMENT = -0.012
Y_FRONT = -DEPTH / 2

# ------------------------------------------------------------
# Clear scene
# ------------------------------------------------------------

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

# ------------------------------------------------------------
# Materials
# ------------------------------------------------------------

def make_metal(name, color, metallic=0.82, roughness=0.30):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness

    return mat


iron = make_metal(
    "Metal | Light Blue Metallic",
    (0.18, 0.55, 0.85),  # светло-голубой
    0.85,                # металлический блеск
    0.24                 # гладкость поверхности
)

iron_detail = make_metal(
    "Metal | Blue Highlights",
    (0.38, 0.72, 0.95),  # голубые акценты
    0.8,
    0.22
)

# ------------------------------------------------------------
# Geometry
# ------------------------------------------------------------

def add_tube(name, points, radius, material, closed=False):
    if len(points) < 2:
        return None

    curve = bpy.data.curves.new(name + "_Curve", 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    curve.use_fill_caps = True

    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)

    for p, co in zip(spline.points, points):
        p.co = (co[0], co[1], co[2], 1)

    spline.use_cyclic_u = closed

    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)

    return obj


def add_bar(name, a, b, radius=BAR_R, material=iron):
    return add_tube(name, [a, b], radius, material)


def add_ring(name, cx, cz, radius, tube, material,
             y=Y_ORNAMENT, segments=64):
    points = []

    for i in range(segments):
        a = math.tau * i / segments
        points.append((
            cx + radius * math.cos(a),
            y,
            cz + radius * math.sin(a)
        ))

    return add_tube(name, points, tube, material, True)


def add_bezier(name, p0, p1, p2, p3,
               radius=ORNAMENT_R, material=iron,
               y=Y_ORNAMENT, segments=40):
    points = []

    for i in range(segments + 1):
        t = i / segments
        u = 1 - t

        x = (
            u**3 * p0[0]
            + 3 * u**2 * t * p1[0]
            + 3 * u * t**2 * p2[0]
            + t**3 * p3[0]
        )

        z = (
            u**3 * p0[1]
            + 3 * u**2 * t * p1[1]
            + 3 * u * t**2 * p2[1]
            + t**3 * p3[1]
        )

        points.append((x, y, z))

    return add_tube(name, points, radius, material)


def add_volute(name, cx, cz, r_outer,
               turns=1.0, direction=1,
               radius=ORNAMENT_R, material=iron,
               y=Y_ORNAMENT):
    # A tapered scroll. Its outer end starts at the weld point.
    points = []
    segments = 72

    for i in range(segments + 1):
        t = i / segments
        angle = direction * math.tau * turns * t
        r = r_outer * (1.0 - 0.78 * t)

        points.append((
            cx + r * math.cos(angle),
            y,
            cz + r * math.sin(angle)
        ))

    return add_tube(name, points, radius, material)


def add_sphere(name, location, radius, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16,
        ring_count=10,
        radius=radius,
        location=location
    )

    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)

    for poly in obj.data.polygons:
        poly.use_smooth = True

    return obj


def add_spike(name, x, z):
    # Forged spearhead with a short square-like base.
    bpy.ops.mesh.primitive_cone_add(
        vertices=8,
        radius1=0.018,
        radius2=0.0,
        depth=0.075,
        location=(x, Y_FRAME, z)
    )

    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(iron_detail)

    return obj


# ------------------------------------------------------------
# Outer frame
# ------------------------------------------------------------

add_bar(
    "Frame | bottom",
    (-X_FRAME, Y_FRAME, Z_BOTTOM),
    (X_FRAME, Y_FRAME, Z_BOTTOM),
    FRAME_R
)

add_bar(
    "Frame | top",
    (-X_FRAME, Y_FRAME, Z_TOP),
    (X_FRAME, Y_FRAME, Z_TOP),
    FRAME_R
)

add_bar(
    "Frame | left",
    (-X_FRAME, Y_FRAME, Z_BOTTOM),
    (-X_FRAME, Y_FRAME, Z_TOP),
    FRAME_R
)

add_bar(
    "Frame | right",
    (X_FRAME, Y_FRAME, Z_BOTTOM),
    (X_FRAME, Y_FRAME, Z_TOP),
    FRAME_R
)

# Corner joints
for x in (-X_FRAME, X_FRAME):
    for z in (Z_BOTTOM, Z_TOP):
        add_sphere(
            "Frame | corner joint",
            (x, Y_FRAME, z),
            FRAME_R * 1.02,
            iron
        )

# ------------------------------------------------------------
# Vertical bars
# ------------------------------------------------------------

X_INNER = W / 2 - 0.055
Z_INNER_BOTTOM = 0.055
Z_INNER_TOP = H - 0.055

PICKET_COUNT = 9

picket_xs = [
    -X_INNER + 2 * X_INNER * i / (PICKET_COUNT - 1)
    for i in range(PICKET_COUNT)
]

for i, x in enumerate(picket_xs):
    # Leave room for decorative spearhead.
    add_bar(
        "Picket %02d" % i,
        (x, Y_FRAME, Z_INNER_BOTTOM),
        (x, Y_FRAME, H - 0.125),
        BAR_R,
        iron
    )

    add_spike(
        "Picket spear %02d" % i,
        x,
        H - 0.085
    )

    # Collars at top and bottom, behind the ornament.
    for z in (0.16, H - 0.18):
        add_ring(
            "Picket collar %02d" % i,
            x, z, 0.012,
            0.0035, iron_detail,
            y=Y_FRAME - 0.004,
            segments=24
        )

# ------------------------------------------------------------
# Inner decorative border
# ------------------------------------------------------------

IX = W / 2 - 0.075
IZ0 = 0.10
IZ1 = H - 0.10

add_bar(
    "Inner border | bottom",
    (-IX, Y_ORNAMENT, IZ0),
    (IX, Y_ORNAMENT, IZ0),
    ACCENT_R, iron_detail
)

add_bar(
    "Inner border | top",
    (-IX, Y_ORNAMENT, IZ1),
    (IX, Y_ORNAMENT, IZ1),
    ACCENT_R, iron_detail
)

# ------------------------------------------------------------
# Central motif
# ------------------------------------------------------------

CZ = H / 2
WHEEL_R = 0.205

# Central ring
add_ring(
    "Central medallion",
    0, CZ, WHEEL_R,
    BAR_R, iron_detail,
    y=Y_ORNAMENT
)

# Hub
add_sphere(
    "Central hub",
    (0, Y_ORNAMENT - 0.004, CZ),
    0.025,
    iron_detail
)

# Eight spokes
for i in range(8):
    a = math.tau * i / 8

    add_bar(
        "Medallion spoke %02d" % i,
        (
            0.028 * math.cos(a),
            Y_ORNAMENT - 0.003,
            CZ + 0.028 * math.sin(a)
        ),
        (
            (WHEEL_R - 0.008) * math.cos(a),
            Y_ORNAMENT - 0.003,
            CZ + (WHEEL_R - 0.008) * math.sin(a)
        ),
        BAR_R * 0.65,
        iron
    )

# ------------------------------------------------------------
# Two large side scrolls
# Each scroll occupies its own half of the panel.
# The inner ends meet the central medallion area.
# ------------------------------------------------------------

for side in (-1, 1):
    # Main S-curve: from the center region towards the side frame.
    add_bezier(
        "Main side scroll %s" % side,
        (side * 0.18, CZ + 0.04),
        (side * 0.34, CZ + 0.22),
        (side * 0.54, CZ + 0.20),
        (side * 0.67, CZ + 0.02),
        ORNAMENT_R,
        iron
    )

    add_bezier(
        "Lower return scroll %s" % side,
        (side * 0.67, CZ + 0.02),
        (side * 0.59, CZ - 0.17),
        (side * 0.35, CZ - 0.22),
        (side * 0.18, CZ - 0.04),
        ORNAMENT_R,
        iron
    )

    # Side curls: their outer ends approach the inner border.
    add_volute(
        "Side curl upper %s" % side,
        side * 0.56,
        CZ + 0.23,
        0.095,
        turns=0.85,
        direction=-side,
        radius=ORNAMENT_R
    )

    add_volute(
        "Side curl lower %s" % side,
        side * 0.56,
        CZ - 0.23,
        0.095,
        turns=0.85,
        direction=side,
        radius=ORNAMENT_R
    )

# ------------------------------------------------------------
# Upper and lower ornaments
# Keep these simple enough to manufacture.
# ------------------------------------------------------------

for side in (-1, 1):
    x = side * 0.22

    # Upper leaf-like arc
    add_bezier(
        "Upper ornament %s" % side,
        (x, H - 0.23),
        (side * 0.30, H - 0.13),
        (side * 0.48, H - 0.13),
        (side * 0.57, H - 0.23),
        ORNAMENT_R,
        iron
    )

    # Lower matching arc
    add_bezier(
        "Lower ornament %s" % side,
        (x, 0.23),
        (side * 0.30, 0.13),
        (side * 0.48, 0.13),
        (side * 0.57, 0.23),
        ORNAMENT_R,
        iron
    )

# Short attachment bars between ornament and inner border.
for side in (-1, 1):
    for z in (0.23, H - 0.23):
        add_bar(
            "Ornament attachment",
            (side * 0.57, Y_ORNAMENT, z),
            (side * 0.69, Y_ORNAMENT, z),
            ACCENT_R,
            iron_detail
        )

# ------------------------------------------------------------
# Convert curves to meshes
# ------------------------------------------------------------

for obj in list(scene.objects):
    if obj.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

# ------------------------------------------------------------
# Normals and smoothing
# ------------------------------------------------------------

for obj in [o for o in scene.objects if o.type == 'MESH']:
    for poly in obj.data.polygons:
        poly.use_smooth = True

# ------------------------------------------------------------
# Organize editable objects
# ------------------------------------------------------------

collection = bpy.data.collections.new("Fence | Editable Parts")
scene.collection.children.link(collection)

for obj in list(scene.objects):
    if collection not in obj.users_collection:
        collection.objects.link(obj)

    for coll in list(obj.users_collection):
        if coll != collection:
            coll.objects.unlink(obj)

# ------------------------------------------------------------
# Save editable project
# ------------------------------------------------------------

blend_path = bpy.path.abspath("//Fence_Panel.blend")
glb_path = bpy.path.abspath("//Fence_Panel.glb")

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# ------------------------------------------------------------
# GLB export
# Duplicate source meshes before joining, so the editable scene
# remains unchanged.
# ------------------------------------------------------------

if EXPORT_GLB:
    source_meshes = [
        obj for obj in scene.objects
        if obj.type == 'MESH'
    ]

    export_collection = bpy.data.collections.new(
        "Temporary GLB Export"
    )
    scene.collection.children.link(export_collection)

    duplicates = []

    for src in source_meshes:
        dup = src.copy()
        dup.data = src.data.copy()
        dup.name = "EXPORT_" + src.name
        export_collection.objects.link(dup)
        duplicates.append(dup)

    bpy.ops.object.select_all(action='DESELECT')

    if duplicates:
        if JOIN_FOR_EXPORT:
            for obj in duplicates:
                obj.select_set(True)

            bpy.context.view_layer.objects.active = duplicates[0]
            bpy.ops.object.join()

            joined = bpy.context.object
            joined.name = "Fence_Panel"

            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                use_selection=True,
                export_apply=True
            )

            bpy.data.objects.remove(joined, do_unlink=True)

        else:
            for obj in duplicates:
                obj.select_set(True)

            bpy.context.view_layer.objects.active = duplicates[0]

            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                use_selection=True,
                export_apply=True
            )

    bpy.data.collections.remove(export_collection)

print("Fence generated.")
print("BLEND:", blend_path)
if EXPORT_GLB:
    print("GLB:", glb_path)
print("Dimensions:", (W, DEPTH, H))
