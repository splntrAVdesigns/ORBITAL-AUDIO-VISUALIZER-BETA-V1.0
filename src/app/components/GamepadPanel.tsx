import { Fragment } from 'react';
import type { GamepadStatus } from '../input/GamepadSource';
import {
  GAMEPAD_FUNCTIONS,
  GAMEPAD_LIMITS,
  STANDARD_BUTTON_LABELS,
  describeControl,
  type GamepadFunctionId,
  type GamepadFunctionMeta,
} from '../input/gamepadConfig';

/**
 * ORBITAL — Gamepad tab of the Controllers modal (Sprint O5).
 * Pure view: all state lives in GamepadSource and arrives as GamepadStatus.
 */

const send = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));
const GROUPS: GamepadFunctionMeta['group'][] = ['Macro knobs', 'Focused knob', 'Speed', 'Presets & textures', 'Other'];

function PadDiagram({ buttons, axes }: { buttons: number[]; axes: number[] }) {
  const on = (i: number) => (buttons[i] ?? 0) >= 0.5;
  const fill = (i: number) => (on(i) ? 'var(--neonBlue)' : 'transparent');
  const stroke = 'rgba(4,217,255,.55)';
  const stick = (cx: number, cy: number, ax: number, click: number) => (
    <g>
      <circle cx={cx} cy={cy} r={24} fill="rgba(4,217,255,.06)" stroke={stroke} />
      <circle cx={cx + (axes[ax] ?? 0) * 13} cy={cy + (axes[ax + 1] ?? 0) * 13} r={11} fill={on(click) ? 'var(--neonBlue)' : '#132733'} stroke={stroke} />
    </g>
  );
  const trigger = (x: number, i: number, label: string) => (
    <g>
      <rect x={x} y={6} width={64} height={11} rx={3} fill="none" stroke={stroke} />
      <rect x={x} y={6} width={64 * Math.min(1, buttons[i] ?? 0)} height={11} rx={3} fill="var(--neonBlue)" opacity={0.85} />
      <text x={x + 32} y={14.5} textAnchor="middle" className="pad-diagram-label">{label}</text>
    </g>
  );
  const face = (cx: number, cy: number, i: number, label: string) => (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={fill(i)} stroke={stroke} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" className="pad-diagram-label" fill={on(i) ? '#06131b' : undefined}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 400 214" className="pad-diagram" role="img" aria-label="Live controller view">
      {trigger(58, 6, 'LT')}{trigger(278, 7, 'RT')}
      <rect x={58} y={22} width={64} height={12} rx={4} fill={fill(4)} stroke={stroke} /><text x={90} y={31} textAnchor="middle" className="pad-diagram-label">LB</text>
      <rect x={278} y={22} width={64} height={12} rx={4} fill={fill(5)} stroke={stroke} /><text x={310} y={31} textAnchor="middle" className="pad-diagram-label">RB</text>
      <path d="M70 42 H330 C372 42 392 92 396 150 C399 196 366 210 344 196 L298 162 H102 L56 196 C34 210 1 196 4 150 C8 92 28 42 70 42 Z" fill="rgba(13,31,43,.65)" stroke="rgba(122,148,170,.35)" />
      {stick(110, 92, 0, 10)}
      {stick(250, 140, 2, 11)}
      <g>
        {[[150, 124, 12], [150, 156, 13], [134, 140, 14], [166, 140, 15]].map(([x, y, i]) => (
          <rect key={i} x={x - 8} y={y - 8} width={16} height={16} rx={3} fill={fill(i)} stroke={stroke} />
        ))}
      </g>
      {face(300, 70, 3, 'Y')}{face(300, 114, 0, 'A')}{face(278, 92, 2, 'X')}{face(322, 92, 1, 'B')}
      <rect x={168} y={86} width={18} height={10} rx={5} fill={fill(8)} stroke={stroke} />
      <rect x={214} y={86} width={18} height={10} rx={5} fill={fill(9)} stroke={stroke} />
      <circle cx={200} cy={66} r={8} fill={fill(16)} stroke={stroke} />
    </svg>
  );
}

export function GamepadPanel({ status, now }: { status: GamepadStatus | null; now: number }) {
  if (!status) return <div className="orbital-midi-body"><div className="orbital-midi-notice info"><span>Starting gamepad input…</span></div></div>;
  const { config, pad, live } = status;
  const standard = !pad || pad.mapping === 'standard';
  const seconds = status.learnExpiresAt ? Math.max(0, Math.ceil((status.learnExpiresAt - now) / 1000)) : 0;
  const extraButtons = live.buttons.map((v, i) => ({ v, i })).filter(({ i }) => i >= STANDARD_BUTTON_LABELS.length);

  return (
    <>
      <div className="orbital-midi-body">
        {!status.supported && (
          <div className="orbital-midi-notice error"><strong>This browser has no Gamepad API.</strong><span>Use a current Chrome, Edge, Firefox or Safari.</span></div>
        )}
        {status.supported && status.enabled && !pad && (
          <div className="orbital-midi-notice info">
            <strong>{status.connected ? 'Controller found — waking up…' : 'No controller detected.'}</strong>
            <span>Connect over Bluetooth, USB or 2.4 GHz, then press any button. Browsers only reveal a gamepad after a button press.</span>
          </div>
        )}
        {!status.enabled && (
          <div className="orbital-midi-notice info"><strong>Gamepad input is off.</strong><span>Turn it on below. Nothing is polled while it is off.</span></div>
        )}
        {pad && !standard && (
          <div className="orbital-midi-notice info"><strong>Non-standard layout reported.</strong><span>Default bindings may not match this controller. Use Learn on each function.</span></div>
        )}

        {pad && (
          <div className="pad-live">
            <PadDiagram buttons={live.buttons} axes={live.axes} />
            <div className="pad-live-meta">
              <b>{pad.id.replace(/\s*\(.*?\)\s*/g, ' ').trim() || 'Gamepad'}</b>
              <small>{pad.mapping === 'standard' ? 'Standard layout' : 'Non-standard layout'} · {pad.buttons} buttons · {pad.axes} axes</small>
              {extraButtons.length > 0 && (
                <div className="pad-extra">
                  <small>Extra buttons (back paddles appear here if your controller reports them separately):</small>
                  <div>{extraButtons.map(({ v, i }) => <span key={i} className={v >= 0.5 ? 'on' : ''}>Button {i}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="orbital-midi-section-title">FEEL</div>
        <div className="orbital-midi-grid pad-feel">
          <label>Step per tap / flick · {config.step}
            <input type="range" min={GAMEPAD_LIMITS.step.min} max={GAMEPAD_LIMITS.step.max} step={1} value={config.step}
              onChange={(e) => send('orbital:gamepad-set', { step: Number(e.target.value) })} />
          </label>
          <label>Glide speed · {config.speed}/s
            <input type="range" min={GAMEPAD_LIMITS.speed.min} max={GAMEPAD_LIMITS.speed.max} step={5} value={config.speed}
              onChange={(e) => send('orbital:gamepad-set', { speed: Number(e.target.value) })} />
          </label>
          <label>Stick deadzone · {config.deadzone.toFixed(2)}
            <input type="range" min={GAMEPAD_LIMITS.deadzone.min} max={GAMEPAD_LIMITS.deadzone.max} step={0.01} value={config.deadzone}
              onChange={(e) => send('orbital:gamepad-set', { deadzone: Number(e.target.value) })} />
          </label>
        </div>

        {status.learnHint && <div className="orbital-midi-notice info"><span>{status.learnHint}</span></div>}

        {GROUPS.map((group) => (
          <Fragment key={group}>
            <div className="orbital-midi-section-title">{group.toUpperCase()}</div>
            <div className="orbital-midi-assignments">
              {GAMEPAD_FUNCTIONS.filter((f) => f.group === group).map((f) => {
                const control = config.bindings[f.id];
                const learning = status.learning === f.id;
                const prompt = f.accepts === 'axis' ? `PUSH A STICK · ${seconds}s` : `PRESS A BUTTON · ${seconds}s`;
                return (
                  <div className={`orbital-midi-row pad-row ${learning ? 'is-learning' : ''}`} key={f.id}>
                    <span><b>{f.label.toUpperCase()}</b><small>{f.hint}</small></span>
                    <code>
                      {learning ? prompt : describeControl(control, standard)}
                      {!learning && control?.kind === 'axis' && (
                        <label className="pad-invert" title="Swap which direction increases">
                          <input type="checkbox" checked={control.invert}
                            onChange={(e) => send('orbital:gamepad-set', { invert: { fn: f.id as GamepadFunctionId, value: e.target.checked } })} />
                          invert
                        </label>
                      )}
                    </code>
                    <button className={learning ? 'active' : ''} disabled={!status.enabled} onClick={() => send('orbital:gamepad-learn', { fn: f.id })}>{learning ? 'CANCEL' : 'LEARN'}</button>
                    <button onClick={() => send('orbital:gamepad-clear', { fn: f.id })}>CLEAR</button>
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="orbital-midi-footer">
        <span>Saved in this browser and included in settings export. Sticks always drive the knobs you can see.</span>
        <button className="secondary" onClick={() => send('orbital:gamepad-restore-defaults')}>RESTORE DEFAULTS</button>
        <button disabled={!status.supported} onClick={() => send('orbital:gamepad-toggle', { enabled: !status.enabled })}>{status.enabled ? 'TURN OFF' : 'TURN ON'}</button>
      </div>
    </>
  );
}
