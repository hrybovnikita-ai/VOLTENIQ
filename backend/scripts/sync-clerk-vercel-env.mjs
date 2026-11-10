import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env.vercel.production');

function parseEnv(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index);
    let value = line.slice(index + 1);
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    out[key] = value;
  }
  return out;
}

function upsert(name, value, environment) {
  spawnSync('npx', ['vercel', 'env', 'rm', name, environment, '--yes'], {
    cwd: root,
    stdio: 'ignore',
    shell: true,
  });
  const result = spawnSync('npx', ['vercel', 'env', 'add', name, environment], {
    cwd: root,
    input: `${value}\n`,
    encoding: 'utf8',
    shell: true,
  });
  const ok = result.status === 0;
  console.log(JSON.stringify({ name, environment, ok }));
  if (!ok) {
    console.error((result.stderr || result.stdout || '').slice(0, 300));
  }
  return ok;
}

if (!fs.existsSync(envFile)) {
  console.error('missing_env_file');
  process.exit(1);
}

const env = parseEnv(envFile);
const publishable = env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY || '';
const proxyUrl = 'https://volteniq.vercel.app/__clerk';

console.log(JSON.stringify({
  hasPublishable: Boolean(publishable),
  hasSecret: Boolean(env.CLERK_SECRET_KEY),
}));

let failed = false;
if (publishable) {
  failed = !upsert('CLERK_PUBLISHABLE_KEY', publishable, 'production') || failed;
  failed = !upsert('CLERK_PUBLISHABLE_KEY', publishable, 'preview') || failed;
}
failed = !upsert('CLERK_PROXY_URL', proxyUrl, 'production') || failed;
failed = !upsert('CLERK_PROXY_URL', proxyUrl, 'preview') || failed;
failed = !upsert('VITE_CLERK_PROXY_URL', proxyUrl, 'production') || failed;
failed = !upsert('VITE_CLERK_PROXY_URL', proxyUrl, 'preview') || failed;

try {
  fs.unlinkSync(envFile);
} catch {
  // ignore cleanup failures
}

if (failed) process.exit(1);
console.log('clerk_vercel_env_synced');
