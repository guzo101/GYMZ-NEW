#!/usr/bin/env node
/**
 * Post-build script: embed Gymz icon and set Windows EXE metadata so the app
 * shows "Gymz" (not "Electron") in Properties and uses the Gymz icon.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const outputDir = process.argv[2] || process.env.GMS_OUTPUT_DIR || "release";
const exePath = path.join(root, outputDir, "win-unpacked", "Gymz.exe");
const iconPath = path.join(root, "build", "icon.ico");
const productName = "Gymz";

if (!fs.existsSync(exePath)) {
  console.log(`Executable not found at ${exePath}, skipping icon/metadata fix`);
  process.exit(0);
}

if (!fs.existsSync(iconPath)) {
  console.error("ERROR: Icon file not found at", iconPath);
  process.exit(1);
}

const is64 = os.arch() === "x64";
const rceditExe = is64 ? "rcedit-x64.exe" : "rcedit.exe";
const rcedit = path.join(root, "node_modules", "rcedit", "bin", rceditExe);

if (!fs.existsSync(rcedit)) {
  console.log("rcedit not found at", rcedit);
  process.exit(0);
}

try {
  const args = [
    exePath,
    "--set-icon", iconPath,
    "--set-version-string", "ProductName", productName,
    "--set-version-string", "FileDescription", `${productName} - Gym Management System`,
    "--set-version-string", "CompanyName", "Gymz",
    "--set-version-string", "LegalCopyright", "Copyright (C) Gymz"
  ];
  console.log("Setting icon and metadata (ProductName/FileDescription) on Gymz.exe...");
  execFileSync(rcedit, args, { stdio: "inherit" });
  console.log("✓ Icon and metadata set successfully");
} catch (err) {
  console.error("WARN: Could not set icon/metadata:", err.message);
  if (err.message.includes("Unable to commit")) {
    console.error("Tip: Close Gymz.exe if it is running, then re-run this script or run electron:build again.");
  }
}
