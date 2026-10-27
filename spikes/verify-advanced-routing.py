"""Independent Gerbonara verification after tests/advanced-routing.cjs.
Run with the optional QA environment: gerbonara.
"""
from pathlib import Path
from gerbonara import GerberFile,ExcellonFile
import json
root=Path('.test-output/advanced-routing')
expected_drills={'F.Cu-In1.Cu':(35,50,.1),'In1.Cu-In2.Cu':(50,50,.2),'In2.Cu-B.Cu':(65,50,.1)}
for span,(x,y,d) in expected_drills.items():
    holes=ExcellonFile.open(root/f'board-{span}.drl').objects
    assert len(holes)==1
    assert abs(holes[0].x-x)<1e-6 and abs(holes[0].y-y)<1e-6 and abs(holes[0].aperture.diameter-d)<1e-6
assert not (root/'board-PTH.drl').exists()
for layer,ext,expected_x in [('F.Cu','gtl',[18.1,20,35]),('In1.Cu','g2',[35,50]),('In2.Cu','g3',[50,65]),('B.Cu','gbl',[65,80,81.9])]:
    objects=GerberFile.open(root/f'board-{layer}.{ext}').objects
    flashes=[o for o in objects if type(o).__name__=='Flash'];lines=[o for o in objects if type(o).__name__=='Line']
    assert len(lines)==1,(layer,lines)
    assert len(flashes)==len(expected_x),(layer,len(flashes))
    assert all(abs(a-b)<1e-6 for a,b in zip(sorted(o.x for o in flashes),expected_x)),(layer,flashes)
    assert all(abs(o.y-50)<1e-6 for o in flashes)
stack=json.loads((root/'stackup.json').read_text());assert stack['layers']==['F.Cu','In1.Cu','In2.Cu','B.Cu'];assert [v['span'] for v in stack['vias']]==[['F.Cu','In1.Cu'],['In1.Cu','In2.Cu'],['In2.Cu','B.Cu']]
print('PASS independent Gerbonara: exactly one routed segment per layer, span-specific via flashes, three plated drill files with correct positions/diameters, no unintended through hole')
