import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(backendDir, '..');

// Local app settings, then Neon `.env.local` wins for DATABASE_* and other Neon vars.
dotenv.config({ path: path.join(backendDir, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

if (!process.env.DATABASE_URL_UNPOOLED && process.env.DATABASE_URL) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

function normalizeOrigin(value) {
  if (!value) return null;
  const raw = String(value).trim().replace(/\/$/, '');
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function uniqueOrigins(values) {
  return [...new Set(values.filter(Boolean))];
}

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => normalizeOrigin(origin)).filter(Boolean)
  : [];

const vercelOrigins = uniqueOrigins([
  normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  normalizeOrigin(process.env.VERCEL_URL),
  normalizeOrigin(process.env.VERCEL_BRANCH_URL),
]);

const corsOrigin = uniqueOrigins([
  ...configuredOrigins,
  ...(process.env.NODE_ENV === 'production' ? vercelOrigins : [...defaultOrigins, ...vercelOrigins]),
]);

export const config = {
  port: Number(process.env.PORT) || 5004,
  nodeEnv: process.env.NODE_ENV || 'development',
  isVercel: Boolean(process.env.VERCEL),
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET || 'volteniq-demo-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin,
  databaseUrl: process.env.DATABASE_URL,
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  neonBranch: process.env.NEON_BRANCH || null,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'volteniq',
};
