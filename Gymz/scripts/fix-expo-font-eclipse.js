#!/usr/bin/env node
/**
 * Fixes "Missing Gradle project configuration folder: .settings" error in expo-font.
 * expo-font includes an Eclipse .project file but omits the required .settings folder.
 * This script creates the missing Buildship prefs file.
 */
const fs = require('fs');
const path = require('path');

const settingsDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-font',
  'android',
  '.settings'
);
const prefsFile = path.join(settingsDir, 'org.eclipse.buildship.core.prefs');
const prefsContent = 'connection.project.dir=\neclipse.preferences.version=1\n';

try {
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  fs.writeFileSync(prefsFile, prefsContent);
} catch (err) {
  console.warn('fix-expo-font-eclipse: Could not create .settings (expo-font may not be installed):', err.message);
}
