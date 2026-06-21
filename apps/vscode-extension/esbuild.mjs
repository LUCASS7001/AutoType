import * as esbuild from "esbuild";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const watch = process.argv.includes("--watch");
const root = fileURLToPath(new URL(".", import.meta.url));
const context = await esbuild.context({
  absWorkingDir: root,
  entryPoints: [path.join(root, "src", "extension.ts")],
  bundle: true,
  outfile: path.join(root, "dist", "extension.cjs"),
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  target: "node20",
});

if (watch) {
  await context.watch();
  console.log("AutoType Recorder extension is watching for changes.");
} else {
  await context.rebuild();
  await context.dispose();
}
