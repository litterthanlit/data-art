export function formatHour(hour, cme) {
  const when = hour.t.replace("T", " ").replace("Z", " UTC");
  const bits = [
    when,
    `n ${hour.density.toFixed(1)} cm⁻³`,
    `v ${Math.round(hour.speed)} km/s`,
    `|B| ${hour.bt.toFixed(1)} nT`,
  ];

  if (hour.storm > 0.35) {
    bits.push(`storm ${hour.storm.toFixed(2)}`);
  }
  if (cme) {
    bits.push(`CME ${Math.round(cme.speed || 0)} km/s`);
  }

  return bits.join(" · ");
}

export function formatCme(cme) {
  const when = cme.startTime.replace("T", " ").replace("Z", " UTC");
  const location = cme.sourceLocation || "far-side / uncertain";
  return `${when} · CME ${Math.round(cme.speed || 0)} km/s · ${location}`;
}

export function formatStorm(storm) {
  const when = storm.startTime.replace("T", " ").replace("Z", " UTC");
  return `${when} · geomagnetic storm · peak Kp ${storm.peakKp.toFixed(2)}`;
}
