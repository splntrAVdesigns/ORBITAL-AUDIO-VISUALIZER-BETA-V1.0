import { useSyncExternalStore } from 'react';
import { getBootSnapshot, subscribeBootReadiness } from '../boot/bootReadiness';

/** Sprint L2: React view onto the boot readiness store (see boot/bootReadiness.ts). */
export function useBootReadiness() {
  return useSyncExternalStore(subscribeBootReadiness, getBootSnapshot, getBootSnapshot);
}
