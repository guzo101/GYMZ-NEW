/**
 * Generates a 96x96 white-on-transparent notification icon for Android.
 * Android requires notification icons to be monochrome (white) with transparent background.
 * Run: node scripts/generate-notification-icon.js
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

  const size = 96; // Expo/Android requirement
  const inputPath = path.join(__dirname, '../assets/gymzLogo.png');
  const outputPath = path.join(__dirname, '../assets/notification_icon.png');

  if (!fs.existsSync(inputPath)) {
    console.error('Input not found:', inputPath);
    process.exit(1);
  }

  // Scale logo to 80% of canvas with padding so it fits properly in notification tray
  const logoPercent = 0.8;
  const logoSize = Math.round(size * logoPercent);
  const padding = Math.round((size - logoSize) / 2);

  const logo = await sharp(inputPath)
    .rotate() // Apply EXIF orientation so image is never tilted
    .resize(logoSize, logoSize, { fit: 'contain' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert to white on transparent and composite onto 96x96 canvas
  const logoData = logo.data;
  for (let i = 0; i < logoData.length; i += 4) {
    const alpha = logoData[i + 3];
    logoData[i] = 255;
    logoData[i + 1] = 255;
    logoData[i + 2] = 255;
    logoData[i + 3] = alpha;
  }

  const logoBuffer = await sharp(logoData, {
    raw: { width: logo.info.width, height: logo.info.height, channels: 4 }
  }).png().toBuffer();

  const { data, info } = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logoBuffer, left: padding, top: padding }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    data[i] = 255;     // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = alpha;
  }

  await sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(outputPath);

  console.log('Generated notification icon:', outputPath);
  console.log('(96x96 white on transparent - required for Android)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
