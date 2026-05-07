import "./styles.css";

const DATA_URL = `${import.meta.env.BASE_URL}data/trade-organism.json`;

async function boot() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  const data = await response.json();
  document.getElementById("status").textContent =
    `${data.nodes.length.toLocaleString()} hubs · ${data.edges.length.toLocaleString()} flows`;
}

boot().catch((error) => {
  document.body.classList.add("has-error");
  document.getElementById("status").textContent = error.message;
});
