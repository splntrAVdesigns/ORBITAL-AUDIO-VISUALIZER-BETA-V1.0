import {
  DEVELOPMENT_DIAGNOSTICS_ENABLED,
  getRuntimeEnvironmentValue,
} from '../../../config/runtimeEnvironment';

const developmentFlag = (name: string): boolean => (
  DEVELOPMENT_DIAGNOSTICS_ENABLED && getRuntimeEnvironmentValue(name) === 'true'
);

export const DEBUG_FLAGS = {
  GENERAL: developmentFlag('VITE_ORBITAL_DEBUG_GENERAL'),
  AUDIO: developmentFlag('VITE_ORBITAL_DEBUG_AUDIO'),
  RENDER: developmentFlag('VITE_ORBITAL_DEBUG_RENDER'),
  PERFORMANCE: developmentFlag('VITE_ORBITAL_DEBUG_PERFORMANCE'),
  BEAT_DETECTION: developmentFlag('VITE_ORBITAL_DEBUG_BEAT_DETECTION'),
  UI_EVENTS: developmentFlag('VITE_ORBITAL_DEBUG_UI_EVENTS'),
} as const;

export const DEBUG_GENERAL = DEBUG_FLAGS.GENERAL;
export const DEBUG_PERF = DEBUG_FLAGS.PERFORMANCE;
export const DEBUG_WEBGL = developmentFlag('VITE_ORBITAL_DEBUG_WEBGL');
export const DEBUG_AUDIO = DEBUG_FLAGS.AUDIO;
