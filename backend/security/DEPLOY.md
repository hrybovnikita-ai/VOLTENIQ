# VOLTENIQ database permissions

The API uses DATABASE_URL and MONGODB_URI. Keep setup, synchronization and migration credentials in separate operator sessions or deployment jobs. The application can start with its current configuration while the new identities are reviewed.

## Atlas

1. In the Atlas project's Database & Network Access screen create a new custom role using atlas-runtime-role.json. The only actions are FIND on volteniq_store.categories and FIND, INSERT and UPDATE on volteniq_store.carts. Clearing a saved cart updates its items array. The built-in _id index identifies the owner's cart.
2. Create a new SCRAM database user named volteniq_runtime, assign only volteniqStoreRuntime in admin, and restrict it to the VOLTENIQ cluster. Leave all existing users and role assignments intact. Generate its secret in your password manager.
3. Supply the new SRV URI to the API through its secret manager or ignored backend/.env. Encode the password exactly once. Run npm run mongo:check with that identity.
4. The existing collections already have validators and indexes. For a fresh store an operator runs npm run mongo:setup with MONGODB_SETUP_URI in that job's environment. Setup needs createCollection, listCollections and createIndex on the managed store. The API never performs collection setup.
5. For snapshots, supply MONGODB_SYNC_URI only to the sync job. Its role needs find, insert and update on products, favorites, demoOrders and categories in volteniq_store. Only a job intended to prune stale snapshots needs remove on those four collections. Use npm run mongo:sync -- --keep-existing to preserve stale records. The job's PostgreSQL connection needs read access on Product, Favorite, Order and OrderItem. The API does not need the sync identity.

Atlas instructions: https://www.mongodb.com/docs/atlas/security-add-mongodb-roles/ and https://www.mongodb.com/docs/atlas/security-add-mongodb-users/

## PostgreSQL

1. Connect with psql as the authorized provisioning administrator to the existing VOLTENIQ database. Verify the database and schema with `\conninfo`. Run `\i security/postgres-runtime.sql` from backend. This transactional script creates a new login and grants object permissions for the routes, including admin-only catalog maintenance. A role-name collision aborts the transaction.
2. Set only the new login's secret interactively with `\password volteniq_runtime`. Use SCRAM authentication. The runtime must not own the database, schema, tables, or migration history. User and order IDs are application-generated. No sequence or default grants are required.
3. Configure the API's DATABASE_URL with the new login and the existing database. The schema owner supplies its own DATABASE_URL in a separate Prisma migration job. Supply maintenance credentials outside the API environment. Review grants when migrations introduce new objects. The script leaves existing PUBLIC grants untouched; verify cluster-wide CONNECT/TEMP policies, PUBLIC functions and other schemas against your hosting policy.
4. Stage the new secrets, run npm run security:check, then restart the API. Smoke-test login, categories, cart, favorites and checkout. If cutover fails, restore the previous deployment secret references and restart. Keep secrets out of shell history, Git, screenshots and logs.

## Regression tests

Run `npm run test:security` for the offline error-boundary and auth middleware tests. These do not touch databases.

For `npm run test:security:integration`, provision disposable loopback PostgreSQL and authenticated MongoDB servers only. Use a PostgreSQL database named `volteniq_security_test`, apply the Prisma schema as owner, then apply `postgres-runtime.sql` to that disposable instance. Initialize MongoDB collections as operator and assign the equivalent collection-level role in the disposable MongoDB. Supply `QA_DATABASE_URL` and `QA_MONGODB_URI` for the restricted test users. Never set those variables to the live store URLs, and do not run `postgres-runtime.sql` against production without an explicit approval. The suite creates fixture records, starts its own HTTP server twice, and leaves fixture lifecycle to the disposable database owner.
