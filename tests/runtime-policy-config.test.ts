import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { sessionConfig } from '../game/agent/config.ts'
import { robotPrompt } from '../game/agent/prompt.ts'
import { createSession, voiceToken } from '../game/client/api.ts'
import type { VoiceAudio } from '../game/client/audio.ts'
import { LiveVoice, type VoiceSocket } from '../game/client/voice.ts'
import { createGameServer } from '../game/server/http.ts'

// These fixed hashes come from delivered 6521bc0's controlled local configuration,
// recorded before the policy edit. No private baseline file is required in CI.
const oldPromptTextSha256 = '91fab9ffdf310da7b33aea7f0e09e6c53114d30ebc173162332b7fe23f0ebe2a'
const oldSerializedConfigSha256 = 'bbe17ef3fb2bdc8af2ef59ceb52fba4b174d462643b6131734fd62f5ccbebeea'
const preservedTransportAndGreetingSha256 = '543788394cf464d7fc043d45e614a5a627afa997275f0c54bbed253ee0494cf9'
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

class OfflineSocket implements VoiceSocket {
  readyState = 0
  onopen: VoiceSocket['onopen'] = null
  onmessage: VoiceSocket['onmessage'] = null
  onclose: VoiceSocket['onclose'] = null
  onerror: VoiceSocket['onerror'] = null
  sent: string[] = []
  send(serialized: string) {
    this.sent.push(serialized)
    if (JSON.parse(serialized).type === 'session.end') queueMicrotask(() => this.emit('session.ended'))
  }
  open() { this.readyState = 1; this.onopen?.(new Event('open')) }
  emit(type: string) { this.onmessage?.({ data: JSON.stringify({ type }) } as MessageEvent) }
  close() { this.readyState = 3 }
}

for (const [missionKind, scenario] of [['rescue', 'classic'], ['training', 'maintenance']] as const) {
  test(`offline ${missionKind}: actual token route and browser mapper deliver the changed policy as the first socket message`, { timeout: 10_000 }, async t => {
    const nativeFetch = globalThis.fetch
    let injectedProviderCalls = 0
    let socketCreations = 0
    let audioClosed = 0
    let tokenResponses = 0
    let receivedHttpConfiguration: unknown
    let ownerCookie = ''
    const errors: string[] = []
    const socket = new OfflineSocket()
    const server = createGameServer({
      apiKey: 'offline-policy-injected-key', allowTestProvider: true,
      fetch: (async input => {
        // This injected function returns locally; it never delegates provider URLs.
        injectedProviderCalls++
        const url = new URL(String(input))
        assert.equal(url.origin + url.pathname, 'https://agents.assemblyai.com/v1/token')
        assert.equal(url.searchParams.get('max_session_duration_seconds'), '600')
        return Response.json({ token: 'offline-policy-socket-placeholder' })
      }) as typeof fetch,
    })
    const audio: VoiceAudio = {
      async prepare(microphone) { assert.equal(microphone, false) },
      play() { assert.fail('Configuration delivery must not synthesize model audio.') },
      stopPlayback() {},
      async close() { audioClosed++ },
    }
    const live = new LiveVoice({ onTranscript() {}, onStatus() {}, onError: message => errors.push(message) }, {
      createAudio: () => audio,
      createSocket: url => {
        socketCreations++
        assert.equal(url.origin + url.pathname, 'wss://agents.assemblyai.com/v1/ws')
        // A fake socket, not a WebSocket: no provider connection is possible.
        queueMicrotask(() => { socket.open(); socket.emit('session.ready') })
        return socket
      },
      handshakeMs: 500, endGraceMs: 100,
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      // Only the real client's relative API requests can cross this adapter.
      assert.equal(typeof input, 'string')
      const path = String(input)
      assert.ok(path.startsWith('/api/'), 'Only controlled loopback API requests are allowed.')
      const response = await nativeFetch(origin + path, { ...init,
        headers: { ...Object.fromEntries(new Headers(init?.headers)), ...(ownerCookie ? { cookie: ownerCookie } : {}) },
        signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(2000)]) })
      if (response.headers.get('set-cookie')) ownerCookie = response.headers.get('set-cookie')!.split(';')[0]!
      if (path.endsWith('/voice-token')) {
        tokenResponses++
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('cache-control'), 'no-store')
        const body = await response.clone().json() as { sessionConfig: unknown; maxSessionSeconds: number }
        receivedHttpConfiguration = body.sessionConfig
        assert.equal(body.maxSessionSeconds, 600)
      }
      return response
    })
    try {
      const view = await createSession(scenario, missionKind)
      await live.start({ token: () => voiceToken(view), microphone: false,
        executeTool: async () => { assert.fail('Configuration verification must not execute robot tools.') },
        cancelPending: async () => {},
      })
      assert.equal(injectedProviderCalls, 1, 'Exactly one local fake token response is used.')
      assert.equal(tokenResponses, 1)
      assert.equal(socketCreations, 1)
      assert.deepEqual(receivedHttpConfiguration, sessionConfig)
      assert.equal(socket.sent.length, 1)
      assert.equal(socket.sent[0], JSON.stringify({ type: 'session.update', session: receivedHttpConfiguration }))
      const wire = JSON.parse(socket.sent[0]) as { type: string; session: typeof sessionConfig }
      assert.equal(wire.type, 'session.update')
      assert.equal(wire.session.system_prompt, robotPrompt)
      assert.notEqual(sha256(wire.session.system_prompt), oldPromptTextSha256)
      assert.notEqual(sha256(JSON.stringify(wire.session)), oldSerializedConfigSha256)
      assert.match(wire.session.system_prompt, /every physical action needs their separate console confirmation/)
      assert.match(wire.session.system_prompt, /awaiting_confirmation means NOT EXECUTED/)
      assert.match(wire.session.system_prompt, /none replaces pressing Confirm this action/)
      assert.match(wire.session.system_prompt, /Checking a known proposal is read-only and needs no extra permission/)
      assert.match(wire.session.system_prompt, /Continue the current clear request after that check/)
      assert.match(wire.session.system_prompt, /A verified committed receipt is sufficient evidence for its exact past action/)
      assert.deepEqual(wire.session.tools.map(tool => tool.name), ['observe_room', 'inspect_object', 'propose_interaction', 'propose_move', 'get_action_status'])
      for (const name of ['propose_interaction', 'propose_move']) {
        const tool = wire.session.tools.find(tool => tool.name === name)
        assert.ok(tool)
        assert.equal(tool.description, sessionConfig.tools.find(tool => tool.name === name)?.description)
        assert.match(tool.description, /without executing|without moving/)
        assert.match(tool.description, /console/)
        assert.equal(tool.parameters.additionalProperties, false)
      }
      assert.equal(Object.hasOwn(wire.session, 'agent_id'), false)
      assert.equal(wire.session.output.voice, 'anna')
      assert.equal(sha256(JSON.stringify({ greeting: wire.session.greeting, input: wire.session.input, output: wire.session.output })), preservedTransportAndGreetingSha256)
      const statusTool = wire.session.tools.find(tool => tool.name === 'get_action_status')!
      assert.deepEqual(statusTool.parameters.required, ['proposal_id'])
      assert.equal(statusTool.parameters.additionalProperties, false)
      assert.match(statusTool.description, /Do not poll/)
      assert.match(statusTool.description, /without asking permission/)
      assert.deepEqual(Object.keys(wire.session), ['system_prompt', 'greeting', 'tools', 'input', 'output'])
      // Developer-only regression facts stay out of the transmitted instructions.
      assert.doesNotMatch(socket.sent[0], /Door and Conveyor share one Power supply|Door and Conveyor use one supply|Cargo Bay|Relay Gallery|Return Dock|latch_open|far_side|Beacon|Harbor|"enum"/)
      assert.deepEqual(errors, [])
    } finally {
      await live.end()
      t.mock.restoreAll()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    assert.equal(live.endAcknowledged, true, 'This ACK is injected fixture evidence, not a real provider ending.')
    assert.equal(audioClosed, 1)
    assert.equal(socket.readyState, 3)
    assert.equal(socket.onmessage, null)
  })
}
