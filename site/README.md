# The site

Every piece in this repository is built into one static site and served under one domain: the gallery home page at `/`, and each piece at `/<folder name>/`.

From the repository root:

```sh
npm run build   # clean-installs and builds every piece into dist/
npm test        # checks the gallery helpers
```

`npm run build -- --no-install` skips the clean installs on a rerun. To look at the result, serve `dist/` with any static file server, for example `npx serve dist`.

## How it works

- `scripts/build-site.mjs` finds every folder under `projects/` that has a `build` script, builds it with its base path set to `/<folder name>/`, and copies its output to `dist/<folder name>/`.
- `site/index.html` is the home page template. The build fills in the list of pieces and the count.
- `site/pieces.json` sets the order and the wording on the home page. A piece that is not listed there still appears, after the listed ones, with the title and description from its own `index.html`.

## Adding a piece

1. Put it in `projects/<folder name>/` with a `build` script that writes to `dist/`. The folder name becomes the URL, so use lowercase letters, digits and hyphens.
2. Load its data through `import.meta.env.BASE_URL` (for example `` `${import.meta.env.BASE_URL}data/file.json` ``), never from an absolute path like `/data/file.json`. The site build serves the piece from a sub-path.
3. Commit its `package-lock.json`. The site build installs with `npm ci`, which fails when the lockfile is missing or out of date.
4. Optionally add an entry to `site/pieces.json` to place it and word it.

## Deployment

One Vercel project serves the whole site. Its Root Directory is the repository root, and `vercel.json` holds the build command and output directory. Adding a piece needs no change in Vercel.
