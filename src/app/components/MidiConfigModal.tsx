import { useEffect,useMemo,useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import type { MidiStatus } from '../engine/MidiController';
import { GAMEPAD_STATUS_EVENT, type GamepadStatus } from '../input/GamepadSource';
import { GamepadPanel } from './GamepadPanel';

/** Sprint O5: the MIDI modal is now the Controllers modal (MIDI | GAMEPAD tabs). */
type ControllerTab='midi'|'gamepad';
const initial:MidiStatus={enabled:false,capability:'checking',inputs:[],selectedInputId:'all',channel:0,learningMacro:null,assignments:{},lastCC:null,lastValue:null,learnExpiresAt:null};
const describeBinding=(b:MidiStatus['assignments'][string]|undefined)=>b?`CC ${b.cc}${b.channel?` · CH ${b.channel}`:''}${b.inputName?` · ${b.inputName}`:''}`:'UNASSIGNED';
const LABELS=['ENERGY','MOTION','CHAOS','ATMOSPHERE','DETAIL','SPACE','PULSE','MASTER'];
export function MidiConfigModal(){
 const [open,setOpen]=useState(false); const [tab,setTab]=useState<ControllerTab>('midi'); const [status,setStatus]=useState<MidiStatus>(initial); const [pad,setPad]=useState<GamepadStatus|null>(null); const [,forceTick]=useState(0);
 useEffect(()=>{const onOpen=(e:Event)=>{const t=(e as CustomEvent).detail?.tab; if(t==='midi'||t==='gamepad')setTab(t); setOpen(true)}; const onStatus=(e:Event)=>setStatus((e as CustomEvent).detail); const onPad=(e:Event)=>setPad((e as CustomEvent).detail); window.addEventListener('orbital:midi-open',onOpen); window.addEventListener('orbital:midi-status',onStatus as EventListener); window.addEventListener(GAMEPAD_STATUS_EVENT,onPad as EventListener); return()=>{window.removeEventListener('orbital:midi-open',onOpen);window.removeEventListener('orbital:midi-status',onStatus as EventListener);window.removeEventListener(GAMEPAD_STATUS_EVENT,onPad as EventListener)}},[]);
 const learnDeadline=status.learnExpiresAt||pad?.learnExpiresAt||null;
 // One countdown interval for both sources' Learn (async audit: 1 owned interval).
 useEffect(()=>{if(!open||!learnDeadline)return;const id=window.setInterval(()=>forceTick(v=>v+1),250);return()=>window.clearInterval(id)},[open,learnDeadline]);
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(status.learningMacro)dispatch('orbital:midi-cancel-learn',{});else if(pad?.learning)dispatch('orbital:gamepad-cancel-learn',{});else setOpen(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open,status.learningMacro,pad?.learning]);
 const blocked=status.capability==='blocked'||status.capability==='unsupported';
 const stateLabel=useMemo(()=>({checking:'CHECKING',unsupported:'UNSUPPORTED',blocked:'BLOCKED BY HOST',denied:'PERMISSION DENIED',disconnected:'DISCONNECTED',connected:'CONNECTED','no-devices':'NO DEVICES'}[status.capability]),[status.capability]);
 const padLabel=!pad?'CHECKING':!pad.supported?'UNSUPPORTED':!pad.enabled?'OFF':pad.pad?'CONNECTED':pad.connected?'PRESS ANY BUTTON':'NO CONTROLLER';
 if(!open)return null;
 function dispatch(name:string,detail:any){window.dispatchEvent(new CustomEvent(name,{detail}))}
 const seconds=status.learnExpiresAt?Math.max(0,Math.ceil((status.learnExpiresAt-Date.now())/1000)):0;
 return <div className="orbital-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="orbital-midi-modal" role="dialog" aria-modal="true" aria-label="Controllers">
   <div className="orbital-modal-header"><div><b>CONTROLLERS</b>{tab==='gamepad'?<small data-state={pad?.pad?'connected':'disconnected'}>{padLabel}</small>:<small data-state={status.capability}>{stateLabel}{status.lastCC!==null?` · CC ${status.lastCC} / ${status.lastValue}${status.lastChannel?` · CH ${status.lastChannel}`:''}`:''}</small>}</div><button aria-label="Close controllers" onClick={()=>setOpen(false)}><X size={16}/></button></div>
   <div className="orbital-controller-tabs" role="tablist">{(['midi','gamepad'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='midi'?'MIDI':'GAMEPAD'}<span className={`dot ${(t==='midi'?status.capability==='connected':!!pad?.pad)?'on':''}`}/></button>)}</div>
   {tab==='gamepad'?<GamepadPanel status={pad} now={Date.now()}/>:<>
   <div className="orbital-midi-body">
    <div className="orbital-midi-section-title">MIDI INPUT</div>
    <div className="orbital-midi-grid">
     <label>Input<select disabled={!status.enabled||status.inputs.length===0} value={status.selectedInputId} onChange={e=>dispatch('orbital:midi-select',{inputId:e.target.value})}><option value="all">All MIDI inputs</option>{status.inputs.map(i=><option key={i.id} value={i.id}>{i.manufacturer?`${i.manufacturer} · `:''}{i.name}</option>)}</select></label>
     <label>Channel<select value={status.channel} onChange={e=>dispatch('orbital:midi-select',{channel:Number(e.target.value)})}><option value={0}>Omni</option>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1}>Channel {i+1}</option>)}</select></label>
     <label title="For pots and faders with a physical position: after a preset change the control only takes over once it reaches the macro's value. Leave Off for endless encoders (Komplete Kontrol, most DJ/VJ controllers).">Soft takeover<select value={status.softTakeover?'on':'off'} onChange={e=>dispatch('orbital:midi-select',{softTakeover:e.target.value==='on'})}><option value="off">Off (direct)</option><option value="on">On (pickup, pots/faders)</option></select></label>
    </div>
    {status.inputs.length>0&&<div className="orbital-midi-device-list">{status.inputs.map(i=><div key={i.id}><span className="orbital-midi-device-dot"/>{i.name}<small>{i.connection||i.state||'available'}</small></div>)}</div>}
    {(status.error||status.guidance)&&<div className={`orbital-midi-notice ${status.error?'error':'info'}`}>{status.error&&<strong>{status.error}</strong>}{status.guidance&&<span>{status.guidance}</span>}</div>}
    <div className="orbital-midi-section-title">MACRO ASSIGNMENTS</div>
    <div className="orbital-midi-assignments">{Array.from({length:8},(_,i)=>{const id=`macro${i+1}`;const binding=status.assignments[id];const learning=status.learningMacro===id;const waiting=!!status.waitingForPickup?.includes(id);return <div className={`orbital-midi-row ${learning?'is-learning':''}`} key={id}><span><b>MACRO {i+1}</b><small>{LABELS[i]}</small></span><code title={waiting?'Turn this control toward the macro value to pick it up.':undefined}>{learning?`MOVE A CONTROL · ${seconds}s`:describeBinding(binding)}{waiting&&!learning?' · PICKUP':''}</code><button className={learning?'active':''} onClick={()=>dispatch('orbital:midi-learn',{macroId:id})}>{learning?'CANCEL':'LEARN'}</button><button onClick={()=>dispatch('orbital:midi-clear',{macroId:id})}>CLEAR</button></div>})}</div>
   </div>
   <div className="orbital-midi-footer"><span>Saved in this browser and included in settings export.</span><button className="secondary" onClick={()=>dispatch('orbital:midi-toggle',{enabled:status.enabled})} title="Refresh MIDI devices"><RefreshCw size={13}/></button><button disabled={blocked} onClick={()=>dispatch('orbital:midi-toggle',{enabled:!status.enabled})}>{status.enabled?'DISCONNECT':'CONNECT MIDI'}</button></div>
   </>}
  </div>
 </div>
}
