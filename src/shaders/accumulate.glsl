// The progressive-accumulation contract between background.frag and the
// ping-pong buffers in background.ts.
//
// Each pass renders a fixed number of samples and hands the mean of them to
// accumulate(), which folds that into a running mean of every pass so far.
// The pass count arrives as uFrame and the previous mean as uAccum, both
// bound by the host.
//
// Two consequences worth keeping in mind while writing the integrator:
//
//   - The scene must be static. Anything driven by uTime averages its own
//     motion into a smear, because history from before the change is still
//     weighted in. Moving the camera means resetting, and resetting means
//     starting convergence over.
//
//   - Samples per pass must be constant. The running mean weights each pass
//     equally, which is only the correct estimator if each pass carried the
//     same number of samples. One pass doing 4 spp and the next doing 1 spp
//     silently biases the result toward the second.
//
// Store linear radiance here, not display values. Tone mapping happens once
// in display.frag, so it can be retuned without throwing away convergence.

uniform sampler2D uAccum; // previous pass's running mean, RGBA32F
uniform int uFrame; // passes completed so far; 0 on the first pass

vec4 accumulate(vec3 radiance) {
  vec3 prev = texelFetch(uAccum, ivec2(gl_FragCoord.xy), 0).rgb;

  // n = 0 gives weight 1.0, which discards prev entirely. That is what
  // makes the first pass after a reset correct without a branch.
  float weight = 1.0 / float(uFrame + 1);

  return vec4(mix(prev, radiance, weight), 1.0);
}
