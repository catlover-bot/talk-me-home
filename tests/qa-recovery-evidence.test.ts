import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error The historical metadata exporter is a native Node CLI module.
import { normalizeObservedEvents } from '../scripts/qa-recovery-evidence.mjs'

test('recovery metadata retains observed causal order without inventing tool reply association', () => {
  const rows = normalizeObservedEvents([
    { type: 'synthetic.speech.started', atMs: 10.02, id: 'fixture-original' },
    { type: 'reply.started', atMs: 20, replyRef: 7 },
    { type: 'input.speech.started', atMs: 30 },
    { type: 'reply.done', atMs: 40, replyRef: 7, status: 'interrupted' },
    { type: 'tool.call', atMs: 50, callRef: 9, name: 'interact_object' },
    { type: 'reply.done', atMs: 60, replyRef: 7, status: 'completed' },
  ])
  assert.deepEqual(rows.map((row: { atMs: number }) => row.atMs), [10, 20, 30, 40, 50, 60])
  assert.equal(rows[1].reply, 'reply-1')
  assert.equal(rows[3].reply, 'reply-1')
  assert.equal(rows[5].reply, 'reply-1')
  assert.equal(rows[4].call, 'call-1')
  assert.equal('reply' in rows[4], false)
  assert.equal(rows.some((row: { type: string }) => row.type === 'tool.result'), false)
})

test('recovery metadata exports no secret-bearing or unavailable source fields', () => {
  const rows = normalizeObservedEvents([
    { type: 'session.ready', atMs: 1, config: 'fixture-secret', resume_token: 'fixture-secret' },
    { type: 'tool.call', atMs: 2, callRef: 3, name: 'observe_room', arguments: { hidden: 'fixture-secret' }, reply_id: 'fixture-secret' },
    { type: 'tool.result', atMs: 3, callRef: 3, isError: true, result: 'fixture-secret' },
    { type: 'transcript.user', atMs: 4, reference: 4, text: 'fixture-secret' },
    { type: 'socket.close', atMs: 5, clean: true, code: 1005, url: 'fixture-secret' },
  ])
  assert.doesNotMatch(JSON.stringify(rows), /fixture-secret/)
  assert.equal(rows.at(-1).clean, true)
  assert.equal(rows.some((row: { type: string }) => row.type === 'session.ended'), false)
})
