
for i in range(9):
    x = left+.24+i*((W-.48)/8)
    ring(f"Frieze {i} | Rosette", x,1.73,.052,.052,-.085,.010,gold)
    sphere(f"Frieze {i} | Rosette center", (x,-.10,1.73),.022,gold_light)
    spiral(f"Frieze {i} | Left scroll", x-.09,1.72,.085,.75,-1,-.075,.010,black)
    spiral(f"Frieze {i} | Right scroll", x+.09,1.72,.085,.75,1,-.075,.010,black)

# Lower ornament belt
bar_x("Bottom ornament | Top rail", left+.04,right-.04,.57,-.04,.025,black)
bar_x("Bottom ornament | Gold rail", left+.04,right-.04,.32,-.04,.010,gold)

for i in range(9):
    x = left+.24+i*((W-.48)/8)
    spiral(f"Lower scroll {i} | A", x-.07,.43,.095,.8,-1,-.08,.012,black)
    spiral(f"Lower scroll {i} | B", x+.07,.43,.095,.8,1,-.08,.012,black)
    ring(f"Lower scroll {i} | Rosette", x,.43,.028,.028,-.105,.009,gold)

# Central crest v2.0 — mirrored curves generated from one side
cy = -.145
ring("Crest v2 | Outer gold oval", 0,1.04,.34,.43,cy,.023,gold,96)
ring("Crest v2 | Inner black oval", 0,1.04,.295,.385,cy-.008,.012,black,96)
sphere("Crest v2 | Central boss", (0,cy-.035,1.04),.065,gold_light)
ring("Crest v2 | Boss rim", 0,1.04,.082,.082,cy-.025,.012,gold,64)
bar_z("Crest v2 | Spine", 0,.49,1.53,cy-.015,.019,black)
bar_z("Crest v2 | Gold spine", 0,.54,1.48,cy-.04,.006,gold_light)

u = bezier_points(
    (.025,1.38),(.08,1.58),(.30,1.58),(.285,1.39),y=cy-.02
)
u += bezier_points(
    (.285,1.39),(.27,1.25),(.13,1.25),(.105,1.36),y=cy-.02
)[1:]
u += bezier_points(
    (.105,1.36),(.085,1.44),(.19,1.46),(.20,1.38),y=cy-.02
)[1:]
mirrored_curve("Crest v2 | Upper fleur scroll",u,.019,black)

ug = bezier_points(
    (.055,1.40),(.10,1.51),(.235,1.51),(.245,1.40),y=cy-.045
)
mirrored_curve("Crest v2 | Upper gold inlay",ug,.0065,gold_light)

lo = bezier_points(
    (.025,.72),(.10,.52),(.34,.55),(.34,.77),y=cy-.025
)
lo += bezier_points(
    (.34,.77),(.34,.91),(.18,.91),(.15,.79),y=cy-.025
)[1:]
lo += bezier_points(
    (.15,.79),(.13,.70),(.25,.68),(.26,.77),y=cy-.025
)[1:]
mirrored_curve("Crest v2 | Lower scroll",lo,.021,black)

lg = bezier_points(
    (.045,.70),(.13,.57),(.29,.61),(.30,.76),y=cy-.05
)
mirrored_curve("Crest v2 | Lower gold inlay",lg,.007,gold)

side = bezier_points(
    (.29,.68),(.46,.48),(.78,.51),(.83,.70),y=cy-.025
)
side += bezier_points(
    (.83,.70),(.88,.84),(.72,.91),(.67,.80),y=cy-.025
)[1:]
side += bezier_points(
    (.67,.80),(.62,.71),(.77,.67),(.77,.77),y=cy-.025
)[1:]
mirrored_curve("Crest v2 | Outer scroll",side,.025,black)

sg = bezier_points(
    (.32,.66),(.49,.53),(.74,.55),(.79,.70),y=cy-.055
)
mirrored_curve("Crest v2 | Gold scroll accent",sg,.007,gold_light)

leaf_pair("Crest v2 | Upper gold leaves",.20,1.08,.25,gold_light,cy-.065)
leaf_pair("Crest v2 | Lower gold leaves",.32,.68,.22,gold,cy-.065)

tube_path(
    "Crest v2 | Fleur stem",
    [(0,cy-.03,1.39),(0,cy-.03,1.48),
     (0,cy-.03,1.58),(0,cy-.03,1.67)],
    .016,gold
)

f = bezier_points(
    (.015,1.48),(.06,1.60),(.14,1.61),(.17,1.54),y=cy-.045
)
f += bezier_points(
    (.17,1.54),(.11,1.52),(.065,1.49),(.015,1.48),y=cy-.045
)[1:]
mirrored_curve("Crest v2 | Fleur wings",f,.014,gold_light)

finial("Crest v2 | Top finial",0,1.67,.25,gold)

fb = bezier_points(
    (.015,.64),(.07,.56),(.13,.55),(.17,.60),y=cy-.05
)
fb += bezier_points(
    (.17,.60),(.11,.61),(.065,.64),(.015,.64),y=cy-.05
)[1:]
mirrored_curve("Crest v2 | Lower fleur",fb,.013,gold)
sphere("Crest v2 | Bottom jewel",(0,cy-.055,.57),.035,gold_light)

# Scene units and background-safe UI setup
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

screen = bpy.context.screen
if screen is not None:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 6.8
            area.spaces.active.region_3d.view_location = (0,0,1.25)

# Save editable .blend before converting curves for GLB export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

# Convert curves to meshes for reliable GLB export
objects = list(bpy.context.scene.objects)
curves = [o for o in objects if o.type == 'CURVE']

if curves:
    bpy.ops.object.select_all(action='DESELECT')
    for o in curves:
        o.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target='MESH')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format='GLB',
    use_selection=True,
    export_apply=True
)

print("="*48)
print("GRAND IMPERIAL FENCE v"+VERSION+" CREATED")
print("BLEND:",BLEND_PATH)
print("GLB:",GLB_PATH)
print("="*48)
