import { cancelTrackedTimeout, scheduleTrackedTimeout } from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { safeLocalStorage } from '../utils/browserCompat';
import { InputRouter } from '../input/InputRouter';
import { MacroMotor } from '../input/MacroMotor';
import { MACRO_LIVE_PREVIEW_EVENT, type MacroId } from '../input/types';

/**
 * ORBITAL — MIDI controller (Sprint O3).
 *
 * Changes from v3:
 *  - Macros start UNASSIGNED (Learn is the norm in VJ tools). The old CC 1–8 defaults
 *    collided with mod wheel (CC1), breath (CC2) and channel volume (CC7).
 *  - Bindings are device + channel aware: { cc, channel, inputId }. Two controllers
 *    sending the same CC no longer collide.
 *  - Learn needs a deliberate move (the same control must travel >= LEARN_MIN_TRAVEL),
 *    so a noisy continuous controller on "All inputs" can't steal the binding.
 *  - Optional soft takeover (pickup), OFF by default. Useful for pots/faders with a
 *    physical position; wrong for endless encoders, which have none.
 *  - Knob gutters paint on every CC via MACRO_LIVE_PREVIEW_EVENT; status publishes are
 *    coalesced to one per STATUS_INTERVAL_MS instead of one per message.
 *  - Removed hidden Note actions (36–39 viz mode — dead since Sprint M; 40–43 palette
 *    cycle — fired whenever those keys were played).
 *  - Mappings export/import with settings (exportMidiConfig / importMidiConfig).
 */

export interface MidiBinding { cc: number; channel: number; inputId?: string; inputName?: string }
export type MidiAssignmentMap = Record<string, MidiBinding>;
export type MidiCapability = 'checking'|'unsupported'|'blocked'|'denied'|'disconnected'|'connected'|'no-devices';
export type MidiStatus = {
  enabled:boolean; capability:MidiCapability; inputs:{id:string;name:string;manufacturer?:string;state?:string;connection?:string}[];
  selectedInputId:string; channel:number; learningMacro:string|null; assignments:MidiAssignmentMap; lastCC:number|null;
  lastValue:number|null; lastChannel?:number|null; learnExpiresAt:number|null; softTakeover?:boolean;
  waitingForPickup?:string[]; error?:string; guidance?:string;
};
export interface MidiControllerOptions {
  params: Record<string, any>;
  /** Only used when no shared router is supplied. */
  applyMacroLive?: (macroId: string, value: number) => void;
  commitMacroValue?: (macroId: string, value: number) => void;
  getSelectedPaletteIndex: () => number;
  setSelectedPaletteIndex: (v: number) => void;
  palettesLength: number;
  /** Shared router (Sprint O4). When omitted the controller builds a private one. */
  router?: InputRouter;
}

export const MIDI_CONFIG_IMPORTED_EVENT = 'orbital:midi-config-imported';
/** Re-exported for existing imports; owned by input/types since Sprint O4. */
export { MACRO_LIVE_PREVIEW_EVENT };
const STATUS_INTERVAL_MS = 80;
const STORAGE = 'orbital-midi-config-v4';
const LEGACY_STORAGE = 'orbital-midi-config-v3';
const LEARN_TIMEOUT_MS = 15000;
/** Minimum CC travel (0–127) before Learn accepts a control. */
const LEARN_MIN_TRAVEL = 6;
/** Pickup window in macro units (0–100). */
const PICKUP_WINDOW = 3;
const MACRO_IDS = Array.from({ length: 8 }, (_, i) => `macro${i + 1}`);

function inferBlockedMessage(message:string){ return /permissions policy|disabled in this document|not allowed by permissions/i.test(message); }
function inferDeniedMessage(message:string){ return /permission|denied|notallowederror/i.test(message); }
const clampInt = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

function sanitizeBinding(raw: unknown): MidiBinding | null {
  if (typeof raw === 'number') { const cc = clampInt(raw, 0, 119); return cc === null ? null : { cc, channel: 0 }; }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const cc = clampInt(r.cc, 0, 119);
  const channel = clampInt(r.channel, 0, 16);
  if (cc === null || channel === null) return null;
  const binding: MidiBinding = { cc, channel };
  if (typeof r.inputId === 'string' && r.inputId.length <= 256) binding.inputId = r.inputId;
  if (typeof r.inputName === 'string' && r.inputName.length <= 128) binding.inputName = r.inputName;
  return binding;
}

export function sanitizeAssignments(raw: unknown): MidiAssignmentMap {
  const out: MidiAssignmentMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of MACRO_IDS) { const b = sanitizeBinding((raw as Record<string, unknown>)[id]); if (b) out[id] = b; }
  return out;
}

/** v3 stored the untouched factory map { macroN: N }. Treat that as "never learned". */
function isLegacyFactoryMap(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const entries = Object.entries(raw as Record<string, unknown>);
  return entries.length === 8 && entries.every(([k, v]) => /^macro[1-8]$/.test(k) && v === Number(k.slice(5)));
}

export interface MidiConfigPayload { version: 4; selectedInputId: string; channel: number; pickup: boolean; assignments: MidiAssignmentMap }

/** Read the saved MIDI config for settings export. */
export function exportMidiConfig(): MidiConfigPayload | null {
  try { const s = JSON.parse(safeLocalStorage.getItem(STORAGE) || 'null'); return s && s.version === 4 ? s : null; } catch { return null; }
}

/** Validate and store an imported MIDI config, then tell the live controller to reload. */
export function importMidiConfig(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  const payload: MidiConfigPayload = {
    version: 4,
    selectedInputId: typeof r.selectedInputId === 'string' && r.selectedInputId.length <= 256 ? r.selectedInputId : 'all',
    channel: clampInt(r.channel, 0, 16) ?? 0,
    pickup: r.pickup === true,
    assignments: sanitizeAssignments(r.assignments),
  };
  safeLocalStorage.setItem(STORAGE, JSON.stringify(payload));
  window.dispatchEvent(new Event(MIDI_CONFIG_IMPORTED_EVENT));
  return true;
}

export class MidiController {
  private midiAccess:any=null;
  private enabled=false;
  private capability:MidiCapability='checking';
  private selectedInputId='all';
  private channel=0;
  /** Soft takeover is opt-in: endless encoders (e.g. Komplete Kontrol) have no physical position. */
  private softTakeover=false;
  private learningMacro:string|null=null;
  private learnCandidates=new Map<string,number>();
  private assignments:MidiAssignmentMap={};
  private cleanupFns:(()=>void)[]=[];
  private learnTimer:number|null=null;
  private learnExpiresAt:number|null=null;
  private lastCC:number|null=null;
  private lastValue:number|null=null;
  private lastChannel:number|null=null;
  /** Soft takeover: the macro value MIDI last wrote, and the last raw position seen. */
  private lastWritten=new Map<string,number>();
  private lastIncoming=new Map<string,number>();
  private pickedUp=new Set<string>();
  private error?:string;
  private guidance?:string;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly router: InputRouter;
  private readonly ownsRouter: boolean;
  constructor(private opts:MidiControllerOptions){
    this.ownsRouter=!opts.router;
    this.router=opts.router ?? new InputRouter(new MacroMotor({params:opts.params,applyMacroLive:opts.applyMacroLive??(()=>{}),commitMacroValue:opts.commitMacroValue??(()=>{})}));
    this.load();
  }

  init():void {
    this.detectCapability();
    const onToggle=(e:Event)=>this.setEnabled(Boolean((e as CustomEvent).detail?.enabled));
    const onLearn=(e:Event)=>this.toggleLearn((e as CustomEvent).detail?.macroId ?? null);
    const onSelect=(e:Event)=>{ const d=(e as CustomEvent).detail||{};
      if(typeof d.inputId==='string')this.selectedInputId=d.inputId;
      if(Number.isFinite(d.channel))this.channel=d.channel;
      if(typeof d.softTakeover==='boolean'){ this.softTakeover=d.softTakeover; this.pickedUp.clear(); this.lastIncoming.clear(); }
      this.save(); this.bindInputs(); this.emit(); };
    const onClear=(e:Event)=>{ const id=(e as CustomEvent).detail?.macroId; if(id){ delete this.assignments[id]; this.pickedUp.delete(id); } if(this.learningMacro===id)this.cancelLearn(); this.save(); this.emit(); };
    const onCancel=()=>this.cancelLearn();
    const onImported=()=>{ this.load(); this.pickedUp.clear(); this.bindInputs(); this.emit(); };
    const pairs:[string,EventListener][]=[
      ['orbital:midi-toggle',onToggle as EventListener],['orbital:midi-learn',onLearn as EventListener],
      ['orbital:midi-select',onSelect as EventListener],['orbital:midi-clear',onClear as EventListener],
      ['orbital:midi-cancel-learn',onCancel as EventListener],[MIDI_CONFIG_IMPORTED_EVENT,onImported as EventListener],
    ];
    for(const [name,fn] of pairs){ window.addEventListener(name,fn); this.cleanupFns.push(()=>window.removeEventListener(name,fn)); }
    this.cleanupFns.push(InputRouter.onOtherSourceLearn('midi',()=>{ if(this.learningMacro) this.cancelLearn(); }));
    this.emit();
  }
  dispose():void {
    this.enabled=false;
    this.cancelLearn(false);
    cancelTrackedTimeout(this.statusTimer);
    this.statusTimer=null;
    this.unbindInputs();
    this.cleanupFns.splice(0).forEach(fn=>fn());
    if(this.ownsRouter) this.router.dispose();
  }

  private detectCapability(){
    if(!(navigator as any).requestMIDIAccess){
      this.capability='unsupported';
      this.error='Web MIDI is not supported in this browser.';
      this.guidance='Use Chrome, Edge or Firefox on desktop. Safari does not support Web MIDI.';
      return;
    }
    this.capability='disconnected';
    if(window.top!==window.self){
      const policy=(document as any).permissionsPolicy || (document as any).featurePolicy;
      try{
        if(policy?.allowsFeature && !policy.allowsFeature('midi')){
          this.capability='blocked';
          this.error='MIDI is blocked by this preview document permissions policy.';
          this.guidance='Embedded previews do not grant Web MIDI access. Open orbital-visualizer.splntr-microtools.com in Chrome, Edge or Firefox.';
        }
      }catch{}
    }
  }

  private async setEnabled(enabled:boolean){
    if(!enabled){ this.enabled=false; this.cancelLearn(false); this.unbindInputs(); this.capability='disconnected'; this.error=undefined; this.guidance=undefined; this.detectCapability(); this.emit(); return; }
    if(this.capability==='blocked'||this.capability==='unsupported'){ this.emit(); return; }
    try{
      this.error=undefined; this.guidance=undefined;
      this.midiAccess=await (navigator as any).requestMIDIAccess({sysex:false});
      this.enabled=true;
      this.midiAccess.onstatechange=()=>{this.bindInputs();this.refreshCapability();this.emit();};
      this.bindInputs(); this.refreshCapability(); this.emit();
    }catch(err:any){
      const msg=err?.message||String(err)||'Web MIDI unavailable';
      this.enabled=false;
      if(inferBlockedMessage(msg)){
        this.capability='blocked';
        this.error='MIDI is blocked by this preview document permissions policy.';
        this.guidance='Embedded previews cannot request MIDI. Open the deployed site in Chrome, Edge or Firefox.';
      }else if(inferDeniedMessage(msg)){
        this.capability='denied'; this.error='MIDI permission was denied.'; this.guidance='Allow MIDI access in the browser site permissions, then reconnect.';
      }else{
        this.capability='disconnected'; this.error=msg; this.guidance='Reconnect the MIDI device and try again from the deployed secure site.';
      }
      this.emit();
    }
  }

  private refreshCapability(){
    const count=this.midiAccess?Array.from(this.midiAccess.inputs.values()).filter((i:any)=>i.state!=='disconnected').length:0;
    this.capability=this.enabled?(count?'connected':'no-devices'):'disconnected';
    if(this.capability==='no-devices'){
      this.error=undefined;
      this.guidance='MIDI access is enabled, but no input devices are currently detected.';
    }else if(this.capability==='connected'){
      this.error=undefined; this.guidance=undefined;
    }
  }

  private toggleLearn(macroId:string|null){
    if(!macroId)return;
    if(this.learningMacro===macroId){ this.cancelLearn(); return; }
    this.cancelLearn(false);
    this.learningMacro=macroId;
    this.learnCandidates.clear();
    this.learnExpiresAt=Date.now()+LEARN_TIMEOUT_MS;
    InputRouter.announceLearnBegin('midi');
    this.learnTimer=window.setTimeout(()=>this.cancelLearn(),LEARN_TIMEOUT_MS);
    this.emit();
  }
  private cancelLearn(emit=true){
    if(this.learnTimer!==null)window.clearTimeout(this.learnTimer);
    this.learnTimer=null; this.learningMacro=null; this.learnExpiresAt=null; this.learnCandidates.clear();
    if(emit)this.emit();
  }

  private bindInputs(){
    if(!this.midiAccess)return;
    this.midiAccess.inputs.forEach((input:any)=>{ input.onmidimessage=(this.selectedInputId==='all'||input.id===this.selectedInputId)?this.handleMessage:null; });
    const ids=new Set(Array.from(this.midiAccess.inputs.values()).map((i:any)=>i.id));
    if(this.selectedInputId!=='all'&&!ids.has(this.selectedInputId)){this.selectedInputId='all';this.save();}
  }
  private unbindInputs(){ if(this.midiAccess){ this.midiAccess.inputs.forEach((input:any)=>input.onmidimessage=null); this.midiAccess.onstatechange=null; } }

  private bindingMatches(b:MidiBinding,cc:number,channel:number,inputId:string){
    return b.cc===cc && (b.channel===0||b.channel===channel) && (!b.inputId||b.inputId===inputId);
  }

  /** Soft takeover gate. Returns true when this incoming value may drive the macro. */
  private passesPickup(macroId:string,value:number):boolean{
    if(!this.softTakeover){ this.lastIncoming.set(macroId,value); return true; }
    const current=Number(this.opts.params[macroId]);
    const written=this.lastWritten.get(macroId);
    // Something other than MIDI moved the macro (preset, UI, randomize): re-arm pickup.
    if(written===undefined || !Number.isFinite(current) || Math.abs(current-written)>1) this.pickedUp.delete(macroId);
    if(this.pickedUp.has(macroId)){ this.lastIncoming.set(macroId,value); return true; }
    const previous=this.lastIncoming.get(macroId);
    this.lastIncoming.set(macroId,value);
    const target=Number.isFinite(current)?current:0;
    const crossed=previous!==undefined && (previous-target)*(value-target)<=0;
    if(Math.abs(value-target)<=PICKUP_WINDOW || crossed){ this.pickedUp.add(macroId); return true; }
    return false;
  }

  private handleMessage=(message:any)=>{
    const [status,data1,data2]=message.data as [number,number,number];
    const command=status & 0xf0; const channel=(status & 0x0f)+1;
    if(this.channel!==0 && channel!==this.channel)return;
    if(command!==0xb0 || data1>119) return; // CC only; 120–127 are channel-mode messages.
    const input=message.currentTarget||message.target||{};
    const inputId=String(input.id||'');
    this.lastCC=data1; this.lastValue=data2; this.lastChannel=channel;

    if(this.learningMacro){
      const key=`${inputId}|${channel}|${data1}`;
      const first=this.learnCandidates.get(key);
      if(first===undefined){ this.learnCandidates.set(key,data2); this.emitSoon(); return; }
      if(Math.abs(data2-first)<LEARN_MIN_TRAVEL){ this.emitSoon(); return; }
      const binding:MidiBinding={cc:data1,channel,inputId:inputId||undefined,inputName:input.name||undefined};
      for(const id of Object.keys(this.assignments)) if(this.bindingMatches(this.assignments[id],data1,channel,inputId)) delete this.assignments[id];
      this.assignments[this.learningMacro]=binding;
      this.pickedUp.add(this.learningMacro); // the user is holding this control right now
      this.save(); this.cancelLearn(false);
      this.emit(); // assignment changed: publish immediately
    }

    const value=(data2/127)*100;
    for(const macroId of Object.keys(this.assignments)){
      if(!this.bindingMatches(this.assignments[macroId],data1,channel,inputId)) continue;
      if(!this.passesPickup(macroId,value)) continue;
      // Sprint O4: one write path for every controller (live apply, gutter preview, debounced commit).
      this.router.absolute({kind:'macro',macroId:macroId as MacroId},value);
      this.lastWritten.set(macroId,Number(this.opts.params[macroId]));
    }
    this.emitSoon();
  };

  private snapshot():MidiStatus{
    const inputs=this.midiAccess?Array.from(this.midiAccess.inputs.values()).filter((i:any)=>i.state!=='disconnected').map((i:any)=>({id:i.id,name:i.name||'MIDI Input',manufacturer:i.manufacturer||'',state:i.state,connection:i.connection})):[];
    const waitingForPickup=this.softTakeover?Object.keys(this.assignments).filter(id=>this.lastIncoming.has(id)&&!this.pickedUp.has(id)):[];
    return {enabled:this.enabled,capability:this.capability,inputs,selectedInputId:this.selectedInputId,channel:this.channel,learningMacro:this.learningMacro,assignments:{...this.assignments},lastCC:this.lastCC,lastValue:this.lastValue,lastChannel:this.lastChannel,learnExpiresAt:this.learnExpiresAt,softTakeover:this.softTakeover,waitingForPickup,error:this.error,guidance:this.guidance};
  }
  private emit(){
    cancelTrackedTimeout(this.statusTimer); this.statusTimer=null;
    window.dispatchEvent(new CustomEvent('orbital:midi-status',{detail:this.snapshot()}));
  }
  /** CC streams arrive at 100+ msg/s. The status only feeds the modal readout, so publish at most every STATUS_INTERVAL_MS. */
  private emitSoon(){
    if(this.statusTimer!==null) return;
    this.statusTimer=scheduleTrackedTimeout('midi-status-coalesce',()=>{ this.statusTimer=null; this.emit(); },STATUS_INTERVAL_MS);
  }
  private save(){
    const payload:MidiConfigPayload={version:4,selectedInputId:this.selectedInputId,channel:this.channel,pickup:this.softTakeover,assignments:this.assignments};
    safeLocalStorage.setItem(STORAGE,JSON.stringify(payload));
  }
  private load(){
    try{
      let s=JSON.parse(safeLocalStorage.getItem(STORAGE)||'null');
      if(!s){
        // One-time v3 migration. An untouched factory map (CC 1–8) becomes unassigned.
        const legacy=JSON.parse(safeLocalStorage.getItem(LEGACY_STORAGE)||'null');
        if(legacy){
          s={version:4,selectedInputId:legacy.selectedInputId,channel:legacy.channel,pickup:false,
            assignments:isLegacyFactoryMap(legacy.assignments)?{}:legacy.assignments};
        }
      }
      if(!s) return;
      if(typeof s.selectedInputId==='string') this.selectedInputId=s.selectedInputId;
      if(Number.isFinite(s.channel)) this.channel=s.channel;
      this.softTakeover=s.pickup===true;
      this.assignments=sanitizeAssignments(s.assignments);
      this.save();
    }catch{}
  }
}
