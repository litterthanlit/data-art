export async function loadWarming(baseUrl) {
  const res = await fetch(`${baseUrl}warming-rivers.json`);
  if (!res.ok) throw new Error(`warming-rivers.json: HTTP ${res.status}`);
  return res.json();
}
