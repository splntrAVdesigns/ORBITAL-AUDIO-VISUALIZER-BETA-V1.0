import { useEffect } from 'react';

/**
 * Sprint L6: previously bailed on ANY focused <button>, not just text-entry controls —
 * since virtually every panel interaction ends by focusing a button, Up/Down preset
 * navigation would silently stop working after the very first click anywhere in the
 * UI. Now only genuine text-entry elements and open dialogs suppress it; a focused
 * button (which does nothing with Up/Down itself) no longer does.
 */
const TEXT_ENTRY_SELECTOR = 'input,textarea,select,[contenteditable="true"],[role="dialog"]';

export function usePresetKeyboardNavigation(){
 useEffect(()=>{
  let timer:number|undefined; let pendingIndex:number|null=null;
  const commit=(select:HTMLSelectElement,valid:HTMLOptionElement[])=>{
   if(pendingIndex===null)return; const i=pendingIndex; pendingIndex=null;
   select.value=valid[i].value; select.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const onKey=(e:KeyboardEvent)=>{
   if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;const target=e.target as HTMLElement|null;
   if(target?.closest(TEXT_ENTRY_SELECTOR))return;
   const select=document.getElementById('presetSelect') as HTMLSelectElement|null;if(!select)return;e.preventDefault();
   const valid=Array.from(select.options).filter(o=>Number(o.value)>=0);
   let i=pendingIndex??valid.findIndex(o=>o.value===select.value);if(i<0)i=0;
   pendingIndex=(i+(e.key==='ArrowDown'?1:-1)+valid.length)%valid.length;
   if(timer)window.clearTimeout(timer); timer=window.setTimeout(()=>commit(select,valid),70);
  };
  window.addEventListener('keydown',onKey);return()=>{window.removeEventListener('keydown',onKey);if(timer)clearTimeout(timer)}
 },[])
}
