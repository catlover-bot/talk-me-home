// Private QA beliefs from eligible communicated reports, never physical game truth.
import { communicatedActionClaim, communicatedEmblemClaim, communicatedPassabilityClaim } from './qa-player-policy.mjs';

export function createPlayerMemory({ round, chapter, visibleNames = [] }) {
  let scope = { round, chapter };
  let names = visibleNames;
  const seen = new Set();
  const beliefs = new Map();
  const records = [];
  let sequence = 0;
  const key = (subject, target) => target ? `${subject}:${target}` : subject;
  function retain(subject, value, message, target, completedTransition = false) {
    const id = key(subject, target);
    const previous = beliefs.get(id);
    if (previous?.displayedAt && message.displayedAt) {
      if (message.displayedAt < previous.displayedAt) return;
    } else if (previous?.messageOrder != null && message.order != null && message.order < previous.messageOrder) return;
    // An explicitly reported completed action explains a state change after an earlier
    // negative inspection. Conflicting state assertions still require a fresh check.
    const transition = subject === 'location' || completedTransition;
    const contradiction = !transition && previous?.value != null && value != null && previous.value !== value;
    const entry = { subject, target: target ?? null, reportedValue: value, value: contradiction ? null : value,
      contradiction, quote: message.text, messageId: message.messageId ?? null,
      source: message.source, sourceLabel: message.sourceLabel ?? null, order: ++sequence,
      messageOrder: message.order ?? null, round: scope.round, chapter: scope.chapter,
      displayedAt: message.displayedAt ?? null,
      sourceKey: message.sourceKey,
      final: message.final, interrupted: message.interrupted, identityBasis: message.identityBasis ?? 'supplied identity' };
    beliefs.set(id, entry); records.push(entry);
  }
  return {
    scope(next) {
      if (next.round !== scope.round || next.chapter !== scope.chapter) { beliefs.clear(); seen.clear(); scope = { ...next }; }
    },
    visibleNames(next) { names = next; },
    invalidate(subject, target) { beliefs.set(key(subject, target), { value: null, invalidated: true }); },
    get(subject, target) { return beliefs.get(key(subject, target)); },
    value(subject, target) { return beliefs.get(key(subject, target))?.value ?? null; },
    snapshot() { return records.map(record => ({ ...record })); },
    consume(messages, context = {}) {
      for (let message of messages) {
        if (message.round !== scope.round || message.chapter !== scope.chapter || message.speaker !== 'Pip') continue;
        const identity = message.messageId ?? `${message.sourceLabel}|${message.displayedAt ?? message.order ?? ''}|${message.speaker}`;
        if (message.final !== true || message.interrupted !== false || message.historical === true) {
          for (const [subject, belief] of beliefs) if (belief.sourceKey === identity) beliefs.set(subject, { ...belief, value: null, invalidated: true });
          continue;
        }
        const revision = JSON.stringify([identity, message.text, message.final, message.interrupted]);
        if (seen.has(revision)) continue;
        seen.add(revision);
        message = { ...message, sourceKey: identity };
        for (const [subject, belief] of beliefs) if (belief.sourceKey === identity) beliefs.set(subject, { ...belief, value: null, invalidated: true });
        for (const subject of ['latch', 'contact']) {
          const claim = communicatedActionClaim(message.text, subject);
          if (claim.mentioned) retain(subject, claim.value, message, undefined, claim.transition);
        }
        const locationClaim = communicatedEmblemClaim(message.text, names);
        const location = locationClaim.value;
        // A fresh explicit location after movement replaces the former location.
        if (locationClaim.mentioned) retain('location', location, message);
        const room = location ?? context.room ?? beliefs.get('location')?.value;
        if (!room) continue;
        const mentioned = [...message.text.toLowerCase().matchAll(/\b(northeast|northwest|southeast|southwest|east|west|north|south) (?:gate|passage|opening)\b/g)].map(match => match[1]);
        const targets = new Set([...mentioned, ...(context.target ? [context.target] : [])]);
        for (const direction of targets) {
          const claim = communicatedPassabilityClaim(message.text, direction);
          if (claim.mentioned) retain('passage', claim.value, message, `${room}:${direction}`);
        }
      }
    },
  };
}

/** DOM labels are the only eligibility source. No React state or record API is read. */
export async function readVisiblePlayerReports(page, round) {
  const messages = await page.locator('.history-message').evaluateAll(articles => articles.map((article, order) => ({
    messageId: article.getAttribute('data-message-id'), order,
    speaker: article.querySelector('strong')?.textContent,
    text: article.querySelector('p')?.textContent ?? '',
    sourceLabel: article.querySelector('.source-label')?.textContent ?? null,
    chapter: article.querySelector('.chapter-source')?.textContent ?? null,
    displayedAt: article.querySelector('time')?.getAttribute('datetime') ?? null,
    final: !/Partial transcript/.test(article.textContent),
    interrupted: /Interrupted \/ incomplete speech/.test(article.textContent),
    historical: /Previous call/.test(article.textContent),
  })));
  return messages.map(message => ({ ...message, round, source: 'rendered visible history',
    identityBasis: message.messageId ? 'visible message identity' : 'visible timestamp, source and snapshot order; no application message ID exposed' }));
}

/** All callers use the same memory; unknown mutations receive one check, never a blind retry. */
export async function confirmReportedAction({ memory, consume, say, request, clarify, retry, action, expectedValue = 'reported_done', checkpoint = async () => false }) {
  const opposite = expectedValue === 'reported_done' ? 'not_done' : 'reported_done';
  await consume();
  if (await checkpoint() || memory.value(action) === expectedValue) return true;
  const prior = memory.get(action);
  if (!prior || prior.value === opposite) {
    memory.invalidate(action);
    await say(request);
    await consume();
    if (await checkpoint() || memory.value(action) === expectedValue) return true;
  }
  await say(clarify);
  await consume();
  if (await checkpoint() || memory.value(action) === expectedValue) return true;
  if (memory.value(action) !== opposite) return false;
  memory.invalidate(action);
  await say(retry);
  await consume();
  return Boolean(await checkpoint()) || memory.value(action) === expectedValue;
}
