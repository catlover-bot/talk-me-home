// Shared by the supervised real driver and explicitly offline synthetic browser tests.
// Decisions use human-visible documents, reports and controls only.
import { expect } from '@playwright/test';
import { crossCargoWithRecovery } from './qa-player-policy.mjs';
import { createPlayerMemory, readVisiblePlayerReports, confirmReportedAction } from './qa-player-memory.mjs';

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

export async function runRescuePlayer({ page, say: exchange, screenshot = async () => {}, report = { route: [], steps: [] } }) {
  report.route ??= []; report.steps ??= [];
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
    await exchange(text, options);
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
        if (!await confirmReportedAction({ memory, consume, say, request: PHRASES.engage, clarify: PHRASES.confirmLatch, retry: PHRASES.retryLatch, action: 'latch', checkpoint: atGallery })) throw new Error('Player oracle: Latch completion remained unconfirmed after bounded recovery.');
        if (!await atGallery()) {
          await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
          await expect(power).toHaveText('OFF');
          await say(PHRASES.powerOff);
        }
      }
    }
    if (!await crossCargoWithRecovery({ say, atGallery })) throw new Error('Cargo crossing did not commit after one clarification and one justified retry.');
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
      if (!memory.value('location')) await say(PHRASES.clarify);
      if (await atDock()) return 'dock';
      if (!memory.value('location')) throw new Error('Current emblem remained ambiguous after one clarification.');
      return memory.value('location');
    }
    await say(PHRASES.location);
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
      if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
      await expect(page.getByTestId('acknowledged-relay')).toHaveText(gate.circuit);
      const options = { context: { room: current, target: direction } };
      if (!memory.value('passage', target)) await say(`Please inspect the ${direction} gate and tell me whether anything blocks it.`, options);
      if (await atDock()) break;
      if (memory.value('location') !== current) continue;
      if (!memory.value('passage', target)) await say(`Is the opening of the ${direction} gate physically clear or blocked?`, options);
      if (await atDock()) break;
      if (memory.value('location') !== current) continue;
      if (!memory.value('passage', target)) await say(`Please check the ${direction} gate again and report whether cargo blocks passage.`, options);
      if (await atDock()) break;
      if (memory.value('location') !== current) continue;
      if (memory.value('passage', target) === 'blocked') { blocked.add(gate.rooms.join('/')); continue; }
      if (memory.value('passage', target) !== 'clear') throw new Error('Gate inspection remained ambiguous after bounded checks.');
      memory.invalidate('location');
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
      if (!await confirmReportedAction({ memory, consume, say, request: PHRASES.contact, clarify: PHRASES.confirmContact, retry: PHRASES.retryContact, action: 'contact', checkpoint: charged })) throw new Error('Player oracle: contact holding remained unconfirmed after bounded recovery.');
      if (!await charged()) {
        await say(PHRASES.controller);
        if (!await charged() && !await confirmReportedAction({ memory, consume, say, request: PHRASES.contact, clarify: PHRASES.confirmContact, retry: PHRASES.retryContact, action: 'contact', checkpoint: charged })) throw new Error('Contact holding became uncertain before Charge.');
        if (!await charged()) { await page.getByRole('button', { name: 'Charge', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Primed'); }
      }
    }
    if (!await home() && await energy() === 'Primed') { await page.getByRole('button', { name: 'Store', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Stored'); }
    if (!await home() && !await ready()) {
      if (!await confirmReportedAction({ memory, consume, say, request: PHRASES.release, clarify: PHRASES.confirmContact, retry: PHRASES.retryRelease, action: 'contact', expectedValue: 'not_done', checkpoint: ready })) throw new Error('Player oracle: contact release remained unconfirmed before boarding.');
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
