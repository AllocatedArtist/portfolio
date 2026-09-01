#version 300 es

// Background shader. Placeholder: solid red.
//
// This is the only shader the site draws. Replace the body of main() with
// the raymarcher; the uniforms below are already plumbed and updated every
// frame by src/scripts/background.ts.
//
// Legibility is NOT handled here. A flat wash of --bg at 0.8 opacity sits
// between this canvas and the content (.bg-scrim in global.css), so you can
// output whatever you like without worrying about the text on top. If you
// later prefer to clamp luminance in-shader instead and drop the DOM scrim,
// that trades a compositing layer for a uniform read in this file.
//
// vite-plugin-glsl handles #include here, so lift SDF primitives, noise, and
// palette helpers into separate .glsl files under this directory as the
// scene grows.

precision highp float;

uniform vec2 uResolution; // drawing buffer size in device pixels
uniform float uTime; // seconds since first frame, paused when hidden

out vec4 fragColor;

void main() {
  fragColor = vec4(vec3(0.1), 1.0);
}
