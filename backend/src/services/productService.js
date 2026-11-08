import { mongo, mongoConfigured } from '../db/mongo.js';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore, clone } from '../db/demoStore.js';
import { categories } from '../data/products.js';

function tokenize(search) {
  return String(search || '')
    .toLowerCase()
    .trim()
    .split(/[\s/+_-]+/)
    .filter(Boolean);
}

function matchesSearch(product, search) {
  const tokens = tokenize(search);
  if (!tokens.length) return true;
  const hay = `${product.name} ${product.category} ${product.brand} ${product.slug || ''}`.toLowerCase();
  // Every token must appear (supports "17 Pro", "iPhone 12 Pro Max")
  return tokens.every((token) => hay.includes(token));
}

function rankSuggestion(product, search) {
  const q = String(search || '').toLowerCase().trim();
  const name = product.name.toLowerCase();
  let score = 0;
  if (name === q) score += 100;
  if (name.startsWith(q)) score += 50;
  if (name.includes(q)) score += 20;
  tokenize(search).forEach((token) => {
    if (name.includes(token)) score += 5;
  });
  // Prefer newer / higher generation loosely via price + name digits
  const gen = Number((name.match(/iphone\s+(\d+)/) || [])[1] || 0);
  score += gen;
  if (product.featured) score += 2;
  return score;
}

function applyFilters(products, query) {
  let result = [...products];
  const { search, category, minPrice, maxPrice, featured, sort } = query;

  if (search) {
    result = result.filter((p) => matchesSearch(p, search));
  }

  if (category && category !== 'all') {
    result = result.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (minPrice !== undefined && minPrice !== '') {
    result = result.filter((p) => p.price >= Number(minPrice));
  }

  if (maxPrice !== undefined && maxPrice !== '') {
    result = result.filter((p) => p.price <= Number(maxPrice));
  }

  if (featured === 'true') {
    result = result.filter((p) => p.featured);
  }

  switch (sort) {
    case 'price-asc':
      result.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      result.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
    default:
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
  }

  return result;
}

export async function listProducts(query = {}) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const filtered = applyFilters(store.products, query);
    return {
      products: filtered,
      total: filtered.length,
      categories,
    };
  }

  const where = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.category && query.category !== 'all') {
    where.category = { equals: query.category, mode: 'insensitive' };
  }
  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = Number(query.minPrice);
    if (query.maxPrice) where.price.lte = Number(query.maxPrice);
  }
  if (query.featured === 'true') where.featured = true;

  const orderBy = {};
  switch (query.sort) {
    case 'price-asc':
      orderBy.price = 'asc';
      break;
    case 'price-desc':
      orderBy.price = 'desc';
      break;
    case 'name-asc':
      orderBy.name = 'asc';
      break;
    case 'name-desc':
      orderBy.name = 'desc';
      break;
    case 'rating':
      orderBy.rating = 'desc';
      break;
    default:
      orderBy.createdAt = 'desc';
  }

  const products = await prisma.product.findMany({ where, orderBy });
  return { products, total: products.length, categories };
}

export async function getProductById(id) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.products.find((p) => p.id === id || p.slug === id) || null;
  }
  const byId = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  return byId;
}

export async function getProductsByIds(ids = []) {
  if (!ids.length) return [];
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.products.filter((p) => ids.includes(p.id));
  }
  return prisma.product.findMany({ where: { id: { in: ids } } });
}

export async function createProduct(data) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const product = {
      id: createId(),
      brand: 'Apple',
      images: data.images || [data.image],
      colors: data.colors || [],
      storage: data.storage || [],
      specs: data.specs || {},
      stock: data.stock ?? 25,
      featured: Boolean(data.featured),
      rating: data.rating ?? 4.5,
      reviewCount: data.reviewCount ?? 0,
      compareAt: data.compareAt ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    store.products.unshift(product);
    return product;
  }
  return prisma.product.create({ data });
}

export async function updateProduct(id, data) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const index = store.products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    store.products[index] = {
      ...store.products[index],
      ...clone(data),
      updatedAt: new Date().toISOString(),
    };
    return store.products[index];
  }
  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const index = store.products.findIndex((p) => p.id === id);
    if (index === -1) return false;
    store.products.splice(index, 1);
    return true;
  }
  await prisma.product.delete({ where: { id } });
  return true;
}

export async function getFeaturedProducts() {
  const { products } = await listProducts({ featured: 'true' });
  return products.slice(0, 8);
}

export async function suggestProducts(search = '', limit = 8) {
  const q = String(search || '').trim();
  if (!q) {
    return { products: [], total: 0, query: q };
  }

  const max = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const { products } = await listProducts({ search: q, sort: 'name-asc' });
  const ranked = [...products].sort(
    (a, b) => rankSuggestion(b, q) - rankSuggestion(a, q) || a.name.localeCompare(b.name)
  );

  return {
    products: ranked.slice(0, max).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      price: p.price,
      image: p.image,
      concept: Boolean(p.concept),
      stock: p.stock,
    })),
    total: ranked.length,
    query: q,
  };
}

export async function getCategories() {
  if (mongoConfigured()) {
    try {
      const { db } = await mongo();
      const rows = await db.collection('categories').find({}, { projection: { _id: 0, generation: 0, position: 0 } }).sort({ position: 1 }).toArray();
      if (rows.length) return rows;
    } catch {
      // The built-in catalog taxonomy is available during Atlas outages.
    }
  }
  return categories;
}
