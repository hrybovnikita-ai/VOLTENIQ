import app from './src/app.js';
import { config } from './src/config.js';

// Local/dev server only. On Vercel the Express app is exported from src/app.js.
if (!config.isVercel) {
  app.listen(config.port, () => {
    console.log(`VOLTENIQ API running on http://localhost:${config.port}`);
    console.log(`Mode: ${config.demoMode ? 'DEMO (in-memory)' : 'PostgreSQL + Prisma'}`);
  });
}

export default app;
