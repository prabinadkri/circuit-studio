"""File transactions, MCP protocol/path checks, and real-engine acceptance checks."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from circuitctl import execute, atomic_write
from circuit_mcp import Server

ROOT = Path(__file__).resolve().parents[1]


class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.file = self.root / 'test.circuit'
        self.original = b'{"old":true}\n'
        self.file.write_bytes(self.original)
        self.revision = hashlib.sha256(self.original).hexdigest()

    def test_conflict_does_not_start_engine(self):
        with patch('circuitctl.run_engine') as engine:
            with self.assertRaisesRegex(ValueError, 'Revision conflict'):
                execute('apply', self.file, {'version': 1, 'operations': []}, 'stale')
            engine.assert_not_called()
        self.assertEqual(self.file.read_bytes(), self.original)

    def test_engine_failure_and_external_edit_preserve_file(self):
        with patch('circuitctl.run_engine', side_effect=ValueError('bad plan')):
            with self.assertRaises(ValueError):
                execute('apply', self.file, {'version': 1}, self.revision)
        self.assertEqual(self.file.read_bytes(), self.original)
        def external(*args):
            self.file.write_bytes(b'{"external":true}')
            return {'project': {'new': True}}
        with patch('circuitctl.run_engine', side_effect=external):
            with self.assertRaisesRegex(ValueError, 'changed during'):
                execute('apply', self.file, {'version': 1}, self.revision)
        self.assertEqual(self.file.read_bytes(), b'{"external":true}')

    def test_success_keeps_previous_and_refuses_create_overwrite(self):
        with patch('circuitctl.run_engine', return_value={'project': {'new': True}}):
            result = execute('apply', self.file, {'version': 1}, self.revision)
        self.assertEqual(result['revision'], hashlib.sha256(self.file.read_bytes()).hexdigest())
        self.assertEqual(self.file.with_suffix('.circuit.previous').read_bytes(), self.original)
        with self.assertRaisesRegex(ValueError, 'already exists'):
            execute('new', self.file, {'version': 1})

    def test_mcp_protocol_and_workspace_scope(self):
        server = Server(self.root)
        def request(method, params=None):
            return server.handle({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or {}})
        self.assertIn('error', request('tools/list'))
        self.assertEqual(request('initialize', {'protocolVersion': '2025-11-25'})['result']['protocolVersion'], '2025-11-25')
        self.assertEqual(len(request('tools/list')['result']['tools']), 8)
        self.assertEqual(len(request('resources/list')['result']['resources']), 2)
        self.assertIn('operations', request('resources/read', {'uri': 'circuit-studio://example'})['result']['contents'][0]['text'])
        self.assertIn('error', request('resources/read', {'uri': 'file:///etc/passwd'}))
        for name in ('../escape.circuit', '/tmp/escape.circuit'):
            result = request('tools/call', {'name': 'circuit_inspect', 'arguments': {'file': name}})
            self.assertTrue(result['result']['isError'])
        (self.root / 'link.circuit').symlink_to(self.file)
        self.assertTrue(request('tools/call', {'name': 'circuit_inspect', 'arguments': {'file': 'link.circuit'}})['result']['isError'])
        with patch('circuit_mcp.execute', return_value={'revision': 'abc'}):
            self.assertFalse(request('tools/call', {'name': 'circuit_inspect', 'arguments': {'file': 'test.circuit'}})['result']['isError'])
        self.assertIsNone(server.handle({'jsonrpc': '2.0', 'method': 'notifications/initialized'}))

    def test_mcp_stdio_is_valid_protocol_only(self):
        messages = [{'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25'}}, {'jsonrpc': '2.0', 'method': 'notifications/initialized'}, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'}]
        result = subprocess.run([sys.executable, str(ROOT / 'circuit_mcp.py'), '--workspace', str(self.root)], input='\n'.join(map(json.dumps, messages))+'\n', text=True, capture_output=True, check=True)
        replies = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual([r['id'] for r in replies], [1, 2])
        self.assertEqual(result.stderr, '')


@unittest.skipUnless(os.environ.get('TEST_REAL_AUTOMATION'), 'Set TEST_REAL_AUTOMATION=1 for real Chrome/engine tests')
class EngineAcceptance(unittest.TestCase):
    def test_agent_workflow(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / 'divider.circuit'
            plan = json.loads((ROOT / 'examples/automation/voltage-divider.json').read_text())
            created = execute('new', file, plan)
            self.assertEqual(created['erc'], [])
            sim = execute('simulate', file)
            r2 = next(e for e in sim['components'] if e['reference'] == 'R2')
            self.assertAlmostEqual(r2['voltages'][0], 2.5, places=8)
            self.assertAlmostEqual(r2['current'], .00025, places=8)
            before = file.read_bytes()
            bad = {'version': 1, 'operations': [{'op': 'set', 'ref': 'R2', 'properties': {'0': '20k'}}, {'op': 'add', 'ref': 'X1', 'type': 'NoSuchElm', 'x': 0, 'y': 0, 'x2': 80, 'y2': 0}]}
            with self.assertRaises(ValueError):
                execute('apply', file, bad, created['revision'])
            self.assertEqual(file.read_bytes(), before)
            edit = {'version': 1, 'operations': [bad['operations'][0], {'op': 'add', 'ref': 'U1', 'type': 'OpAmpElm', 'x': 400, 'y': 80, 'x2': 480, 'y2': 80}, {'op': 'add', 'ref': 'X1', 'type': 'ExtVoltageElm', 'x': 480, 'y': 240, 'x2': 480, 'y2': 176, 'properties': {'0': 'D13'}}]}
            updated = execute('apply', file, edit, created['revision'])
            self.assertEqual(len(next(e for e in updated['components'] if e['reference'] == 'U1')['pins']), 3)
            self.assertEqual(next(e for e in updated['components'] if e['reference'] == 'X1')['properties'][0]['text'], 'D13')
            original_ids = {e['reference']: e['id'] for e in created['components']}
            self.assertTrue(all(original_ids[e['reference']] == e['id'] for e in updated['components'] if e['reference'] in original_ids))
            with self.assertRaises(ValueError):
                execute('apply', file, edit, created['revision'])
            svg = execute('svg', file)['svg']
            self.assertIn('<svg', svg)
            self.assertIn('</svg>', svg)


if __name__ == '__main__':
    unittest.main()
