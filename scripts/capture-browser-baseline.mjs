import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const port = Number(args.get('port') ?? 4174);
const debugPort = Number(args.get('debug-port') ?? (9400 + (process.pid % 400)));
const idleDurationMs = Number(args.get('duration') ?? 8000);
const scrollDurationMs = Number(args.get('scroll-duration') ?? 4000);
const stressDurationMs = Number(args.get('stress-duration') ?? 8000);
const haloCometEnabled = args.get('halo-comet') !== 'off';
const outputJson = path.resolve(root, args.get('out') ?? 'artifacts/main-thread-baseline.json');
const outputMarkdown = outputJson.replace(/\.json$/i, '.md');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-baseline-'));
const tempProfile = path.join(tempRoot, 'profile');
const runnerPath = path.join(tempRoot, 'orbital-baseline.html');
fs.mkdirSync(tempProfile, { recursive: true });
const url = `${pathToFileURL(runnerPath).href}?orbitalFieldCert=1`;
const children = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
};
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value, digits = 2) => Number(Number(value ?? 0).toFixed(digits));

function findChromium() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function waitForHttp(target, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch {}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${target}`);
}

async function waitForDebugger(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page' && target.url?.startsWith(url));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error('Timed out waiting for Chromium DevTools endpoint');
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.exception?.value
      ?? result.exceptionDetails.text
      ?? 'Runtime evaluation failed';
    throw new Error(String(detail));
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

function metricsToObject(result) {
  return Object.fromEntries((result.metrics ?? []).map((metric) => [metric.name, metric.value]));
}

function buildMarkdown(report) {
  const idle = report.idle;
  const stress = report.stress;
  const scroll = report.scroll;
  const resources = report.resources;
  return `# ORBITAL Phase 4.5 — Hardware Field Certificate\n\n` +
    `Captured: ${report.capturedAt}\n\n` +
    `Environment: ${report.environment.browserProduct}; ${report.environment.userAgent}\n\n` +
    `> This run uses a deterministic stereo WAV and requires a hardware WebGL2 renderer. Capture Figma and Vercel separately.\n\n` +
    `## Idle visualizer (${report.configuration.idleDurationMs} ms)\n\n` +
    `| Metric | Result |\n|---|---:|\n` +
    `| Frame interval average | ${idle.frameIntervalAverage} ms |\n` +
    `| Frame interval p95 | ${idle.frameIntervalP95} ms |\n` +
    `| Frame interval maximum | ${idle.frameIntervalMax} ms |\n` +
    `| Render cost p95 | ${idle.renderCostP95} ms |\n` +
    `| Dropped-frame counter delta | ${idle.droppedFramesDelta} |\n` +
    `| Long-frame counter delta | ${idle.longFramesDelta} |\n` +
    `| Main-thread task duration | ${idle.taskDurationDelta} s |\n` +
    `| Script duration | ${idle.scriptDurationDelta} s |\n` +
    `| Layout + style duration | ${idle.layoutStyleDurationDelta} s |\n\n` +
    `## Core Particles stress (${report.configuration.stressDurationMs} ms)\n\n` +
    `| Metric | Result |\n|---|---:|\n` +
    `| Frame interval p95 | ${stress.frameIntervalP95} ms |\n` +
    `| Frame interval p99 | ${stress.frameIntervalP99} ms |\n` +
    `| Maximum interruption | ${stress.frameIntervalMax} ms |\n` +
    `| Halo render p95 | ${stress.haloRenderP95} ms |\n` +
    `| Comet render p95 | ${stress.cometRenderP95} ms |\n` +
    `| Orbital render p95 | ${stress.orbitalRenderP95} ms |\n` +
    `| Shockwave render p95 | ${stress.shockwaveRenderP95} ms |\n` +
    `| Audio waiting events | ${stress.audioWaiting} |\n` +
    `| Audio stalled events | ${stress.audioStalled} |\n` +
    `| GPU timer supported | ${stress.coreParticlesGpu?.gpuTimerSupported ? 'yes' : 'no'} |\n` +
    `| GPU average | ${stress.coreParticlesGpu?.averageGpuMs ?? 'n/a'} ms |\n\n` +
    `## Programmatic panel scroll (${report.configuration.scrollDurationMs} ms)\n\n` +
    `| Metric | Result |\n|---|---:|\n` +
    `| Scroll events observed | ${scroll.scrollEvents} |\n` +
    `| RAF frames during scroll | ${scroll.rafFramesDuringScroll} |\n` +
    `| Longest frame gap | ${scroll.longestFrameGap} ms |\n` +
    `| Maximum scroll-handler duration | ${scroll.maxScrollHandlerDuration} ms |\n` +
    `| Input-to-frame delay | ${scroll.inputToFrameDelay} ms |\n` +
    `| Scroll stalls detected | ${scroll.scrollStalls} |\n` +
    `| Suspected presentation delay | ${scroll.suspectedPresentationDelay ? 'yes' : 'no'} |\n\n` +
    `## Runtime ownership snapshot\n\n` +
    `| Resource | Active |\n|---|---:|\n` +
    Object.entries(resources).map(([key, value]) => `| ${key} | ${value} |`).join('\n') + '\n\n' +
    `## Field assessment\n\n` +
    `**${report.assessment.decision}** — ${report.assessment.summary}\n\n` +
    report.assessment.notes.map((note) => `- ${note}`).join('\n') + '\n';
}

let cdp;
try {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
    throw new Error('dist/index.html is missing. Run npm run build before baseline:main-thread.');
  }

  const distIndexPath = path.join(root, 'dist/index.html');
  const distIndex = fs.readFileSync(distIndexPath, 'utf8');
  const scriptMatch = distIndex.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i);
  const styleMatch = distIndex.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!scriptMatch || !styleMatch) throw new Error('Could not locate production JS/CSS in dist/index.html');
  const resolveDistAsset = (assetUrl) => path.join(root, 'dist', assetUrl.replace(/^\//, ''));
  const scriptCode = fs.readFileSync(resolveDistAsset(scriptMatch[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
  const styleCode = fs.readFileSync(resolveDistAsset(styleMatch[1]), 'utf8');
  const runnerHtml = distIndex
    .replace(/<script[^>]+src=["']\/vendor\/gif\.js["'][^>]*><\/script>/i, '')
    .replace(scriptMatch[0], '')
    .replace(styleMatch[0], '')
    .replace('</head>', `<style>${styleCode}</style></head>`)
    .replace('</body>', `<script type="module">${scriptCode}</script></body>`);
  fs.writeFileSync(runnerPath, runnerHtml);

  const chromium = findChromium();
  if (!chromium) throw new Error('Chromium/Chrome was not found. Set CHROME_BIN to run the baseline.');
  let chromeStderr = '';
  const chrome = spawn(chromium, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-proxy-server',
    '--proxy-bypass-list=*',
    '--enable-gpu',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--allow-file-access-from-files',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required',
    url,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  children.push(chrome);
  chrome.stderr?.on('data', (chunk) => {
    chromeStderr = (chromeStderr + String(chunk)).slice(-8000);
  });

  const target = await waitForDebugger();
  cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Performance.enable');
  const version = await cdp.send('Browser.getVersion');
  let initialLocation = await evaluate(cdp, 'location.href');
  console.log(`Baseline target: ${target.url}; runtime location: ${initialLocation}`);
  for (let attempt = 0; attempt < 3 && !initialLocation.startsWith(url); attempt += 1) {
    await cdp.send('Page.navigate', { url });
    await sleep(1000);
    initialLocation = await evaluate(cdp, 'location.href');
  }
  if (!initialLocation.startsWith(url)) {
    throw new Error(`Chromium could not load ${url}. Runtime location: ${initialLocation}. ${chromeStderr.slice(-1200)}`);
  }

  await waitFor(cdp, `location.href.startsWith(${JSON.stringify(url)})`, 20000);
  await waitFor(cdp, 'document.readyState === "complete"');
  await evaluate(cdp, `try { localStorage.setItem('orbital-intro-completed','true'); localStorage.setItem('orbital-keyboard-helper-visible','false'); localStorage.removeItem('orbital.fieldCertification'); } catch {} true`);
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitFor(cdp, 'document.readyState === "complete"');
  await waitFor(cdp, `[...document.querySelectorAll('button')].some((button) => button.textContent?.trim().toLowerCase() === 'launch')`);
  await evaluate(cdp, `[...document.querySelectorAll('button')].find((button) => button.textContent?.trim().toLowerCase() === 'launch')?.click(); true`);
  await waitFor(cdp, `document.querySelector('#app-frame') && document.querySelector('.panel-scrollable')`, 30000);
  await evaluate(cdp, `window.__ORBITAL_RENDER_COST_DEBUG__ = true; true`);
  await waitFor(cdp, `window.__ORBITAL_FRAME_PACING__ && window.__ORBITAL_RENDER_COSTS__`, 20000);
  await sleep(2000);

  const performanceBefore = metricsToObject(await cdp.send('Performance.getMetrics'));
  const countersBefore = await evaluate(cdp, `({
    droppedFrames: window.__ORBITAL_FRAME_PACING__?.droppedFrames ?? 0,
    longFrames: window.__ORBITAL_FRAME_PACING__?.longFrames ?? 0
  })`);
  const idleSamples = [];
  const idleStarted = Date.now();
  while (Date.now() - idleStarted < idleDurationMs) {
    const sample = await evaluate(cdp, `({
      pacing: window.__ORBITAL_FRAME_PACING__ ?? null,
      costs: window.__ORBITAL_RENDER_COSTS__ ?? null
    })`);
    if (sample?.pacing) idleSamples.push(sample);
    await sleep(200);
  }
  const performanceAfterIdle = metricsToObject(await cdp.send('Performance.getMetrics'));
  const countersAfter = await evaluate(cdp, `({
    droppedFrames: window.__ORBITAL_FRAME_PACING__?.droppedFrames ?? 0,
    longFrames: window.__ORBITAL_FRAME_PACING__?.longFrames ?? 0
  })`);

  const gpuInfo = await evaluate(cdp, `(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { webgl2: false };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      webgl2: true,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  })()`);

  await waitFor(cdp, `typeof window.loadFile === 'function'`, 20000);
  const stressPrepared = await evaluate(cdp, `(async () => {
    const rate = 44100, seconds = 24, channels = 2, frames = rate * seconds;
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + frames * channels * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    for (let i = 0; i < frames; i++) {
      const t = i / rate;
      const beatPhase = t % 0.5;
      const kick = Math.sin(2 * Math.PI * (58 - beatPhase * 30) * t) * Math.exp(-beatPhase * 18);
      const tone = Math.sin(2 * Math.PI * 220 * t) * 0.18 + Math.sin(2 * Math.PI * 880 * t) * 0.08;
      const transient = beatPhase < 0.018 ? (1 - beatPhase / 0.018) * 0.42 : 0;
      const left = Math.max(-1, Math.min(1, kick * 0.72 + tone + transient));
      const right = Math.max(-1, Math.min(1, kick * 0.68 + tone * 0.82 - transient * 0.35));
      view.setInt16(44 + i * 4, left * 32767, true);
      view.setInt16(46 + i * 4, right * 32767, true);
    }
    const file = new File([bytes], 'orbital-phase4-5-field.wav', { type: 'audio/wav' });
    const params = window.params;
    if (params) {
      params.shapeOscillate = true;
      params.astralShaper = false;
      params.shapeBurstStrength = 1;
      params.shapeDensity = 1;
      params.shapeDecay = 0.75;
      params.shapeEdgeTrails = 0.65;
      params.rotation = 0.32;
      params.spikes = 512;
      params.halo = 0.85;
      params.bloom = 0.55;
      params.haloCometEnabled = ${haloCometEnabled};
      params.haloCometTailLength = 0.5;
      params.haloCometThickness = 3;
      params.orbitalEnergy = 1;
      params.orbitalWidth = 0.35;
      params.shockwave = true;
      params.shockwaveThreshold = 0.58;
      params.shockwaveRings = 3;
    }
    await window.loadFile(file);
    await window.mediaEl?.play();
    return Boolean(window.mediaEl);
  })()`, true);
  if (!stressPrepared) throw new Error('Deterministic audio stress fixture could not be loaded.');
  await waitFor(cdp, `window.__ORBITAL_CORE_PARTICLES_GPU__?.backend === 'webgl2-transform-feedback'`, 20000);

  const stressSamples = [];
  const stressStarted = Date.now();
  while (Date.now() - stressStarted < stressDurationMs) {
    const sample = await evaluate(cdp, `({
      pacing: window.__ORBITAL_FRAME_PACING__ ?? null,
      gpu: window.__ORBITAL_CORE_PARTICLES_GPU__ ?? null,
      costs: window.__ORBITAL_RENDER_COSTS__ ?? null
    })`);
    if (sample?.pacing) stressSamples.push(sample);
    await sleep(200);
  }

  await evaluate(cdp, `(async () => {
    const scroller = document.querySelector('.panel-scrollable');
    if (!scroller) return false;
    const started = performance.now();
    let direction = 1;
    while (performance.now() - started < ${scrollDurationMs}) {
      const limit = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop += direction * 48;
      if (scroller.scrollTop >= limit - 2) direction = -1;
      if (scroller.scrollTop <= 2) direction = 1;
      await new Promise((resolve) => setTimeout(resolve, 32));
    }
    return true;
  })()`, true);
  await sleep(250);

  const interaction = await evaluate(cdp, `window.__ORBITAL_INTERACTION_METRICS__ ?? {}`);
  const audioStress = await evaluate(cdp, `window.__ORBITAL_AUDIO_VISUAL_STRESS__ ?? {}`);
  const coreParticlesGpu = await evaluate(cdp, `window.__ORBITAL_CORE_PARTICLES_GPU__ ?? {}`);
  const resources = await evaluate(cdp, `window.__ORBITAL_RUNTIME_RESOURCES__ ?? {}`);
  const finalPacing = await evaluate(cdp, `window.__ORBITAL_FRAME_PACING__ ?? {}`);
  const performanceAfterScroll = metricsToObject(await cdp.send('Performance.getMetrics'));

  const frameIntervals = idleSamples.map((sample) => sample.pacing.frameInterval).filter(Number.isFinite);
  const renderCosts = idleSamples.map((sample) => sample.costs?.frame).filter(Number.isFinite);
  const stressFrameIntervals = stressSamples.map((sample) => sample.pacing.frameInterval).filter(Number.isFinite);
  const haloRenderCosts = stressSamples.map((sample) => sample.costs?.halo).filter(Number.isFinite);
  const cometRenderCosts = stressSamples.map((sample) => sample.costs?.comet).filter(Number.isFinite);
  const orbitalRenderCosts = stressSamples.map((sample) => sample.costs?.orbital).filter(Number.isFinite);
  const shockwaveRenderCosts = stressSamples.map((sample) => sample.costs?.shockwave).filter(Number.isFinite);
  const layoutStyleDurationDelta =
    (performanceAfterIdle.LayoutDuration ?? 0) - (performanceBefore.LayoutDuration ?? 0) +
    (performanceAfterIdle.RecalcStyleDuration ?? 0) - (performanceBefore.RecalcStyleDuration ?? 0);

  const structuralReady =
    resources.activeRuntimeSessions === 1 &&
    resources.activeRafSchedulers === 1 &&
    (resources.activeAudioContexts ?? 0) <= 1;
  const stressP95 = percentile(stressFrameIntervals, 0.95);
  const stressP99 = percentile(stressFrameIntervals, 0.99);
  const stressMax = Math.max(0, ...stressFrameIntervals);
  const hardwareGpu = Boolean(gpuInfo?.webgl2) && !/swiftshader|llvmpipe|software/i.test(String(gpuInfo?.renderer ?? ''));
  const performanceReady = stressP95 <= 25 && stressP99 <= 34 && stressMax <= 100 &&
    Number(interaction.longestFrameGap ?? 0) <= 50;
  const audioReady = Number(audioStress.waiting ?? 0) === 0 && Number(audioStress.stalled ?? 0) === 0;
  const fieldReady = structuralReady && hardwareGpu && performanceReady && audioReady;
  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    configuration: { idleDurationMs, stressDurationMs, scrollDurationMs, haloCometEnabled, viewport: '1440x900', audio: 'deterministic-stereo-wav', microphone: 'none' },
    environment: {
      browserProduct: version.product,
      userAgent: version.userAgent,
      jsVersion: version.jsVersion,
      platform: process.platform,
      arch: process.arch,
      gpu: gpuInfo,
    },
    idle: {
      samples: idleSamples.length,
      frameIntervalAverage: round(average(frameIntervals)),
      frameIntervalP50: round(percentile(frameIntervals, 0.5)),
      frameIntervalP95: round(percentile(frameIntervals, 0.95)),
      frameIntervalMax: round(Math.max(0, ...frameIntervals)),
      renderCostP95: round(percentile(renderCosts, 0.95)),
      droppedFramesDelta: Math.max(0, countersAfter.droppedFrames - countersBefore.droppedFrames),
      longFramesDelta: Math.max(0, countersAfter.longFrames - countersBefore.longFrames),
      taskDurationDelta: round((performanceAfterIdle.TaskDuration ?? 0) - (performanceBefore.TaskDuration ?? 0), 4),
      scriptDurationDelta: round((performanceAfterIdle.ScriptDuration ?? 0) - (performanceBefore.ScriptDuration ?? 0), 4),
      layoutStyleDurationDelta: round(layoutStyleDurationDelta, 4),
      finalPacing,
    },
    scroll: {
      scrollEvents: interaction.scrollEvents ?? 0,
      rafFramesDuringScroll: interaction.rafFramesDuringScroll ?? 0,
      longestFrameGap: round(interaction.longestFrameGap ?? 0),
      maxScrollHandlerDuration: round(interaction.maxScrollHandlerDuration ?? 0, 3),
      inputToFrameDelay: round(interaction.inputToFrameDelay ?? 0),
      scrollStalls: interaction.scrollStalls ?? 0,
      suspectedPresentationDelay: Boolean(interaction.suspectedPresentationDelay),
      taskDurationDelta: round((performanceAfterScroll.TaskDuration ?? 0) - (performanceAfterIdle.TaskDuration ?? 0), 4),
      layoutStyleDurationDelta: round(
        ((performanceAfterScroll.LayoutDuration ?? 0) - (performanceAfterIdle.LayoutDuration ?? 0)) +
        ((performanceAfterScroll.RecalcStyleDuration ?? 0) - (performanceAfterIdle.RecalcStyleDuration ?? 0)),
        4,
      ),
    },
    stress: {
      samples: stressFrameIntervals.length,
      frameIntervalP95: round(stressP95),
      frameIntervalP99: round(stressP99),
      frameIntervalMax: round(stressMax),
      haloRenderP95: round(percentile(haloRenderCosts, 0.95), 3),
      cometRenderP95: round(percentile(cometRenderCosts, 0.95), 3),
      orbitalRenderP95: round(percentile(orbitalRenderCosts, 0.95), 3),
      shockwaveRenderP95: round(percentile(shockwaveRenderCosts, 0.95), 3),
      audioWaiting: audioStress.waiting ?? 0,
      audioStalled: audioStress.stalled ?? 0,
      audioSuspend: audioStress.suspend ?? 0,
      coreParticlesGpu,
    },
    resources,
    assessment: {
      decision: fieldReady ? 'PHASE 4.5 FIELD PASS' : 'PHASE 4.5 FIELD NO-GO',
      summary: fieldReady
        ? 'Hardware WebGL2, frame pacing, interaction, audio continuity and runtime ownership passed the recovery thresholds.'
        : 'One or more hardware GPU, frame-pacing, interaction, audio-continuity or runtime-ownership thresholds failed.',
      notes: [
        'Retain this JSON as the Phase 4.5 pre-worker field certificate.',
        'Figma and Vercel must be captured separately on a hardware-accelerated browser.',
        'A SwiftShader/llvmpipe/software renderer is an automatic field no-go.',
      ],
    },
  };

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(outputMarkdown, buildMarkdown(report));
  console.log(`Main-thread baseline written to ${path.relative(root, outputJson)}`);
  console.log(`Assessment: ${report.assessment.decision}`);
} finally {
  cdp?.close();
  for (const child of children.reverse()) {
    if (!child.killed) child.kill('SIGTERM');
  }
  await sleep(350);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  } catch {
    // Chromium can briefly retain profile files after SIGTERM. The OS temp
    // directory will clean the residue; baseline results must not be masked.
  }
}
