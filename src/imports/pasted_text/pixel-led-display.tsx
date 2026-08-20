// Pixel LED Display — Originkit
// Using component defaults.

"use client";

import { useRef, useEffect, useMemo, type CSSProperties } from "react";

type Direction = "left" | "right";
type DotShape = "round" | "square";

interface GlowOptions {
  strength: number;
  size: number;
}

interface FlickerOptions {
  strength: number;
  speed: number;
}

interface LEDTickerProps {
  items?: string[];
  separator?: string;
  speed?: number;
  direction?: Direction;
  textSize?: number;
  dotSize?: number;
  dotQuantity?: number;
  spread?: number;
  dotShape?: DotShape;
  onColor?: string;
  offColor?: string;
  glow?: boolean;
  glowOptions?: GlowOptions;
  flicker?: boolean;
  flickerOptions?: FlickerOptions;
  style?: CSSProperties;
}

const ROWS = 7;
const GLYPH_COLS = 5;

const QUANTITY_MID = 10;
const QUANTITY_MIN_ROWS = 3;
const QUANTITY_MAX_ROWS = 21;

/** Rows of dots for a Dot Quantity of 1–20. Even either side of the midpoint. */
function rowsForQuantity(quantity: number): number {
  const q = Math.min(20, Math.max(1, Math.round(quantity)));
  const rows =
    q <= QUANTITY_MID
      ? QUANTITY_MIN_ROWS +
        ((q - 1) * (ROWS - QUANTITY_MIN_ROWS)) / (QUANTITY_MID - 1)
      : ROWS +
        ((q - QUANTITY_MID) * (QUANTITY_MAX_ROWS - ROWS)) / QUANTITY_MID;
  return Math.max(1, Math.round(rows));
}

const WORD_GAP_EXTRA = 3;
const SEPARATOR_PAD_EXTRA = 5;

const FONT: number[][] = [
  [0x00, 0x00, 0x00, 0x00, 0x00], // space
  [0x00, 0x00, 0x5f, 0x00, 0x00], // !
  [0x00, 0x07, 0x00, 0x07, 0x00], // "
  [0x14, 0x7f, 0x14, 0x7f, 0x14], // #
  [0x24, 0x2a, 0x7f, 0x2a, 0x12], // $
  [0x23, 0x13, 0x08, 0x64, 0x62], // %
  [0x36, 0x49, 0x55, 0x22, 0x50], // &
  [0x00, 0x05, 0x03, 0x00, 0x00], // '
  [0x00, 0x1c, 0x22, 0x41, 0x00], // (
  [0x00, 0x41, 0x22, 0x1c, 0x00], // )
  [0x14, 0x08, 0x3e, 0x08, 0x14], // *
  [0x08, 0x08, 0x3e, 0x08, 0x08], // +
  [0x00, 0x50, 0x30, 0x00, 0x00], // ,
  [0x08, 0x08, 0x08, 0x08, 0x08], // -
  [0x00, 0x60, 0x60, 0x00, 0x00], // .
  [0x20, 0x10, 0x08, 0x04, 0x02], // /
  [0x3e, 0x51, 0x49, 0x45, 0x3e], // 0
  [0x00, 0x42, 0x7f, 0x40, 0x00], // 1
  [0x42, 0x61, 0x51, 0x49, 0x46], // 2
  [0x21, 0x41, 0x45, 0x4b, 0x31], // 3
  [0x18, 0x14, 0x12, 0x7f, 0x10], // 4
  [0x27, 0x45, 0x45, 0x45, 0x39], // 5
  [0x3c, 0x4a, 0x49, 0x49, 0x30], // 6
  [0x01, 0x71, 0x09, 0x05, 0x03], // 7
  [0x36, 0x49, 0x49, 0x49, 0x36], // 8
  [0x06, 0x49, 0x49, 0x29, 0x1e], // 9
  [0x00, 0x36, 0x36, 0x00, 0x00], // :
  [0x00, 0x56, 0x36, 0x00, 0x00], // ;
  [0x00, 0x08, 0x14, 0x22, 0x41], // <
  [0x14, 0x14, 0x14, 0x14, 0x14], // =
  [0x41, 0x22, 0x14, 0x08, 0x00], // >
  [0x02, 0x01, 0x51, 0x09, 0x06], // ?
  [0x32, 0x49, 0x79, 0x41, 0x3e], // @
  [0x7e, 0x11, 0x11, 0x11, 0x7e], // A
  [0x7f, 0x49, 0x49, 0x49, 0x36], // B
  [0x3e, 0x41, 0x41, 0x41, 0x22], // C
  [0x7f, 0x41, 0x41, 0x22, 0x1c], // D
  [0x7f, 0x49, 0x49, 0x49, 0x41], // E
  [0x7f, 0x09, 0x09, 0x01, 0x01], // F
  [0x3e, 0x41, 0x41, 0x51, 0x32], // G
  [0x7f, 0x08, 0x08, 0x08, 0x7f], // H
  [0x00, 0x41, 0x7f, 0x41, 0x00], // I
  [0x20, 0x40, 0x41, 0x3f, 0x01], // J
  [0x7f, 0x08, 0x14, 0x22, 0x41], // K
  [0x7f, 0x40, 0x40, 0x40, 0x40], // L
  [0x7f, 0x02, 0x04, 0x02, 0x7f], // M
  [0x7f, 0x04, 0x08, 0x10, 0x7f], // N
  [0x3e, 0x41, 0x41, 0x41, 0x3e], // O
  [0x7f, 0x09, 0x09, 0x09, 0x06], // P
  [0x3e, 0x41, 0x51, 0x21, 0x5e], // Q
  [0x7f, 0x09, 0x19, 0x29, 0x46], // R
  [0x46, 0x49, 0x49, 0x49, 0x31], // S
  [0x01, 0x01, 0x7f, 0x01, 0x01], // T
  [0x3f, 0x40, 0x40, 0x40, 0x3f], // U
  [0x1f, 0x20, 0x40, 0x20, 0x1f], // V
  [0x7f, 0x20, 0x18, 0x20, 0x7f], // W
  [0x63, 0x14, 0x08, 0x14, 0x63], // X
  [0x03, 0x04, 0x78, 0x04, 0x03], // Y
  [0x61, 0x51, 0x49, 0x45, 0x43], // Z
  [0x00, 0x00, 0x7f, 0x41, 0x41], // [
  [0x02, 0x04, 0x08, 0x10, 0x20], // \
  [0x41, 0x41, 0x7f, 0x00, 0x00], // ]
  [0x04, 0x02, 0x01, 0x02, 0x04], // ^
  [0x40, 0x40, 0x40, 0x40, 0x40], // _
];

const EXTRA: Record<string, number[]> = {
  "●": [0x1c, 0x3e, 0x3e, 0x3e, 0x1c],
  "•": [0x00, 0x1c, 0x1c, 0x1c, 0x00],
  "·": [0x00, 0x00, 0x18, 0x00, 0x00],
  "°": [0x00, 0x03, 0x03, 0x00, 0x00],
  "★": [0x24, 0x2a, 0x7f, 0x2a, 0x24],
  "→": [0x08, 0x08, 0x2a, 0x1c, 0x08],
  "←": [0x08, 0x1c, 0x2a, 0x08, 0x08],
};
const FOLD: Record<string, string> = {
  "–": "-",
  "—": "-",
  "'": "'",
  "'": "'",
  "\u201c": '"',
  "\u201d": '"',
};

function glyphFor(char: string): number[] {
  const extra = EXTRA[char];
  if (extra) return extra;
  const folded = FOLD[char] ?? char;
  const code = folded.toUpperCase().charCodeAt(0);
  const glyph = FONT[code - 32];
  return glyph ?? FONT[0];
}

/**
 * Value noise in 0..1, biased low so the board sits bright and dips hard now and
 * then rather than pulsing evenly. Deterministic, so the static render matches.
 */
function flickerNoise(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = f * f * (3 - 2 * f);
  const value = hash(i) * (1 - smooth) + hash(i + 1) * smooth;
  return value * value;
}

/**
 * Flatten items and separators into one endless strip of dot columns (bit-packed
 * rows). Word gaps and the pad around a separator are counted in dot columns
 * rather than spelled with blank glyphs, so they stay tight as spread grows.
 * At spread 1 a word gap is 4 columns and a separator sits in 6 on each side.
 */
function buildColumns(
  items: string[],
  separator: string,
  spread: number
): number[] {
  const parts = (items ?? []).map((item) => item.trim()).filter(Boolean);
  const joiner = (separator ?? "").trim();
  const columns: number[] = [];
  const blanks = (count: number) => {
    for (let i = 0; i < count; i++) columns.push(0);
  };

  const writeText = (text: string) => {
    const chars = [...text];
    chars.forEach((char, index) => {
      if (char === " ") {
        blanks(spread + WORD_GAP_EXTRA);
        return;
      }
      const glyph = glyphFor(char);
      for (let i = 0; i < GLYPH_COLS; i++) columns.push(glyph[i]);
      const next = chars[index + 1];
      if (next !== undefined && next !== " ") blanks(spread);
    });
  };

  if (parts.length === 0) {
    blanks(GLYPH_COLS + spread);
    return columns;
  }

  for (const part of parts) {
    writeText(part);
    blanks(spread + SEPARATOR_PAD_EXTRA);
    if (joiner) {
      writeText(joiner);
      blanks(spread + SEPARATOR_PAD_EXTRA);
    }
  }
  return columns;
}

export default function LEDTicker({
  items = ["LED", "DISPLAY"],
  separator = "●",
  speed = 20,
  direction = "left",
  textSize = 120,
  dotSize = 18,
  dotQuantity = 10,
  spread = 1,
  dotShape = "round",
  onColor = "#FFFFFF",
  offColor = "rgba(255, 0, 0, 0)",
  glow = false,
  glowOptions = { strength: 60, size: 10 },
  flicker = false,
  flickerOptions = { strength: 40, speed: 50 },
  style,
}: LEDTickerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const glowStrength = glow ? (glowOptions?.strength ?? 0) / 100 : 0;
  const glowSize = glow ? (glowOptions?.size ?? 0) / 10 : 0;
  const flickerStrength = flicker ? (flickerOptions?.strength ?? 0) / 100 : 0;
  const flickerSpeed = flicker ? (flickerOptions?.speed ?? 0) / 10 : 0;

  const itemsKey = JSON.stringify(items ?? []);
  const columns = useMemo(
    () => buildColumns(JSON.parse(itemsKey), separator, spread),
    [itemsKey, separator, spread]
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context;

    const total = columns.length;
    let alive = true;
    let raf = 0;
    let last = 0;
    let offset = 0;

    let dpr = 1;
    let cell = 1;
    let radius = 1;
    let visibleCols = 0;
    let boardRows = ROWS;
    let yPad = 0;
    let scale = 1;
    let rowSource: number[] = [];

    function measure() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 600;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      boardRows = rowsForQuantity(dotQuantity);
      scale = boardRows / ROWS;
      cell = Math.max(1, (textSize / boardRows) * dpr);
      radius = (dotSize * dpr) / 2;
      visibleCols = Math.ceil(canvas.width / cell) + 1;
      yPad = (canvas.height - boardRows * cell) / 2;
      rowSource = [];
      for (let row = 0; row < boardRows; row++) {
        rowSource.push(Math.min(ROWS - 1, Math.floor(row / scale)));
      }
    }

    function dotPath(x: number, y: number) {
      if (dotShape === "square") {
        const s = radius * 2;
        ctx.rect(x - radius, y - radius, s, s);
      } else {
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
    }

    function draw(time: number) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const boardOffset = offset * scale;
      const whole = Math.floor(boardOffset);
      const shift = (boardOffset - whole) * cell;
      const sign = direction === "right" ? -1 : 1;
      const xBase = -sign * shift;

      ctx.beginPath();
      for (let cx = 0; cx < visibleCols; cx++) {
        const px = xBase + cx * cell + cell / 2;
        for (let row = 0; row < boardRows; row++) {
          dotPath(px, yPad + row * cell + cell / 2);
        }
      }
      ctx.fillStyle = offColor;
      ctx.fill();

      ctx.beginPath();
      for (let cx = 0; cx < visibleCols; cx++) {
        const source = Math.floor((cx + sign * whole) / scale);
        const index = ((source % total) + total) % total;
        const bits = columns[index];
        if (!bits) continue;
        const px = xBase + cx * cell + cell / 2;
        for (let row = 0; row < boardRows; row++) {
          if (!((bits >> rowSource[row]) & 1)) continue;
          dotPath(px, yPad + row * cell + cell / 2);
        }
      }

      const wobble =
        flickerStrength > 0
          ? 1 - flickerStrength * flickerNoise((time / 1000) * flickerSpeed)
          : 1;
      ctx.globalAlpha = wobble;
      ctx.fillStyle = onColor;

      if (glowStrength > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = onColor;
        ctx.shadowBlur = radius * 2 * glowSize;
        ctx.globalAlpha = wobble * glowStrength;
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = wobble;
        ctx.fillStyle = onColor;
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function frame(time: number) {
      if (!alive) return;
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      offset = (offset + speed * dt) % total;
      draw(time);
      raf = requestAnimationFrame(frame);
    }

    measure();
    draw(0);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        measure();
        draw(last);
      });
      ro.observe(canvas);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [
    columns,
    speed,
    direction,
    textSize,
    dotSize,
    dotQuantity,
    dotShape,
    onColor,
    offColor,
    glowStrength,
    glowSize,
    flickerStrength,
    flickerSpeed,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        ...style,
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
}