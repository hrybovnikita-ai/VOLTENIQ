import { createMongoClient, initializeCollections } from '../src/db/mongo.js';

let client;
try {
  client = createMongoClient(process.env.MONGODB_SETUP_URI || '');
  await client.connect();
  await initializeCollections(client.db('volteniq_store'));
  console.log('Store collections and indexes verified.');
} catch {
  console.error('MongoDB setup failed. Check the setup identity and collection validators.');
  process.exitCode = 1;
} finally {
  await client?.close();
}
