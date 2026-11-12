// Flat ΛCDM, closed form for lookback time (radiation ignored).
const H0 = 67.7;
const OMEGA_M = 0.31;
const OMEGA_L = 1 - OMEGA_M;
const HUBBLE_TIME_GYR = 977.79222 / H0;
const K = Math.sqrt(OMEGA_L / OMEGA_M);
const PREFACTOR = (2 / (3 * Math.sqrt(OMEGA_L))) * HUBBLE_TIME_GYR;

export function lookbackGyr(z) {
  return PREFACTOR * (Math.asinh(K) - Math.asinh(K * (1 + z) ** -1.5));
}
