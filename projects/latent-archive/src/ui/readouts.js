export function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function formatEra(window) {
  return window ? `${formatYear(window[0])} – ${formatYear(window[1])}` : "All eras";
}

export function imageUrl(work, width = 400) {
  return `https://www.artic.edu/iiif/2/${work.image}/full/${width},/0/default.jpg`;
}

export function workUrl(work) {
  return `https://www.artic.edu/artworks/${work.id}`;
}
