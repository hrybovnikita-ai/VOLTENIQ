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

// True only on the real Vercel runtime. A local `vercel env pull` may set
// VERCEL=1, which must not flip local cookie/CORS/listen behavior.
const isVercelRuntime = Boolean(
  process.env.VERCEL
  && (process.env.VERCEL_REGION || process.env.VERCEL_DEPLOYMENT_ID)
);

function resolveAppOrigin() {
  const configured = normalizeOrigin(process.env.APP_ORIGIN);
  if (configured) return configured;
  if (configuredOrigins[0]) return configuredOrigins[0];
  if (process.env.NODE_ENV === 'production' && vercelOrigins[0]) return vercelOrigins[0];
  return 'http://localhost:5173';
}

export const config = {
  port: Number(process.env.PORT) || 5004,
  nodeEnv: process.env.NODE_ENV || 'development',
  isVercel: isVercelRuntime,
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET || 'volteniq-demo-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin,
  appOrigin: resolveAppOrigin(),
  mailFrom: process.env.MAIL_FROM || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtpUrl: process.env.SMTP_URL || '',
  authTestReturnToken: !isVercelRuntime && process.env.NODE_ENV !== 'production' && String(process.env.AUTH_TEST_RETURN_TOKEN || '').toLowerCase() === '1',
  databaseUrl: process.env.DATABASE_URL,
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  neonBranch: process.env.NEON_BRANCH || null,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
  clerkPublishableKey:
    process.env.CLERK_PUBLISHABLE_KEY
    || process.env.VITE_CLERK_PUBLISHABLE_KEY
    || '',
  clerkProxyUrl: (
    process.env.CLERK_PROXY_URL
    || process.env.VITE_CLERK_PROXY_URL
    || 'https://volteniq.vercel.app/__clerk'
  ).replace(/\/$/, ''),
  firebaseEnabled: (process.env.AUTH_PROVIDER || 'firebase') === 'firebase' && Boolean(process.env.FIREBASE_PROJECT_ID),
  clerkEnabled: process.env.AUTH_PROVIDER === 'clerk' && Boolean(process.env.CLERK_SECRET_KEY),
};
