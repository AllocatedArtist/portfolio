// PCG hash and a stateful uniform generator.
//
// GLSL has no rand(). Every sample needs its own stream, and the streams
// have to be decorrelated across BOTH pixel and frame: seed with the pixel
// alone and the whole image marches in lockstep, seed with the frame alone
// and every pixel gets the same sequence. Either mistake shows up as
// structure in the noise that looks exactly like a transport bug and is not
// one. Suspect the seeding before the integrator.
//
//   uint rng = rngInit(uvec2(gl_FragCoord.xy), uint(uFrame));
//   float x = rand(rng);
//
// Pass `rng` as inout to anything that draws samples, so the stream keeps
// advancing instead of restarting.

// PCG output-permuted LCG. One multiply, a variable shift, one more
// multiply: cheap enough to call per bounce and well distributed enough
// that low-discrepancy artefacts do not show up in the accumulated image.
uint pcgHash(uint x) {
  x = x * 747796405u + 2891336453u;
  uint word = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return (word >> 22u) ^ word;
}

// Nested rather than summed. Adding the terms would collide on the diagonal
// (pixel (3,1) and (1,3) landing on the same seed); hashing each term into
// the next does not.
uint rngInit(uvec2 pixel, uint frame) {
  return pcgHash(pixel.x ^ pcgHash(pixel.y ^ pcgHash(frame)));
}

// Half-open [0, 1). Dividing by 2^32 rather than 2^32-1 keeps 1.0 out of
// the range, which matters for anything that feeds the result into a log or
// an acos.
float rand(inout uint state) {
  state = pcgHash(state);
  return float(state) * (1.0 / 4294967296.0);
}

vec2 rand2(inout uint state) {
  return vec2(rand(state), rand(state));
}

vec3 rand3(inout uint state) {
  return vec3(rand(state), rand(state), rand(state));
}

#define M_PI 3.14159265358979323846
vec3 randomUnitVector(inout uint state) {
  float z = rand(state) * 2.0 - 1.0;
  float a = rand(state) * 2.0 * M_PI;
  float r = sqrt(1.0 - z * z);
  return vec3(r * cos(a), r * sin(a), z);
}
