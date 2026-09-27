/**
 * Sprint L1: single source for the phone / portrait-tablet gate.
 *
 * Evaluated synchronously on first render so a blocked device never sees one frame
 * of the landing page before the blocker replaces it. The same rules are used by
 * useOrbitalAppLifecycle for live resize/orientation updates.
 */
export interface DeviceGate {
  isMobileDevice: boolean;
  isLandscapeOnly: boolean;
}

export function detectDeviceGate(): DeviceGate {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isMobileDevice: false, isLandscapeOnly: false };
  }
  const mobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const small = window.innerWidth < 768;
  const portrait = window.innerHeight > window.innerWidth;
  return {
    isMobileDevice: mobileUA && small,
    isLandscapeOnly: !mobileUA && small && portrait,
  };
}
