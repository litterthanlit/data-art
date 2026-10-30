import { RAMP_STOPS } from "./mapping.js";

const f = (v) => v.toFixed(5);

// The colour ramp from mapping.js, written out as GLSL so both sides agree.
const ramp = /* glsl */ `
vec3 ramp(float t) {
  ${RAMP_STOPS.slice(1)
    .map(([t1, c1], i) => {
      const [t0, c0] = RAMP_STOPS[i];
      return `if (t <= ${f(t1)}) return mix(vec3(${c0.map(f)}), vec3(${c1.map(f)}), (t - ${f(t0)}) / ${f(t1 - t0)});`;
    })
    .join("\n  ")}
  return vec3(${RAMP_STOPS.at(-1)[1].map(f)});
}
`;

const hash = /* glsl */ `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
`;

// GPUComputationRenderer pass: state.x = radius, state.y = angle. Mirrors riverStep() in mapping.js.
export const simulationFragment = /* glsl */ `
uniform float uTime;
uniform float uDt;
uniform float uChannels;
uniform float uSwirl;
uniform float uPull;
uniform float uBunch;
uniform float uRim;
uniform float uCentre;
uniform sampler2D uSources;
${hash}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 state = texture2D(tState, uv);
  vec4 source = texture2D(uSources, uv);
  float r = state.x;
  float theta = state.y;
  float field = sin(uChannels * theta + r * 7.0 + uTime * 0.21) + 0.5 * sin(3.0 * theta - r * 11.0 - uTime * 0.13);
  theta += uDt * (uSwirl / (r + 0.25) - uBunch * field * 0.35);
  r -= uDt * uPull * source.g * (0.55 + 0.45 * r);
  if (r < uCentre) {
    r = uRim * (0.97 + 0.06 * hash(uv + uTime));
    theta = source.r + (hash(uv * 1.7 + uTime) - 0.5) * 0.25;
  }
  gl_FragColor = vec4(r, mod(theta, 6.28318530718), 0.0, 1.0);
}
`;

export const riverVertex = /* glsl */ `
uniform sampler2D uState;
uniform vec2 uFit;
uniform float uReach;
uniform float uPointSize;
uniform float uAlpha;
uniform float uColourScale;
varying vec3 vColor;
varying float vAlpha;
${ramp}

void main() {
  // position carries (u, v) into the state texture and the particle's size.
  vec4 state = texture2D(uState, position.xy);
  float size = position.z;
  float r = state.x;
  float theta = state.y;
  float R = r * uReach;
  gl_Position = vec4(cos(theta) * R * uFit.x, sin(theta) * R * uFit.y, 0.0, 1.0);
  gl_PointSize = uPointSize * size;
  vColor = ramp(clamp(r * uColourScale, 0.0, 1.0));
  float arriving = clamp((r - 0.05) / 0.25, 0.0, 1.0);
  vAlpha = uAlpha * arriving * size;
}
`;

export const riverFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vColor * vAlpha * smoothstep(0.5, 0.0, d), 1.0);
}
`;

export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Long exposure: last frame's light, dimmed a little.
export const fadeFragment = /* glsl */ `
uniform sampler2D uTrail;
uniform float uFade;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uTrail, vUv).rgb * uFade, 1.0);
}
`;

// Tone-map the accumulated light, let it sink into a quiet dark centre, encode to sRGB.
export const displayFragment = /* glsl */ `
uniform sampler2D uTrail;
uniform vec2 uAspect;
varying vec2 vUv;

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 c = texture2D(uTrail, vUv).rgb;
  c = 1.0 - exp(-c * 1.3);
  c *= smoothstep(0.0, 0.16, length((vUv - 0.5) * uAspect));
  c += vec3(0.0012, 0.0014, 0.0026);
  gl_FragColor = vec4(toSrgb(c), 1.0);
}
`;
