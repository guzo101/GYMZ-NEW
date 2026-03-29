/**
 * Copies built index.html into route folders so static hosts serve /privacy without SPA rewrites.
 * Asset URLs stay root-absolute (/assets/...) so the app still loads correctly.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("postbuild-spa-routes: dist/index.html missing. Run vite build first.");
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");
const routes = ["privacy"];

for (const route of routes) {
  const dir = path.join(dist, route);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "index.html");
  fs.writeFileSync(out, html);
  console.log(`postbuild-spa-routes: wrote ${path.relative(dist, out)}`);
}
