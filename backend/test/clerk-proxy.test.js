import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Express mounts Clerk frontendApiProxy before JSON body parsing', () => {
  const appPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const proxyIndex = source.indexOf('frontendApiProxy');
  const jsonIndex = source.indexOf('express.json');
  assert.ok(proxyIndex > -1, 'frontendApiProxy must be configured');
  assert.ok(jsonIndex > -1, 'express.json must remain configured');
  assert.ok(proxyIndex < jsonIndex, 'Clerk proxy must run before body parsing');
  assert.match(source, /path:\s*['"]\/__clerk['"]/);
  assert.match(source, /clerkPublishableKey/);
});
