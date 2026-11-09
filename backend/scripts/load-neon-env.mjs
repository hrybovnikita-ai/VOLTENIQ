import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = path.resolve(backendDir, '..');

dotenv.config({ path: path.join(backendDir, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

if (!process.env.DATABASE_URL_UNPOOLED && process.env.DATABASE_URL) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/load-neon-env.mjs <command> [args...]');
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
