import { useEffect, useRef } from 'react';

interface MacroKnobProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  /** Keep pointer-drag values entirely local until mouse release. */
  deferRuntimeUpdates?: boolean;
  size?: number;
  disabled?: boolean;
}

export function MacroKnob({
  id,
  label,
  value,
  onChange,
  onCommit,
  deferRuntimeUpdates = false,
  size = 80,
  disabled = false,
}: MacroKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const fillPathRef = useRef<SVGPathElement>(null);
  const valueLabelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);
  const latestValueRef = useRef(value);
  const activePointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const lastPreviewPaintAtRef = useRef(0);
  const lastPaintedValueRef = useRef(value);

  // Phase 4.8J.3: the committed React value is the only render-time value.
  // Pointer interaction never changes React state; the native SVG/text preview below
  // owns the complete drag gesture until the single release commit.
  useEffect(() => {
    if (!draggingRef.current) latestValueRef.current = value;
    const fillPath = fillPathRef.current;
    if (fillPath && !draggingRef.current) {
      fillPath.style.strokeDashoffset = String(value - 100);
      fillPath.style.opacity = value > 0 ? '1' : '0';
    }
    if (valueLabelRef.current && !draggingRef.current) {
      valueLabelRef.current.textContent = String(Math.round(value));
    }
  }, [value]);

  // SVG parameters
  const center = size / 2;
  const radius = (size - 16) / 2; // Leave 8px padding on each side
  const strokeWidth = 4;
  
  // Arc parameters (7 o'clock to 5 o'clock = 225° to 495° = 270° sweep)
  const startAngle = 225; // 7 o'clock
  const sweepAngle = 270; // Total arc length
  const valueAngle = (value / 100) * sweepAngle; // Committed value angle

  // Convert polar to cartesian
  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  // Create SVG arc path
  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  // Phase 4.8I.1: knob preview is deliberately zero-RAF. The production visualizer
  // owns the frame clock; controls must never create a competing animation scheduler.
  // Pointer capture already limits this path to the active knob, and repeated values
  // are deduplicated before any DOM work. Macro 2 remains commit-only at runtime.
  const paintLocalPreview = (rounded: number, force = false) => {
    if (!force && rounded === lastPaintedValueRef.current) return;
    lastPaintedValueRef.current = rounded;

    const fillPath = fillPathRef.current;
    if (fillPath) {
      // Phase 4.8J.4: macro interaction is a paint-only UI preview. Keep the
      // immutable path and cap preview painting so pointer-event bursts cannot
      // starve the production visual frame clock.
      fillPath.style.strokeDashoffset = String(rounded - 100);
      fillPath.style.opacity = rounded > 0 ? '0.92' : '0';
    }
    if (valueLabelRef.current) valueLabelRef.current.textContent = String(rounded);
  };

  const applyLocalPreview = (rounded: number, nowMs: number) => {
    if (rounded === latestValueRef.current) return;
    latestValueRef.current = rounded;

    // 30 Hz is deliberate: the visualizer retains 60 Hz authority while the
    // knob still feels responsive. No React/runtime publication occurs here.
    if ((nowMs - lastPreviewPaintAtRef.current) >= 33) {
      lastPreviewPaintAtRef.current = nowMs;
      paintLocalPreview(rounded);
    }

    if (!deferRuntimeUpdates) onChange(rounded);
  };

  const finishDrag = (pointerId?: number) => {
    if (!draggingRef.current) return;
    if (pointerId !== undefined && activePointerIdRef.current !== pointerId) return;
    const committed = latestValueRef.current;
    paintLocalPreview(committed, true);
    draggingRef.current = false;
    svgContainerRef.current?.classList.remove('dragging');
    activePointerIdRef.current = null;
    onCommit(committed);
  };

  // Phase 4.8J.2: native pointer path. Avoid React's synthetic pointer-move
  // dispatch while dragging the macros; only the knob's two paint-only DOM fields
  // are touched until release. Runtime/React authority still commits once on release.
  useEffect(() => {
    const target = svgContainerRef.current;
    if (!target) return;

    const onPointerDownNative = (event: PointerEvent) => {
      if (disabled) return;
      event.preventDefault();
      activePointerIdRef.current = event.pointerId;
      draggingRef.current = true;
      target.setPointerCapture?.(event.pointerId);
      target.classList.add('dragging');
      startYRef.current = event.clientY;
      startValueRef.current = value;
      latestValueRef.current = value;
      lastPaintedValueRef.current = value;
      lastPreviewPaintAtRef.current = performance.now();
    };

    const onPointerMoveNative = (event: PointerEvent) => {
      if (!draggingRef.current || activePointerIdRef.current !== event.pointerId) return;
      const deltaY = startYRef.current - event.clientY;
      const newValue = Math.max(0, Math.min(100, startValueRef.current + deltaY * 0.5));
      applyLocalPreview(Math.round(newValue), event.timeStamp || performance.now());
    };

    const onPointerEndNative = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      try { target.releasePointerCapture?.(event.pointerId); } catch { /* capture may already be released */ }
      finishDrag(event.pointerId);
    };

    target.addEventListener('pointerdown', onPointerDownNative, { passive: false });
    target.addEventListener('pointermove', onPointerMoveNative, { passive: true });
    target.addEventListener('pointerup', onPointerEndNative, { passive: true });
    target.addEventListener('pointercancel', onPointerEndNative, { passive: true });

    return () => {
      target.removeEventListener('pointerdown', onPointerDownNative);
      target.removeEventListener('pointermove', onPointerMoveNative);
      target.removeEventListener('pointerup', onPointerEndNative);
      target.removeEventListener('pointercancel', onPointerEndNative);
      draggingRef.current = false;
      };
  }, [disabled, value, onChange, onCommit, deferRuntimeUpdates]);

  useEffect(() => () => {
  }, []);

  // Determine if knob is active (value > 0)
  const isActive = value > 0;

  return (
    <div className="macro-knob" ref={knobRef} data-macro-id={id}>
      <div className="macro-knob-label">{label}</div>
      <div
        className={`macro-knob-circle macro-knob-svg-container ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        ref={svgContainerRef}
        style={{ 
          width: size, 
          height: size,
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? 'not-allowed' : 'ns-resize',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none'
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            overflow: 'visible',
            filter: disabled ? 'grayscale(1)' : 'none',
          }}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius + 4}
            fill={`url(#knobGradient-${id})`}
            stroke="#2a2e38"
            strokeWidth="1.5"
          />
          
          {/* Gradient definitions (unique per knob) */}
          <defs>
            <linearGradient id={`knobGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1f2229" />
              <stop offset="100%" stopColor="#15171d" />
            </linearGradient>
            <linearGradient id={`gutterGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3a3e48" />
              <stop offset="100%" stopColor="#2a2e38" />
            </linearGradient>
          </defs>

          {/* Gray gutter arc (full 270° range) */}
          <path
            d={createArc(startAngle, startAngle + sweepAngle)}
            fill="none"
            stroke={`url(#gutterGradient-${id})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Blue fill arc (0° to current value) */}
          <path
            id={`${id}-fill`}
            ref={fillPathRef}
            d={createArc(startAngle, startAngle + sweepAngle)}
            pathLength={100}
            fill="none"
            stroke="#1E90FF"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="100 100"
            strokeDashoffset={value - 100}
            opacity={valueAngle > 0 ? 1 : 0}
          />
        </svg>

        {/* Value display */}
        <div id={`${id}-value`} ref={valueLabelRef} className="macro-knob-value">{Math.round(value)}</div>
      </div>
    </div>
  );
}