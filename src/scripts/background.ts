/**
 * WebGL2 bootstrap for the background shader.
 *
 * This is the only client JavaScript on the site. It is deliberately
 * self-contained and fails soft: if the context, compile, or link step does
 * not work out, the canvas is removed and the flat --bg colour on <body>
 * plus the scrim is what visitors see. Nothing else on the page depends on
 * it having run.
 */

import fragmentSource from "../shaders/background.frag";
import vertexSource from "../shaders/fullscreen.vert";

const MAX_DPR = 2;

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    console.error(`[background] ${kind} shader:\n${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function link(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // Flagged for deletion now; the driver frees them when the program dies.
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`[background] link:\n${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function start(canvas: HTMLCanvasElement): void {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) {
    canvas.remove();
    return;
  }

  const vert = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vert || !frag) {
    canvas.remove();
    return;
  }

  const program = link(gl, vert, frag);
  if (!program) {
    canvas.remove();
    return;
  }

  gl.useProgram(program);

  // WebGL2 requires a bound VAO even when the draw uses no attributes.
  gl.bindVertexArray(gl.createVertexArray());

  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");

  let width = 0;
  let height = 0;

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (w === width && h === height) return;

    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uResolution, w, h);
  }

  function draw(seconds: number): void {
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");

  let frameId = 0;
  // Wall-clock elapsed minus time spent hidden, so a backgrounded tab does
  // not fast-forward the animation when it comes back.
  let elapsed = 0;
  let last = 0;

  function loop(now: number): void {
    frameId = requestAnimationFrame(loop);
    elapsed += (now - last) / 1000;
    last = now;
    draw(elapsed);
  }

  function play(): void {
    if (frameId || stillness.matches || document.hidden) return;
    last = performance.now();
    frameId = requestAnimationFrame(loop);
  }

  function pause(): void {
    if (!frameId) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function sync(): void {
    if (stillness.matches) {
      // Reduced motion: one static frame, no loop at all.
      pause();
      resize();
      draw(0);
      return;
    }
    document.hidden ? pause() : play();
  }

  document.addEventListener("visibilitychange", sync);
  stillness.addEventListener("change", sync);
  sync();
}

const canvas = document.querySelector<HTMLCanvasElement>("canvas.bg-canvas");
if (canvas) start(canvas);
