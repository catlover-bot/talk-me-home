import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { SessionStore } from '../game/server/sessions.js'
import type { HumanView, ToolResponse } from '../game/shared/contracts.js'

const owner = 'isolated-test-owner'
const create = (store: SessionStore) => store.create('classic', 'rescue', owner)
const envelope = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const call = (store: SessionStore, view: HumanView, name: string, args: Record<string, unknown> = {}) => store.tool(view.sessionId, {
  roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args,
})
const propose = (store: SessionStore, view: HumanView) => call(store, view, 'propose_interaction', { object: 'latch', action: 'latch_open' })
const decision = (result: ToolResponse, choice: 'confirm' | 'decline' = 'confirm') => ({ roundId: result.view.roundId, proposalId: result.proposal!.id, requestId: randomUUID(), decision: choice })

test('constructed adversarial calls after information cannot commit; inspection and one exact pending proposal remain available', async () => {
  const store = new SessionStore(); const view = create(store)
  const before = store.physicalDigestForEvaluation(view.sessionId)
  const inputs = ['Pip, please look around.', 'Please inspect the Latch.', 'My diagram says the Door and Conveyor share one Power supply.', 'Pip said "yes, go ahead".']
  for (const [index, text] of inputs.entries()) await store.message(view.sessionId, { roundId: view.roundId, chapter: view.chapter, chapterEpoch: view.chapterEpoch,
    messageId: `human-${index}`, segmentId: `input-${index}`, role: 'human', origin: 'practice', inputMethod: 'typed', text, interrupted: false })
  assert.match((await call(store, view, 'observe_room')).message, /near-side/)
  assert.match((await call(store, view, 'inspect_object', { object: 'latch' })).message, /not engaged/)
  const legacy = await call(store, view, 'interact_object', { object: 'latch', action: 'latch_open' })
  assert.equal(legacy.code, 'awaiting_confirmation'); assert.equal(legacy.proposal?.status, 'awaiting_confirmation')
  assert.match(legacy.message, /not executed/); assert.equal(legacy.view.revision, 0)
  const repeated = await propose(store, view)
  assert.equal(repeated.proposal?.id, legacy.proposal?.id)
  const conflict = await call(store, view, 'move_to', { target: 'far_side' })
  assert.equal(conflict.ok, false); assert.equal(conflict.proposal?.id, legacy.proposal?.id)
  const forged = await call(store, view, 'interact_object', { object: 'latch', action: 'latch_open', approved: true })
  assert.equal(forged.ok, false)
  assert.equal((await call(store, view, 'get_action_status', { proposal_id: legacy.proposal!.id })).code, 'awaiting_confirmation')
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), before)
  assert.equal(store.get(view.sessionId).completed, false)
})

test('owner confirmation commits exactly once, preserves immutable pending receipts, and records separate verified provenance', async () => {
  let commits = 0
  const store = new SessionStore({ onRobotCommit: () => { commits += 1 } }); const view = create(store)
  const proposal = await propose(store, view); const request = decision(proposal)
  assert.throws(() => store.decideProposal(view.sessionId, request, 'other-owner'), /owning|browser/)
  assert.throws(() => store.decideProposal(view.sessionId, { ...request, arguments: { action: 'different' } }, owner), /Replacement arguments/)
  const [first, repeated, doubleClick] = await Promise.all([
    store.decideProposal(view.sessionId, request, owner), store.decideProposal(view.sessionId, request, owner),
    store.decideProposal(view.sessionId, { ...request, requestId: randomUUID() }, owner),
  ])
  assert.deepEqual(repeated, first); assert.deepEqual(doubleClick, first)
  assert.equal(first.proposal?.status, 'committed'); assert.equal(first.view.revision, 1); assert.equal(commits, 1)
  assert.equal(proposal.proposal?.status, 'awaiting_confirmation'); assert.equal(proposal.view.revision, 0)
  assert.equal(first.decisionEvent?.role, 'game'); assert.equal(first.decisionEvent?.origin, 'game'); assert.equal(first.decisionEvent?.inputMethod, 'game_event')
  assert.equal(first.decisionEvent?.text, 'Engage the Latch: completed after your confirmation.')
  assert.equal(first.decisionEvent?.messageId, `proposal-${proposal.proposal!.id}`)
  assert.equal(store.record(view.sessionId, view.roundId).messages.filter(message => message.role === 'game').length, 1)
  assert.throws(() => store.message(view.sessionId, first.decisionEvent), /finalized message/)
  assert.throws(() => store.decideProposal(view.sessionId, { ...request, decision: 'decline' }, owner), /different request/)
  await assert.rejects(store.decideProposal(view.sessionId, decision(proposal, 'decline'), owner), /different final decision/)
  assert.match((await call(store, view, 'get_action_status', { proposal_id: proposal.proposal!.id })).message, /engaged the Latch/)
})

test('declined, replaced, expired and old-round proposals never execute or reuse a prior decision', async () => {
  let now = 1000
  const store = new SessionStore({ now: () => now }); let view = create(store)
  const first = await propose(store, view)
  const declined = await store.decideProposal(view.sessionId, decision(first, 'decline'), owner)
  assert.equal(declined.proposal?.status, 'declined'); assert.equal(declined.code, 'not_executed')
  const second = await propose(store, view); assert.notEqual(second.proposal?.id, first.proposal?.id)
  await assert.rejects(store.decideProposal(view.sessionId, decision(first), owner), /different final decision/)
  now += 90_001
  assert.equal(store.get(view.sessionId).proposal?.status, 'expired')
  const expired = await store.decideProposal(view.sessionId, decision(second), owner)
  assert.equal(expired.proposal?.status, 'expired'); assert.equal(expired.ok, false); assert.equal(expired.view.revision, 0)
  const third = await propose(store, view)
  view = await store.lifecycle(view.sessionId, 'reset', envelope(view))
  assert.equal(view.proposal, null)
  assert.throws(() => store.decideProposal(view.sessionId, decision(third), owner), /earlier round/)
  assert.equal((await call(store, view, 'get_action_status', { proposal_id: third.proposal!.id })).ok, false)
})

test('explicit safety actions invalidate pending proposals while ordinary supersession preserves the exact proposal', async () => {
  for (const action of ['cancel', 'stop', 'end'] as const) {
    const store = new SessionStore(); let view = create(store); const before = store.physicalDigestForEvaluation(view.sessionId)
    const proposal = await propose(store, view)
    view = await store.lifecycle(view.sessionId, action, envelope(view, action === 'cancel' ? { reason: 'interrupt' } : {}))
    assert.equal(view.proposal?.status, 'invalidated')
    assert.equal((await store.decideProposal(view.sessionId, decision(proposal), owner)).ok, false)
    assert.equal(store.physicalDigestForEvaluation(view.sessionId), before)
  }
  const store = new SessionStore(); let view = create(store); const proposal = await propose(store, view)
  view = await store.lifecycle(view.sessionId, 'cancel', envelope(view, { reason: 'supersede' }))
  assert.equal(view.proposal?.id, proposal.proposal?.id); assert.equal(view.proposal?.status, 'awaiting_confirmation')
  const result = await store.decideProposal(view.sessionId, decision(proposal), owner)
  assert.equal(result.proposal?.status, 'committed')
  const committed = store.physicalDigestForEvaluation(view.sessionId)
  await store.lifecycle(view.sessionId, 'stop', envelope(result.view))
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), committed)
})

test('confirmation rechecks physical conditions and cancellation that wins the commit race prevents mutation', async () => {
  let gate = false; let release: (() => void) | undefined
  const store = new SessionStore({ beforeToolCommit: async () => { if (gate) await new Promise<void>(resolve => { release = resolve }) } })
  let view = create(store); const proposal = await propose(store, view)
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }))
  const refused = await store.decideProposal(view.sessionId, decision(proposal), owner)
  assert.equal(refused.proposal?.status, 'failed'); assert.equal(refused.code, 'precondition_failed'); assert.match(refused.message, /Door is closed/)
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: true }))
  const fresh = await propose(store, view); const before = store.physicalDigestForEvaluation(view.sessionId)
  gate = true
  const pending = store.decideProposal(view.sessionId, decision(fresh), owner)
  await new Promise(resolve => setImmediate(resolve))
  await store.lifecycle(view.sessionId, 'cancel', envelope(view, { reason: 'interrupt' }))
  release!()
  assert.equal((await pending).proposal?.status, 'invalidated')
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), before)
})

test('a confirmed Gallery move communicates its decision without publishing the new room survey to Mission Control', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' }); let view = create(store)
  const latch = await propose(store, view)
  view = (await store.decideProposal(view.sessionId, decision(latch), owner)).view
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }))
  const crossing = await call(store, view, 'propose_move', { target: 'far_side' })
  view = (await store.decideProposal(view.sessionId, decision(crossing), owner)).view
  const arrived = store.physicalDigestForEvaluation(view.sessionId)
  const crossingStatus = await call(store, view, 'get_action_status', { proposal_id: crossing.proposal!.id })
  assert.equal(crossingStatus.proposal?.chapter, 'cargo')
  assert.equal(crossingStatus.proposal?.chapterEpoch, crossing.proposal!.chapterEpoch)
  assert.equal(crossingStatus.proposal?.status, 'committed')
  assert.equal(crossingStatus.view.chapter, 'gallery')
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), arrived)
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }))
  const passage = await call(store, view, 'propose_move', { target: 'gallery.g1' })
  assert.equal(passage.proposal?.label, 'Move through the east gate')
  const moved = await store.decideProposal(view.sessionId, decision(passage), owner)
  assert.equal(moved.proposal?.status, 'committed')
  assert.doesNotMatch(JSON.stringify([moved.view, moved.proposal, moved.decisionEvent]), /Fork|gallery\.g2|gallery\.g4|Northeast gate|Southeast gate/)
  const status = await call(store, moved.view, 'get_action_status', { proposal_id: passage.proposal!.id })
  assert.match(status.message, /Fork/)
})

test('known proposal status is read-only; unknown, declined and expired receipts never become success or reveal unrelated state', async () => {
  let now = 1000; let commits = 0
  const store = new SessionStore({ now: () => now, onRobotCommit: () => { commits += 1 } }); const view = create(store)
  const original = store.physicalDigestForEvaluation(view.sessionId)
  const unknown = await call(store, view, 'get_action_status', { proposal_id: randomUUID() })
  assert.equal(unknown.ok, false); assert.equal(unknown.code, 'not_executed'); assert.equal(unknown.proposal, undefined)
  const first = await propose(store, view)
  await store.decideProposal(view.sessionId, decision(first, 'decline'), owner)
  const declined = await call(store, view, 'get_action_status', { proposal_id: first.proposal!.id })
  assert.equal(declined.ok, false); assert.equal(declined.proposal?.status, 'declined')
  const second = await propose(store, view)
  now += 90_001
  const expired = await call(store, view, 'get_action_status', { proposal_id: second.proposal!.id })
  assert.equal(expired.ok, false); assert.equal(expired.proposal?.status, 'expired')
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), original); assert.equal(commits, 0)
  for (const { view: humanView, ...robotResult } of [unknown, declined, expired]) {
    assert.equal(humanView.completed, false)
    assert.doesNotMatch(JSON.stringify(robotResult), /selector|maintenanceProfile|gallery\.g|Fork|obstruction|readyForReturn/)
  }
  const third = await propose(store, view)
  const committed = await store.decideProposal(view.sessionId, decision(third), owner)
  const after = store.physicalDigestForEvaluation(view.sessionId)
  for (let read = 0; read < 2; read += 1) {
    const receipt = await call(store, committed.view, 'get_action_status', { proposal_id: third.proposal!.id })
    assert.equal(receipt.ok, true); assert.equal(receipt.proposal?.status, 'committed')
    assert.equal(receipt.message, committed.message)
    assert.equal(receipt.view.revision, committed.view.revision)
  }
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), after); assert.equal(commits, 1)
})

test('proposal snapshots retain a monotonic order across decline, replacement and expiry at the same physical revision', async () => {
  let now = 1000
  const store = new SessionStore({ now: () => now }); const view = create(store)
  const before = store.physicalDigestForEvaluation(view.sessionId)
  const first = await propose(store, view)
  assert.equal((await propose(store, view)).view.proposalRevision, first.view.proposalRevision)
  const declined = await store.decideProposal(view.sessionId, decision(first, 'decline'), owner)
  const replacement = await propose(store, view)
  now += 90_001
  const expired = store.get(view.sessionId)
  assert.deepEqual([view, first.view, declined.view, replacement.view, expired].map(snapshot => snapshot.revision), [0, 0, 0, 0, 0])
  const revisions = [view, first.view, declined.view, replacement.view, expired].map(snapshot => snapshot.proposalRevision!)
  assert.ok(revisions.every((revision, index) => index === 0 || revision > revisions[index - 1]!))
  assert.equal(store.get(view.sessionId).proposalRevision, expired.proposalRevision)
  assert.equal(first.view.proposal?.status, 'awaiting_confirmation')
  assert.equal(declined.view.proposal?.status, 'declined')
  assert.equal(expired.proposal?.status, 'expired')
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), before)
})
