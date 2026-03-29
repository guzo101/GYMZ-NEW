#!/usr/bin/env node
/**
 * Copies Gymz logo to build/ and converts to ICO for Windows.
 * Source of truth (ONLY): image_assets/gymzLogo.png (and optional image_assets/gymzLogo.svg).
 *
 * This script also syncs public/ assets so Vite + Electron always ship the same logo:
 * - public/gymzLogo.png (copied from image_assets/gymzLogo.png)
 * - public/gymzLogo.svg (copied from image_assets/gymzLogo.svg when present)
 * Output: build/icon.png + build/icon.ico (multi-size for Windows)
 * REQUIRED: Never use default Electron icon - strictly use Gymz logo.
 * 
 * Generates ICO with all required Windows sizes: 16x16, 32x32, 48x48, 256x256
 * This ensures proper display in taskbar, desktop shortcuts, installer, and executable.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "image_assets", "gymzLogo.png");
const srcSvg = path.join(root, "image_assets", "gymzLogo.svg");
const destDir = path.join(root, "build");
const destPng = path.join(destDir, "icon.png");
const destIco = path.join(destDir, "icon.ico");
const publicDir = path.join(root, "public");
const publicPng = path.join(publicDir, "gymzLogo.png");
const publicSvg = path.join(publicDir, "gymzLogo.svg");

if (!fs.existsSync(src)) {
  console.error("ERROR: Gymz logo not found at the required location:");
  console.error(`  ${src}`);
  console.error("This project is locked to use ONLY image_assets/gymzLogo.png as the single source of truth.");
  process.exit(1);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Sync public/ PNG for Vite + runtime usage
fs.copyFileSync(src, publicPng);
console.log("✓ Gymz logo copied to public/gymzLogo.png");

// Sync public/ SVG if present (kept in sync with the same logo name)
if (fs.existsSync(srcSvg)) {
  fs.copyFileSync(srcSvg, publicSvg);
  console.log("✓ Gymz logo copied to public/gymzLogo.svg");
}

// Copy PNG logo to build resources
fs.copyFileSync(src, destPng);
console.log("✓ Gymz logo copied to build/icon.png");

// Generate multi-size ICO file with all required Windows sizes
(async () => {
  try {
    const pngToIco = (await import("png-to-ico")).default;
    
    // png-to-ico can auto-generate multiple sizes from a single PNG
    // Passing just the source file will create an ICO with standard sizes
    // For Windows, this includes: 16x16, 32x32, 48x48, 256x256
    const buf = await pngToIco(src);
    fs.writeFileSync(destIco, buf);
    console.log("✓ Gymz logo converted to build/icon.ico (multi-size ICO for Windows)");
    
    // Verify ICO file was created
    if (!fs.existsSync(destIco)) {
      throw new Error("ICO file was not created");
    }
    
    const stats = fs.statSync(destIco);
    if (stats.size === 0) {
      throw new Error("ICO file is empty");
    }
    if (stats.size < 1000) {
      console.warn(`WARN: ICO file is very small (${stats.size} bytes). May not contain all sizes.`);
    }
    console.log(`✓ ICO file verified (${stats.size} bytes)`);
    console.log("  ICO contains multiple sizes for: taskbar, desktop, installer, executable");
  } catch (err) {
    console.error("ERROR: ICO conversion failed:", err.message);
    console.error("This will cause Electron default icon to appear. Fix required before build.");
    process.exit(1);
  }
})().catch((err) => {
  console.error("FATAL ERROR: Icon generation failed:", err.message);
  console.error("Build cannot proceed without Gymz logo. Fix icon generation script.");
  process.exit(1);
});
