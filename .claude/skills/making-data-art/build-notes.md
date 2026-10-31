# Build Notes

## Repo pattern

- **Layout:** `projects/<name>/` uses Vite and `three@^0.164.1`, written in plain JS modules. Copy `vite.config.js` and the `package.json` scripts from `projects/redshift-tunnel`.
- **Data:** `npm run data` runs `scripts/build-*-data.mjs`. It caches raw downloads in `scripts/cache/`, which is gitignored by its own `.gitignore` containing `*` and `!.gitignore`. It writes a compact binary plus JSON to `public/data/`, which is committed. The site never fetches at runtime.
- **Tests:** `"test": "node --test \"test/*.test.mjs\""`. A bare `node --test test/` fails on Node 22. Unit-test the pure mapping code (colour ramp, scales, sampling) and the parsers.
- **Docs:** each piece gets a spec in `docs/superpowers/specs/`, a README in the house style, and a link in the root README.

## Rendering gotchas

- **Black renders as grey (`#05060a` came out as rgb 38,42,56):** with `EffectComposer`, the clear colour reaches the linear render target unconverted, and the output pass encodes it to sRGB a second time. Pass a pre-linearised clear colour, and decode sRGB-authored attribute colours in the shader. Prove the fix by checking one pixel's value.
- **Flowing look:** trails come from ping-pong `HalfFloat` render targets. Each frame, fade the previous target by `0.965^(dt*60)`, draw the points additively, then tone-map with `1 - exp(-c * k)` and encode to sRGB. Step particles on the GPU with `GPUComputationRenderer`. See `projects/redshift-tunnel/src/scene/RiverScene.js`.
- **Additive overload:** hundreds of thousands of points wash out to grey. Scale alpha by roughly `1 / count`, and keep the bloom threshold above 0.2.
- **Pause:** skip rendering entirely, so the GPU rests.

## Verifying without a GPU

- Launch Playwright Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. It runs at about 1 fps, so use a viewport of 800×500 or smaller, run one browser at a time, and wait 8–16 s before each screenshot.
- Scene time is capped per frame, so time-based features (like a label cadence) look sparse in these screenshots. Note this rather than "fixing" it.
- Frame rate on real hardware cannot be measured here. Say so.

## Preview links (claude.ai Artifact)

- Build with `vite build --base ./`. Publish `index.html` with the doctype, `html`, `head` and `body` tags removed, and keep `<title>` first. List the assets and data in `files`.
- Raw `.bin` is refused, both as `application/octet-stream` and as text, because it contains escape bytes. Ship it as base64 in a `.json` file, and add an inline `fetch` shim to the preview page only that decodes it back to bytes. The repo keeps the real `.bin`.
- Fullscreen may be refused inside the frame. Hide the button when `!document.fullscreenEnabled`, and catch the rejected promise.
- For a sketch, make one self-contained HTML file with a small base64 sample of the real data inlined (about 60k points is plenty).
