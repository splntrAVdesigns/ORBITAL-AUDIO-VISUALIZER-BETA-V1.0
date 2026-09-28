/**
 * ORBITAL — non-blocking WebGL program builds for Core Texture presets (Sprint M1).
 *
 * Why: measured first-activation stalls of ~1.8 s when the first WebGL texture preset
 * is selected. `getShaderParameter(COMPILE_STATUS)` / `getProgramParameter(LINK_STATUS)`
 * / `getUniformLocation` all force the driver to finish compiling on the main thread.
 * With KHR_parallel_shader_compile the driver compiles on worker threads and
 * `COMPLETION_STATUS_KHR` can be polled without blocking.
 *
 * Contract:
 * 1. startProgramBuild()  — createShader / shaderSource / compileShader / attach / link.
 *                           Reads no status, so it never blocks.
 * 2. isProgramBuildComplete() — cheap poll, called once per render() while pending.
 *                           Returns true immediately when the extension is missing
 *                           (legacy behaviour: the status reads in step 3 then block,
 *                           exactly as before this change).
 * 3. finishProgramBuild() — only after step 2 is true: reads LINK_STATUS, logs the
 *                           shader/program info logs on failure, deletes the shader
 *                           objects, returns the program (or null).
 * 4. abandonProgramBuild() — cleanup() while still pending.
 *
 * While pending, presets skip drawing, so the texture layer is transparent for the
 * few frames the compile takes instead of freezing the whole main thread.
 */

interface ParallelCompileExtension {
  readonly COMPLETION_STATUS_KHR: number;
}

export interface PendingProgramBuild {
  readonly program: WebGLProgram;
  readonly vertexShader: WebGLShader;
  readonly fragmentShader: WebGLShader;
}

export function startProgramBuild(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): PendingProgramBuild | null {
  // Must be requested before the first compile for drivers to enable the async path.
  gl.getExtension('KHR_parallel_shader_compile');

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (program) gl.deleteProgram(program);
    return null;
  }

  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  return { program, vertexShader, fragmentShader };
}

export function isProgramBuildComplete(gl: WebGLRenderingContext, build: PendingProgramBuild): boolean {
  if (gl.isContextLost()) return true; // let finish/abandon run and fail cleanly
  const ext = gl.getExtension('KHR_parallel_shader_compile') as ParallelCompileExtension | null;
  if (!ext) return true;
  return !!gl.getProgramParameter(build.program, ext.COMPLETION_STATUS_KHR);
}

export function finishProgramBuild(
  gl: WebGLRenderingContext,
  build: PendingProgramBuild,
  label: string,
): WebGLProgram | null {
  const linked = !gl.isContextLost() && !!gl.getProgramParameter(build.program, gl.LINK_STATUS);
  if (!linked && !gl.isContextLost()) {
    console.error(`[${label}] shader build failed`, {
      vertex: gl.getShaderInfoLog(build.vertexShader),
      fragment: gl.getShaderInfoLog(build.fragmentShader),
      program: gl.getProgramInfoLog(build.program),
    });
  }
  gl.deleteShader(build.vertexShader);
  gl.deleteShader(build.fragmentShader);
  if (!linked) {
    gl.deleteProgram(build.program);
    return null;
  }
  return build.program;
}

export function abandonProgramBuild(gl: WebGLRenderingContext, build: PendingProgramBuild): void {
  gl.deleteShader(build.vertexShader);
  gl.deleteShader(build.fragmentShader);
  gl.deleteProgram(build.program);
}
