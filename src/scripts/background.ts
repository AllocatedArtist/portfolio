/**
 * WebGL2 bootstrap for the background shader.
 *
 * This is the only client JavaScript on the site. It is deliberately
 * self-contained and fails soft: if the context, extension, compile, or link
 * step does not work out, the canvas is removed and the flat --bg colour on
 * <body> plus the scrim is what visitors see. Nothing else on the page
 * depends on it having run.
 *
 * Two passes per frame, because the background is a path tracer:
 *
 *   trace    background.frag  -> float texture   one pass of samples, folded
 *                                                into a running mean of every
 *                                                pass before it
 *   display  display.frag     -> canvas          exposure, tone map, sRGB
 *
 * The trace pass reads the previous mean and writes the new one, so it can
 * neither read nor write the same texture in one draw. Hence two textures
 * swapped each frame. See accumulate.glsl for the shader half of this.
 */

import fragmentSource from "../shaders/background.frag";
import displaySource from "../shaders/display.frag";
import vertexSource from "../shaders/fullscreen.vert";

const MAX_DPR = 2;

/**
 * Ceiling on drawing-buffer pixels. A path tracer is fragment-bound, so cost
 * scales with this number directly, and it is the first dial to turn if
 * frames get long enough to make scrolling feel sticky. A modern phone
 * reports dpr 3, which at 390x844 CSS pixels would mean ~3.0M fragments
 * every frame and a hot battery for a decorative background. Capping at 1.4M
 * keeps a desktop 1440p canvas untouched while pulling phones back to
 * roughly dpr 1.8.
 */
const MAX_PIXELS = 1_400_000;

/**
 * Passes to gather before the trace pass stops for good.
 *
 * The image is static, so there is nothing to gain from tracing forever and
 * a laptop fan to lose. Once this many passes are in, only the display blit
 * keeps running — a single texture fetch per pixel, cheap enough to leave on
 * an animation frame. It has to keep running rather than stopping outright
 * because a WebGL drawing buffer is cleared after it is composited unless
 * preserveDrawingBuffer is set, and setting that costs more than the blit.
 */
const MAX_PASSES = 4096;

/**
 * Splice the offending source line into a driver log.
 *
 *   ERROR: 0:23: 'p' : undeclared identifier
 *     23 |   vec3 col = shade(p);
 *
 * Drivers report a line number but not the line, which stops being useful
 * the moment the shader outgrows one screen. The number refers to the string
 * handed to shaderSource, and that is the same string annotated here, so it
 * stays correct after vite-plugin-glsl has expanded any #include.
 */
function annotate(log: string, source: string): string {
  const lines = source.split("\n");

  return log
    .trim()
    .split("\n")
    .map((entry) => {
      const at = /^\w+:\s*\d+:(\d+):/.exec(entry);
      if (!at) return entry;

      const n = Number(at[1]);
      const line = lines[n - 1];
      return line === undefined ? entry : `${entry}\n  ${n} | ${line}`;
    })
    .join("\n");
}

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
    const log = gl.getShaderInfoLog(shader) ?? "";
    console.error(`[background] ${kind} shader:\n${annotate(log, source)}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Both programs share fullscreen.vert, so the vertex shader is compiled once
 * and attached twice. Deleting it here would be premature; the caller drops
 * it after the last link.
 */
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

  // Flagged for deletion now; the driver frees it when the program dies.
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`[background] link:\n${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/** One half of the ping-pong: a float texture and the FBO that renders to it. */
interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

function createTarget(gl: WebGL2RenderingContext): Target | null {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) return null;

  gl.bindTexture(gl.TEXTURE_2D, tex);

  // NEAREST because the display pass uses texelFetch at 1:1 and never
  // samples between texels. Convenient, since filtering a float texture
  // needs OES_texture_float_linear on top of the render-target extension.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );

  return { tex, fbo };
}

function start(canvas: HTMLCanvasElement): void {
  /**
   * Touch-primary devices get the flat --bg and nothing else.
   *
   * Nine-bounce path tracing over a million-odd fragments is a mobile GPU
   * running flat out for minutes to resolve an image sitting behind body
   * text and a 0.8 scrim. The battery cost is real and the payoff is not.
   * index.astro shows a note pointing at the desktop site instead.
   *
   * `pointer: coarse` reports the *primary* input, so a laptop with a
   * touchscreen still reads as fine and still renders. It also does not
   * change with orientation, which a width query would.
   *
   * Checked before getContext so nothing is allocated at all — no context,
   * no shaders, no float buffers, no animation frame.
   */
  if (window.matchMedia("(pointer: coarse)").matches) {
    canvas.remove();
    return;
  }

  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    depth: false,
  });
  if (!gl) {
    canvas.remove();
    return;
  }

  /**
   * Rendering to a float texture is an extension even in WebGL2. It is the
   * one hard requirement here: accumulating into an 8-bit target quantises
   * every pass to 1/255 and the mean stops moving after a few dozen samples,
   * so the image never converges. Half-float is renderable through the same
   * extension but has only 10 bits of mantissa, which stalls the running
   * mean around a thousand passes. Take RGBA32F or take the flat colour.
   */
  if (!gl.getExtension("EXT_color_buffer_float")) {
    console.warn("[background] no EXT_color_buffer_float; skipping shader");
    canvas.remove();
    return;
  }

  const vert = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const traceFrag = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const displayFrag = compile(gl, gl.FRAGMENT_SHADER, displaySource);
  if (!vert || !traceFrag || !displayFrag) {
    canvas.remove();
    return;
  }

  const traceProgram = link(gl, vert, traceFrag);
  const displayProgram = link(gl, vert, displayFrag);
  gl.deleteShader(vert);
  if (!traceProgram || !displayProgram) {
    canvas.remove();
    return;
  }

  const front = createTarget(gl);
  const back = createTarget(gl);
  if (!front || !back) {
    canvas.remove();
    return;
  }

  // WebGL2 requires a bound VAO even when the draw uses no attributes.
  gl.bindVertexArray(gl.createVertexArray());

  const uResolution = gl.getUniformLocation(traceProgram, "uResolution");
  const uTime = gl.getUniformLocation(traceProgram, "uTime");
  const uFrame = gl.getUniformLocation(traceProgram, "uFrame");
  const uAccumTrace = gl.getUniformLocation(traceProgram, "uAccum");
  const uAccumDisplay = gl.getUniformLocation(displayProgram, "uAccum");

  // Both programs read the history from texture unit 0 and nothing else is
  // ever bound, so the sampler bindings are set once here rather than per
  // frame.
  gl.activeTexture(gl.TEXTURE0);
  gl.useProgram(traceProgram);
  gl.uniform1i(uAccumTrace, 0);
  gl.useProgram(displayProgram);
  gl.uniform1i(uAccumDisplay, 0);

  let width = 0;
  let height = 0;

  /**
   * Set if allocation ever fails. Checked by the loop rather than acted on
   * directly, because resize() runs once before the loop's own state exists
   * and cannot safely touch it.
   */
  let failed = false;

  /** Passes folded into `read` so far. Doubles as the shader's RNG seed. */
  let passes = 0;

  /** `read` holds the newest mean; the trace pass writes `write`, then swaps. */
  let read = front;
  let write = back;

  /**
   * Reallocate both targets and throw away the history.
   *
   * Resizing invalidates every sample: the pixels no longer correspond, so
   * there is nothing to carry over. Convergence restarts from zero, which is
   * why this bails early when the size has not actually changed — a resize
   * event that leaves the buffer the same would otherwise reset the image
   * for nothing.
   */
  function resize(): void {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    // Scale dpr down until the buffer fits the fragment budget. Sqrt because
    // the budget is an area and dpr scales both axes.
    const over = (cssW * cssH * dpr * dpr) / MAX_PIXELS;
    if (over > 1) dpr /= Math.sqrt(over);

    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === width && h === height) return;

    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    for (const target of [front, back]) {
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );

      // WebGL zero-fills new storage, but clear anyway: on the first pass
      // accumulate() computes mix(prev, radiance, 1.0), and mix multiplies
      // prev by zero rather than dropping it. A NaN in prev would survive
      // that and stick for the life of the buffer.
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);

      // Checked per target, not once after the loop: they are allocated
      // identically, but "identically" is an assumption and this is the only
      // place it would break.
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error(`[background] incomplete framebuffer: 0x${status.toString(16)}`);
        failed = true;
        canvas.remove();
        return;
      }

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    passes = 0;
  }

  /** One pass of samples, folded into the running mean. */
  function trace(seconds: number): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.useProgram(traceProgram);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);

    gl.uniform2f(uResolution, width, height);
    gl.uniform1f(uTime, seconds);
    gl.uniform1i(uFrame, passes);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [read, write] = [write, read];
    passes++;
  }

  /** Tone map the newest mean onto the canvas. */
  function present(): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(displayProgram);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");

  let frameId = 0;
  // Wall-clock elapsed minus time spent hidden, so a backgrounded tab does
  // not fast-forward anything driven by uTime when it comes back.
  let elapsed = 0;
  let last = 0;

  function loop(now: number): void {
    // Bail without re-requesting, so a failed reallocation stops the loop
    // instead of drawing into a canvas that is no longer in the document.
    if (failed) {
      frameId = 0;
      return;
    }

    frameId = requestAnimationFrame(loop);
    elapsed += (now - last) / 1000;
    last = now;

    if (passes < MAX_PASSES) trace(elapsed);
    present();
  }

  function play(): void {
    if (failed || frameId || stillness.matches || document.hidden) return;
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
      /**
       * Reduced motion gets the flat --bg, not a static frame.
       *
       * The old raymarcher could honour this by drawing one frame at t=0.
       * A path tracer cannot: one pass is pure noise, and the alternative —
       * letting it converge — is a hissing field that resolves over several
       * seconds, which is a worse thing to show someone who asked for less
       * movement than the animation was. Hiding the canvas is reversible, so
       * toggling the OS setting back picks up where this left off.
       */
      pause();
      canvas.style.display = "none";
      return;
    }

    canvas.style.display = "";
    document.hidden ? pause() : play();
  }

  document.addEventListener("visibilitychange", sync);
  stillness.addEventListener("change", sync);
  sync();
}

const canvas = document.querySelector<HTMLCanvasElement>("canvas.bg-canvas");
if (canvas) start(canvas);
