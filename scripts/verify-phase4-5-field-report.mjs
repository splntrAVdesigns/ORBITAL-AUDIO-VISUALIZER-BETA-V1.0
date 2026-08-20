import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(process.cwd(), process.argv[2] ?? 'artifacts/phase4-5-field.json');
if (!fs.existsSync(reportPath)) {
  console.error(`Phase 4.5 field report is missing: ${reportPath}`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const errors = [];
const renderer = String(report.environment?.gpu?.renderer ?? '');
if (!report.environment?.gpu?.webgl2) errors.push('WebGL2 was unavailable');
if (/swiftshader|llvmpipe|software/i.test(renderer)) errors.push(`software GPU renderer is not certifiable: ${renderer}`);
if ((report.stress?.frameIntervalP95 ?? Infinity) > 25) errors.push('stress p95 exceeded 25 ms');
if ((report.stress?.frameIntervalP99 ?? Infinity) > 34) errors.push('stress p99 exceeded 34 ms');
if ((report.stress?.frameIntervalMax ?? Infinity) > 100) errors.push('stress interruption exceeded 100 ms');
if ((report.scroll?.longestFrameGap ?? Infinity) > 50) errors.push('interaction stall exceeded 50 ms');
if ((report.stress?.audioWaiting ?? 0) !== 0) errors.push('audio waiting events were observed');
if ((report.stress?.audioStalled ?? 0) !== 0) errors.push('audio stalled events were observed');
if ((report.resources?.activeRuntimeSessions ?? 0) !== 1) errors.push('runtime session ownership is not singular');
if ((report.resources?.activeRafSchedulers ?? 0) !== 1) errors.push('RAF scheduler ownership is not singular');
if (report.assessment?.decision !== 'PHASE 4.5 FIELD PASS') errors.push('capture assessment is not a field pass');

if (errors.length) {
  console.error(`Phase 4.5 field verification failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Phase 4.5 field verification passed: ${path.relative(process.cwd(), reportPath)}`);
