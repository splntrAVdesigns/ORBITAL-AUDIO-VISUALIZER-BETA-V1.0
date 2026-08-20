import { useEffect,useMemo,useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import type { MidiStatus } from '../engine/MidiController';
const initial:MidiStatus={enabled:false,capability:'checking',inputs:[],selectedInputId:'all',channel:0,learningMacro:null,assignments:{},lastCC:null,lastValue:null,learnExpiresAt:null};
const LABELS=['ENERGY','MOTION','CHAOS','ATMOSPHERE','DETAIL','SPACE','PULSE','MASTER'];
export function MidiConfigModal(){
 const [open,setOpen]=useState(false); const [status,setStatus]=useState<MidiStatus>(initial); const [,forceTick]=useState(0);
 useEffect(()=>{const onOpen=()=>setOpen(true); const onStatus=(e:Event)=>setStatus((e as CustomEvent).detail); window.addEventListener('orbital:midi-open',onOpen); window.addEventListener('orbital:midi-status',onStatus as EventListener); return()=>{window.removeEventListener('orbital:midi-open',onOpen);window.removeEventListener('orbital:midi-status',onStatus as EventListener)}},[]);
 useEffect(()=>{if(!open||!status.learnExpiresAt)return;const id=window.setInterval(()=>forceTick(v=>v+1),250);return()=>window.clearInterval(id)},[open,status.learnExpiresAt]);
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(status.learningMacro)dispatch('orbital:midi-cancel-learn',{});else setOpen(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open,status.learningMacro]);
 const blocked=status.capability==='blocked'||status.capability==='unsupported';
 const stateLabel=useMemo(()=>({checking:'CHECKING',unsupported:'UNSUPPORTED',blocked:'BLOCKED BY HOST',denied:'PERMISSION DENIED',disconnected:'DISCONNECTED',connected:'CONNECTED','no-devices':'NO DEVICES'}[status.capability]),[status.capability]);
 if(!open)return null;
 function dispatch(name:string,detail:any){window.dispatchEvent(new CustomEvent(name,{detail}))}
 const seconds=status.learnExpiresAt?Math.max(0,Math.ceil((status.learnExpiresAt-Date.now())/1000)):0;
 return <div className="orbital-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="orbital-midi-modal" role="dialog" aria-modal="true" aria-label="MIDI Configuration">
   <div className="orbital-modal-header"><div><b>MIDI CONFIGURATION</b><small data-state={status.capability}>{stateLabel}{status.lastCC!==null?` · CC ${status.lastCC} / ${status.lastValue}`:''}</small></div><button aria-label="Close MIDI configuration" onClick={()=>setOpen(false)}><X size={16}/></button></div>
   <div className="orbital-midi-body">
    <div className="orbital-midi-section-title">MIDI INPUT</div>
    <div className="orbital-midi-grid">
     <label>Input<select disabled={!status.enabled||status.inputs.length===0} value={status.selectedInputId} onChange={e=>dispatch('orbital:midi-select',{inputId:e.target.value})}><option value="all">All MIDI inputs</option>{status.inputs.map(i=><option key={i.id} value={i.id}>{i.manufacturer?`${i.manufacturer} · `:''}{i.name}</option>)}</select></label>
     <label>Channel<select value={status.channel} onChange={e=>dispatch('orbital:midi-select',{channel:Number(e.target.value)})}><option value={0}>Omni</option>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1}>Channel {i+1}</option>)}</select></label>
    </div>
    {status.inputs.length>0&&<div className="orbital-midi-device-list">{status.inputs.map(i=><div key={i.id}><span className="orbital-midi-device-dot"/>{i.name}<small>{i.connection||i.state||'available'}</small></div>)}</div>}
    {(status.error||status.guidance)&&<div className={`orbital-midi-notice ${status.error?'error':'info'}`}>{status.error&&<strong>{status.error}</strong>}{status.guidance&&<span>{status.guidance}</span>}</div>}
    <div className="orbital-midi-section-title">MACRO ASSIGNMENTS</div>
    <div className="orbital-midi-assignments">{Array.from({length:8},(_,i)=>{const id=`macro${i+1}`;const cc=status.assignments[id];const learning=status.learningMacro===id;return <div className={`orbital-midi-row ${learning?'is-learning':''}`} key={id}><span><b>MACRO {i+1}</b><small>{LABELS[i]}</small></span><code>{learning?`LISTENING · ${seconds}s`:cc===undefined?'UNASSIGNED':`CC ${cc}`}</code><button className={learning?'active':''} onClick={()=>dispatch('orbital:midi-learn',{macroId:id})}>{learning?'CANCEL':'LEARN'}</button><button onClick={()=>dispatch('orbital:midi-clear',{macroId:id})}>CLEAR</button></div>})}</div>
   </div>
   <div className="orbital-midi-footer"><span>Assignments persist in this browser.</span><button className="secondary" onClick={()=>dispatch('orbital:midi-toggle',{enabled:status.enabled})} title="Refresh MIDI devices"><RefreshCw size={13}/></button><button disabled={blocked} onClick={()=>dispatch('orbital:midi-toggle',{enabled:!status.enabled})}>{status.enabled?'DISCONNECT':'CONNECT MIDI'}</button></div>
  </div>
 </div>
}
