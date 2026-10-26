"""Independent Gerbonara/Shapely/Trimesh validation; run tests/routing.cjs first.
KiCad: kicad-cli pcb export gerbers .test-output/routing/board.kicad_pcb -o .test-output/routing/kicad-gerbers
"""
import json
from pathlib import Path
import numpy as np
from gerbonara import GerberFile, ExcellonFile
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
import trimesh

root=Path('.test-output/routing')
fills=json.loads((root/'expected-fill.json').read_text())
expected=unary_union([Polygon([(p['x'],80-p['y']) for p in r['outer']], [[(p['x'],80-p['y']) for p in h] for h in r['holes']]) for r in fills])
def region_union(path,dy=0):
    regions=[]
    for o in GerberFile.open(path).objects:
        if type(o).__name__=='Region':
            for primitive in o.to_primitives():
                regions.append(Polygon([(x,y+dy) for x,y in primitive.outline]))
    return unary_union(regions)
actual=region_union(root/'board-F.Cu.gtl')
assert actual.symmetric_difference(expected).area<1e-5
assert actual.distance(box(17.6,49.3,18.6,50.7))>=.25-1e-5
assert actual.distance(box(81.4,49.3,82.4,50.7))>=.25-1e-5
kicad=region_union(root/'kicad-gerbers/board-F_Cu.gtl',80)
assert kicad.symmetric_difference(expected).area<.002
holes=ExcellonFile.open(root/'board-PTH.drl').objects
assert len(holes)==1 and abs(holes[0].x-50)<1e-6 and abs(holes[0].y-50)<1e-6 and abs(holes[0].aperture.diameter-.4)<1e-6
manifest=json.loads((root/'mechanical.json').read_text())
scene=trimesh.load(root/'board.gltf')
for p in manifest['components']:
    matrix=scene.graph[p['reference']][0]
    x,y,z=p['origin']
    assert np.allclose(matrix[:3,3],[x/1000,-y/1000,z/1000],atol=1e-8)
assert np.allclose(scene.bounds[:,:2],[[.01,-.07],[.11,-.01]],atol=1e-8)
board=trimesh.load(root/'board.stl')
assert np.allclose(board.bounds[:,:2],[[10,-70],[110,-10]],atol=1e-5)
# Section through the laminate must contain the actual 0.4 mm through drill.
section=board.section(plane_origin=[0,0,-.8],plane_normal=[0,0,1])
loops=section.discrete
assert any(np.linalg.norm(loop[:,:2].mean(axis=0)-[50,-30])<.05 and .38<np.ptp(loop[:,0])<.42 for loop in loops)
# The top copper section must retain the drill opening too (zones cannot cap it).
section=board.section(plane_origin=[0,0,.0175],plane_normal=[0,0,1])
assert any(np.linalg.norm(loop[:,:2].mean(axis=0)-[50,-30])<.05 and .38<np.ptp(loop[:,0])<.42 for loop in section.discrete)
print('PASS independent Gerbonara + KiCad: via drill, zone area/holes, 0.25 mm clearance and layer geometry')
print('PASS independent Trimesh: 100x60 mm extent, mm/m units, front/back component origins and open through drill in laminate/copper')
