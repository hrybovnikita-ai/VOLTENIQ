import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteClerkSetCookie } from '../src/middleware/clerkFrontendProxy.js';

const root = path.dirname(fileURLToPath(import.meta.url));

test('Express mounts custom Clerk proxy before JSON body parsing', () => {
  const appPath = path.resolve(root, '../src/app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const proxyIndex = source.indexOf('createClerkFrontendProxyMiddleware');
  const jsonIndex = source.indexOf('express.json');
  assert.ok(proxyIndex > -1, 'custom Clerk proxy must be configured');
  assert.ok(jsonIndex > -1, 'express.json must remain configured');
  assert.ok(proxyIndex < jsonIndex, 'Clerk proxy must run before body parsing');
  assert.match(source, /createClerkFrontendProxyMiddleware/);
  assert.doesNotMatch(source, /frontendApiProxy:\s*\{/);
});

test('rewriteClerkSetCookie strips foreign Clerk FAPI Domain attributes', () => {
  const raw = [
    '__client=abc; Path=/; Domain=frontend-api.clerk.dev; Secure; SameSite=None; HttpOnly',
    '__client_uat=1; Path=/; Domain=.clerk.accounts.dev; HttpOnly; Secure',
    '_cfuvid=xyz; HttpOnly; SameSite=None; Secure; Path=/; Domain=frontend-api.clerk.dev',
  ];

  for (const cookie of raw) {
    const rewritten = rewriteClerkSetCookie(cookie);
    assert.doesNotMatch(rewritten, /Domain=/i);
    assert.match(rewritten, /Path=\//);
  }

  assert.equal(
    rewriteClerkSetCookie('__client=abc; Path=/; Secure'),
    '__client=abc; Path=/; Secure'
  );
});

test('proxy middleware uses getSetCookie and appendHeader for Set-Cookie', () => {
  const proxyPath = path.resolve(root, '../src/middleware/clerkFrontendProxy.js');
  const source = fs.readFileSync(proxyPath, 'utf8');
  assert.match(source, /getSetCookie/);
  assert.match(source, /appendHeader\(\s*['"]Set-Cookie['"]/);
  assert.match(source, /clerkFrontendApiProxy/);
  assert.match(source, /x-forwarded-host/);
  assert.match(source, /volteniq_session/);
});
