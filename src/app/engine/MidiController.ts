/** ORBITAL MIDI manager — Sprint 22K.1 */
export type MidiAssignmentMap = Record<string, number>;
export type MidiCapability = 'checking'|'unsupported'|'blocked'|'denied'|'disconnected'|'connected'|'no-devices';
export type MidiStatus = {
  enabled:boolean; capability:MidiCapability; inputs:{id:string;name:string;manufacturer?:string;state?:string;connection?:string}[];
  selectedInputId:string; channel:number; learningMacro:string|null; assignments:MidiAssignmentMap; lastCC:number|null;
  lastValue:number|null; learnExpiresAt:number|null; error?:string; guidance?:string;
};
export interface MidiControllerOptions {
  params: Record<string, any>;
  applyMacroLive: (macroId: string, value: number) => void;
  commitMacroValue: (macroId: string, value: number) => void;
  getSelectedPaletteIndex: () => number;
  setSelectedPaletteIndex: (v: number) => void;
  palettesLength: number;
}
const STORAGE='orbital-midi-config-v3';
const LEARN_TIMEOUT_MS=15000;
const DEFAULT_ASSIGNMENTS: MidiAssignmentMap = Object.fromEntries(Array.from({length:8},(_,i)=>[`macro${i+1}`,i+1]));

function inferBlockedMessage(message:string){ return /permissions policy|disabled in this document|not allowed by permissions/i.test(message); }
function inferDeniedMessage(message:string){ return /permission|denied|notallowederror/i.test(message); }

export class MidiController {
  private midiAccess:any=null;
  private enabled=false;
  private capability:MidiCapability='checking';
  private selectedInputId='all';
  private channel=0;
  private learningMacro:string|null=null;
  private assignments:MidiAssignmentMap={...DEFAULT_ASSIGNMENTS};
  private cleanupFns:(()=>void)[]=[];
  private learnTimer:number|null=null;
  private learnExpiresAt:number|null=null;
  private lastCC:number|null=null;
  private lastValue:number|null=null;
  private error?:string;
  private guidance?:string;
  private macroCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMacroCommit: { macroId: string; value: number } | null = null;
  constructor(private opts:MidiControllerOptions){ this.load(); }

  init():void {
    this.detectCapability();
    const onToggle=(e:Event)=>this.setEnabled(Boolean((e as CustomEvent).detail?.enabled));
    const onLearn=(e:Event)=>this.toggleLearn((e as CustomEvent).detail?.macroId ?? null);
    const onSelect=(e:Event)=>{ const d=(e as CustomEvent).detail||{}; if(typeof d.inputId==='string')this.selectedInputId=d.inputId; if(Number.isFinite(d.channel))this.channel=d.channel; this.save(); this.bindInputs(); this.emit(); };
    const onClear=(e:Event)=>{ const id=(e as CustomEvent).detail?.macroId; if(id) delete this.assignments[id]; if(this.learningMacro===id)this.cancelLearn(); this.save(); this.emit(); };
    const onCancel=()=>this.cancelLearn();
    window.addEventListener('orbital:midi-toggle',onToggle as EventListener);
    window.addEventListener('orbital:midi-learn',onLearn as EventListener);
    window.addEventListener('orbital:midi-select',onSelect as EventListener);
    window.addEventListener('orbital:midi-clear',onClear as EventListener);
    window.addEventListener('orbital:midi-cancel-learn',onCancel as EventListener);
    this.cleanupFns.push(
      ()=>window.removeEventListener('orbital:midi-toggle',onToggle as EventListener),
      ()=>window.removeEventListener('orbital:midi-learn',onLearn as EventListener),
      ()=>window.removeEventListener('orbital:midi-select',onSelect as EventListener),
      ()=>window.removeEventListener('orbital:midi-clear',onClear as EventListener),
      ()=>window.removeEventListener('orbital:midi-cancel-learn',onCancel as EventListener),
    );
    this.emit();
  }
  dispose():void {
    this.enabled=false;
    this.cancelLearn(false);
    cancelTrackedTimeout(this.macroCommitTimer);
    this.macroCommitTimer=null;
    this.pendingMacroCommit=null;
    this.unbindInputs();
    this.cleanupFns.splice(0).forEach(fn=>fn());
  }

  private scheduleMacroCommit(macroId:string,value:number):void {
    this.pendingMacroCommit={macroId,value};
    cancelTrackedTimeout(this.macroCommitTimer);
    this.macroCommitTimer=scheduleTrackedTimeout('midi-macro-commit',()=>{
      this.macroCommitTimer=null;
      const pending=this.pendingMacroCommit;
      this.pendingMacroCommit=null;
      if(pending)this.opts.commitMacroValue(pending.macroId,pending.value);
    },120);
  }

  private detectCapability(){
    if(!(navigator as any).requestMIDIAccess){
      this.capability='unsupported';
      this.error='Web MIDI is not supported in this browser.';
      this.guidance='Open the deployed ORBITAL app in a current Chromium browser such as Chrome or Edge.';
      return;
    }
    this.capability='disconnected';
    if(window.top!==window.self){
      const policy=(document as any).permissionsPolicy || (document as any).featurePolicy;
      try{
        if(policy?.allowsFeature && !policy.allowsFeature('midi')){
          this.capability='blocked';
          this.error='MIDI is blocked by this preview document permissions policy.';
          this.guidance='Figma preview does not grant Web MIDI access. Test MIDI from the deployed Vercel site in Chrome or Edge.';
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
        this.guidance='Figma preview cannot request MIDI. Open the deployed Vercel build in Chrome or Edge.';
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
    this.learnExpiresAt=Date.now()+LEARN_TIMEOUT_MS;
    this.learnTimer=window.setTimeout(()=>this.cancelLearn(),LEARN_TIMEOUT_MS);
    this.emit();
  }
  private cancelLearn(emit=true){
    if(this.learnTimer!==null)window.clearTimeout(this.learnTimer);
    this.learnTimer=null; this.learningMacro=null; this.learnExpiresAt=null;
    if(emit)this.emit();
  }

  private bindInputs(){
    if(!this.midiAccess)return;
    this.midiAccess.inputs.forEach((input:any)=>{ input.onmidimessage=(this.selectedInputId==='all'||input.id===this.selectedInputId)?this.handleMessage:null; });
    const ids=new Set(Array.from(this.midiAccess.inputs.values()).map((i:any)=>i.id));
    if(this.selectedInputId!=='all'&&!ids.has(this.selectedInputId)){this.selectedInputId='all';this.save();}
  }
  private unbindInputs(){ if(this.midiAccess){ this.midiAccess.inputs.forEach((input:any)=>input.onmidimessage=null); this.midiAccess.onstatechange=null; } }

  private handleMessage=(message:any)=>{
    const [status,data1,data2]=message.data as [number,number,number];
    const command=status & 0xf0; const channel=(status & 0x0f)+1;
    if(this.channel!==0 && channel!==this.channel)return;
    if(command===0xb0){
      this.lastCC=data1; this.lastValue=data2;
      if(this.learningMacro){
        for(const key of Object.keys(this.assignments)) if(this.assignments[key]===data1) delete this.assignments[key];
        this.assignments[this.learningMacro]=data1; this.save(); this.cancelLearn(false);
      }
      const macroId=Object.keys(this.assignments).find(k=>this.assignments[k]===data1);
      if(macroId){
        const value=(data2/127)*100; applyRuntimeParameterTransaction(this.opts.params,{[macroId]:value});
        this.opts.applyMacroLive(macroId,value);
        this.scheduleMacroCommit(macroId,value);
      }
      this.emit();
    }
    if(command===0x90 && data2>0){
      if(data1>=36&&data1<=39){ const mode=data1-36; applyRuntimeParameterTransaction(this.opts.params,{vizMode:mode}); const el=document.querySelector('#vizMode') as HTMLSelectElement|null; if(el){el.value=String(mode);el.dispatchEvent(new Event('change',{bubbles:true}));} }
      if(data1>=40&&data1<=43) this.opts.setSelectedPaletteIndex((this.opts.getSelectedPaletteIndex()+1)%this.opts.palettesLength);
    }
  };

  private snapshot():MidiStatus{
    const inputs=this.midiAccess?Array.from(this.midiAccess.inputs.values()).filter((i:any)=>i.state!=='disconnected').map((i:any)=>({id:i.id,name:i.name||'MIDI Input',manufacturer:i.manufacturer||'',state:i.state,connection:i.connection})):[];
    return {enabled:this.enabled,capability:this.capability,inputs,selectedInputId:this.selectedInputId,channel:this.channel,learningMacro:this.learningMacro,assignments:{...this.assignments},lastCC:this.lastCC,lastValue:this.lastValue,learnExpiresAt:this.learnExpiresAt,error:this.error,guidance:this.guidance};
  }
  private emit(){ window.dispatchEvent(new CustomEvent('orbital:midi-status',{detail:this.snapshot()})); }
  private save(){ localStorage.setItem(STORAGE,JSON.stringify({selectedInputId:this.selectedInputId,channel:this.channel,assignments:this.assignments})); }
  private load(){ try{const s=JSON.parse(localStorage.getItem(STORAGE)||'{}'); if(s.selectedInputId)this.selectedInputId=s.selectedInputId; if(Number.isFinite(s.channel))this.channel=s.channel; if(s.assignments)this.assignments={...DEFAULT_ASSIGNMENTS,...s.assignments};}catch{} }
}
import { cancelTrackedTimeout, scheduleTrackedTimeout } from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { applyRuntimeParameterTransaction } from '../runtime/parameters/RuntimeParameterTransactions';
