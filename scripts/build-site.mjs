// Builds every piece under projects/ into one static site:
//   dist/index.html      the gallery home page
//   dist/<piece>/        each piece, built with its base path set to /<piece>/
// One Vercel project serves dist/, so every piece lives under one domain.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arrangePieces, isSlug, readMeta, renderGallery } from "./lib/gallery.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = join(ROOT, "projects");
const SITE = join(ROOT, "site");
const OUT = join(ROOT, "dist");
const INSTALL = !process.argv.includes("--no-install"); // reruns can skip the clean installs

async function main() {
  const slugs = await findPieces();
  if (!slugs.length) throw new Error("No buildable pieces under projects/");

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const built = [];
  for (const slug of slugs) {
    const dir = join(PROJECTS, slug);
    console.log(`\n── ${slug}`);
    if (INSTALL) run("npm", ["ci", "--no-audit", "--no-fund"], dir);
    run("npm", ["run", "build", "--", "--base", `/${slug}/`], dir);
    await cp(join(dir, "dist"), join(OUT, slug), { recursive: true });
    if (!existsSync(join(OUT, slug, "index.html"))) throw new Error(`${slug} built no index.html`);
    built.push({ slug, ...readMeta(await readFile(join(dir, "index.html"), "utf8")) });
  }

  const manifest = JSON.parse(await readFile(join(SITE, "pieces.json"), "utf8"));
  const pieces = arrangePieces(built, manifest);
  const template = await readFile(join(SITE, "index.html"), "utf8");
  await writeFile(join(OUT, "index.html"), renderGallery(template, pieces));

  console.log(`\nsite: ${pieces.length} pieces → ${OUT}`);
  for (const piece of pieces) console.log(`  /${piece.slug}/  ${piece.title}`);
}

// A piece is a folder under projects/ with a URL-safe name and a build script.
async function findPieces() {
  const entries = await readdir(PROJECTS, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = join(PROJECTS, entry.name, "package.json");
    if (!existsSync(manifest)) continue;
    if (!isSlug(entry.name)) {
      console.warn(`skipping projects/${entry.name}: the folder name is not URL-safe`);
      continue;
    }
    const scripts = JSON.parse(await readFile(manifest, "utf8")).scripts ?? {};
    if (scripts.build) slugs.push(entry.name);
  }
  return slugs.sort();
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
