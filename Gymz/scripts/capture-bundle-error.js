/**
 * Run this while "npm run web" is running in another terminal.
 * Fetches the bundle URL that the browser uses and saves the response.
 * If you get a 500, the response body (JSON error) is written to bundle-error.json
 * so we can fix the real Metro/build error.
 *
 * Usage: node scripts/capture-bundle-error.js
 */

const http = require('http');

// Same URL the browser requests (with hermes - to see the 500 body)
const url =
  'http://localhost:8081/index.ts.bundle?platform=web&dev=false&hot=false&lazy=true&minify=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable';

// Also try without hermes (JSC-style) - might succeed
const urlJsc =
  'http://localhost:8081/index.ts.bundle?platform=web&dev=true&hot=false&lazy=false&minify=false';

function fetch(u, label) {
  return new Promise((resolve) => {
    const parsed = new URL(u);
    const req = http.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || 8081,
        path: parsed.pathname + parsed.search,
        timeout: 30000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body, label });
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message, label }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'timeout', label });
    });
  });
}

async function main() {
  console.log('Fetching bundle (hermes URL)...');
  const result = await fetch(url, 'hermes');
  if (result.error) {
    console.error('Error:', result.error);
    console.log('Is "npm run web" or "npx expo start --web" running in another terminal?');
    process.exit(1);
  }
  console.log('Status:', result.status);
  if (result.status === 500 && result.body) {
    const fs = require('fs');
    const out = 'bundle-error.json';
    try {
      const parsed = JSON.parse(result.body);
      fs.writeFileSync(out, JSON.stringify(parsed, null, 2), 'utf8');
      console.log('Saved 500 response to', out);
      if (parsed.message) console.log('Message:', parsed.message);
    } catch (_) {
      fs.writeFileSync(out, result.body, 'utf8');
      console.log('Saved raw response to', out);
    }
    process.exit(1);
  }
  if (result.status === 200) {
    console.log('Bundle loaded successfully (length:', result.body.length, ')');
    process.exit(0);
  }

  console.log('Trying JSC-style URL (no hermes params)...');
  const resultJsc = await fetch(urlJsc, 'jsc');
  if (resultJsc.error) {
    console.error('JSC fetch error:', resultJsc.error);
    process.exit(1);
  }
  console.log('JSC Status:', resultJsc.status);
  if (resultJsc.status === 200) {
    console.log('JSC URL works. Use dev mode or remove hermes params from the request.');
    process.exit(0);
  }
  if (resultJsc.status === 500 && resultJsc.body) {
    const fs = require('fs');
    fs.writeFileSync('bundle-error.json', resultJsc.body, 'utf8');
    console.log('Saved JSC 500 response to bundle-error.json');
    process.exit(1);
  }
}

main();
