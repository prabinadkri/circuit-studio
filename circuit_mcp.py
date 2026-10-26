#!/usr/bin/env python3
"""Optional MCP stdio adapter for a single Circuit Studio project workspace."""
import argparse
import json
from pathlib import Path
import sys
from circuitctl import execute, ROOT

PROTOCOL = '2025-11-25'
ACTIONS = ('catalog', 'new', 'apply', 'inspect', 'check', 'simulate', 'svg', 'kicad')
DESCRIPTIONS = {
    'catalog': 'List actual simulation components, model limits and PCB footprints.',
    'new': 'Create a new .circuit file from a version 1 JSON plan; never overwrite.',
    'apply': 'Atomically apply an edit plan with required expected SHA-256 revision.',
    'inspect': 'Read components, pin indices/UUIDs, properties and current file revision.',
    'check': 'Run schematic ERC and PCB DRC; return all findings.',
    'simulate': 'Run bounded analog simulation; return pin voltages, currents and time. Does not execute MCU firmware.',
    'svg': 'Return an SVG schematic drawing.',
    'kicad': 'Return KiCad PCB text after manufacturing checks pass.',
}


def schema(action):
    props = {} if action == 'catalog' else {'file': {'type': 'string', 'description': 'Workspace-relative .circuit filename'}}
    required = [] if action == 'catalog' else ['file']
    if action in ('new', 'apply'):
        props['plan'] = {'type': 'object', 'description': 'See docs/AUTOMATION.md: version:1, name for new, operations array'}
        required.append('plan')
    if action == 'apply':
        props['expectedRevision'] = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}
        required.append('expectedRevision')
    if action == 'simulate':
        props.update(steps={'type': 'integer', 'minimum': 1, 'maximum': 100000}, timeStep={'type': 'number', 'minimum': 1e-9, 'maximum': .01})
    return {'type': 'object', 'properties': props, 'required': required, 'additionalProperties': False}


class Server:
    def __init__(self, workspace):
        self.workspace = Path(workspace).resolve(strict=True)
        if not self.workspace.is_dir():
            raise ValueError('Workspace must be an existing directory')
        self.initialized = False

    def call(self, name, args):
        action = name.removeprefix('circuit_')
        if name != 'circuit_' + action or action not in ACTIONS:
            raise ValueError('Unknown tool')
        spec = schema(action)
        if not isinstance(args, dict) or set(args) - set(spec['properties']) or any(k not in args for k in spec['required']):
            raise ValueError('Invalid tool arguments')
        path = None
        if action != 'catalog':
            if not isinstance(args['file'], str) or Path(args['file']).is_absolute():
                raise ValueError('Use a workspace-relative circuit file')
            path = self.workspace / args['file']
            if path.is_symlink() or not path.resolve().is_relative_to(self.workspace):
                raise ValueError('File is outside the configured workspace or is a symlink')
        return execute(action, path, args.get('plan'), args.get('expectedRevision'), args.get('steps', 1000), args.get('timeStep', 5e-6))

    def handle(self, message):
        if not isinstance(message, dict) or message.get('jsonrpc') != '2.0' or not isinstance(message.get('method'), str):
            return {'jsonrpc': '2.0', 'id': message.get('id') if isinstance(message, dict) else None, 'error': {'code': -32600, 'message': 'Invalid JSON-RPC request'}}
        if 'id' not in message:
            return None
        response = {'jsonrpc': '2.0', 'id': message['id']}
        method = message['method']
        params = message.get('params', {})
        if not isinstance(params, dict):
            response['error'] = {'code': -32602, 'message': 'params must be an object'}
        elif method == 'initialize':
            requested = params.get('protocolVersion')
            version = requested if requested in (PROTOCOL, '2025-06-18', '2024-11-05') else PROTOCOL
            self.initialized = True
            response['result'] = {'protocolVersion': version, 'capabilities': {'tools': {}, 'resources': {}}, 'serverInfo': {'name': 'circuit-studio', 'version': '0.4.0-alpha.1'}, 'instructions': 'Inspect before editing; preserve returned revision for apply. Pin indices are zero-based. Read resource circuit-studio://automation for JSON plans and circuit-studio://example for a complete circuit. Simulation is the analog engine, not a firmware co-simulation claim.'}
        elif method == 'ping':
            response['result'] = {}
        elif not self.initialized:
            response['error'] = {'code': -32000, 'message': 'Initialize first'}
        elif method == 'resources/list':
            response['result'] = {'resources': [
                {'uri': 'circuit-studio://automation', 'name': 'Circuit automation API', 'mimeType': 'text/markdown'},
                {'uri': 'circuit-studio://example', 'name': '5 V voltage divider plan', 'mimeType': 'application/json'}]}
        elif method == 'resources/read':
            resources = {'circuit-studio://automation': ('docs/AUTOMATION.md', 'text/markdown'), 'circuit-studio://example': ('examples/automation/voltage-divider.json', 'application/json')}
            entry = resources.get(params.get('uri')) if isinstance(params.get('uri'), str) else None
            if entry:
                response['result'] = {'contents': [{'uri': params['uri'], 'mimeType': entry[1], 'text': (ROOT / entry[0]).read_text()}]}
            else:
                response['error'] = {'code': -32602, 'message': 'Unknown resource URI'}
        elif method == 'tools/list':
            response['result'] = {'tools': [{'name': 'circuit_' + a, 'description': DESCRIPTIONS[a], 'inputSchema': schema(a), 'annotations': {'readOnlyHint': a not in ('new', 'apply'), 'destructiveHint': a == 'apply', 'idempotentHint': a not in ('new', 'apply'), 'openWorldHint': False}} for a in ACTIONS]}
        elif method == 'tools/call':
            try:
                result = self.call(params.get('name', ''), params.get('arguments', {}))
                response['result'] = {'content': [{'type': 'text', 'text': json.dumps(result, allow_nan=False)}], 'isError': False}
            except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
                response['result'] = {'content': [{'type': 'text', 'text': str(error)}], 'isError': True}
        else:
            response['error'] = {'code': -32601, 'message': 'Method not found'}
        return response


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    server = Server(parser.parse_args().workspace)
    while True:
        line = sys.stdin.buffer.readline(1_000_001)
        if not line:
            break
        if len(line) > 1_000_000:
            print('MCP request exceeds 1 MB', file=sys.stderr)
            return 2
        try:
            response = server.handle(json.loads(line))
        except (ValueError, UnicodeError):
            response = {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}}
        if response is not None:
            print(json.dumps(response, allow_nan=False), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
