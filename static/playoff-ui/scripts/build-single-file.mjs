import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");
const htmlPath = path.join(distDir, "index.html");
const outputPath = path.join(distDir, "playoff-single-file.html");

async function inlineAssets() {
  let html = await fs.readFile(htmlPath, "utf8");

  html = html
    .split("\n")
    .filter((line) => !line.includes('rel="modulepreload"'))
    .join("\n");

  const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  if (cssMatch) {
    const cssPath = path.join(distDir, cssMatch[1].replace(/^\.\//, ""));
    const cssContent = await fs.readFile(cssPath, "utf8");
    html = html.replace(cssMatch[0], `<style>\n${cssContent}\n</style>`);
  }

  const jsMatch = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
  if (jsMatch) {
    const jsPath = path.join(distDir, jsMatch[1].replace(/^\.\//, ""));
    const jsContent = await fs.readFile(jsPath, "utf8");
    html = html.replace(jsMatch[0], `<script type="module">\n${jsContent}\n</script>`);
  }

  await fs.writeFile(outputPath, html, "utf8");
  console.log(`Created ${outputPath}`);
}

try {
  await inlineAssets();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}



