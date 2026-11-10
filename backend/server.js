import app from './src/app.js';
import { config } from './src/config.js';

/**
 * Local development entrypoint only.
 * Vercel Services mounts `src/app.js` directly, so this file must always listen
 * even if a pulled `.env` sets VERCEL=1 (which used to skip app.listen).
 */
const host = process.env.HOST || '0.0.0.0';
const port = config.port;

const server = app.listen(port, host, () => {
  console.log(`VOLTENIQ API running on http://localhost:${port}`);
  console.log(`Mode: ${config.demoMode ? 'DEMO (in-memory)' : 'PostgreSQL + Prisma'}`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or set PORT.`);
  } else {
    console.error('Failed to start VOLTENIQ API:', error);
  }
  process.exit(1);
});

export default app;
