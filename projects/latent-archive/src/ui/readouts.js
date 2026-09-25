export function formatStatus(archive) {
  const [first, last] = archive.meta.years;
  return `${archive.count.toLocaleString()} works · ${(archive.count * archive.cells).toLocaleString()} pigments · ${formatYear(first)} – ${formatYear(last)}`;
}

export function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function formatEra(window) {
  return window ? `${formatYear(window[0])} – ${formatYear(window[1])}` : "All eras";
}

export function formatMeta(work) {
  return [work.date, work.place, work.department].filter(Boolean).join(" · ");
}

export function imageUrl(work, width = 400) {
  return `https://www.artic.edu/iiif/2/${work.image}/full/${width},/0/default.jpg`;
}

export function workUrl(work) {
  return `https://www.artic.edu/artworks/${work.id}`;
}
