#version 300 es

precision highp float;

#include "./random.glsl"
#include "./accumulate.glsl"

uniform vec2 uResolution; // drawing buffer size in device pixels

// Still bound by the host, but reaching for it will smear: accumulate()
// weights history from before the change into the current mean, so anything
// animated averages its own motion. See accumulate.glsl.
uniform float uTime;

out vec4 fragColor;

#define NUM_RENDER 1
#define NUM_BOUNCES 9
#define MIN_HIT_DIST 0.01
#define MAX_DIST 1000.0

struct Ray {
  vec3 position;
  vec3 direction;
};

struct RayHitInfo {
  float closestHit;
  vec3 normal;
  vec3 glassNormal;
  bool isInside;
};

struct Material {
  vec3 albedo;
  vec3 emission;

  float roughness;

  vec3 specularColor;
  float percentSpecular;

  float ior;
  vec3 absorption;
  float percentRefraction;
};

Material zeroMaterial() {
  Material defaultMat;
  defaultMat.albedo = vec3(0.0);
  defaultMat.emission = vec3(0.0);
  defaultMat.roughness = 1.0f;

  defaultMat.specularColor = vec3(0.0);
  defaultMat.percentSpecular = 0.0;

  defaultMat.ior = 1.0;
  defaultMat.absorption = vec3(0.0);
  defaultMat.percentRefraction = 0.0;

  return defaultMat;
}

RayHitInfo zeroRayHitInfo() {
  RayHitInfo info;
  info.closestHit = MAX_DIST;
  info.normal = vec3(0.0);
  info.isInside = false;
  info.glassNormal = vec3(0.0);
  return info;
}

bool sphereRay(in Ray ray, vec3 p, float r, inout RayHitInfo info) {
  vec3 L = p - ray.position;
  float tca = dot(L, ray.direction);

  float d2 = dot(L, L) - tca * tca;
  float r2 = r * r;
  if (d2 > r2) return false;
  float thc = sqrt(r2 - d2);

  float t0 = tca - thc;
  float t1 = tca + thc;

  if (t0 < MIN_HIT_DIST) {
    t0 = t1;
    if (t0 < MIN_HIT_DIST) return false;
  }

  if (t0 < info.closestHit) {
    info.closestHit = t0;

    vec3 hitPos = ray.position + ray.direction * t0;
    info.normal = normalize(hitPos - p);
    info.isInside = dot(info.normal, ray.direction) > 0.0;
    if (info.isInside) {
      info.normal *= -1.0;
    }

    return true;
  }

  return false;
}

float scalarTriple(vec3 a, vec3 b, vec3 c) {
  return dot(cross(a, b), c);
}

bool quadRay(in Ray ray, in vec3 a, in vec3 b, in vec3 c, in vec3 d, inout RayHitInfo info) {
  // calculate normal and flip vertices order if needed
  vec3 normal = normalize(cross(c - a, c - b));
  if (dot(normal, ray.direction) > 0.0f) {
    normal *= -1.0f;

    vec3 temp = d;
    d = a;
    a = temp;

    temp = b;
    b = c;
    c = temp;
  }

  vec3 p = ray.position;
  vec3 q = ray.position + ray.direction;
  vec3 pq = q - p;
  vec3 pa = a - p;
  vec3 pb = b - p;
  vec3 pc = c - p;

  // determine which triangle to test against by testing against diagonal first
  vec3 m = cross(pc, pq);
  float v = dot(pa, m);
  vec3 intersectPos;
  if (v >= 0.0f) {
    // test against triangle a,b,c
    float u = -dot(pb, m);
    if (u < 0.0f) return false;
    float w = scalarTriple(pq, pb, pa);
    if (w < 0.0f) return false;
    float denom = 1.0f / (u + v + w);
    u *= denom;
    v *= denom;
    w *= denom;
    intersectPos = u * a + v * b + w * c;
  }
  else {
    vec3 pd = d - p;
    float u = dot(pd, m);
    if (u < 0.0f) return false;
    float w = scalarTriple(pq, pa, pd);
    if (w < 0.0f) return false;
    v = -v;
    float denom = 1.0f / (u + v + w);
    u *= denom;
    v *= denom;
    w *= denom;
    intersectPos = u * a + v * d + w * c;
  }

  if (abs(dot(ray.direction, normal)) < 1e-8) return false;

  float dist;
  if (abs(ray.direction.x) > 0.1f) {
    dist = (intersectPos.x - ray.position.x) / ray.direction.x;
  }
  else if (abs(ray.direction.y) > 0.1f) {
    dist = (intersectPos.y - ray.position.y) / ray.direction.y;
  }
  else {
    dist = (intersectPos.z - ray.position.z) / ray.direction.z;
  }

  if (dist > MIN_HIT_DIST && dist < info.closestHit) {
    info.closestHit = dist;
    info.normal = normal;
    info.isInside = false;
    return true;
  }

  return false;
}

void sceneTrace(in Ray ray, out Material material, inout RayHitInfo info) {
  if (sphereRay(ray, vec3(5.0, 0.5, 0.5), 3.0, info)) {
    material = zeroMaterial();
    material.albedo = vec3(0.2f, 1.0, 0.2);
  }

  if (sphereRay(ray, vec3(5.5, 0.1, -3.5), 2.0, info)) {
    material = zeroMaterial();
    material.albedo = vec3(0.3, 0.5, 1.0);
    material.roughness = 0.0;
    material.percentSpecular = 0.5;
    material.specularColor = material.albedo;
  }

  if (sphereRay(ray, vec3(5.5, 2.5, -3.0), 0.8, info)) {
    material = zeroMaterial();
    material.albedo = vec3(1.0, 0.3, 0.5);
    material.specularColor = material.albedo;

    material.roughness = 0.0;
    material.percentSpecular = 0.2;
    material.percentRefraction = 0.8;
    material.absorption = vec3(0.0f, 0.4, 0.4);
    material.ior = 1.5;
  }

  {
    vec3 a = vec3(-10.0, -2.0, 10.0);
    vec3 b = vec3(10.0, -2.0, 10.0);
    vec3 c = vec3(10.0, -2.0, -10.0);
    vec3 d = vec3(-10.0, -2.0, -10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  {
    vec3 a = vec3(-10.0, 10.0, 10.0);
    vec3 b = vec3(10.0, 10.0, 10.0);
    vec3 c = vec3(10.0, 10.0, -10.0);
    vec3 d = vec3(-10.0, 10.0, -10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  // {
  //   vec3 a = vec3(-10.0, 9.5, 10.0);
  //   vec3 b = vec3(10.0, 9.5, 10.0);
  //   vec3 c = vec3(10.0, 9.5, 9.0);
  //   vec3 d = vec3(-10.0, 9.5, 9.0);
  //   if (quadRay(ray, a, b, c, d, info)) {
  //     material = zeroMaterial();
  //     material.emission = vec3(0.95) * 1.0f;
  //   }
  // }

  {
    vec3 a = vec3(-10.0, 10.0, 10.0);
    vec3 b = vec3(10.0, 10.0, 10.0);
    vec3 c = vec3(10.0, -2.0, 10.0);
    vec3 d = vec3(-10.0, -2.0, 10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  {
    vec3 a = vec3(-10.0, 10.0, 10.0);
    vec3 b = vec3(-10.0, 10.0, -10.0);
    vec3 c = vec3(-10.0, -2.0, -10.0);
    vec3 d = vec3(-10.0, -2.0, 10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  {
    vec3 a = vec3(10.0, 3.0, 10.0);
    vec3 b = vec3(10.0, 3.0, -10.0);
    vec3 c = vec3(8.0, 3.0, -10.0);
    vec3 d = vec3(8.0, 3.0, 10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  {
    vec3 a = vec3(8.0, 3.0, 10.0);
    vec3 b = vec3(8.0, 3.0, -10.0);
    vec3 c = vec3(8.0, -2.0, -10.0);
    vec3 d = vec3(8.0, -2.0, 10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      material = zeroMaterial();
      material.albedo = vec3(0.1);
    }
  }

  // Right wall
  {
    vec3 a = vec3(10.0, 10.0, 10.0);
    vec3 b = vec3(10.0, 10.0, -10.0);
    vec3 c = vec3(10.0, 3.0, -10.0);
    vec3 d = vec3(10.0, 3.0, 10.0);
    if (quadRay(ray, a, b, c, d, info)) {
      vec3 hitPos = ray.position + ray.direction * info.closestHit;
      vec2 windowSize = vec2(20.0, 7.0);
      vec2 windowMin = vec2(-10.0, 3.0);

      vec2 gridSize = vec2(20.0, 7.0);

      vec2 uv = (hitPos.zy - windowMin) / windowSize;

      ivec2 cell = ivec2(floor(uv * gridSize));
      vec2 local = fract(uv * gridSize);

      Material DEFAULT_TILE = zeroMaterial();
      DEFAULT_TILE.albedo = vec3(0.1);

      Material BORDER_TILE = zeroMaterial();

      Material PANE_TILE = zeroMaterial();
      PANE_TILE.albedo = vec3(0.0);
      PANE_TILE.specularColor = vec3(0.95, 0.3, 0.3);
      PANE_TILE.percentSpecular = 0.02;
      PANE_TILE.percentRefraction = 0.98;
      PANE_TILE.roughness = 0.3;
      PANE_TILE.absorption = vec3(0.5, 0.5, 0.15);
      PANE_TILE.ior = 1.1;

      int panesCount = 22;
      ivec2 panes[] = ivec2[](
          ivec2(9, 5),
          ivec2(8, 5),
          ivec2(7, 5),
          ivec2(6, 5),
          ivec2(6, 4),
          ivec2(7, 3),
          ivec2(8, 3),
          ivec2(8, 2),
          ivec2(8, 1),
          ivec2(8, 0),

          ivec2(10, 0),
          ivec2(10, 1),
          ivec2(10, 2),
          ivec2(12, 0),
          ivec2(12, 1),
          ivec2(12, 2),
          ivec2(14, 0),
          ivec2(14, 1),
          ivec2(14, 2),
          ivec2(16, 0),
          ivec2(16, 1),
          ivec2(16, 2)
        );

      material = DEFAULT_TILE;

      float SLOPE = 0.045;
      float FREQ = 40.0;
      float BORDER_MARGIN = 0.06;

      for (int i = 0; i < panesCount; ++i) {
        if (panes[i] == cell) {
          if (any(lessThan(local, vec2(BORDER_MARGIN))) ||
              any(greaterThan(local, vec2(1.0 - BORDER_MARGIN)))) {
            material = BORDER_TILE;
            break;
          }

          float hu = SLOPE * cos(FREQ * hitPos.z) * sin(FREQ * hitPos.y);
          float hv = SLOPE * sin(FREQ * hitPos.z) * cos(FREQ * hitPos.y);

          vec3 T = vec3(0.0, 0.0, 1.0);
          vec3 B = vec3(0.0, 1.0, 0.0);

          info.glassNormal = normalize(info.normal - hu * T - hv * B);
          material = PANE_TILE;
          break;
        }
      }
    }
  }

  if (sphereRay(ray, vec3(100.0, 23.0, 80.0), 40.0, info)) {
    material = zeroMaterial();
    material.emission = vec3(0.1, 0.8, 0.3) * 40.0f;
  }
}

void main() {
  uint rng = rngInit(uvec2(gl_FragCoord.xy), uint(uFrame));

  float fovDeg = 90.0f;
  float cameraDist = 1.0 / tan(fovDeg * 0.5 * (M_PI / 180.0f));

  vec3 sceneColor = vec3(0.0);

  // uv is normalised by height, so the vertical FOV is pinned at 90 degrees
  // and the horizontal one follows the aspect ratio. A phone held upright has
  // roughly a 50 degree horizontal field against a laptop's 119, which leaves
  // the window wall outside the frame entirely. Stepping the camera toward it
  // recovers the shot without touching the projection.
  bool portrait = uResolution.x < uResolution.y;

  for (int i = 0; i < NUM_RENDER; ++i) {
    Ray ray;
    ray.position = vec3(portrait ? 3.0f : 0.0f, 5.0f, -8.5f);

    vec2 jitter = vec2(rand(rng), rand(rng)) - 0.5;
    vec2 uv = ((jitter + gl_FragCoord.xy) * 2.0 - uResolution.xy) / uResolution.y;
    ray.direction = normalize(vec3(uv, cameraDist));

    vec3 accumulatedColor = vec3(0.0);
    vec3 throughput = vec3(1.0);

    for (int j = 0; j < NUM_BOUNCES; ++j) {
      RayHitInfo info;
      info = zeroRayHitInfo();

      Material material;

      sceneTrace(ray, material, info);
      if (info.closestHit >= MAX_DIST) {
        break;
      }

      if (info.isInside) {
        throughput *= exp(-material.absorption * info.closestHit);
      }

      vec3 hitPos = ray.position + ray.direction * info.closestHit;

      float roll = rand(rng);

      float percentSpecular = material.percentSpecular;
      float percentRefraction = material.percentRefraction;

      float rayProbability = 1.0;

      float spec = 0.0;
      float refr = 0.0;
      if (percentSpecular > 0.0 && roll < percentSpecular) {
        spec = 1.0;
        rayProbability = percentSpecular;
      } else if (percentRefraction > 0.0 && roll < percentSpecular + percentRefraction) {
        refr = 1.0;
        rayProbability = percentRefraction;
      } else {
        rayProbability = 1.0 - percentSpecular - percentRefraction;
      }

      rayProbability = max(rayProbability, 0.001);

      vec3 diffDir = info.normal + randomUnitVector(rng);
      diffDir = dot(diffDir, diffDir) < 1e-8 ?
        info.normal :
        normalize(diffDir);

      vec3 specDir = reflect(ray.direction, info.normal);
      vec3 refrDir = refract(
          ray.direction,
          info.normal,
          info.isInside ? material.ior : 1.0 / material.ior
        );

      if (dot(refrDir, refrDir) < 1e-8)
        refrDir = reflect(ray.direction, info.normal);

      specDir = normalize(mix(specDir, diffDir, material.roughness * material.roughness));

      vec3 randomRefrDir = normalize(-info.normal + randomUnitVector(rng));
      refrDir = normalize(mix(refrDir, randomRefrDir, material.roughness * material.roughness));

      if (dot(info.glassNormal, info.glassNormal) > 0.0) {
        vec3 inGlass = refract(ray.direction, info.glassNormal, material.ior);
        refrDir = refract(inGlass, info.normal, 1.0 / material.ior);

        float c = max(abs(dot(inGlass, info.normal)), 1e-3);
        throughput *= pow(1.0 - material.absorption, vec3(1.0 / c));
      }

      ray.direction = mix(diffDir, specDir, spec);
      ray.direction = mix(ray.direction, refrDir, refr);

      float side = dot(ray.direction, info.normal) < 0.0 ? -1.0 : 1.0;
      ray.position = hitPos + info.normal * side * 0.01;

      accumulatedColor += material.emission * throughput;

      if (refr == 0.0) {
        throughput *= mix(material.albedo, material.specularColor, spec);
      }
      throughput /= rayProbability;

      float p = min(max(throughput.r, max(throughput.g, throughput.b)), 1.0);
      if (p < rand(rng)) {
        break;
      }
      throughput /= p;
    }

    sceneColor += accumulatedColor / float(NUM_RENDER);
  }

  fragColor = accumulate(sceneColor);
}
