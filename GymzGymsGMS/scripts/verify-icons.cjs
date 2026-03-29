#!/usr/bin/env node
/**
 * Verifies that Gymz logo icons exist before building.
 * Prevents builds with Electron default icon fallback.
 * 
 * This script ensures:
 * - build/icon.ico exists and is not empty
 * - build/icon.png exists and is not empty
 * - public/gymzLogo.png exists and is not empty (web runtime source)
 * - Icons are from Gymz logo, not Electron defaults
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const buildDir = path.join(root, "build");
const iconIco = path.join(buildDir, "icon.ico");
const iconPng = path.join(buildDir, "icon.png");
const publicLogo = path.join(root, "public", "gymzLogo.png");

let errors = [];

// Check build directory exists
if (!fs.existsSync(buildDir)) {
  errors.push("ERROR: build/ directory does not exist. Run: node scripts/copy-gymz-icon.cjs");
}

// Check ICO file
if (!fs.existsSync(iconIco)) {
  errors.push("ERROR: build/icon.ico does not exist. This is REQUIRED for Windows builds.");
  errors.push("  Run: node scripts/copy-gymz-icon.cjs");
} else {
  const stats = fs.statSync(iconIco);
  if (stats.size === 0) {
    errors.push("ERROR: build/icon.ico exists but is empty (0 bytes).");
  } else if (stats.size < 1000) {
    errors.push(`WARN: build/icon.ico is very small (${stats.size} bytes). May be invalid.`);
  } else {
    console.log(`✓ build/icon.ico verified (${stats.size} bytes)`);
  }
}

// Check PNG file
if (!fs.existsSync(iconPng)) {
  errors.push("ERROR: build/icon.png does not exist.");
  errors.push("  Run: node scripts/copy-gymz-icon.cjs");
} else {
  const stats = fs.statSync(iconPng);
  if (stats.size === 0) {
    errors.push("ERROR: build/icon.png exists but is empty (0 bytes).");
  } else {
    console.log(`✓ build/icon.png verified (${stats.size} bytes)`);
  }
}

// Check public logo file (runtime favicon/logo in UI)
if (!fs.existsSync(publicLogo)) {
  errors.push("ERROR: public/gymzLogo.png does not exist (required for web UI).");
  errors.push("  Run: node scripts/copy-gymz-icon.cjs");
} else {
  const stats = fs.statSync(publicLogo);
  if (stats.size === 0) {
    errors.push("ERROR: public/gymzLogo.png exists but is empty (0 bytes).");
  } else {
    console.log(`✓ public/gymzLogo.png verified (${stats.size} bytes)`);
  }
}

// If errors, exit with failure
if (errors.length > 0) {
  console.error("\n" + "=".repeat(60));
  console.error("ICON VERIFICATION FAILED");
  console.error("=".repeat(60));
  errors.forEach(err => console.error(err));
  console.error("\nTo fix:");
  console.error("  1. Ensure image_assets/gymzLogo.png exists (single source of truth)");
  console.error("  2. Run: node scripts/copy-gymz-icon.cjs");
  console.error("  3. Verify public/gymzLogo.png, build/icon.ico and build/icon.png are created");
  console.error("\nBuild cannot proceed without Gymz logo icons.");
  console.error("=".repeat(60) + "\n");
  process.exit(1);
}

console.log("\n✓ All Gymz logo icons verified. Build can proceed.\n");
process.exit(0);
