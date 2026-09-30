import { expect, type Page } from '@playwright/test';
import { previewSwitchyardRouting, type SwitchyardApproach, type SwitchyardAssignment, type SwitchyardDirection, type SwitchyardPanelSpec, type SwitchyardRotation, type SwitchyardRotations, type SwitchyardTerminal } from '../../game/shared/switchyard';

/** Ordinary-UI operator. Inputs are visible drawings, full manual rows and communicated local reports.
 * This module deliberately imports no server catalog, seed decoder, fixture state or solution witness. */
export interface RemixTraceStep { kind: string; label: string; report?: string; terminals?: readonly SwitchyardTerminal[] }
const directions: SwitchyardDirection[] = ['north', 'east', 'south', 'west'];
const terminals = ['amber', 'blue', 'white'] as const;
const names = (text: string) => terminals.filter(terminal => text.toLowerCase().includes(terminal));
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function startRemix(page: Page, selection: { code: string } | { kind: 'new' | 'daily'; assignment?: SwitchyardAssignment }, navigate = true) {
  if (navigate) await page.goto('/');
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('radio', { name: /^Remix(?:\s|$)/ }).check();
  if ('code' in selection) {
    await page.getByRole('radio', { name: 'Replay a code', exact: true }).check();
    await page.getByRole('textbox', { name: 'Replay mission code', exact: true }).fill(selection.code);
  } else if (selection.kind === 'daily') await page.getByRole('radio', { name: 'Daily dispatch', exact: true }).check();
  else {
    await page.getByRole('radio', { name: 'New dispatch', exact: true }).check();
    await page.getByLabel('Optional assignment', { exact: true }).selectOption(selection.assignment ?? 'rescue');
  }
  await expect(page.locator('.dispatch-availability')).toContainText('Dispatch ready');
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel')).toBeVisible();
  await expect(page.getByTestId('switchyard-dispatch-card')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Local companion requests' })).toContainText('Local/scripted');
}

/** Reconstruct only the electrical drawing's rendered contacts and labelled attachments. */
export async function readVisiblePanel(page: Page): Promise<SwitchyardPanelSpec> {
  const board = page.getByRole('group', { name: 'Draft routing pieces', exact: true });
  const pieces = await board.locator('button[data-piece]').evaluateAll(buttons => buttons.map(button => ({
    id: button.getAttribute('data-piece')!, rotation: Number(button.getAttribute('data-rotation')),
    label: button.getAttribute('aria-label')!, row: Number((button as HTMLElement).style.gridRow) - 2,
    column: Number((button as HTMLElement).style.gridColumn) - 2,
  })));
  expect(pieces).toHaveLength(6);
  const sourceLabel = await board.locator('.switchyard-terminal-source').getAttribute('aria-label');
  const source = sourceLabel?.match(/^Fixed supply, (north|east|south|west) of (P[1-6])$/);
  if (!source) throw new Error('The public supply attachment is not readable.');
  const outputs = [];
  for (const id of terminals) {
    const label = await board.locator(`.switchyard-terminal-${id}`).getAttribute('aria-label');
    const match = label?.match(/^(Amber|Blue|White), (north|east|south|west) of (P[1-6])$/);
    if (!match) throw new Error('A public output attachment is not readable.');
    outputs.push({ id, label: match[1]!, side: match[2] as SwitchyardDirection, pieceId: match[3]!.toLowerCase(), load: 1 as const });
  }
  return { rows: 2, columns: 3, capacity: 2, source: { pieceId: source[2]!.toLowerCase(), side: source[1] as SwitchyardDirection }, terminals: outputs,
    pieces: pieces.map(piece => {
      const match = piece.label.match(/^P[1-6] (junction|elbow|straight), \d+ degrees, contacts ([^.]+)\./);
      if (!match) throw new Error('A public rotor contact list is not readable.');
      const contacts = match[2]!.split(', ') as SwitchyardDirection[];
      if (contacts.some(contact => !directions.includes(contact))) throw new Error('Unknown public rotor direction.');
      return { id: piece.id, row: piece.row, column: piece.column, kind: match[1] as 'junction' | 'elbow' | 'straight',
        ports: contacts.map(contact => directions[(directions.indexOf(contact) - piece.rotation + 4) % 4]!) };
    }) };
}

/** Developer-only electrical search of the displayed public board, never the installation or winning route. */
export function layoutForPublicSupply(specification: SwitchyardPanelSpec, requested: readonly SwitchyardTerminal[], current?: SwitchyardRotations): SwitchyardRotations {
  let best: SwitchyardRotations | undefined; let distance = Infinity;
  for (let encoded = 0; encoded < 4096; encoded++) {
    const layout = Array.from({ length: 6 }, (_, i) => (encoded >> (i * 2)) & 3) as SwitchyardRotations;
    const preview = previewSwitchyardRouting(layout, specification);
    if (preview.poweredTerminals.length !== requested.length || !requested.every(terminal => preview.poweredTerminals.includes(terminal))) continue;
    const edits = current ? layout.reduce<number>((sum, rotation, i) => sum + Math.min((rotation - current[i]! + 4) % 4, (current[i]! - rotation + 4) % 4), 0) : 0;
    if (edits < distance) { best = layout; distance = edits; }
  }
  if (!best) throw new Error('The displayed board cannot supply the requested public manual combination.');
  return best;
}

export class RemixUiPlayer {
  readonly trace: RemixTraceStep[] = [];
  private location = '';
  private corridors: Array<[string, string]> = [];
  constructor(readonly page: Page) {}
  private requests() { return this.page.getByRole('region', { name: 'Local companion requests' }); }

  async readReport(expected: RegExp): Promise<string> {
    const caption = this.page.getByTestId('caption');
    await expect(caption).toContainText(expected);
    await expect(caption).toHaveAttribute('aria-live', 'polite');
    await expect(this.requests().getByRole('button', { name: 'Look around', exact: true })).toBeEnabled();
    const report = await caption.innerText();
    const found = [...report.matchAll(/(?:I am|You are) at ([^.]+)\./g)].at(-1)?.[1];
    if (found) this.location = found;
    return report;
  }

  async ask(label: string, expected: RegExp, physical = false, confirm = true): Promise<string | undefined> {
    const tools = this.page.waitForResponse(response => response.url().endsWith('/tools') && response.request().method() === 'POST');
    await this.requests().getByRole('button', { name: label, exact: true }).click();
    await tools;
    if (physical) {
      await expect(this.page.getByTestId('proposal-label')).toHaveText(label);
      await expect(this.page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
      this.trace.push({ kind: 'proposal', label });
      if (!confirm) return undefined;
      const decision = this.page.waitForResponse(response => response.url().endsWith('/proposal-decision') && response.request().method() === 'POST');
      await this.page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
      await decision;
      this.trace.push({ kind: 'confirmed', label });
      if (label === 'Depart for home') { await expect(this.page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible(); return undefined; }
      await expect(this.page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    }
    const report = await this.readReport(expected);
    this.trace.push({ kind: physical ? 'result' : 'report', label, report });
    return report;
  }

  async begin() {
    await this.ask('Look around', /(?:I am|You are) at Control Bay\./);
    await this.page.getByRole('tab', { name: 'Site plan', exact: true }).click();
    const drawing = this.page.locator('details').filter({ has: this.page.locator('summary', { hasText: 'Installation drawing and safe return paths' }) }).first();
    if (await drawing.getAttribute('open') === null) await drawing.locator('summary').click();
    const edges = await this.page.locator('.dispatch-schematic-key li').allTextContents();
    this.corridors = edges.filter(text => text.endsWith('Ordinary corridor')).map(text => {
      const match = text.match(/^(.+) ↔ (.+) · Ordinary corridor$/);
      if (!match) throw new Error('The public station corridor list is unreadable.');
      return [match[1]!, match[2]!] as [string, string];
    });
    expect(this.corridors).toHaveLength(3);
    this.trace.push({ kind: 'drawing', label: edges.join(' | ') });
    await this.ask('Inspect Route directory', /directory describes two ways/i);
  }

  async navigate(destination: string) {
    if (!this.location) throw new Error('Navigation needs an actually communicated local report.');
    if (this.location === 'Return Platform') {
      const back = this.requests().getByRole('button', { name: /^Return to (Lift Station|Service Gallery)$/ });
      const label = await back.innerText();
      await this.ask(label, new RegExp(`(?:I am|You are) at ${escape(label.replace('Return to ', ''))}\\.`), true);
    }
    const paths = [[this.location]]; const visited = new Set([this.location]); let selected: string[] | undefined;
    for (let cursor = 0; cursor < paths.length; cursor++) {
      const path = paths[cursor]!; const here = path.at(-1)!;
      if (here === destination) { selected = path; break; }
      for (const [a, b] of this.corridors) {
        const next = a === here ? b : b === here ? a : undefined;
        if (next && !visited.has(next)) { visited.add(next); paths.push([...path, next]); }
      }
    }
    if (!selected) throw new Error('The public station plan has no ordinary route to the requested equipment.');
    for (const next of selected.slice(1)) {
      const button = this.requests().getByRole('button', { name: new RegExp(`^(?:Go|Return) to ${escape(next)}$`) });
      const label = await button.innerText();
      await this.ask(label, new RegExp(`(?:I am|You are) at ${escape(next)}\\.`), true);
    }
  }

  async draft(layout: SwitchyardRotations, keyboard = false) {
    for (const [index, rotation] of layout.entries()) {
      const piece = this.page.locator(`[data-piece="p${index + 1}"]`);
      const current = Number(await piece.getAttribute('data-rotation'));
      const right = (rotation - current + 4) % 4; const left = (current - rotation + 4) % 4;
      if (left < right || keyboard) {
        await piece.focus();
        for (let turn = 0; turn < (left < right ? left : right); turn++) await this.page.keyboard.press(left < right ? 'ArrowLeft' : 'ArrowRight');
      } else for (let turn = 0; turn < right; turn++) await piece.click();
      await expect(piece).toHaveAttribute('data-rotation', String(rotation));
    }
  }

  async supply(requested: readonly SwitchyardTerminal[]) {
    const specification = await readVisiblePanel(this.page);
    const current = await this.page.locator('.switchyard-piece').evaluateAll(pieces => pieces.map(piece => Number(piece.getAttribute('data-rotation')))) as SwitchyardRotations;
    await this.draft(layoutForPublicSupply(specification, requested, current));
    const apply = this.page.getByRole('button', { name: 'Apply routing', exact: true });
    if (await apply.isEnabled()) {
      const accepted = this.page.waitForResponse(response => response.url().endsWith('/routing-panel') && response.request().method() === 'POST');
      await apply.click();
      expect((await accepted).ok()).toBe(true);
      await expect(this.page.getByTestId('switchyard-panel-status')).toContainText('Applied routing acknowledged');
      this.trace.push({ kind: 'apply', label: requested.join(' + ') || 'All outputs isolated', terminals: requested });
    }
    for (const terminal of terminals) await expect(this.page.getByTestId(`applied-${terminal}`)).toHaveText(requested.includes(terminal) ? 'Powered' : 'Off');
  }

  private async manual(tab: 'Lift plates' | 'Service modules', plate: string) {
    await this.page.getByRole('tab', { name: tab, exact: true }).click();
    const cells = await this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: plate, exact: true }) }).getByRole('cell').allTextContents();
    expect(cells).toHaveLength(3);
    this.trace.push({ kind: 'manual', label: `${plate}: ${cells.join(' / ')}` });
    return cells;
  }

  async prepareLift() {
    await this.navigate('Lift Station');
    const report = await this.ask('Inspect Lift console', /Lift console plate reads [^.]+\./);
    const plate = report!.match(/Lift console plate reads ([^.]+)\./)?.[1];
    if (!plate) throw new Error('The local lift report did not identify its plate.');
    const [index, testing, running] = await this.manual('Lift plates', plate);
    expect(['1', '2']).toContain(index);
    await this.supply([]);
    await this.ask(index === '1' ? 'Set index one' : 'Set index two', /set lift index [12]/i, true);
    await this.supply(names(testing!));
    await this.ask('Test the lift', /lift self-test passed/i, true);
    return names(running!);
  }

  async prepareService() {
    await this.navigate('Transfer Table');
    const report = await this.ask('Inspect Transfer turntable', /Transfer turntable service plate reads [^.]+\./);
    const plate = report!.match(/service plate reads ([^.]+)\./)?.[1];
    const procedure = report!.match(/This is (?:a|an) ([^.]+ service module)/)?.[1];
    if (!plate || !procedure) throw new Error('The local turntable report did not identify its module and procedure.');
    const [winch, alignment, crossing] = await this.manual('Service modules', plate);
    const entry = this.page.locator('.dispatch-procedures > div').filter({ has: this.page.locator('dt', { hasText: new RegExp(`^${escape(procedure)}$`) }) });
    const instructions = await entry.locator('dd').innerText();
    const alignmentFirst = /Align the turntable .* before deploying the bridge\./.test(instructions);
    this.trace.push({ kind: 'procedure', label: procedure, report: instructions });
    if (alignmentFirst) {
      await this.supply(names(alignment!));
      await this.ask('Align the turntable', /aligned the turntable and its mechanical lock engaged/i, true);
    }
    await this.navigate('Service Gallery');
    await this.ask('Inspect Bridge winch', new RegExp(`Bridge winch plate reads ${escape(plate)}\\.`));
    await this.supply([]);
    await this.ask('Seat the bridge brace', /seated the bridge brace/i, true);
    await this.supply(names(winch!));
    await this.ask('Deploy the bridge', /deployed the bridge into its retaining detent/i, true);
    if (!alignmentFirst) {
      await this.navigate('Transfer Table');
      await this.ask('Inspect Transfer turntable', /Transfer turntable service plate reads [^.]+\./);
      await this.supply(names(alignment!));
      await this.ask('Align the turntable', /aligned the turntable and its mechanical lock engaged/i, true);
    }
    return names(crossing!);
  }

  async home(approach: SwitchyardApproach, assignment: SwitchyardAssignment = 'rescue', finishAssignment = true) {
    if (finishAssignment && approach === 'bypass' && assignment === 'lift_survey') await this.prepareLift();
    if (finishAssignment && approach === 'lift' && assignment === 'service_restoration') await this.prepareService();
    if (approach === 'lift') {
      const running = await this.prepareLift();
      await this.supply(running);
      await this.ask('Ride the direct lift', /(?:I am|You are) at Return Platform\./, true);
    } else {
      const crossing = await this.prepareService();
      await this.navigate('Service Gallery');
      await this.ask('Inspect Bridge winch', /Bridge winch plate reads [^.]+\./);
      await this.supply(crossing);
      await this.ask('Cross the maintenance bridge', /(?:I am|You are) at Return Platform\./, true);
    }
    await expect(this.page.getByRole('heading', { name: 'Pip is home.', exact: true })).toHaveCount(0);
    await this.page.getByRole('group', { name: 'My intended approach' }).getByRole('radio', { name: approach === 'lift' ? 'Maintenance bypass' : 'Direct lift', exact: true }).check();
    await this.ask('Inspect Departure console', /Departure console confirms arrival/);
    await this.ask('Depart for home', /arrived safely home/i, true);
    await expect(this.page.getByTestId('switchyard-departure')).toHaveAttribute('data-approach', approach);
    await expect(this.page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible();
  }
}
