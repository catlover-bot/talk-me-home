#!/usr/bin/env python3
"""Verify the actual Goal 006 manifest locally; never deploy or enable Live.

Run from the repository: python3 artifacts/goal-006/publication-prep/verify_local.py
Requires the already installed PyYAML, Node 24 and game dependencies. No install
or external request is performed. Existing receipts are never overwritten.
"""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import time
from datetime import datetime, timezone

import yaml

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--receipt', default='artifacts/goal-006/publication-prep/local-verification.json')
args = parser.parse_args()
receipt = (ROOT / args.receipt).resolve()
assert receipt.is_relative_to(ROOT / 'artifacts/goal-006/publication-prep')
assert not receipt.exists(), 'Choose another receipt filename to preserve the earlier run.'
stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')
logs = ROOT / '.validation/goal-006-publication-prep' / stamp
logs.mkdir(parents=True, exist_ok=False)
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
manifest_path = ROOT / 'render.goal-006.yaml'
old_manifest = ROOT / 'render.game.yaml'
old_hash = sha(old_manifest)
report = {'status': 'running', 'startedAt': stamp, 'checks': [], 'newProviderRequests': 0,
          'issuedTokens': 0, 'allowanceCreated': False, 'deploymentPerformed': False,
          'externalRequests': 0, 'forcedCleanup': False, 'logs': str(logs.relative_to(ROOT)),
          'limitations': ['Local YAML parsing and explicit setting assertions are not Render schema or account acceptance.',
                          'No service, disk, DNS, HTTPS certificate, public URL or hosting charge was created or verified.',
                          'The networked npm ci install step was not executed; existing installed dependencies were used.',
                          'Loopback HTTP cookies omit Secure; the existing focused HTTPS-origin test separately checks Secure cookies.',
                          'No browser interaction or real provider session is part of this focused publication check.']}
server = None
server_log = None
port = None


def passed(label, **details):
    report['checks'].append({'label': label, 'status': 'passed', **details})


def run(command, name, env):
    target = logs / name
    with target.open('wb') as out:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=out,
                                stderr=subprocess.STDOUT, timeout=90, check=False)
    assert result.returncode == 0, f'{name} failed; inspect its local log.'
    return target


def request(path, body=None, cookie=None, extra=None):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    headers = {'Origin': origin}
    if cookie:
        headers['Cookie'] = cookie
    if body is not None:
        headers['Content-Type'] = 'application/json'
    headers.update(extra or {})
    try:
        connection.request('GET' if body is None else 'POST', path,
                           None if body is None else json.dumps(body), headers)
        response = connection.getresponse()
        return response.status, {key.lower(): value for key, value in response.getheaders()}, response.read()
    finally:
        connection.close()


try:
    config = yaml.safe_load(manifest_path.read_text())
    assert set(config) == {'services'} and len(config['services']) == 1
    service = config['services'][0]
    for key, value in {'type': 'web', 'name': 'talk-me-home-goal-006', 'runtime': 'node',
                       'branch': 'work/goal-006-gameplay-and-submission', 'plan': '0.5c-512mb',
                       'numInstances': 1, 'autoDeployTrigger': 'off', 'healthCheckPath': '/api/health',
                       'buildCommand': 'npm ci --include=dev && npm run build:game',
                       'startCommand': 'npm run start:game'}.items():
        assert service[key] == value, key
    assert service['disk'] == {'name': 'talk-me-home-goal-006-admission', 'mountPath': '/var/data', 'sizeGB': 1}
    entries = {entry['key']: entry for entry in service['envVars']}
    assert len(entries) == len(service['envVars'])
    expected = {'NODE_ENV': 'production', 'NODE_VERSION': '24.20.0', 'GAME_BIND_ADDRESS': '0.0.0.0',
                'GAME_PUBLIC_LIVE_ENABLED': '0', 'GAME_DISABLE_LIVE': '1', 'GAME_LIVE_CONCURRENT_LIMIT': '2',
                'GAME_LIVE_ALLOWANCE_FILE': '/var/data/talk-me-home-live-allowance.jsonl'}
    assert set(entries) == set(expected) | {'GAME_ORIGIN'}
    for key, value in expected.items():
        assert entries[key] == {'key': key, 'value': value}, key
    assert entries['GAME_ORIGIN'] == {'key': 'GAME_ORIGIN', 'sync': False}
    passed('Actual YAML parsed and bounded publication settings matched', parser=f'PyYAML {yaml.__version__}',
           manifestSha256=sha(manifest_path), serviceCount=1, nodeVersion='24.20.0', liveDisabled=True,
           secretValuesInManifest=False, schemaAcceptance='not evaluated')

    # Construct a fresh environment. Do not inherit credentials, .env, proxies,
    # NODE_OPTIONS, npm user configuration or an existing allowance path.
    for name in ['npm-user-config', 'npm-global-config']:
        (logs / name).write_text('')
    environment = {**expected, 'PATH': '/home/mhirotaka/.local/bin:/usr/local/bin:/usr/bin:/bin',
                   'NPM_CONFIG_USERCONFIG': str(logs / 'npm-user-config'),
                   'NPM_CONFIG_GLOBALCONFIG': str(logs / 'npm-global-config'),
                   'NPM_CONFIG_CACHE': str(logs / 'npm-cache'), 'CI': '1'}
    assert subprocess.check_output(['node', '--version'], env=environment, text=True).strip() == 'v24.20.0'
    report['commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    run(['npm', 'run', 'build:game'], 'build.log', environment)
    passed('Existing game production build command', log=str((logs / 'build.log').relative_to(ROOT)))
    test_log = run(['node', '--import', 'tsx', '--test', '--test-name-pattern',
                    '^(production serves|production rejects|all deployed)', 'tests/production.test.ts'],
                   'production-focused.log', environment)
    test_text = test_log.read_text()
    assert re.search(r'(?:#|\u2139)\s*pass\s+3\b', test_text), 'Expected three focused production cases.'
    passed('Three existing production cases: static files, origin checks, all-route ownership and disabled Live',
           cases=3, log=str(test_log.relative_to(ROOT)), fundedOrInjectedTokenCasesSelected=False)

    with socket.socket() as candidate:
        candidate.bind(('127.0.0.1', 0))
        port = candidate.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    absent_allowance = logs / 'unused-allowance-must-remain-absent.jsonl'
    assert not absent_allowance.exists()
    environment.update(PORT=str(port), GAME_ORIGIN=origin, GAME_BIND_ADDRESS='127.0.0.1',
                       GAME_LIVE_ALLOWANCE_FILE=str(absent_allowance))
    report['localOverrides'] = {'bind': '127.0.0.1 instead of manifest 0.0.0.0', 'origin': origin,
                                'port': port, 'allowancePath': str(absent_allowance.relative_to(ROOT)),
                                'reason': 'No LAN exposure or access to a historical/provider allowance.'}
    server_log = (logs / 'production-start.log').open('wb')
    server = subprocess.Popen(['npm', 'run', 'start:game'], cwd=ROOT, env=environment,
                              stdout=server_log, stderr=subprocess.STDOUT, start_new_session=True)
    for attempt in range(50):
        assert server.poll() is None, 'Production process exited during startup.'
        try:
            status, _, body = request('/api/health')
            if status == 200 and json.loads(body) == {'ok': True}:
                break
        except (OSError, ValueError):
            pass
        time.sleep(.1)
    else:
        raise AssertionError('Local production health did not become ready within five seconds.')
    passed('Actual start:game process and health endpoint', httpStatus=200, loopbackOnly=True)

    status, headers, body = request('/')
    assert status == 200 and b'Talk Me Home' in body and b'<div id="root">' in body
    assert headers['cache-control'] == 'no-cache'
    assert "frame-ancestors 'none'" in headers['content-security-policy']
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', body.decode())
    assert len(assets) >= 2
    for path in assets:
        status, headers, content = request(path)
        assert status == 200 and content and 'immutable' in headers['cache-control']
        assert 'javascript' in headers['content-type'] if path.endswith('.js') else 'text/css' in headers['content-type']
    for path in ['/.env', '/game/server/http.ts', '/.live-test-budget.json', '/api/unknown']:
        assert request(path)[0] == 404
    passed('Actual compiled title, referenced JS/CSS, CSP/cache headers and private-path rejection', assets=len(assets))

    assert request('/api/health', extra={'Host': 'unconfigured.invalid'})[0] == 403
    for extra in [{'Origin': 'https://unconfigured.invalid'}, {'Origin': ''}, {'Sec-Fetch-Site': 'cross-site'}]:
        assert request('/api/sessions', {}, extra=extra)[0] == 403
    passed('Actual production rejects unconfigured Host, foreign/missing Origin and cross-site writes')
    status, _, body = request('/api/access')
    access = json.loads(body)
    assert status == 200 and access['liveEnabled'] is False and access['available'] is False and access['authorized'] is False
    assert request('/api/access', {'code': 'not-a-real-access-code'})[0] == 503
    passed('Public access reports Live unavailable and rejects access exchange', tokenIssued=False)

    sessions = []
    for unused in range(2):
        status, headers, body = request('/api/sessions', {'missionKind': 'rescue', 'scenario': 'classic'})
        view = json.loads(body)
        assert status == 201 and view['missionKind'] == 'rescue'
        assert 'HttpOnly' in headers['set-cookie'] and 'SameSite=Strict' in headers['set-cookie']
        sessions.append((view, headers['set-cookie'].split(';')[0]))
    view, owner = sessions[0]
    path = f"/api/sessions/{view['sessionId']}"
    assert request(path, cookie=owner)[0] == 200
    assert request(path + f"/record?roundId={view['roundId']}", cookie=owner)[0] == 200
    actions = ['power', 'relay', 'dock-control', 'annotations', 'tools', 'proposal-decision', 'stop',
               'resume', 'reset', 'end', 'cancel', 'voice-token', 'messages', 'notebook', 'hint']
    for outsider in [None, sessions[1][1]]:
        for suffix in ['', f"/record?roundId={view['roundId']}", f"/recap?roundId={view['roundId']}"]:
            assert request(path + suffix, cookie=outsider)[0] == 404
        for action in actions:
            assert request(path + '/' + action, {}, cookie=outsider)[0] == 404
    passed('Actual owner-bound Rescue API and all-route outsider rejection', outsiders=2, protectedReadRoutes=3, protectedWriteRoutes=15)
    before = json.loads(request(path, cookie=owner)[2])
    status, _, body = request(path + '/voice-token', {'roundId': view['roundId']}, cookie=owner)
    assert status == 503 and 'token' not in json.loads(body)
    assert json.loads(request(path, cookie=owner)[2]) == before
    assert not absent_allowance.exists()
    passed('Owner token route fails before reservation or issuance; mission unchanged; unused ledger absent', httpStatus=503)
    assert sha(old_manifest) == old_hash
    passed('Original render.game.yaml preserved', sha256=old_hash)
    source_delta = subprocess.check_output(['git', 'diff', '--name-only',
        '5cbca538c80748c6944a43b9d886e9e74c50ce36', '--', 'game', 'tests', 'scripts',
        'package.json', 'package-lock.json', 'playwright.config.ts', 'vite.config.ts',
        'tsconfig.json', 'tsconfig.server.json'], cwd=ROOT, text=True)
    assert not source_delta.strip(), 'Accepted game/test/build sources changed.'
    passed('Accepted application, tests, harness and package/build configuration unchanged',
           acceptedCommit='5cbca538c80748c6944a43b9d886e9e74c50ce36')
    report['verifierSha256'] = sha(__file__)
    report['status'] = 'passed'
except Exception as error:
    report['status'] = 'failed'
    report['failure'] = f'{type(error).__name__}: {error}'
finally:
    if server is not None:
        try:
            os.killpg(server.pid, signal.SIGTERM)
            server.wait(timeout=5)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            report['forcedCleanup'] = True
            report['status'] = 'failed'
            report['failure'] = 'Owned production process required forced termination after its cleanup deadline.'
            os.killpg(server.pid, signal.SIGKILL)
            server.wait(timeout=5)
        report['ownedProcessExited'] = server.poll() is not None
    if server_log:
        server_log.close()
    if port is not None:
        with socket.socket() as probe:
            probe.settimeout(.5)
            report['ownedPortClosed'] = probe.connect_ex(('127.0.0.1', port)) != 0
        if not report['ownedPortClosed']:
            report['status'] = 'failed'
            report['failure'] = 'Owned production port was still listening after cleanup.'
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    receipt.parent.mkdir(parents=True, exist_ok=True)
    with receipt.open('x') as out:
        json.dump(report, out, indent=2)
        out.write('\n')
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'receipt': str(receipt.relative_to(ROOT))}))
raise SystemExit(0 if report['status'] == 'passed' else 1)
