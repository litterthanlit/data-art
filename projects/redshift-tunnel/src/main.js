import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { loadTunnel } from "./data/loadTunnel.js";
import { buildAnchors } from "./tunnel/mapping.js";
import { TunnelScene } from "./scene/TunnelScene.js";

const status = document.getElementById("status");
const scene = new TunnelScene(document.getElementById("scene"));

try {
  const data = await loadTunnel(`${import.meta.env.BASE_URL}data/`);
  scene.setData(buildAnchors(data, data.meta));
  status.hidden = true;
  scene.start();
} catch (error) {
  status.textContent = "The galaxies could not be loaded.";
  console.error(error);
}
