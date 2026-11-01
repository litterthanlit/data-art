export function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function formatEra(window) {
  return window ? `${formatYear(window[0])} – ${formatYear(window[1])}` : "All eras";
}

export function workUrl(work) {
  return `https://clevelandart.org/art/${encodeURIComponent(work.accession)}`;
}
