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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMoment(t) {
  const date = new Date(t);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${MONTHS[date.getUTCMonth()]} ${day} · ${hour}:00 UTC`;
}

// NOAA G-scale: Kp 5 → G1 … Kp 9 → G5.
function gScale(kp) {
  return Math.max(1, Math.min(5, Math.floor(kp) - 4));
}

export function describePhase(sample) {
  if (sample.stormEvent && sample.storm > 0.45) {
    const kp = sample.stormEvent.peakKp;
    return {
      phase: "storm",
      label: `G${gScale(kp)} storm · Kp ${Number.isInteger(kp) ? kp : kp.toFixed(1)}`,
    };
  }
  if (sample.shock > 0.3) {
    return { phase: "shock", label: "Shock front arriving" };
  }
  if (sample.cme && sample.launch > 0.45) {
    return { phase: "cme", label: `CME launch · ${Math.round(sample.cme.speed || 0)} km/s` };
  }
  return { phase: "quiet", label: "Quiet solar wind" };
}

// Track gradient for the time scrubber: dim indigo for quiet hours, amber for
// shocks, coral for geomagnetic storms — the whole storm arc at a glance.
export function timelineGradient(samples, steps = 90) {
  const stops = [];
  for (let i = 0; i < steps; i += 1) {
    const from = Math.floor((i / steps) * samples.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / steps) * samples.length));
    let storm = 0;
    let shock = 0;
    for (let j = from; j < to; j += 1) {
      storm = Math.max(storm, samples[j].storm);
      shock = Math.max(shock, samples[j].shock);
    }
    let color = "rgba(92, 110, 220, 0.35)";
    if (storm > 0.45) color = `rgba(255, 70, 100, ${0.45 + storm * 0.55})`;
    else if (shock > 0.25) color = `rgba(255, 180, 90, ${0.4 + shock * 0.6})`;
    const a = ((i / steps) * 100).toFixed(2);
    const b = (((i + 1) / steps) * 100).toFixed(2);
    stops.push(`${color} ${a}%`, `${color} ${b}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
