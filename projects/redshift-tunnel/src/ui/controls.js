// Pause, fullscreen and About, each with a single-key shortcut.
export function createControls(scene) {
  const pause = document.getElementById("pause");
  const fullscreen = document.getElementById("fullscreen");
  const aboutButton = document.getElementById("about-open");
  const about = document.getElementById("about");

  function setPaused(paused) {
    scene.setPaused(paused);
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute("aria-label", paused ? "Play" : "Pause");
  }

  function toggleFullscreen() {
    // Browsers and embedding frames may refuse; the tunnel simply stays as it is.
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen?.();
    request?.catch(() => {});
  }

  function openAbout() {
    if (!about.open) about.showModal();
  }

  fullscreen.hidden = !document.fullscreenEnabled;
  pause.addEventListener("click", () => setPaused(!scene.paused));
  fullscreen.addEventListener("click", toggleFullscreen);
  aboutButton.addEventListener("click", openAbout);
  // The dialog element itself receives clicks on its padding too, so only a
  // click outside its box counts as a click on the backdrop.
  about.addEventListener("click", (event) => {
    const box = about.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) about.close();
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || about.open) return;
    const onButton = event.target instanceof HTMLButtonElement;
    if (event.code === "Space" && !onButton) {
      event.preventDefault();
      setPaused(!scene.paused);
    } else if (event.key === "f" || event.key === "F") {
      toggleFullscreen();
    } else if (event.key === "a" || event.key === "A") {
      openAbout();
    }
  });
}
