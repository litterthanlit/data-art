// Gentle motion shared by objects and their light: a slow angular sway plus
// radial waves whose crests travel down the tunnel toward the core.
const sway = /* glsl */ `
vec3 sway(vec3 p, float seed) {
  float a = atan(p.y, p.x);
  float r = length(p.xy);
  a += 0.035 * sin(uTime * 0.11 + seed * 6.2831 + p.z * 0.05);
  a += 0.018 * sin(p.z * 0.07 + uTime * 0.25 + a * 3.0);
  r += 0.28 * sin(a * 5.0 + p.z * 0.11 + uTime * 0.4);
  r += 0.16 * sin(a * 2.0 - p.z * 0.045 + uTime * 0.17 + seed);
  return vec3(cos(a) * r, sin(a) * r, p.z);
}
`;

// Spiral bands of brightness whose crests travel down the tunnel. Objects stay
// put; only their glow ripples, so the light appears to pour toward the core.
const rivers = /* glsl */ `
float river(vec3 p) {
  float a = atan(p.y, p.x);
  float braid = 1.6 * sin(a * 3.0 - p.z * 0.05 + uTime * 0.07);
  float band = 0.5 + 0.5 * sin(a * 5.0 + p.z * 0.16 + uTime * 0.55 + braid);
  return mix(0.3, 1.6, band * band * band);
}
`;

const pointSize = /* glsl */ `
// Sub-pixel points are drawn at 1px but dimmed by their true area, so the
// crowded far end of the tunnel doesn't saturate.
float pointSize(float worldSize, vec4 mvPosition, out float coverage) {
  float dist = max(-mvPosition.z, 0.001);
  float px = worldSize * uPixelRatio * uViewportHeight / dist;
  coverage = clamp(px * px, 0.0, 1.0);
  return max(px, 1.0);
}
`;

// Colours are authored in sRGB; the composer works in linear light and the
// output pass encodes back to sRGB.
const srgbToLinear = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

const header = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uViewportHeight;
attribute vec3 color;
attribute float seed;
varying vec3 vColor;
varying float vAlpha;
${sway}
${rivers}
${pointSize}
${srgbToLinear}
`;

export const anchorVertex = /* glsl */ `
${header}
attribute float size;

void main() {
  vec3 p = sway(position, seed);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float coverage;
  gl_PointSize = pointSize(0.045 * size, mvPosition, coverage);
  float twinkle = 0.62 + 0.38 * sin(uTime * (0.5 + seed) + seed * 40.0);
  float nearFade = smoothstep(1.5, 6.0, -mvPosition.z);
  vColor = srgbToLinear(color);
  vAlpha = 0.3 * twinkle * river(position) * nearFade * coverage * (0.55 + 0.45 * size);
}
`;

export const photonVertex = /* glsl */ `
${header}
attribute float phase;
uniform float uSpeed;
uniform float uTravel;

void main() {
  float t = fract(uTime * uSpeed * (0.6 + 0.8 * seed) + phase);
  vec3 p = position;
  p.z -= uTravel * t;
  p.xy *= 1.0 - 0.35 * t;
  float spin = 0.22 * t * (seed > 0.5 ? 1.0 : -1.0);
  p.xy = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * p.xy;
  p = sway(p, seed);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float coverage;
  gl_PointSize = pointSize(0.03, mvPosition, coverage);
  float nearFade = smoothstep(1.5, 6.0, -mvPosition.z);
  vColor = srgbToLinear(color);
  vAlpha = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.6) * 0.3 * river(position) * nearFade * coverage;
}
`;

export const pointFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a * vAlpha, 1.0);
}
`;

export const coreVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// A soft blue-white heart with a faint iridescent ring, after kishimisu's "Eclipse".
export const coreFragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;

vec3 iridescence(float x) {
  return 0.5 + 0.5 * cos(6.2831 * (x + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  float heart = exp(-r * r * 90.0) * 1.1 + exp(-r * 9.0) * 0.22;
  float ringR = 0.16 + 0.006 * sin(uTime * 0.3);
  float ring = exp(-pow((r - ringR) * 38.0, 2.0)) * (0.55 + 0.45 * sin(ang * 3.0 + uTime * 0.2));
  vec3 col = vec3(0.84, 0.89, 1.0) * heart;
  col += iridescence(ang / 6.2831 + uTime * 0.03 + r * 2.0) * ring * 0.22;
  col *= smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(col, 1.0);
}
`;
