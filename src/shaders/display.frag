#version 300 es

// Display pass. Reads the accumulated linear radiance and writes something
// a monitor can show: exposure, tone map, sRGB encode, dither.
//
// Deliberately separate from the trace pass. Everything here is a display
// decision rather than a transport one, so it can be retuned at any point
// without invalidating the samples already gathered — change EXPOSURE and
// the image restates immediately instead of reconverging.

precision highp float;

uniform sampler2D uAccum;

out vec4 fragColor;

// Linear scale before the tone curve. The scene is a dim room, and the page
// puts a 0.8 scrim over the result, so only near-white output survives to
// the screen at all. Expect to raise this well past 1.0.
const float EXPOSURE = 10.0;

// Narkowicz's ACES fit. Not the real ACES transform, but it rolls highlights
// off gracefully instead of clipping them flat, which is what a scene with a
// small very bright light and a lot of near-black needs. Reinhard would
// desaturate the bright core of the shaft to white.
vec3 tonemap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Exact sRGB transfer, not pow(x, 1.0/2.2). The linear toe near zero is the
// part that matters here: this scene lives in the bottom of the range, and
// the gamma approximation crushes it noticeably.
vec3 encodeSrgb(vec3 x) {
  vec3 lo = x * 12.92;
  vec3 hi = 1.055 * pow(x, vec3(1.0 / 2.4)) - 0.055;
  return mix(hi, lo, step(x, vec3(0.0031308)));
}

// Static per-pixel value in [-0.5, 0.5]. Seeded by pixel only, never by
// frame: this pass runs every frame even after tracing stops, so a
// frame-varying dither would crawl on a still image.
float dither() {
  uvec2 p = uvec2(gl_FragCoord.xy);
  uint h = p.x * 1973u + p.y * 9277u;
  h = (h ^ (h >> 15u)) * 2246822519u;
  h = (h ^ (h >> 13u)) * 3266489917u;
  return float(h ^ (h >> 16u)) * (1.0 / 4294967296.0) - 0.5;
}

void main() {
  vec3 radiance = texelFetch(uAccum, ivec2(gl_FragCoord.xy), 0).rgb;

  vec3 color = encodeSrgb(tonemap(radiance * EXPOSURE));

  // Sub-LSB noise before the driver quantises to 8 bits. A near-black scene
  // with a slow falloff bands badly without this, and the banding is much
  // more visible than the dither is.
  color += dither() / 255.0;

  fragColor = vec4(color, 1.0);
}
