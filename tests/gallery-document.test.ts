import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MissionRecord, RecordedMessage } from '../game/shared/contracts';
import { GalleryDocument, latestGalleryReport } from '../game/client/components/GalleryDocument';
import { MessageQuote } from '../game/client/components/CommunicationDock';
import { PipPortrait } from '../game/client/components/PipPortrait';

const message = (patch: Partial<RecordedMessage> = {}): RecordedMessage => ({ roundId: 'round', messageId: 'report', segmentId: 'call', role: 'robot', text: 'I can see the Ring emblem. The east gate is open; I have not checked the passage.', origin: 'live_voice', inputMethod: 'robot', interrupted: false, chapter: 'gallery', chapterEpoch: 2, timestamp: 1000, ...patch });
const record = (messages: RecordedMessage[]): MissionRecord => ({ roundId: 'round', messages, notebook: [], hintsUsed: [], debrief: null });

test('Gallery quotes exact eligible communicated text without inferring map position or accepting another scope', () => {
  const spoken = message();
  const data = record([spoken, message({ messageId: 'partial', interrupted: true, text: 'Sail' }), message({ messageId: 'old-round', roundId: 'old', text: 'Leaf' }), message({ messageId: 'wrong-chapter', chapter: 'cargo', text: 'Dock' }), message({ messageId: 'human', role: 'human', text: 'I think Fork' }), message({ messageId: 'game', role: 'game', origin: 'game', text: 'Move confirmed' })]);
  assert.equal(latestGalleryReport(data), spoken);
  const html = renderToStaticMarkup(createElement(GalleryDocument, { record: data }));
  assert.ok(html.includes(spoken.text));
  assert.match(html, /Location unknown until you mark it/);
  assert.doesNotMatch(html, /class="private-location-mark"|YOUR MARK/);
  assert.match(html, /Quote &amp; attach to map/);
  assert.match(html, /Selected requests · not microphone speech/);
});

test('private plan, explored marks and historical gate quote remain distinct from a stable report association', () => {
  const data = record([message({ reportContext: { relay: 'beacon', earlier: true } })]);
  const common = { messageId: 'report', text: data.messages[0].text, origin: 'live_voice' as const, chapter: 'gallery' as const, interrupted: false, associatedAt: 2000, reportedAt: 1000, relayAtReport: 'beacon' as const };
  data.annotations = { chapter: 'gallery', location: null, blockedGates: ['g2'], plannedGates: ['g1'], exploredGates: ['g3'], reportLinks: [
    { ...common, target: 'g1', targetKind: 'corridor', dynamic: true, earlier: true },
    { ...common, target: 'ring', targetKind: 'room', dynamic: false, earlier: false },
  ] };
  const html = renderToStaticMarkup(createElement(GalleryDocument, { record: data, annotation: data.annotations }));
  assert.match(html, /aria-label="Planned: Ring – Fork"/);
  assert.match(html, /aria-label="Player-marked explored: Sail – Dock"/);
  assert.match(html, /Your suspected obstruction: Fork – Sail/);
  assert.match(html, /Historical gate report — recheck/);
  assert.match(html, /Stable clue — reported then/);
  assert.match(html, /Earlier conditions — request a fresh check/);
  assert.doesNotMatch(html, /class="private-location-mark"/);
});

test('selected recovery request keeps human input provenance distinct from microphone speech', () => {
  const html = renderToStaticMarkup(createElement(MessageQuote, { item: { id: 'quick:1', role: 'human', text: 'Please look around.', final: true, origin: 'live_voice', inputMethod: 'quick_request', roundId: 'round', segmentId: 'call', timestamp: 1000, saved: true, chapter: 'gallery', chapterEpoch: 2 }, onPin() {} }));
  assert.match(html, /Mission Control/);
  assert.match(html, /Live Voice · Selected request/);
  assert.doesNotMatch(html, /· Speech|· Typed/);
});

test('a pending proposal has a calm waiting portrait rather than an executed action state', () => {
  const html = renderToStaticMarkup(createElement(PipPortrait, { state: 'awaiting_confirmation', compact: true }));
  assert.match(html, /data-state="awaiting_confirmation"/);
  assert.match(html, /Waiting for your confirmation/);
  assert.doesNotMatch(html, /Arrival confirmed|data-state="success"/);
});
