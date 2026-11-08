import { isDeepStrictEqual } from 'node:util';
import { MongoClient } from 'mongodb';
import '../config.js';

const string = { bsonType: 'string', minLength: 1 };
const number = { bsonType: ['int', 'long', 'double', 'decimal'], minimum: 0 };
export const variantKeys = ['color', 'storage', 'ram', 'size', 'chip', 'connectivity', 'material', 'band', 'model', 'case', 'compatible'];
const selection = { bsonType: 'object', additionalProperties: false,
  properties: Object.fromEntries(variantKeys.map(key => [key, { ...string, maxLength: 120 }])) };
function schema(properties) {
  return { $jsonSchema: { bsonType: 'object', required: Object.keys(properties), properties } };
}
const line = { bsonType: 'object', additionalProperties: false, required: ['productId','quantity','selection'],
  properties: { productId: string, quantity: { bsonType: 'int', minimum: 1, maximum: 999 }, selection } };
const snapshot = { _id: string, generation: string };
const specs = {
  products: [schema({ ...snapshot, name: string, slug: string, category: string, price: number, stock: number }), { category: 1, name: 1 }],
  categories: [schema({ ...snapshot, id: string, name: string, description: string, icon: string, position: number }), { position: 1 }],
  favorites: [schema({ ...snapshot, userId: string, productId: string }), { userId: 1, productId: 1 }],
  demoOrders: [schema({ ...snapshot, userId: string, status: string, total: number, createdAt: { bsonType: 'date' },
    items: { bsonType: 'array', items: { bsonType: 'object', required: ['productId','quantity','price'],
      properties: { productId: string, quantity: { bsonType: 'int', minimum: 1 }, price: number } } } }), { userId: 1, createdAt: -1 }],
  carts: [schema({ _id: string, version: { bsonType: 'int', minimum: 1 }, updatedAt: { bsonType: 'date' },
    items: { bsonType: 'array', maxItems: 100, items: line } }), null],
};

let connection;
let retryAfter = 0;
export function mongoConfigured() {
  return Boolean(process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('<db_password>'));
}
export function unavailable() {
  return Object.assign(new Error('MongoDB storage is unavailable.'), { status: 503 });
}
export function createMongoClient(uri = process.env.MONGODB_URI) {
  if (!uri || uri.includes('<db_password>')) throw new Error('MONGODB_URI is missing or contains the password placeholder.');
  const parsed = new URL(uri);
  const localTest = parsed.protocol === 'mongodb:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'mongodb+srv:' && !localTest)
    throw new Error('Expected an Atlas SRV URI or local test connection.');
  return new MongoClient(uri, { serverSelectionTimeoutMS: 4000, connectTimeoutMS: 4000, socketTimeoutMS: 10000, maxPoolSize: 8 });
}
export async function initializeCollections(db) {
  for (const [name, [validator, index]] of Object.entries(specs)) {
    try { await db.createCollection(name, { validator }); }
    catch (err) {
      if (err.code !== 48) throw err;
      const existing = await db.listCollections({ name }).next();
      if (!isDeepStrictEqual(existing?.options?.validator, validator)) throw unavailable();
    }
    if (index) await db.collection(name).createIndex(index);
  }
}
async function connect() {
  let client;
  try {
    client = createMongoClient();
    await client.connect();
    const db = client.db('volteniq_store');
    await db.command({ ping: 1 });
    return { client, db };
  } catch {
    await client?.close().catch(() => {});
    throw unavailable();
  }
}
export async function mongo() {
  if (!mongoConfigured() || Date.now() < retryAfter) throw unavailable();
  connection ??= connect().catch(error => {
    connection = undefined;
    retryAfter = Date.now() + 15000;
    throw error;
  });
  return connection;
}
export async function closeMongo() {
  const connected = await connection;
  connection = undefined;
  await connected?.client.close();
}
