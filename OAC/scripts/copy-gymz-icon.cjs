#!/usr/bin/env node
/**
 * Copies Gymz icon into OAC build/ for Electron (installer + app icon).
 * Prefer: ../GymzGymsGMS/build/icon.ico and icon.png (shared branding).
 * If GMS build is missing, ensure OAC/build/ exists and prompt to add icons.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const destDir = path.join(root, "build");
const gmsBuild = path.join(root, "..", "GymzGymsGMS", "build");
const gmsIco = path.join(gmsBuild, "icon.ico");
const gmsPng = path.join(gmsBuild, "icon.png");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(gmsIco)) {
  fs.copyFileSync(gmsIco, path.join(destDir, "icon.ico"));
  console.log("✓ Copied icon.ico from GymzGymsGMS/build");
}
if (fs.existsSync(gmsPng)) {
  fs.copyFileSync(gmsPng, path.join(destDir, "icon.png"));
  console.log("✓ Copied icon.png from GymzGymsGMS/build");
}

if (!fs.existsSync(path.join(destDir, "icon.ico")) && !fs.existsSync(path.join(destDir, "icon.png"))) {
  console.warn("OAC build/: no icon.ico or icon.png found.");
  console.warn("  Copy from GymzGymsGMS/build/ or add icon.png + icon.ico to OAC/build/");
  console.warn("  Then run: npm run electron:dev or npm run electron:build");
}
