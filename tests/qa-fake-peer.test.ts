import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Page, WebSocketRoute } from '@playwright/test';
import { fakeProvider, type FixtureEvent } from './e2e/fake-provider';

async function peerFixture() {
  let onMessage: (data: string) => void = () => { throw new Error('Peer not installed.'); };
  let closed = false;
  const events = new EventEmitter();
  const page = Object.assign(events, {
    addInitScript: async () => {}, route: async () => {}, isClosed: () => closed,
    routeWebSocket: async (_url: string, install: (socket: WebSocketRoute) => void) => {
      install({ onClose() {}, onMessage(callback: typeof onMessage) { onMessage = callback; }, send() {} } as unknown as WebSocketRoute);
    },
  }) as unknown as Page;
  const provider = await fakeProvider(page);
  return { provider, listeners: () => events.listenerCount('close'), receive: (event: FixtureEvent) => onMessage(JSON.stringify(event)), close: () => { closed = true; events.emit('close'); } };
}

test('offline peer wait receives future exact messages and historical messages without a lost-event gap', async () => {
  const peer = await peerFixture();
  let settled = false;
  const pending = peer.provider.waitForSent(event => event.type === 'conversation.message' && event.content === 'selected').then(value => { settled = true; return value; });
  assert.equal(peer.listeners(), 1);
  peer.receive({ type: 'conversation.message', content: 'unrelated' });
  await Promise.resolve(); assert.equal(settled, false);
  peer.receive({ type: 'conversation.message', content: 'selected' });
  assert.equal((await pending).content, 'selected'); assert.equal(peer.listeners(), 0);
  assert.equal(await peer.provider.waitForSent(event => event.content === 'selected'), peer.provider.sent[1]);
  assert.equal(peer.listeners(), 0);
  const firstSent = peer.provider.sent.length;
  const next = peer.provider.waitForSent(event => event.content === 'selected', firstSent);
  assert.equal(peer.listeners(), 1);
  peer.receive({ type: 'conversation.message', content: 'selected' });
  assert.equal(await next, peer.provider.sent[firstSent]); assert.equal(peer.listeners(), 0);
});

test('offline peer keeps the exact five-second failure bound and removes timed-out observers', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const peer = await peerFixture(); let calls = 0; let settled = false;
  const pending = peer.provider.waitForSent(() => { calls++; return false; });
  const rejected = assert.rejects(pending, /within 5000ms/).then(() => { settled = true; });
  context.mock.timers.tick(4999); await Promise.resolve(); assert.equal(settled, false); assert.equal(peer.listeners(), 1);
  context.mock.timers.tick(1); await rejected; assert.equal(peer.listeners(), 0);
  peer.receive({ type: 'conversation.message', content: 'late' }); assert.equal(calls, 0);
});

test('offline peer removes timers and observers when the page closes or a predicate rejects', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const peer = await peerFixture(); let calls = 0;
  const waiting = peer.provider.waitForSent(() => { calls++; return false; });
  const closed = assert.rejects(waiting, /peer closed/);
  peer.close(); await closed; assert.equal(peer.listeners(), 0);
  peer.receive({ type: 'conversation.message' }); assert.equal(calls, 0);
  await assert.rejects(peer.provider.waitForSent(() => false), /peer closed/);
  const other = await peerFixture();
  const throwing = assert.rejects(other.provider.waitForSent(() => { throw new Error('Predicate failed.'); }), /Predicate failed/);
  other.receive({ type: 'conversation.message' }); await throwing; assert.equal(other.listeners(), 0);
  context.mock.timers.runAll();
});
