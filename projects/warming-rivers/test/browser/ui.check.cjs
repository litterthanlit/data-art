// Browser checks: node test/browser/ui.check.cjs <dev-server-url>
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const GPU_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function withoutWebGL() {
  const browser = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForTimeout(4000);
  const text = await page.textContent("#status");
  await browser.close();
  assert.match(text, /could not/i, `without WebGL the status still says: ${text}`);
  console.log("ok - without WebGL the page says so");
}

async function aboutStaysOpenOnInnerClicks() {
  const browser = await chromium.launch({ args: GPU_ARGS });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(url);
  await page.click("#about-open");
  const box = await page.locator("#about").boundingBox();
  await page.mouse.click(box.x + 8, box.y + box.height / 2);
  assert.equal(await page.$eval("#about", (d) => d.open), true, "clicking inside the About padding closed it");
  await page.mouse.click(4, 4);
  assert.equal(await page.$eval("#about", (d) => d.open), false, "clicking the backdrop did not close About");
  await browser.close();
  console.log("ok - About closes on the backdrop only");
}

(async () => {
  let failed = 0;
  for (const check of [withoutWebGL, aboutStaysOpenOnInnerClicks]) {
    try { await check(); } catch (error) { failed++; console.log(`not ok - ${check.name}: ${error.message}`); }
  }
  process.exit(failed ? 1 : 0);
})();
