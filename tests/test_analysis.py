import json, math, os, shutil, unittest
from pathlib import Path
from analysis_backend import AnalysisBackend,validate_circuit
ROOT=Path(__file__).resolve().parents[1]
AVAILABLE=os.environ.get('NGSPICE') or shutil.which('ngspice') or ((ROOT/'native/ngspice').exists() and str(ROOT/'native/ngspice'))
class SyntaxTests(unittest.TestCase):
 def test_rejects_external_and_executable_syntax(self):
  for text in ['.include /etc/passwd','.control\nshell whoami\n.endc','.model x D (evil=1)','B1 out 0 v=system(1)','V1 out 0 1\n.model x NMOS (vto=1)']:
   with self.assertRaises(ValueError):validate_circuit(text)
 def test_rejects_bad_range(self):
  with self.assertRaises(ValueError):AnalysisBackend().run({'circuit':'V1 out 0 5\nR1 out 0 1k','mode':'dc','settings':{'start':0,'stop':5,'step':1e-9}})
@unittest.skipUnless(AVAILABLE,'Install ngspice or set NGSPICE for the analysis acceptance suite')
class ReferenceTests(unittest.TestCase):
 def run_fixture(self,name):
  p=json.loads((ROOT/'examples/analysis'/f'{name}.json').read_text());r=AnalysisBackend(AVAILABLE).run(p);self.assertTrue(r['rows']);return r
 def test_divider_dc(self):
  r=self.run_fixture('divider');self.assertAlmostEqual(r['rows'][-1][1],2.5,places=6)
 def test_rc_step(self):
  r=self.run_fixture('rc-step');row=min(r['rows'],key=lambda r:abs(r[0]-.001));self.assertAlmostEqual(row[1],5*(1-math.exp(-1)),delta=.02)
 def test_rc_ac(self):
  r=self.run_fixture('rc-ac');row=min(r['rows'],key=lambda r:abs(r[0]-1000));gain=math.hypot(row[1],row[2]);self.assertAlmostEqual(gain,1/math.sqrt(1+(2*math.pi*1000*.001)**2),delta=.001)
 def test_rl_step(self):
  r=self.run_fixture('rl-step');row=min(r['rows'],key=lambda r:abs(r[0]-.001));self.assertAlmostEqual(row[1],5*math.exp(-1),delta=.02)
 def test_diode_model(self):
  r=self.run_fixture('diode');v=r['rows'][-1][1];self.assertGreater(v,.55);self.assertLess(v,.65)
