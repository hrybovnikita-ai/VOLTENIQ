import { createMongoClient } from '../src/db/mongo.js';

function diagnostic(error) {
  let message = String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[redacted URI]');
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      const { username, password } = new URL(uri);
      const secrets = [username, password, decodeURIComponent(username), decodeURIComponent(password)];
      for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
        message = message.replaceAll(secret, '[redacted]');
    } catch {
      message = 'Invalid URI syntax or credential encoding.';
    }
  }
  return `${error.name}${error.code == null ? '' : ' (code ' + error.code + ')'}: ${message}`;
}

let client;
try {
  client = createMongoClient();
  await client.connect();
  const db = client.db('admin');
  const status = await db.command({ connectionStatus: 1 });
  if (!status.authInfo?.authenticatedUsers?.length) throw new Error('No authenticated MongoDB user.');
  await db.command({ ping: 1 });
  console.log('Authenticated MongoDB connection and ping succeeded.');
} catch (error) {
  console.error(diagnostic(error));
  process.exitCode = 1;
} finally {
  await client?.close();
}
