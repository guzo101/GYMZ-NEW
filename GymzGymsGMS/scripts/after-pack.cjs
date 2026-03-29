const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");

/**
 * After pack hook for electron-builder.
 * Sets the application icon AND Windows version metadata on the .exe so that
 * the executable shows "Gymz" (not "Electron") in Properties and uses the Gymz icon.
 */
exports.default = async function(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== "win32") {
    return;
  }
  
  const exePath = path.join(appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const projectDir = context.packager.projectDir;
  const productName = context.packager.appInfo.productName || "Gymz";
  
  if (!fs.existsSync(exePath)) {
    console.log(`[afterPack] Executable not found: ${exePath}`);
    return;
  }
  
  if (!fs.existsSync(iconPath)) {
    console.error(`[afterPack] Icon not found: ${iconPath}`);
    return;
  }
  
  const is64 = os.arch() === "x64";
  const rceditExe = is64 ? "rcedit-x64.exe" : "rcedit.exe";
  const rceditPath = path.join(projectDir, "node_modules", "rcedit", "bin", rceditExe);
  
  if (!fs.existsSync(rceditPath)) {
    console.log(`[afterPack] rcedit not found at ${rceditPath}, icon/metadata may show Electron`);
    return;
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
    console.log(`[afterPack] Setting icon and metadata (ProductName/FileDescription) on .exe...`);
    execFileSync(rceditPath, args, {
      stdio: "inherit",
      cwd: projectDir
    });
    console.log(`[afterPack] ✓ Icon and metadata set successfully`);
  } catch (err) {
    console.error(`[afterPack] Error setting icon/metadata:`, err.message);
  }
};
