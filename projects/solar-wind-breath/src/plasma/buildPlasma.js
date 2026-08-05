function normalizeSeries(hours, key) {
  let min = Infinity;
  let max = -Infinity;
  for (const hour of hours) {
    const value = hour[key];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = Math.max(1e-6, max - min);
  return hours.map((hour) => (hour[key] - min) / span);
}

export function buildPlasma(data) {
  const hours = data.hours;
  const densityN = normalizeSeries(hours, "density");
  const speedN = normalizeSeries(hours, "speed");
  const btN = normalizeSeries(hours, "bt");
  const tempN = normalizeSeries(hours, "temperature");

  const samples = hours.map((hour, index) => ({
    ...hour,
    index,
    densityN: densityN[index],
    speedN: speedN[index],
    btN: btN[index],
    tempN: tempN[index],
  }));

  const cmeById = new Map(data.cmes.map((cme) => [cme.id, cme]));

  return {
    meta: data.meta,
    cmes: data.cmes,
    storms: data.storms,
    samples,
    cmeById,
    startMs: Date.parse(hours[0].t),
    endMs: Date.parse(hours[hours.length - 1].t),
  };
}

export function sampleAtProgress(plasma, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  const index = clamped * (plasma.samples.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(plasma.samples.length - 1, lower + 1);
  const mix = index - lower;
  const a = plasma.samples[lower];
  const b = plasma.samples[upper];

  return {
    index: lower,
    mix,
    hour: a,
    next: b,
    densityN: a.densityN * (1 - mix) + b.densityN * mix,
    speedN: a.speedN * (1 - mix) + b.speedN * mix,
    btN: a.btN * (1 - mix) + b.btN * mix,
    tempN: a.tempN * (1 - mix) + b.tempN * mix,
    storm: a.storm * (1 - mix) + b.storm * mix,
    shock: a.shock * (1 - mix) + b.shock * mix,
    launch: a.launch * (1 - mix) + b.launch * mix,
    activity: a.activity * (1 - mix) + b.activity * mix,
    cme: a.cmeId ? plasma.cmeById.get(a.cmeId) : null,
  };
}
