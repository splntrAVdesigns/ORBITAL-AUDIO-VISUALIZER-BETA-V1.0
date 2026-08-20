export function computeCoreParticleReactivity(a:{bass:number;mid:number;high:number;transient:number;beat:number;chaos:number;spread:number}){
 const c=(v:number)=>Math.max(0,Math.min(1,v||0)); const bass=c(a.bass),mid=c(a.mid),high=c(a.high),tr=c(a.transient),beat=c(a.beat);
 return {radialImpulse:c(bass*.62+tr*.48+beat*.7),swirl:c(mid*.55+a.chaos*.35),depthPulse:c(tr*.7+high*.25),sizePulse:c(high*.42+beat*.55),spread:c(a.spread*(.78+bass*.32))};
}