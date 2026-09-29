// Shared by the supervised real driver and explicitly offline synthetic browser tests.
// Decisions use human-visible documents, reports and controls only.
import { expect } from '@playwright/test';
import { classifyProposalResponse, proposalRecoveryPhrases } from './qa-player-policy.mjs';
import { createPlayerMemory, readVisiblePlayerReports } from './qa-player-memory.mjs';
import { acquirePlayerReport, LOCATION_REQUESTS, passageRequests } from './qa-player-recovery.mjs';

export const PHRASES = {
  observe: 'Pip, please look around.', latch: 'Please inspect the Latch.',
  wiring: 'My diagram says the Door and Conveyor share one Power supply.', powerOff: 'Power is now off.',
  engage: 'Please engage the Latch.', confirmLatch: 'Is the Latch engaged now?', retryLatch: 'Please set the Latch to hold the Door open.',
  location: 'Please look around.', clarify: 'What emblem is beside you now?', dock: 'Please look around.',
  inspectContact: 'Please inspect the contact.', contact: 'Please hold the contact.',
  confirmContact: 'Are you holding the contact now?', retryContact: 'Please grip the contact steadily.',
  controller: 'The controller is ready to charge.', release: 'Please release the contact.',
  retryRelease: 'Please let go of the contact.',
  board: 'Please board the capsule.', home: 'Please confirm the return.', wait: 'Please wait.',
};

/** Fixed player intentions, matched against the server's visible action label. */
export function proposalLabelForRequest(text) {
  const request = text.toLowerCase().replace(/^please /, '').replace(/[.!]$/, '').trim();
  if (['engage the latch', 'set the latch to hold the door open', 'keep the door open', 'latch the door open'].includes(request)) return 'Engage the Latch';
  if (['hold the contact', 'grip the contact steadily', 'hold the contact while i store the charge'].includes(request)) return 'Hold the charging contact';
  if (['release the contact', 'let go of the contact'].includes(request)) return 'Release the charging contact';
  if (request === 'board the capsule') return 'Board the recovery capsule';
  if (['confirm the return', 'confirm return'].includes(request)) return 'Confirm the authorized return';
  if (['cross to the far side', 'cross to the far side now if the route is clear', 'walk through the door'].includes(request)) return 'Move to the far-side platform';
  const selector = request.match(/^set (?:the )?selector to (neutral|anchor|bridge)$/)?.[1];
  if (selector) return `Set the Latch selector to ${selector[0].toUpperCase()}${selector.slice(1)}`;
  const direction = request.match(/^(?:go|move) through the (east|west|northeast|northwest|southeast|southwest) gate$/)?.[1];
  return direction ? `Move through the ${direction} gate` : null;
}

export async function confirmProposalForRequest(page, intendedRequest, report = {}) {
  const expectedLabel = proposalLabelForRequest(intendedRequest);
  if (!expectedLabel) return null;
  report.confirmations ??= [];
  return confirmVisibleProposal(page, expectedLabel, intendedRequest, report.confirmations);
}

/** Only an explicitly selected, exactly matching visible proposal can be confirmed. */
export async function confirmVisibleProposal(page, expectedLabel, intendedRequest, confirmations = [], expectedProposalId) {
  const strip = page.getByTestId('action-proposal');
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute('data-status', 'awaiting_confirmation');
  expect(await page.getByTestId('proposal-label').innerText()).toBe(expectedLabel);
  const proposalId = await strip.getAttribute('data-proposal-id');
  if (!proposalId) throw new Error('Visible proposal identity is unavailable.');
  if (expectedProposalId && proposalId !== expectedProposalId) throw new Error('The selected proposal identity changed before confirmation.');
  if (confirmations.some(receipt => receipt.proposalId === proposalId)) throw new Error('A terminal proposal cannot be confirmed again.');
  const confirmationRequestedAtMs = await page.evaluate(() => globalThis.__qaAudio?.snapshot().elapsedMs ?? performance.now());
  // The click locator retains the original identity; a replacement strip cannot
  // acquire the earlier action's confirmation while Playwright waits for readiness.
  await page.locator(`[data-testid="action-proposal"][data-proposal-id=${JSON.stringify(proposalId)}]`).getByRole('button', { name: 'Confirm this action', exact: true }).click();
  let status;
  await expect.poll(async () => {
    // One DOM snapshot avoids waiting on a strip that disappears between a
    // visibility check and a terminal heading mounting after validated arrival.
    const visible = await page.evaluate(() => ({
      completed: [...document.querySelectorAll('h1')].some(element => /^(?:You brought Pip home\.|You got Pip through\.)$/.test(element.textContent.trim())),
      id: document.querySelector('[data-testid="action-proposal"]')?.getAttribute('data-proposal-id'),
      status: document.querySelector('[data-testid="action-proposal"]')?.getAttribute('data-status'),
    }));
    if (visible.completed) return status = 'committed';
    if (!visible.id) return null;
    if (visible.id !== proposalId) throw new Error('The visible proposal changed during confirmation.');
    status = visible.status;
    return ['committed', 'failed', 'expired', 'declined', 'invalidated'].includes(status) ? status : null;
  }).not.toBeNull();
  const confirmedAtMs = await page.evaluate(() => globalThis.__qaAudio?.snapshot().elapsedMs ?? performance.now());
  const receipt = { proposalId, label: expectedLabel, intendedRequest, status, confirmationRequestedAtMs, confirmedAtMs, source: 'Visible action strip and normal owner confirmation button' };
  confirmations.push(receipt);
  return receipt;
}

async function visibleProposal(page) {
  return page.getByTestId('action-proposal').evaluateAll(elements => {
    const element = elements[0];
    return element ? { proposalId: element.getAttribute('data-proposal-id'), label: element.querySelector('[data-testid="proposal-label"]')?.textContent, status: element.getAttribute('data-status') } : null;
  });
}

async function visibleActionChapter(page) {
  return page.locator('h1, h2').evaluateAll(elements => {
    const chapters = elements.map(element => element.textContent.trim()).filter(text => ['Cargo Bay', 'Relay Gallery', 'Return Dock'].includes(text));
    const completed = elements.some(element => /^(?:You brought Pip home\.|You got Pip through\.)$/.test(element.textContent.trim()));
    return !completed && chapters.length === 1 ? chapters[0] : null;
  });
}

/** Initial request plus three purposeful recovery exchanges; never confirm unknown work. */
export async function requestConfirmedAction({ page, request, exchange, checkScope = async () => {}, report = {}, options = {} }) {
  const expectedLabel = proposalLabelForRequest(request);
  if (!expectedLabel) throw new Error('The QA player has no exact proposal label for this intention.');
  report.confirmations ??= []; report.actionRequests ??= [];
  const diagnostic = { intendedRequest: request, expectedLabel, strictFirstResponse: false, recovered: false, outcome: 'pending', exchanges: [] };
  report.actionRequests.push(diagnostic);
  const terminalIds = new Set(report.confirmations.map(receipt => receipt.proposalId));
  const deadlineAt = performance.now() + 120_000;
  let text = request; let kind = 'initial'; let retry;
  try {
    const actionChapter = await visibleActionChapter(page);
    if (!actionChapter) throw new Error('QA player scope ended: the action chapter is unavailable.');
    diagnostic.sourceChapter = actionChapter;
    const checkActionScope = async () => {
      await checkScope();
      if (await visibleActionChapter(page) !== actionChapter) throw new Error('QA player scope ended: the chapter changed before the selected action was confirmed.');
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      if (performance.now() >= deadlineAt) throw new Error(`QA action recovery exceeded 120 seconds for ${expectedLabel}`);
      await checkActionScope();
      const before = await visibleProposal(page);
      if (before && before.status !== 'awaiting_confirmation') terminalIds.add(before.proposalId);
      const oldReports = await readVisiblePlayerReports(page, 'current uninterrupted QA invocation');
      const identity = item => JSON.stringify([item.messageId, item.displayedAt, item.sourceLabel, item.speaker, item.text]);
      const oldIdentities = new Set(oldReports.map(identity));
      const exchangeRecord = { kind, text, outcome: 'pending', proposal: null, replies: [] };
      diagnostic.exchanges.push(exchangeRecord);
      await exchange(text, { ...options, deadlineAt });
      if (performance.now() > deadlineAt) throw new Error(`QA action recovery exceeded 120 seconds for ${expectedLabel}`);
      await checkActionScope();
      const current = await visibleProposal(page);
      const replies = (await readVisiblePlayerReports(page, 'current uninterrupted QA invocation')).filter(item => item.speaker === 'Pip' && item.chapter === actionChapter && item.final && !item.interrupted && !item.historical && !oldIdentities.has(identity(item)));
      const outcome = classifyProposalResponse({ expectedLabel, before, current, reply: replies.map(item => item.text).join(' '), terminalIds: [...terminalIds], confirmedIds: report.confirmations.filter(item => item.status === 'committed').map(item => item.proposalId) });
      Object.assign(exchangeRecord, { outcome: outcome.kind, proposal: current, replies });
      if (outcome.kind === 'matching_pending') {
        if (report.exerciseRecovery && !report.recoveryExercise && expectedLabel === 'Engage the Latch') {
          await page.locator(`[data-testid="action-proposal"][data-proposal-id=${JSON.stringify(current.proposalId)}]`).getByRole('button', { name: 'Not yet', exact: true }).click();
          await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
          terminalIds.add(current.proposalId);
          report.recoveryExercise = { kind: 'deliberate_decline', proposalId: current.proposalId, label: expectedLabel, source: 'Normal Not yet UI; no physical confirmation', completed: false };
          text = proposalRecoveryPhrases(expectedLabel, null).retry; kind = 'fresh_request_after_deliberate_decline';
          exchangeRecord.outcome = 'deliberately_declined'; continue;
        }
        const receipt = await confirmVisibleProposal(page, expectedLabel, request, report.confirmations, current.proposalId);
        if (receipt.status !== 'committed') {
          if (!['failed', 'expired', 'invalidated', 'declined'].includes(receipt.status)) throw new Error(`The selected action has an unknown result: ${expectedLabel}`);
          terminalIds.add(receipt.proposalId); exchangeRecord.outcome = `not_executed_${receipt.status}`;
          text = proposalRecoveryPhrases(expectedLabel, null).clarify; retry = proposalRecoveryPhrases(expectedLabel, null).retry; kind = 'verify_rejected_preconditions';
          continue;
        }
        diagnostic.strictFirstResponse = attempt === 0; diagnostic.recovered = attempt > 0; diagnostic.outcome = 'committed';
        if (report.recoveryExercise?.label === expectedLabel) report.recoveryExercise.completed = true;
        return receipt;
      }
      if (!['verified_committed_receipt', 'relevant_clarification', 'rejected_or_unresolved', 'no_relevant_reply'].includes(outcome.kind)
        || current?.status === 'confirming' || replies.length === 0) throw new Error(`QA action stopped: ${outcome.kind} for ${expectedLabel}`);
      if (attempt === 3) throw new Error(`QA action recovery exhausted after 4 exchanges for ${expectedLabel}`);
      if (attempt === 0) {
        const phrases = proposalRecoveryPhrases(expectedLabel, current);
        text = phrases.clarify; retry = phrases.retry; kind = 'clarification';
      } else if (attempt === 1) { text = retry ?? proposalRecoveryPhrases(expectedLabel, current).retry; kind = 'rephrased_request'; }
      else { text = proposalRecoveryPhrases(expectedLabel, current).propose; kind = 'explicit_proposal_request'; }
    }
    throw new Error(`QA action recovery exhausted after 4 exchanges for ${expectedLabel}`);
  } catch (error) { diagnostic.outcome = 'failed'; diagnostic.failure = error.message; throw error; }
}

export async function runRescuePlayer({ page, say: exchange, waitForReady = async () => {}, exerciseRecovery = false, screenshot = async () => {}, report = { route: [], steps: [] } }) {
  report.route ??= []; report.steps ??= [];
  report.confirmations ??= [];
  report.exerciseRecovery = exerciseRecovery;
  // There is no round identifier in the rendered UI. This identity belongs only to this
  // invocation. Replacement/disconnection of its communication panel invalidates it.
  const round = 'current uninterrupted QA invocation';
  const panel = await page.locator('.communication-dock').elementHandle();
  if (!panel) throw new Error('The current communication panel is unavailable.');
  if (await page.getByRole('button', { name: 'Open transcript history', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  const heading = name => page.getByRole('heading', { name, exact: true }).isVisible();
  const home = () => heading('You brought Pip home.');
  const atGallery = async () => await heading('Relay Gallery') || await heading('Return Dock') || await home();
  const atDock = async () => await heading('Return Dock') || await home();
  let chapter = 'Cargo Bay'; let phase = chapter;
  const memory = createPlayerMemory({ round, chapter });
  const currentCallReports = new Set();
  async function consume(context = {}) {
    if (await home()) return;
    if (!await panel.evaluate(element => element.isConnected)) throw new Error('QA player scope ended: Restart replaced the current round.');
    if (await page.getByLabel('Type a message', { exact: true }).isDisabled()) throw new Error('QA player scope ended: stopped or resumed knowledge requires a fresh player invocation.');
    for (const title of ['Cargo Bay', 'Relay Gallery', 'Return Dock']) if (await heading(title)) chapter = title;
    memory.scope({ round, chapter });
    const visible = await readVisiblePlayerReports(page, round);
    for (const item of visible) {
      const identity = item.messageId ?? `${item.sourceLabel}|${item.displayedAt}|${item.speaker}`;
      if (item.historical && currentCallReports.has(identity)) throw new Error('QA player scope ended: resumed call requires fresh scoped knowledge.');
      if (!item.historical) currentCallReports.add(identity);
    }
    memory.consume(visible, context);
    report.communicatedEvidence = memory.snapshot();
  }
  async function say(text, options = {}) {
    await consume();
    if (await home() || chapter !== phase) return '';
    const expectedLabel = proposalLabelForRequest(text);
    if (expectedLabel) {
      await requestConfirmedAction({ page, request: text, exchange, report, options, checkScope: consume });
      if (expectedLabel.startsWith('Move ')) memory.depart(new Date().toISOString());
      await waitForReady();
    } else await exchange(text, options);
    if (options.terminal) await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible({ timeout: 25000 });
    await consume(options.context);
    return (await readVisiblePlayerReports(page, round)).filter(item => item.speaker === 'Pip' && item.chapter === chapter && item.final && !item.interrupted && !item.historical).at(-1)?.text ?? '';
  }
  await consume();
  if (!await atGallery()) {
    const latchMentioned = async () => (await readVisiblePlayerReports(page, round)).some(item => item.chapter === 'Cargo Bay' && item.speaker === 'Pip' && item.final && !item.interrupted && !item.historical && /\blatch\b/i.test(item.text));
    await say(PHRASES.observe);
    if (!await atGallery() && !await latchMentioned()) await say('Please look around and report the objects you can reach from the platform.');
    if (!await atGallery() && !await latchMentioned()) throw new Error('No Latch was communicated in the current visible observation.');
    if (!await atGallery()) {
      await page.getByRole('tab', { name: 'Equipment manual', exact: true }).click();
      report.cargoManual = await page.getByRole('tabpanel', { name: 'Equipment manual' }).innerText();
      if (!/Door and Conveyor use one supply/.test(report.cargoManual)) throw new Error('Visible shared Power document was unavailable.');
      await say(PHRASES.latch);
      if (!await atGallery()) {
        const power = page.getByTestId('acknowledged-power');
        if (await power.innerText() !== 'ON') await page.getByRole('button', { name: 'Power ON', exact: true }).click();
        await expect(power).toHaveText('ON');
        await say(PHRASES.wiring);
        // Information and a model's completion claim never substitute for this
        // explicit request and the separate owner decision on its exact proposal.
        await say(PHRASES.engage);
        if (!await atGallery()) {
          await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
          await expect(power).toHaveText('OFF');
          await say(PHRASES.powerOff);
        }
      }
    }
    if (!await atGallery()) await say('Please cross to the far side.');
    if (!await atGallery()) throw new Error('Cargo crossing did not reach its authoritative checkpoint.');
    report.route.push('Cargo Bay');
  }
  if (!await atDock()) {
    phase = 'Relay Gallery'; await consume(); report.route.push(phase); await screenshot('gallery');
    const atlas = await page.locator('.gallery-document').evaluate(root => {
      const rooms = [...root.querySelectorAll('.atlas-room')].map(room => ({ name: room.querySelector('.room-name').textContent.toLowerCase(), position: room.getAttribute('transform').match(/[\d.]+/g).map(Number) }));
      const gates = [...root.querySelectorAll('.atlas-gate')].map(gate => {
        const [x1, y1, x2, y2] = gate.querySelector('.atlas-track').getAttribute('d').match(/[\d.]+/g).map(Number);
        return { rooms: [[x1, y1], [x2, y2]].map(([x, y]) => rooms.find(room => room.position[0] === x && room.position[1] === y).name), circuit: gate.querySelector('.gate-full-name').textContent };
      });
      return { rooms, gates };
    });
    report.atlas = atlas; memory.visibleNames(atlas.rooms.map(room => room.name));
    async function location() {
      if (await atDock()) return 'dock';
      await waitForReady(); await consume();
      return acquirePlayerReport({ subject: 'current Gallery location', read: async () => await atDock() ? 'dock' : memory.value('location'),
        exchange: say, checkScope: consume, requests: LOCATION_REQUESTS, report });
    }
    let current = await location(); report.route.push(current);
    const blocked = new Set();
    for (let moves = 0; moves < 8 && !await atDock(); moves++) {
      await consume(); current = await location();
      const queue = [[current]]; let path;
      while (queue.length) {
        const candidate = queue.shift(); const last = candidate.at(-1);
        if (last === 'dock') { path = candidate; break; }
        for (const gate of atlas.gates) if (!blocked.has(gate.rooms.join('/')) && gate.rooms.includes(last)) {
          const next = gate.rooms.find(name => name !== last); if (!candidate.includes(next)) queue.push([...candidate, next]);
        }
      }
      if (!path || path.length < 2) throw new Error('No documented route remained after spoken obstruction reports.');
      const next = path[1]; const gate = atlas.gates.find(gate => gate.rooms.includes(current) && gate.rooms.includes(next));
      const [x1, y1] = atlas.rooms.find(room => room.name === current).position; const [x2, y2] = atlas.rooms.find(room => room.name === next).position;
      const direction = (y2 < y1 ? 'north' : y2 > y1 ? 'south' : '') + (x2 > x1 ? 'east' : x2 < x1 ? 'west' : '');
      const target = `${current}:${direction}`;
      const button = page.getByRole('button', { name: `Relay ${gate.circuit}`, exact: true });
      if (await button.getAttribute('aria-pressed') !== 'true') { await button.click(); memory.invalidatePassages(); }
      await expect(page.getByTestId('acknowledged-relay')).toHaveText(gate.circuit);
      const options = { context: { room: current, target: direction } };
      await acquirePlayerReport({ subject: `${current} ${direction} passage`,
        read: () => memory.value('location') !== current ? 'location_changed' : memory.value('passage', target),
        exchange: (text, recovery) => say(text, { ...options, ...recovery }), checkScope: consume, requests: passageRequests(direction), report });
      if (await atDock()) break;
      if (memory.value('location') !== current) continue;
      if (memory.value('passage', target) === 'blocked') { blocked.add(gate.rooms.join('/')); continue; }
      if (memory.value('passage', target) !== 'clear') throw new Error('Gate inspection remained ambiguous after bounded checks.');
      memory.depart();
      await say(`Please go through the ${direction} gate.`);
      current = await location(); report.route.push(current);
    }
    if (!await atDock()) throw new Error('Gallery route did not reach the public Dock checkpoint within its bound.');
  }
  if (!await home()) {
    phase = 'Return Dock'; await consume(); report.route.push(phase); await screenshot('dock');
    report.dockManual = await page.locator('.return-document').innerText();
    const energy = () => page.getByTestId('dock-energy').innerText();
    const ready = async () => await home() || await page.getByTestId('dock-readiness').innerText() === 'Ready';
    const charged = async () => await home() || ['Primed', 'Stored'].includes(await energy());
    if (!await charged()) {
      await say(PHRASES.dock); await say(PHRASES.inspectContact);
      await say(PHRASES.contact);
      if (!await charged()) {
        await say(PHRASES.controller);
        if (!await charged()) { await page.getByRole('button', { name: 'Charge', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Primed'); }
      }
    }
    if (!await home() && await energy() === 'Primed') { await page.getByRole('button', { name: 'Store', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Stored'); }
    if (!await home() && !await ready()) {
      await say(PHRASES.release);
      if (!await ready()) await say(PHRASES.board);
      await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
    }
    if (!await home() && await page.getByTestId('dock-authorization').innerText() !== 'Granted') { await page.getByRole('button', { name: 'Authorize return', exact: true }).click(); await expect(page.getByTestId('dock-authorization')).toHaveText('Granted'); }
    if (!await home()) await say(PHRASES.home, { terminal: true });
  }
  await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible({ timeout: 25000 });
  report.completion = true; report.route.push('home'); report.communicatedEvidence = memory.snapshot(); await screenshot('home');
  await panel.dispose();
  return report;
}
