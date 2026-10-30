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
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  function openAbout() {
    if (!about.open) about.showModal();
  }

  pause.addEventListener("click", () => setPaused(!scene.paused));
  fullscreen.addEventListener("click", toggleFullscreen);
  aboutButton.addEventListener("click", openAbout);
  about.addEventListener("click", (event) => {
    if (event.target === about) about.close();
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
