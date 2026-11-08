import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

export const config = {
  port: Number(process.env.PORT) || 5004,
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET || 'volteniq-demo-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin,
  databaseUrl: process.env.DATABASE_URL,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'volteniq',
};
