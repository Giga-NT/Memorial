#!/usr/bin/env python3
"""
Giga-NT — генератор параметрических 3D-интерпретаций каталога фигурных стел.

Blender 4.x/5.x:
  blender --background --python tools/generate_steles.py

Результат:
  models/generated/F10.glb ... F36.glb
  models/generated/models-list.generated.json

Каждая GLB содержит отдельные объекты: стела, верхняя/нижняя база,
декоративная лицевая вставка. Исходный models/models-list.json не меняется.

ВАЖНО: формы являются объёмными интерпретациями одного фронтального
каталожного изображения, а не точными заводскими чертежами.
"""

import bpy
import bmesh
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "models" / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Единицы — метры. Модель ориентирована лицом в сторону -Y.
STONE_COLOR = (0.12, 0.13, 0.14, 1.0)
ACCENT_COLOR = (0.055, 0.06, 0.065, 1.0)
POLISH_COLOR = (0.23, 0.24, 0.25, 1.0)
BODY_DEPTH = 0.105
EDGE_BEVEL = 0.009
SAMPLES = 12


def material(name, color, roughness=0.27, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Не удаляем материалы: они переиспользуются между моделями.
    for datablocks in (bpy.data.meshes, bpy.data.curves):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def smooth_profile(points, steps=SAMPLES):
    """Catmull-Rom interpolation for smooth sculpted outline transitions."""
    if len(points) < 4:
        return points[:]
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1:i + 3]
        for j in range(steps):
            t = j / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t +
                       (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 +
                       (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            z = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t +
                       (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 +
                       (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x, z))
    out.append(points[-1])
    return out


def outline(kind, w, h):
    """Distinct front silhouettes. All profiles are closed at the bottom."""
    a = w / 2
    # Points are ordered from lower-left, up the left edge, over the crown,
    # down the right edge, then closed by the bottom edge.
    shapes = {
        "classic_arch": [(-a,0),(-a,h*.76),(-a*.88,h*.86),(-a*.62,h*.96),(0,h),(a*.62,h*.96),(a*.88,h*.86),(a,h*.76),(a,0)],
        "shoulder": [(-a,0),(-a,h*.78),(-a*.94,h*.84),(-a*.72,h*.88),(-a*.58,h*.98),(0,h),(a*.58,h*.98),(a*.72,h*.88),(a*.94,h*.84),(a,h*.78),(a,0)],
        "crown": [(-a,0),(-a,h*.72),(-a*.88,h*.72),(-a*.88,h*.82),(-a*.58,h*.82),(-a*.58,h*.94),(0,h),(a*.58,h*.94),(a*.58,h*.82),(a*.88,h*.82),(a*.88,h*.72),(a,h*.72),(a,0)],
        "wave": [(-a,0),(-a,h*.70),(-a*.86,h*.79),(-a*.65,h*.76),(-a*.38,h*.88),(0,h*.91),(a*.35,h),(a*.66,h*.93),(a*.88,h*.82),(a,h*.76),(a,0)],
        "ogee": [(-a,0),(-a,h*.70),(-a*.92,h*.82),(-a*.68,h*.86),(-a*.60,h*.96),(-a*.34,h),(0,h*.91),(a*.34,h),(a*.60,h*.96),(a*.68,h*.86),(a*.92,h*.82),(a,h*.70),(a,0)],
        "slant_left": [(-a,0),(-a,h*.70),(-a*.88,h*.84),(-a*.55,h*.90),(-a*.20,h*.98),(a*.18,h),(a*.60,h*.94),(a,h*.82),(a,0)],
        "slant_right": [(-a,0),(-a,h*.82),(-a*.60,h*.94),(-a*.18,h),(a*.20,h*.98),(a*.55,h*.90),(a*.88,h*.84),(a,h*.70),(a,0)],
        "double_wave": [(-a,0),(-a,h*.70),(-a*.85,h*.78),(-a*.62,h*.73),(-a*.35,h*.87),(0,h*.82),(a*.35,h*.87),(a*.62,h*.73),(a*.85,h*.78),(a,h*.70),(a,0)],
        "round": [(-a,0),(-a,h*.72),(-a*.95,h*.86),(-a*.78,h*.96),(-a*.48,h),(a*.48,h),(a*.78,h*.96),(a*.95,h*.86),(a,h*.72),(a,0)],
        "gable": [(-a,0),(-a,h*.76),(-a*.72,h*.76),(0,h),(a*.72,h*.76),(a,h*.76),(a,0)],
        "flared": [(-a,0),(-a,h*.72),(-a*.78,h*.82),(-a*.50,h*.88),(-a*.35,h*.98),(0,h),(a*.35,h*.98),(a*.50,h*.88),(a*.78,h*.82),(a,h*.72),(a,0)],
        "notched": [(-a,0),(-a,h*.76),(-a*.78,h*.84),(-a*.55,h*.84),(-a*.55,h*.95),(0,h),(a*.55,h*.95),(a*.55,h*.84),(a*.78,h*.84),(a,h*.76),(a,0)],
        "wing": [(-a,0),(-a,h*.72),(-a*.95,h*.86),(-a*.68,h*.84),(-a*.42,h*.94),(0,h),(a*.42,h*.94),(a*.68,h*.84),(a*.95,h*.86),(a,h*.72),(a,0)],
        "soft_shoulder": [(-a,0),(-a,h*.74),(-a*.94,h*.82),(-a*.82,h*.91),(-a*.55,h*.96),(0,h),(a*.55,h*.96),(a*.82,h*.91),(a*.94,h*.82),(a,h*.74),(a,0)],
        "offset_crown": [(-a,0),(-a,h*.72),(-a*.88,h*.82),(-a*.60,h*.91),(-a*.24,h*.96),(a*.18,h*.88),(a*.48,h*.96),(a*.78,h),(a,h*.90),(a,h*.72),(a,0)],
        "scroll": [(-a,0),(-a,h*.72),(-a*.92,h*.83),(-a*.72,h*.92),(-a*.48,h*.90),(-a*.42,h*.98),(0,h),(a*.42,h*.98),(a*.48,h*.90),(a*.72,h*.92),(a*.92,h*.83),(a,h*.72),(a,0)],
        "baroque": [(-a,0),(-a,h*.70),(-a*.90,h*.78),(-a*.78,h*.88),(-a*.58,h*.86),(-a*.48,h*.96),(-a*.22,h*.93),(0,h),(a*.22,h*.93),(a*.48,h*.96),(a*.58,h*.86),(a*.78,h*.88),(a*.90,h*.78),(a,h*.70),(a,0)],
        "asymmetric": [(-a,0),(-a,h*.72),(-a*.92,h*.83),(-a*.65,h*.94),(-a*.25,h),(a*.20,h*.97),(a*.56,h*.88),(a*.86,h*.82),(a,h*.70),(a,0)],
    }
    raw = shapes[kind]
    # Smooth only profiles without deliberate rectangular notches.
    if kind in ("crown", "notched", "gable"):
        return raw
    # Keep bottom corners crisp; interpolate upper outline only.
    upper = smooth_profile(raw[1:-1], 5)
    return [raw[0]] + upper + [raw[-1]]


def extruded_polygon(name, points, depth, z_offset, mat, bevel=EDGE_BEVEL):
    n = len(points)
    verts = [(x, -depth/2, z+z_offset) for x,z in points]
    verts += [(x, depth/2, z+z_offset) for x,z in points]
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, 2*n))]
    for i in range(n):
        j = (i+1) % n
        faces.append((i, j, j+n, i+n))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("Polished perimeter", "BEVEL")
        mod.width = min(bevel, depth * .18)
        mod.segments = 4
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
    return obj


def bevelled_box(name, location, dimensions, mat, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Rounded stone arris", "BEVEL")
        mod.width = min(bevel, min(dimensions) * .22)
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def make_model(spec, stone, accent, polish):
    model_id, name, profile, width, height, depth, pedestal_style = spec
    clear_scene()
    objects = []
    plinth_h = .105
    pedestal_h = .205
    stele_z = plinth_h + pedestal_h
    total_h = stele_z + height

    # Broad bottom slab and stepped pedestal are separate editable GLB objects.
    objects.append(bevelled_box(
        model_id + "_Основание", (0, 0, plinth_h/2),
        (width*1.28, depth*1.72, plinth_h), stone, .012
    ))
    ped_w = width * (1.12 if pedestal_style == "wide" else 1.04)
    objects.append(bevelled_box(
        model_id + "_Постамент", (0, 0, plinth_h + pedestal_h/2),
        (ped_w, depth*1.35, pedestal_h), stone, .014
    ))
    # Narrow polished reveal between pedestal and stele.
    objects.append(bevelled_box(
        model_id + "_Профиль", (0, 0, stele_z + .012),
        (width*1.045, depth*1.12, .024), polish, .004
    ))

    silhouette = outline(profile, width, height)
    body = extruded_polygon(model_id + "_Стела", silhouette, depth, stele_z, stone)
    objects.append(body)

    # Front inset: restrained dark stone panel, not a flat sticker.
    panel_w = width * .48
    panel_h = height * .53
    panel_z = stele_z + height * .43
    objects.append(bevelled_box(
        model_id + "_Лицевая_вставка",
        (0, -depth/2 - .003, panel_z),
        (panel_w, .012, panel_h), accent, .006
    ))
    # Small polished top medallion / accent strip, independently editable.
    objects.append(bevelled_box(
        model_id + "_Декоративная_полоса",
        (0, -depth/2 - .010, stele_z + height*.79),
        (width*.22, .008, .012), polish, .003
    ))

    # Set a useful origin at ground centre for configurator placement.
    for obj in objects:
        obj["catalog_id"] = model_id
        obj["component"] = obj.name.split("_", 1)[-1]
    return objects, total_h


def enable_gltf_export():
    if hasattr(bpy.ops, "export_scene") and hasattr(bpy.ops.export_scene, "gltf"):
        return
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass
    if not (hasattr(bpy.ops, "export_scene") and hasattr(bpy.ops.export_scene, "gltf")):
        raise RuntimeError(
            "Не найден GLB-экспортёр glTF. В Blender включите/установите "
            "расширение glTF 2.0 (экспорт)."
        )


def export_glb(model_id, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    target = OUT_DIR / (model_id + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    bpy.ops.object.select_all(action="DESELECT")
    if not target.exists() or target.stat().st_size < 1000:
        raise RuntimeError("GLB не создан или файл подозрительно мал: " + str(target))
    return target


# Catalog identifiers and silhouette families are based on the supplied
# frontal catalogue sheet. Dimensions are proportional starting values.
SPECS = [
    ("F10", "Фигурная стела с арочным верхом", "classic_arch", .62, 1.18, .105, "standard"),
    ("F11", "Стела с выраженными плечами", "shoulder", .64, 1.20, .105, "wide"),
    ("F12", "Стела с короной", "crown", .62, 1.18, .11, "standard"),
    ("F13", "Стела с волнистым верхом", "wave", .64, 1.18, .105, "standard"),
    ("F15", "Стела с фигурным плечом", "ogee", .64, 1.20, .105, "wide"),
    ("F18", "Стела с наклонным силуэтом слева", "slant_left", .62, 1.18, .105, "standard"),
    ("F20", "Стела с наклонным силуэтом справа", "slant_right", .62, 1.18, .105, "standard"),
    ("F21", "Стела с двойной волной", "double_wave", .66, 1.20, .105, "wide"),
    ("F23", "Стела с мягким округлым верхом", "round", .62, 1.16, .105, "standard"),
    ("F26", "Стела с фронтоном", "gable", .64, 1.18, .105, "wide"),
    ("F27", "Стела с расширенным верхом", "flared", .64, 1.20, .11, "wide"),
    ("F29", "Стела с уступчатой короной", "notched", .62, 1.18, .105, "standard"),
    ("F31", "Стела с крыловидными плечами", "wing", .68, 1.20, .11, "wide"),
    ("F32", "Стела с плавными плечами", "soft_shoulder", .64, 1.20, .105, "standard"),
    ("F33", "Стела со смещённой короной", "offset_crown", .66, 1.20, .105, "wide"),
    ("F34", "Стела с завитками", "scroll", .68, 1.20, .11, "wide"),
    ("F35", "Стела с барочным верхом", "baroque", .68, 1.22, .11, "wide"),
    ("F36", "Асимметричная фигурная стела", "asymmetric", .66, 1.20, .105, "wide"),
]


def main():
    enable_gltf_export()
    stone = material("GigaNT | Granite", STONE_COLOR, .24)
    accent = material("GigaNT | Dark inset", ACCENT_COLOR, .30)
    polish = material("GigaNT | Polished edge", POLISH_COLOR, .19)
    manifest = []

    for spec in SPECS:
        model_id, name, profile, width, height, depth, pedestal_style = spec
        objects, total_h = make_model(spec, stone, accent, polish)
        target = export_glb(model_id, objects)
        manifest.append({
            "id": model_id,
            "file": "generated/" + model_id + ".glb",
            "name": name,
            "defaultWidth": round(width * 1.28, 3),
            "defaultHeight": round(total_h, 3),
            "defaultDepth": round(depth * 1.72, 3),
            "modelType": "vertical",
            "rotation": "",
            "catalogReference": "pamyatnik-kupit.ru catalogue sheet",
            "components": ["Стела", "Основание", "Постамент", "Профиль", "Лицевая вставка", "Декоративная полоса"],
            "sourceNote": "Параметрическая 3D-интерпретация фронтального изображения; размеры ориентировочные."
        })
        print("GLB OK:", model_id, target.name, target.stat().st_size, "bytes")

    manifest_path = OUT_DIR / "models-list.generated.json"
    manifest_path.write_text(
        json.dumps({"models": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print("Готово:", len(manifest), "моделей")
    print("Каталог:", OUT_DIR)
    print("Манифест:", manifest_path)


if __name__ == "__main__":
    main()
