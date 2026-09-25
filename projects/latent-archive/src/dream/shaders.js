// Simplex noise + curl (after Ashima Arts / Stefan Gustavson, MIT).
const noise = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 curl(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 a = vec3(snoise(p), snoise(p + vec3(31.4, 17.1, 7.7)), snoise(p + vec3(-13.3, 47.9, 23.1)));
  vec3 ax = vec3(snoise(p + dx), snoise(p + dx + vec3(31.4, 17.1, 7.7)), snoise(p + dx + vec3(-13.3, 47.9, 23.1)));
  vec3 ay = vec3(snoise(p + dy), snoise(p + dy + vec3(31.4, 17.1, 7.7)), snoise(p + dy + vec3(-13.3, 47.9, 23.1)));
  vec3 az = vec3(snoise(p + dz), snoise(p + dz + vec3(31.4, 17.1, 7.7)), snoise(p + dz + vec3(-13.3, 47.9, 23.1)));
  vec3 dFx = (ax - a) / e;
  vec3 dFy = (ay - a) / e;
  vec3 dFz = (az - a) / e;
  return vec3(dFy.z - dFz.y, dFz.x - dFx.z, dFx.y - dFy.x);
}
`;

export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uMorph;      // 0 = archive helix, 1 = latent cloud
uniform float uDream;      // 0 = anchored, 1 = full hallucination
uniform float uTile;       // world size of one artwork miniature
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uViewScale;  // viewport height / 900, keeps density constant across screens
uniform float uHover;      // hovered artwork index, -1 for none
uniform vec2 uYearWindow;  // visible year range
uniform float uYearFade;   // 0 = show all eras
uniform vec3 uRight;
uniform vec3 uUp;

attribute vec3 aLatent;
attribute vec3 aHelix;
attribute vec2 aCell;
attribute vec3 aColor;
attribute float aYear;
attribute float aWork;
attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

${noise}

void main() {
  float morph = smoothstep(0.0, 1.0, clamp(uMorph * 1.25 - aSeed * 0.25, 0.0, 1.0));
  vec3 anchor = mix(aHelix, aLatent, morph);

  // Mid-morph the pigment lifts off and arcs between the two memories.
  float transit = sin(morph * 3.14159265);
  if (transit > 0.002) {
    anchor += curl(anchor * 0.035 + vec3(aSeed * 3.0, uTime * 0.03, 0.0)) * transit * 4.5;
  }

  // Quiet breathing of each miniature.
  anchor += vec3(
    snoise(anchor * 0.05 + vec3(uTime * 0.07, 0.0, aSeed)),
    snoise(anchor * 0.05 + vec3(0.0, uTime * 0.07, aSeed + 11.0)),
    snoise(anchor * 0.05 + vec3(aSeed + 23.0, 0.0, uTime * 0.07))
  ) * 0.45;

  // Hallucination: advect through a slow curl field, cells shed from their tile.
  float cellSeed = fract(aSeed * 17.0 + aCell.x * 0.37 + aCell.y * 0.71);
  float dream = uDream * (0.55 + 0.45 * cellSeed);
  vec3 flow = anchor;
  if (uDream > 0.002) {
    for (int i = 0; i < 3; i++) {
      flow += curl(flow * 0.022 + vec3(0.0, uTime * 0.018, cellSeed * 0.6)) * 4.2 * dream;
    }
  }

  float tile = uTile * (1.0 + uDream * 1.6 * cellSeed);
  vec3 position = flow + (uRight * aCell.x + uUp * aCell.y) * tile;

  float isHover = step(abs(aWork - uHover), 0.5);
  float inEra = mix(1.0,
    smoothstep(uYearWindow.x - 30.0, uYearWindow.x, aYear) *
    (1.0 - smoothstep(uYearWindow.y, uYearWindow.y + 30.0, aYear)),
    uYearFade);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = uPointSize * (1.0 + isHover * 1.4) * (0.85 + uDream * 0.35 * cellSeed);
  gl_PointSize = max(1.0, size * uPixelRatio * uViewScale * (60.0 / -mv.z));

  vColor = aColor;
  vGlow = isHover;
  vAlpha = mix(0.035, 1.0, inEra) * (0.72 + 0.28 * sin(uTime * 0.6 + aSeed * 40.0));
}
`;

export const fragmentShader = /* glsl */ `
uniform float uIntensity;
uniform float uHasHover;

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float falloff = core * core;

  // Lift dark pigments (multiplicatively) so near-black paintings still read as embers.
  vec3 color = pow(vColor, vec3(0.8)) * 1.1;
  color = mix(color, vec3(1.0), vGlow * 0.35);

  float dim = mix(1.0, mix(0.35, 1.8, vGlow), uHasHover);
  gl_FragColor = vec4(color * falloff * uIntensity * vAlpha * dim, 1.0);
}
`;
