import { prisma } from '../src/db/prisma.js';
import { createMongoClient } from '../src/db/mongo.js';

let client;
try {
  const [role] = await prisma.$queryRawUnsafe(`SELECT current_user = 'volteniq_runtime'
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
    AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
    AND NOT has_column_privilege(current_user, 'public."User"', 'role', 'UPDATE')
    AND NOT has_column_privilege(current_user, 'public."User"', 'role', 'INSERT')
    AS restricted FROM pg_roles WHERE rolname = current_user`);
  client = createMongoClient();
  await client.connect();
  const { authInfo } = await client.db('admin').command({ connectionStatus: 1 });
  const roles = authInfo.authenticatedUserRoles;
  const atlasOk = authInfo.authenticatedUsers.length === 1
    && authInfo.authenticatedUsers[0].user === 'volteniq_runtime'
    && roles.length === 1 && roles[0].role === 'volteniqStoreRuntime' && roles[0].db === 'admin';
  console.log('PostgreSQL runtime identity and privilege checks:', role?.restricted ? 'PASS' : 'FAIL');
  console.log('Atlas runtime identity and role assignment:', atlasOk ? 'PASS' : 'FAIL');
  if (!role?.restricted || !atlasOk) process.exitCode = 1;
} catch {
  console.error('Unable to verify database runtime access.');
  process.exitCode = 1;
} finally {
  await client?.close();
  await prisma.$disconnect();
}
