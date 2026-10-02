import { useEffect } from 'react';
import { cancelPendingPresetStep, stepPresetSelection } from '../input/actions';

/**
 * Sprint L6: previously bailed on ANY focused <button>, not just text-entry controls —
 * since virtually every panel interaction ends by focusing a button, Up/Down preset
 * navigation would silently stop working after the very first click anywhere in the
 * UI. Now only genuine text-entry elements and open dialogs suppress it; a focused
 * button (which does nothing with Up/Down itself) no longer does.
 *
 * Sprint O4: stepping + the 70 ms latest-preset commit now live in input/actions so the
 * arrow keys, MIDI and the gamepad D-pad share one coalesced preset stepper.
 */
const TEXT_ENTRY_SELECTOR = 'input,textarea,select,[contenteditable="true"],[role="dialog"]';

export function usePresetKeyboardNavigation(){
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
   const target=e.target as HTMLElement|null;
   if(target?.closest(TEXT_ENTRY_SELECTOR))return;
   if(stepPresetSelection(e.key==='ArrowDown'?1:-1)) e.preventDefault();
  };
  window.addEventListener('keydown',onKey);
  return()=>{window.removeEventListener('keydown',onKey);cancelPendingPresetStep();};
 },[])
}
