import app from './src/app.js';
import { config } from './src/config.js';

app.listen(config.port, () => {
  console.log(`VOLTENIQ API running on http://localhost:${config.port}`);
  console.log(`Mode: ${config.demoMode ? 'DEMO (in-memory)' : 'PostgreSQL + Prisma'}`);
});
