import type { DockControl, HumanView, Relay } from '../../shared/contracts';

export interface HumanControlsProps {
  view: HumanView;
  connected: boolean;
  busy: boolean;
  pending: string | null;
  changePower(value: boolean): Promise<unknown>;
  changeRelay(value: Relay): Promise<unknown>;
  dockControl(action: DockControl): Promise<unknown>;
}

/** Controls and readings here belong to Mission Control's public instruments. */
export function HumanControls({ view, connected, busy, pending, changePower, changeRelay, dockControl }: HumanControlsProps) {
  const disabled = !connected || busy || view.completed || pending !== null;
  const disconnected = !connected ? 'Resume communication to use remote controls.' : null;
  const waiting = pending !== null ? 'Waiting for the server to acknowledge your command.' : null;
  if (view.chapter === 'gallery') return <section className="power-control human-controls relay-controls" aria-labelledby="relay-heading" aria-busy={pending !== null}>
    <div><p className="control-kicker">Mission Control / 02</p><h2 id="relay-heading">Remote Relay</h2><p>Acknowledged: <strong className="control-ack" key={view.relay} data-testid="acknowledged-relay">{view.relay === 'beacon' ? 'Beacon' : view.relay === 'harbor' ? 'Harbor' : 'Off'}</strong></p></div>
    <div className="power-buttons relay-buttons">{(['off', 'beacon', 'harbor'] as const).map(value => <button key={value} aria-label={`Relay ${value === 'off' ? 'Off' : value === 'beacon' ? 'Beacon' : 'Harbor'}`} aria-pressed={view.relay === value} disabled={disabled || view.relay === value} onClick={() => { void changeRelay(value); }}>{value === 'off' ? 'Off' : value === 'beacon' ? 'Beacon' : 'Harbor'}</button>)}</div>
    <p className="power-explanation" role="status">{waiting ?? disconnected ?? 'One circuit at a time. This is your acknowledged command; Pip checks whether the passage is clear.'}</p>
  </section>;
  if (view.chapter === 'return_dock') {
    const instruments = view.returnDock;
    return <section className="human-controls dock-controls" aria-labelledby="dock-controls-heading" aria-busy={pending !== null}>
      <div className="dock-control-heading"><div><p className="control-kicker">Mission Control / 03</p><h2 id="dock-controls-heading">Return console</h2></div><span className="source-label">Working instruments</span></div>
      <dl className="dock-instruments" aria-label="Acknowledged Return Dock instruments">
        <div><dt>Energy</dt><dd data-testid="dock-energy">{!instruments ? 'Unavailable' : instruments.energy === 'stored' ? 'Stored' : instruments.energy === 'primed' ? 'Primed' : 'Empty'}</dd></div>
        <div><dt>Return interlock</dt><dd data-testid="dock-readiness">{!instruments ? 'Unavailable' : instruments.readyForReturn ? 'Ready' : 'Not ready'}</dd></div>
        <div><dt>Authorization</dt><dd data-testid="dock-authorization">{!instruments ? 'Unavailable' : instruments.returnAuthorized ? 'Granted' : 'Not granted'}</dd></div>
      </dl>
      <div className="dock-buttons">
        <button className="secondary-button" disabled={disabled || instruments?.energy === 'stored'} onClick={() => { void dockControl('charge'); }}>Charge</button>
        <button className="secondary-button" disabled={disabled || instruments?.energy !== 'primed'} onClick={() => { void dockControl('store'); }}>Store</button>
        <button className="primary-button" disabled={disabled || !instruments?.readyForReturn || instruments?.returnAuthorized === true} onClick={() => { void dockControl('authorize_return'); }}>Authorize return</button>
        <button className="text-button" disabled={disabled || !instruments?.returnAuthorized} onClick={() => { void dockControl('revoke_return'); }}>Revoke</button>
      </div>
      <p className="power-explanation" role="status">{waiting ?? disconnected ?? 'These readings come from the return console. Pip still performs the local checks and confirms departure.'}</p>
      <p className="dock-control-reason">{instruments?.returnAuthorized ? 'Authorization granted. Ask Pip to confirm return; Revoke cancels permission.' : instruments?.readyForReturn ? 'Ready. Authorize when your shared plan is settled. Pause or interruption revokes permission; stored energy remains.' : instruments?.energy === 'stored' ? 'Energy is stored. Ask Pip to finish local preparation; authorization needs a Ready interlock.' : instruments?.energy === 'primed' ? 'Charge is primed. Store it while Pip keeps the contact steady.' : 'Store needs primed energy. Coordinate the contact with Pip, then Charge.'}</p>
    </section>;
  }
  return <section className="power-control human-controls" aria-labelledby="power-heading" aria-busy={pending !== null}>
    <div><p className="control-kicker">Mission Control / 01</p><h2 id="power-heading">Remote Power</h2><p>Acknowledged: <strong className="control-ack" key={String(view.powerOn)} data-testid="acknowledged-power">{view.powerOn ? 'ON' : 'OFF'}</strong></p></div>
    <div className="power-buttons">{[true, false].map(value => <button key={String(value)} aria-label={`Power ${value ? 'ON' : 'OFF'}`} aria-pressed={view.powerOn === value} disabled={disabled || view.powerOn === value} onClick={() => { void changePower(value); }}>{value ? 'Power ON' : 'Power OFF'}</button>)}</div>
    <p className="power-explanation" role="status">{waiting ?? disconnected ?? 'Your switch command is acknowledged. Tell Pip, then ask what changed at the Door and Conveyor.'}</p>
  </section>;
}
