/**
 * Generates the app icon (gymzLogoIcon.png) from the official logo (gymzLogo.png).
 * This file is the single source for the mobile app icon; app.config.js points to it.
 *
 * No cropping: logo is resized with fit: 'contain' so the full logo is always
 * visible. It is centered on a 1024x1024 transparent canvas within the Android
 * safe zone so system masks (circle/squircle) never crop the logo.
 *
 * Run: npm run generate:icon  (or node scripts/generate-adaptive-icon.js)
 * Run before prebuild/build so the icon exists: build:android already does this.
 */
const path = require('path');
const fs = require('fs');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp is required. Run: npm install sharp --save-dev');
    process.exit(1);
  }

  const size = 1024;
  // Android safe zone: inner 66x66 dp of 108x108 canvas. Use 62% for good balance -
  // logo fills the icon well while staying within safe zone to avoid cropping.
  const safeZonePercent = 0.62;
  const logoSize = Math.round(size * safeZonePercent);
  const padding = Math.round((size - logoSize) / 2);

  const inputPath = path.join(__dirname, '../assets/gymzLogo.png');
  const outputPath = path.join(__dirname, '../assets/gymzLogoIcon.png');

  if (!fs.existsSync(inputPath)) {
    console.error('Input not found:', inputPath);
    process.exit(1);
  }

  const logo = await sharp(inputPath)
    .rotate() // Apply EXIF orientation so image is never tilted
    .resize(logoSize, logoSize, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logo, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log('Generated:', outputPath);

  // Web favicon (app.config.js references ./assets/favicon.png)
  const faviconSize = 48;
  const faviconPath = path.join(__dirname, '../assets/favicon.png');
  await sharp(inputPath)
    .rotate()
    .resize(faviconSize, faviconSize, { fit: 'contain' })
    .png()
    .toFile(faviconPath);
  console.log('Generated:', faviconPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
