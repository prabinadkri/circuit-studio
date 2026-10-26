"""Independent format check: pip install gerbonara; run footprint-export.cjs and KiCad CLI first."""
import json, math
from pathlib import Path
from gerbonara import GerberFile, ExcellonFile
root=Path('.test-output/packages');pads=json.loads((root/'expected-pads.json').read_text())
def near(a,b):return abs(a-b)<1e-5
for side,ext in [('F','gtl'),('B','gbl')]:
 objects=GerberFile.open(root/f'board-{side}.Cu.{ext}').objects
 expected=[p for p in pads if side+'.Cu' in p['layers']]
 assert len(objects)==len(expected)
 for pad in expected:
  obj=next(o for o in objects if near(o.x,pad['x']) and near(o.y,80-pad['y']))
  if pad['shape']=='rect':
   w,h=(pad['height'],pad['width']) if pad['rotation']%180 else (pad['width'],pad['height'])
   assert near(obj.aperture.w,w) and near(obj.aperture.h,h)
  else:assert near(obj.aperture.diameter,pad['width'])
 kicad=GerberFile.open(root/f'kicad-gerbers/board-{side}_Cu.{ext}').objects
 # KiCad flips Y around zero; the application flips Y around its 80 mm SVG extent.
 for pad in expected:assert any(near(o.x,pad['x']) and near(o.y,-pad['y']) for o in kicad if hasattr(o,'x'))
drills=ExcellonFile.open(root/'board-PTH.drl').objects
expected=[p for p in pads if p['drill']]
assert len(drills)==len(expected)
for pad in expected:assert any(near(o.x,pad['x']) and near(o.y,80-pad['y']) and near(o.aperture.diameter,pad['drill']) for o in drills)
print('PASS independent Gerbonara + KiCad: copper coordinates, rotated SMD dimensions, physical sides, drill positions/diameters')
