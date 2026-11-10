#!/usr/bin/env python3
"""
Giga-NT: простой генератор базовых форм стел для Blender 4.x.

Запуск из корня проекта:
  blender --background --python tools/generate_steles.py

Создаёт отдельную папку models/generated/:
  001.glb, 002.glb, ...
  models-list.generated.json

Это стартовые геометрические заготовки, а не копии фотографий с сайта.
Основной models/models-list.json скрипт не перезаписывает.
"""

import bpy
import bmesh
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "models" / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)

STONE = (0.22, 0.23, 0.24, 1.0)
DEPTH = 0.08
BEVEL = 0.006


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def stone_material():
    mat = bpy.data.materials.new("Neutral stone - replaced by configurator")
    mat.diffuse_color = STONE
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = STONE
        bsdf.inputs["Roughness"].default_value = 0.32
    return mat


def polygon_extrusion(name, points, depth=DEPTH, material=None):
    """Extrude an X/Z outline symmetrically around Y=0."""
    count = len(points)
    verts = [(x, -depth / 2, z) for x, z in points]
    verts += [(x, depth / 2, z) for x, z in points]

    faces = []
    faces.append(tuple(range(count - 1, -1, -1)))
    faces.append(tuple(range(count, count * 2)))
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, j + count, i + count))

    mesh = bpy.data.meshes.new(name + "Mesh")
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
    if material:
        obj.data.materials.append(material)

    bevel = obj.modifiers.new("Soft polished edges", "BEVEL")
    bevel.width = min(BEVEL, depth * 0.12)
    bevel.segments = 3
    bevel.limit_method = "ANGLE"

    normals = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    bpy.ops.object.modifier_apply(modifier=normals.name)
    obj.select_set(False)
    return obj


def rounded_top(width=0.6, height=1.2, radius_ratio=0.48):
    x, z = width / 2, height
    radius = x * radius_ratio
    points = [(-x, 0), (x, 0), (x, z * 0.72)]
    for i in range(17):
        angle = (i / 16) * math.pi
        points.append((radius * math.cos(angle), z * 0.72 + radius * math.sin(angle)))
    points.append((-x, z * 0.72))
    return points


def oval(width=0.62, height=1.15, steps=64):
    return [
        (width / 2 * math.cos(2 * math.pi * i / steps),
         height / 2 + height / 2 * math.sin(2 * math.pi * i / steps))
        for i in range(steps)
    ]


def wave_top(width=0.62, height=1.2, steps=48):
    points = [(-width / 2, 0), (width / 2, 0), (width / 2, height * 0.56)]
    for i in range(steps + 1):
        t = i / steps
        x = width / 2 - width * t
        z = height * (0.56 + 0.12 * math.sin(t * 2 * math.pi))
        points.append((x, z))
    return points


def heart(width=0.78, height=0.82, steps=80):
    points = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        x = 16 * math.sin(t) ** 3
        z = 13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t)
        points.append((x * width / 32, (z + 2) * height / 30))
    min_z = min(z for _, z in points)
    return [(x, z - min_z) for x, z in points]


def cross_outline(width=0.68, height=1.2, arm=0.22):
    x = width / 2
    y = height
    a = arm / 2
    shoulder = height * 0.64
    return [
        (-a, 0), (a, 0), (a, shoulder - a), (x, shoulder - a),
        (x, shoulder + a), (a, shoulder + a), (a, y), (-a, y),
        (-a, shoulder + a), (-x, shoulder + a), (-x, shoulder - a),
        (-a, shoulder - a)
    ]


def export_one(model_id, name, model_type, objects, width, height, depth):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    target = OUT_DIR / f"{model_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    for obj in objects:
        obj.select_set(False)
    return {
        "id": model_id,
        "file": f"generated/{model_id}.glb",
        "name": name,
        "defaultWidth": width,
        "defaultHeight": height,
        "defaultDepth": depth,
        "modelType": model_type,
        "rotation": ""
    }


def build():
    material = stone_material()
    catalog = []

    specs = [
        ("001", "Вертикальная прямоугольная", "vertical", 0.60, 1.20, "rect"),
        ("002", "Вертикальная с арочным верхом", "vertical", 0.62, 1.20, "arch"),
        ("003", "Горизонтальная плита", "horizontal", 1.20, 0.58, "horizontal"),
        ("004", "Овальная стела", "vertical", 0.62, 1.15, "oval"),
        ("005", "Фигурная волна", "vertical", 0.62, 1.20, "wave"),
        ("006", "Ромбовидная стела", "vertical", 0.68, 1.15, "diamond"),
        ("007", "Крест из камня", "vertical", 0.68, 1.20, "cross"),
        ("008", "Стела-сердце", "exclusive", 0.78, 0.82, "heart"),
        ("009", "Двойная вертикальная стела", "horizontal", 1.05, 1.15, "double"),
    ]

    for model_id, name, model_type, width, height, shape in specs:
        reset_scene()
        objects = []
        depth = DEPTH

        if shape == "rect":
            pts = [(-width/2, 0), (width/2, 0), (width/2, height), (-width/2, height)]
            objects.append(polygon_extrusion(model_id, pts, depth, material))
        elif shape == "arch":
            objects.append(polygon_extrusion(model_id, rounded_top(width, height), depth, material))
        elif shape == "horizontal":
            pts = [(-width/2, 0), (width/2, 0), (width/2, height), (-width/2, height)]
            objects.append(polygon_extrusion(model_id, pts, depth, material))
        elif shape == "oval":
            objects.append(polygon_extrusion(model_id, oval(width, height), depth, material))
        elif shape == "wave":
            objects.append(polygon_extrusion(model_id, wave_top(width, height), depth, material))
        elif shape == "diamond":
            pts = [(0, height), (width/2, height*0.52), (0, 0), (-width/2, height*0.52)]
            objects.append(polygon_extrusion(model_id, pts, depth, material))
        elif shape == "cross":
            objects.append(polygon_extrusion(model_id, cross_outline(width, height), depth, material))
        elif shape == "heart":
            objects.append(polygon_extrusion(model_id, heart(width, height), depth, material))
        elif shape == "double":
            single_w = width * 0.43
            gap = width * 0.07
            for suffix, center_x in (("L", -(single_w + gap)/2), ("R", (single_w + gap)/2)):
                pts = [
                    (center_x-single_w/2, 0), (center_x+single_w/2, 0),
                    (center_x+single_w/2, height), (center_x-single_w/2, height)
                ]
                objects.append(polygon_extrusion(model_id + suffix, pts, depth, material))

        catalog.append(export_one(
            model_id, name, model_type, objects, width, height, depth
        ))
        print(f"Exported {model_id}: {name}")

    manifest = {"models": catalog}
    manifest_path = OUT_DIR / "models-list.generated.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Done: {len(catalog)} GLB models -> {OUT_DIR}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    build()
