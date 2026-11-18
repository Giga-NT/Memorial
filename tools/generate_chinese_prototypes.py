#!/usr/bin/env python3
"""Prototype catalogue models F40, F45 and F54.
Run with Blender 5.x:
  blender --background --python tools/generate_chinese_prototypes.py
Outputs are isolated in models/prototypes_chinese/; existing models are untouched.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "models" / "prototypes_chinese"
OUT.mkdir(parents=True, exist_ok=True)
STONE = (0.075, 0.078, 0.082, 1)
EDGE = (0.16, 0.165, 0.17, 1)
INSET = (0.025, 0.027, 0.03, 1)

def mat(name, color, rough=.24):
    m=bpy.data.materials.new(name); m.diffuse_color=color; m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=color; p.inputs["Roughness"].default_value=rough
    return m

def cube(name, loc, dims, material, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new("Каменные фаски","BEVEL"); b.width=bevel; b.segments=4
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return o

def extrude(name, pts, depth, z, material, bevel=.006):
    n=len(pts); verts=[(x,-depth/2,y+z) for x,y in pts]+[(x,depth/2,y+z) for x,y in pts]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name+"Mesh"); me.from_pydata(verts,[],faces); me.validate()
    bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
    if bevel:
        mod=ob.modifiers.new("Скругление кромки","BEVEL"); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def curve_line(name, pts, radius, material, cyclic=True):
    c=bpy.data.curves.new(name,"CURVE"); c.dimensions="3D"; c.bevel_depth=radius; c.bevel_resolution=4
    sp=c.splines.new("POLY"); sp.points.add(len(pts)-1)
    for p,(x,y,z) in zip(sp.points,pts): p.co=(x,y,z,1)
    sp.use_cyclic_u=cyclic
    ob=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
    return ob

def oval_points(rx, rz, zc, count=96):
    return [(rx*math.cos(2*math.pi*i/count), zc+rz*math.sin(2*math.pi*i/count)) for i in range(count)]

def heart_points(w,h, count=128):
    pts=[]
    for i in range(count):
        t=2*math.pi*i/count
        x=16*math.sin(t)**3/32*w
        y=h*(.5+(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))/34)
        pts.append((x,y))
    # normalize to exact requested bounding height
    lo=min(y for x,y in pts); hi=max(y for x,y in pts)
    return [(x,(y-lo)*h/(hi-lo)) for x,y in pts]

def platform(model, width=0.9, depth=.72):
    cube(model+"_нижняя_плита",(0,0,.055),(width,depth,.11),STONE,.018)
    cube(model+"_верхняя_ступень",(0,-.005,.12),(width*.91,depth*.90,.055),EDGE,.009)

def setup_scene(model_id, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    for o in objects: o["catalog_id"]=model_id
    bpy.ops.export_scene.gltf(filepath=str(OUT/(model_id+".glb")),export_format="GLB",use_selection=True,export_apply=True)
    bpy.ops.object.select_all(action="DESELECT")
    # studio render, front three-quarter view
    bpy.ops.object.camera_add(location=(2.55,-4.7,2.35))
    cam=bpy.context.object; cam.name="PreviewCamera"
    target=Vector((0,0,.95)); cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.lens=55; bpy.context.scene.camera=cam
    bpy.ops.object.light_add(type="AREA", location=(-3,-4,4)); key=bpy.context.object; key.data.energy=520; key.data.shape="DISK"; key.data.size=4
    key.rotation_euler=(Vector((0,0,1))-key.location).to_track_quat("-Z","Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(3,1,3)); fill=bpy.context.object; fill.data.energy=300; fill.data.size=3
    fill.rotation_euler=(Vector((0,0,1))-fill.location).to_track_quat("-Z","Y").to_euler()
    sc=bpy.context.scene; sc.render.engine="BLENDER_EEVEE_NEXT"
    sc.render.resolution_x=1000; sc.render.resolution_y=1000; sc.render.resolution_percentage=100
    sc.world.color=(.12,.12,.12)
    sc.view_settings.view_transform="Standard"
    sc.render.image_settings.file_format="PNG"; sc.render.filepath=str(OUT/(model_id+"_preview.png"))
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam,do_unlink=True); bpy.data.objects.remove(key,do_unlink=True); bpy.data.objects.remove(fill,do_unlink=True)

def build_f40(stone, edge, inset):
    objs=[]; platform("F40",.82,.72)
    # Distinct cross with stepped arms and a sculpted widening foot.
    cross=[(-.12,0),(-.18,.12),(-.16,.29),(-.075,.34),(-.075,.52),(-.25,.52),(-.25,.66),(-.075,.66),(-.075,.80),(-.16,.80),(-.16,.94),(-.075,.94),(-.075,1.12),(.075,1.12),(.075,.94),(.16,.94),(.16,.80),(.075,.80),(.075,.66),(.25,.66),(.25,.52),(.075,.52),(.075,.34),(.16,.29),(.18,.12),(.12,0)]
    objs.append(extrude("F40_крест_с_фигурной_ножкой",cross,.12,.18,stone,.012))
    # Lower sculpted foot transition and polished inset face.
    objs.append(extrude("F40_основание_креста",[(-.12,0),(-.17,.10),(-.14,.23),(0,.28),(.14,.23),(.17,.10),(.12,0)],.145,.18,edge,.008))
    cube("F40_надпись_площадка",(0,-.18,.155),(.48,.24,.018),inset,.008)
    return objs+[o for o in bpy.context.scene.objects if o.type=="MESH"]

def build_f45(stone, edge, inset):
    platform("F45",.82,.70); objs=[]
    # Oval upright slab with layered raised oval surround and flared lower shoulders.
    body=oval_points(.255,.48,.70)
    objs.append(extrude("F45_овальная_центральная_плита",body,.115,.20,stone,.009))
    # Frame follows oval face, slightly proud of the front surface.
    frame=[(x,-.071,z+.20) for x,z in oval_points(.285,.515,.70)]
    objs.append(curve_line("F45_наружный_овальный_обод",frame,.018,edge))
    frame2=[(x,-.079,z+.20) for x,z in oval_points(.245,.465,.70)]
    objs.append(curve_line("F45_внутренний_овальный_обод",frame2,.009,stone))
    shoulders=[(-.16,0),(-.20,.12),(-.18,.25),(-.12,.34),(0,.38),(.12,.34),(.18,.25),(.20,.12),(.16,0)]
    objs.append(extrude("F45_фигурные_боковые_лопасти",shoulders,.15,.20,edge,.012))
    cube("F45_шейка",(0,0,.205),(.25,.22,.18),stone,.025)
    return objs+[o for o in bpy.context.scene.objects if o.type=="MESH"]

def build_f54(stone, edge, inset):
    platform("F54",1.02,.76); objs=[]
    # Broad heart-shaped double memorial panel, with raised border and pointed lower tip.
    heart=heart_points(.72,.78)
    objs.append(extrude("F54_сердцевидная_стела",heart,.13,.27,stone,.012))
    rim=[(x,-.078,y+.27) for x,y in heart_points(.77,.83)]
    objs.append(curve_line("F54_объемный_контур_сердца",rim,.022,edge))
    inner=[(x,-.081,y+.27) for x,y in heart_points(.67,.73)]
    objs.append(curve_line("F54_внутренний_контур",inner,.008,inset))
    # Petal-like crown at the cleft of the heart, visible as a sculptural crest.
    for k,ang in enumerate((-32,0,32)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(.055*math.sin(math.radians(ang)),-.095,1.07+.035*math.cos(math.radians(ang))))
        pet=bpy.context.object; pet.name=f"F54_верхний_лепесток_{k+1}"; pet.scale=(.045,.025,.105); pet.rotation_euler[1]=math.radians(ang); pet.data.materials.append(edge); objs.append(pet)
    cube("F54_сердцевидная_опора",(0,0,.30),(.43,.28,.12),stone,.025)
    return objs+[o for o in bpy.context.scene.objects if o.type=="MESH"]

def reset():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)

def main():
    stone=mat("Чёрный полированный гранит",STONE,.22); edge=mat("Гранитная окантовка",EDGE,.18); inset=mat("Глубокая лицевая тень",INSET,.3)
    for mid,builder in (("F40",build_f40),("F45",build_f45),("F54",build_f54)):
        reset()
        objs=builder(stone,edge,inset)
        # remove accidental duplicates from scene collection
        unique=list(dict.fromkeys(objs))
        setup_scene(mid,unique)
        print("PROTOTYPE OK:",mid,(OUT/(mid+".glb")).stat().st_size,"bytes")
    (OUT/"README.txt").write_text("F40, F45, F54 — контрольные 3D-прототипы по каталожному фото. GLB и PNG превью.\n",encoding="utf-8")
    print("DONE:",OUT)

if __name__=="__main__": main()
