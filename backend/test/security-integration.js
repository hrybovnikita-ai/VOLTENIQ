import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

// Deliberately require separate, disposable databases. Never inherit the app's URLs.
function requireQaUrl(name) {
  const value = process.env[name];
  assert(value, `${name} is required. Provision disposable loopback databases and do not point this suite at the live store. See security/DEPLOY.md.`);
  return new URL(value);
}
const pgUrl = requireQaUrl('QA_DATABASE_URL');
const mongoUrl = requireQaUrl('QA_MONGODB_URI');
assert(['localhost','127.0.0.1'].includes(pgUrl.hostname) && pgUrl.pathname === '/volteniq_security_test');
assert(['localhost','127.0.0.1'].includes(mongoUrl.hostname) && mongoUrl.port && mongoUrl.username);
assert(process.env.DATABASE_URL !== pgUrl.href, 'QA_DATABASE_URL must not reuse DATABASE_URL');
assert(process.env.MONGODB_URI !== mongoUrl.href, 'QA_MONGODB_URI must not reuse MONGODB_URI');
const pg = new PrismaClient({ datasourceUrl: pgUrl.href });
const mongo = new MongoClient(mongoUrl.href);
let child, origin, sessionCookie = '';

async function start() {
  child = spawn(process.execPath, ['--input-type=module', '-e',
    "import app from './src/app.js'; const s=app.listen(0,'127.0.0.1',()=>process.send(s.address().port));"],
    { env: { ...process.env, DATABASE_URL: pgUrl.href, MONGODB_URI: mongoUrl.href, DEMO_MODE: 'false', NODE_ENV: 'test', AUTH_TEST_RETURN_TOKEN: '1' },
      stdio: ['ignore','ignore','ignore','ipc'] });
  const port = await Promise.race([once(child,'message').then(([port]) => port),
    once(child,'exit').then(() => { throw new Error('Test API exited before startup'); }),
    delay(15000, null, { ref: false }).then(() => { throw new Error('Test API startup timed out'); })]);
  origin = 'http://127.0.0.1:' + port + '/api';
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const finished = once(child,'exit');
  child.kill();
  await finished;
}

function rememberCookies(res) {
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (!setCookie.length) return;
  const parts = setCookie.map((value) => String(value).split(';')[0]).filter(Boolean);
  if (parts.length) sessionCookie = parts.join('; ');
}

async function request(path, method, status, body, authed = false) {
  const res = await fetch(origin + path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      ...(authed && sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: body && JSON.stringify(body),
  });
  rememberCookies(res);
  assert.equal(res.status, status, method + ' ' + path + ' returned ' + res.status);
  return res.json();
}

try {
  const [priv] = await pg.$queryRawUnsafe(`SELECT rolsuper, rolcreatedb, rolcreaterole,
    has_column_privilege(current_user,'public."User"','role','UPDATE') AS promote,
    has_schema_privilege(current_user,'public','CREATE') AS ddl
    FROM pg_roles WHERE rolname=current_user`);
  assert(Object.values(priv).every(value => value === false));
  await mongo.connect();
  const store = mongo.db('volteniq_store');
  await assert.rejects(store.collection('products').findOne({}), err => err.code === 13);
  await assert.rejects(store.collection('carts').deleteOne({ _id: randomUUID() }), err => err.code === 13);
  await store.collection('categories').findOne({});
  await start();
  const suffix = randomUUID(), credentials = { email: suffix+'@example.test', password: randomUUID() };
  const registration = await request('/auth/register','POST',201,credentials);
  await request('/auth/login','POST',401,credentials);
  await request('/auth/verify-email','POST',200,{email:credentials.email,token:registration.data.token});
  await request('/auth/register','POST',409,credentials);
  sessionCookie = '';
  const { data: { user } } = await request('/auth/login','POST',200,credentials);
  assert.ok(sessionCookie.includes('volteniq_session='));
  const product = await pg.product.create({data:{name:'Test product',slug:suffix,description:'Fixture',category:'QA',price:12.5,stock:3,image:'test',images:[],colors:[],storage:[],specs:{}}});
  const favorite = productId => ({ productId });
  await request('/favorites/toggle','POST',401,favorite(product.id));
  for (const invalid of [null,{},[],12,'  ','x'.repeat(101)]) await request('/favorites/toggle','POST',400,favorite(invalid),true);
  const missing = await request('/favorites/toggle','POST',404,favorite(suffix),true);
  assert.deepEqual(missing,{success:false,message:'Product not found'});
  await request('/favorites/toggle','POST',200,favorite(product.id),true);
  const lines=[{productId:product.id,quantity:2,selection:{}}];
  await request('/cart','PUT',200,{items:lines,version:0},true);
  await request('/cart','PUT',409,{items:[],version:0},true);
  const {data:{order}}=await request('/orders','POST',201,{items:lines,shipping:{name:'QA',address:'Test',city:'Test',zip:'00000'}},true);
  assert.equal(order.total,25);
  // Checkout clears the purchased cart. Save a fresh cart to test restart persistence.
  const afterCheckout = await request('/cart','GET',200,null,true);
  assert.deepEqual(afterCheckout.data.items, []);
  const saved = await request('/cart','PUT',200,{items:[{...lines[0], quantity:1}],version:afterCheckout.data.version},true);
  const persistedCookie = sessionCookie;
  await stop();
  await start();
  sessionCookie = persistedCookie;
  assert.equal((await request('/auth/me','GET',200,null,true)).data.user.id,user.id);
  const restoredCart = await request('/cart','GET',200,null,true);
  assert.deepEqual(restoredCart.data.items.map(({productId,quantity,selection}) => ({productId,quantity,selection})),[{...lines[0],quantity:1}]);
  assert((await request('/favorites','GET',200,null,true)).data.favorites.some(f=>f.productId===product.id));
  assert.equal((await request('/orders/'+order.id,'GET',200,null,true)).data.order.total,25);
  assert.equal((await pg.product.findUniqueOrThrow({where:{id:product.id}})).stock,1);
  assert.equal((await request('/favorites/toggle','POST',200,favorite(product.id),true)).data.favorited,false);
  await request('/cart','PUT',200,{items:[],version:saved.data.version},true);
  await request('/admin/stats','GET',403,null,true);
  console.log('PASS restricted roles, favorites validation, signup/login, cart conflicts, checkout, restart, persistence and authorization.');
} finally {
  await stop();
  await mongo.close();
  await pg.$disconnect();
}
