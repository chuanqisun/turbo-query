const path = require("path");
const fs = require("fs/promises");
const fse = require("fs-extra");

const OUT_DIR = `dist`;
const UNPACKED_OUT_DIR = `dist/unpacked/chrome`;

const isWatch = process.argv.includes("--watch");

async function build() {
  console.log("[build] start building extension...");

  console.log(`[build] remove ${OUT_DIR}`);

  try {
    await fs.stat(OUT_DIR);
    await fs.rm(path.resolve(OUT_DIR), { recursive: true });
  } catch {}

  const mainBuild = require("esbuild")
    .build({
      entryPoints: ["src/modules/ui/popup.tsx", "src/modules/ui/options.tsx"],
      bundle: true,
      format: "esm",
      sourcemap: "inline",
      watch: isWatch,
      outdir: path.join(UNPACKED_OUT_DIR, "modules/ui"),
    })
    .catch(() => process.exit(1));

  const webWorkerBuild = require("esbuild")
    .build({
      entryPoints: ["src/modules/worker/worker.ts"],
      bundle: true,
      format: "iife",
      sourcemap: "inline",
      watch: isWatch,
      outdir: path.join(UNPACKED_OUT_DIR, "modules/worker"),
    })
    .catch(() => process.exit(1));

  const styleBuild = require("esbuild")
    .build({
      entryPoints: ["src/modules/ui/popup.css", "src/modules/ui/options.css"],
      bundle: true,
      sourcemap: "inline",
      watch: isWatch,
      outdir: path.join(UNPACKED_OUT_DIR, "modules/ui"),
    })
    .catch(() => process.exit(1));

  await Promise.all([mainBuild, webWorkerBuild, styleBuild]);
  console.log("[build] script built");

  const copyTasksAsync = [
    fs.copyFile(path.resolve("src/manifest.json"), path.join(UNPACKED_OUT_DIR, "manifest.json")),
    fse.copy(path.resolve("src/public"), UNPACKED_OUT_DIR),
  ];

  await Promise.all(copyTasksAsync);
  console.log("[build] assets copied");
}

build();
