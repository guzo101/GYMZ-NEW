/**
 * Wraps `npx expo ...` with EXPO_NO_DEPENDENCY_VALIDATION=1 so Metro starts even when
 * Expo's online dependency check hits a Node/undici "Body has already been read" error.
 */
'use strict';

process.env.EXPO_NO_DEPENDENCY_VALIDATION = '1';

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/start-expo.cjs <expo-args...>');
  console.error('Example: node scripts/start-expo.cjs start --lan --port 8082');
  process.exit(1);
}

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });

const child = spawn(process.execPath, [expoCli, ...args], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: process.env,
  windowsHide: true,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
