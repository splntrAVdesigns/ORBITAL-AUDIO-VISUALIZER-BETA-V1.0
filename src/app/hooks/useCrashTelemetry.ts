import { useEffect, useRef, type RefObject } from 'react';
import { CrashTelemetry } from '../runtime/crashTelemetry';
import { RUNTIME_TELEMETRY_ENABLED } from '../config/runtimeEnvironment';

export function useCrashTelemetry(glCanvasRef: RefObject<HTMLCanvasElement | null>) {
  const telemetryRef = useRef<CrashTelemetry | null>(null);

  useEffect(() => {
    if (!RUNTIME_TELEMETRY_ENABLED) return;
    const telemetry = new CrashTelemetry();
    telemetryRef.current = telemetry;
    const detachGL = glCanvasRef.current ? telemetry.attachWebGLCanvas(glCanvasRef.current) : undefined;

    const bridge = Object.assign(
      () => telemetry.snapshot(),
      {
        heartbeat: telemetry.heartbeat.bind(telemetry),
        recordRafCrash: telemetry.recordRafCrash.bind(telemetry),
        recordAudioEvent: telemetry.recordAudioEvent.bind(telemetry),
        markReload: telemetry.markReload.bind(telemetry),
        note: telemetry.note.bind(telemetry),
      },
    );
    (window as any).__ORBITAL_CRASH_TELEMETRY__ = bridge;

    return () => {
      detachGL?.();
      telemetry.dispose();
      telemetryRef.current = null;
      delete (window as any).__ORBITAL_CRASH_TELEMETRY__;
    };
  }, [glCanvasRef]);

  return telemetryRef;
}
