/**
 * Demo iPhone lineup (12–17).
 * Prices are DEMO sample amounts — not official Apple pricing.
 * Configuration (colors/storage/images) lives here for the API — frontend must not hardcode it.
 */

const img = {
  iphone12Blue: '/products/iphone-12-blue.png',
  iphone12White: '/products/iphone-12-white.png',
  iphone12Pro: '/products/iphone-12-pro.png',
  iphone13Blue: '/products/iphone-13-blue.png',
  iphone13Pink: '/products/iphone-13-pink.png',
  iphone13Pro: '/products/iphone-13-pro.png',
  iphone13ProGraphite: '/products/iphone-13-pro-graphite.png',
  iphone13ProGold: '/products/iphone-13-pro-gold.png',
  iphone13ProSierraBlue: '/products/iphone-13-pro-sierra-blue.png',
  iphone13ProSilver: '/products/iphone-13-pro-silver.png',
  iphone14: '/products/iphone-14.png',
  iphone14Pro: '/products/iphone-14-pro.png',
  iphone14ProMaxGold: '/products/iphone-14-pro-max-gold.png',
  iphone14ProMaxSpaceBlack: '/products/iphone-14-pro-max-space-black.png',
  iphone14ProMaxSilver: '/products/iphone-14-pro-max-silver.png',
  iphone14ProMaxBlue: '/products/iphone-14-pro-max-blue.png',
  iphone15Black: '/products/iphone-15-black.png',
  iphone15Green: '/products/iphone-15-green.png',
  iphone15ProBlue: '/products/iphone-15-pro-blue.png',
  iphone15ProBlack: '/products/iphone-15-pro-black.png',
  iphone16: '/products/iphone-16.jpg',
  iphone16ProDesert: '/products/iphone-16-pro-desert.png',
  iphone17Black: '/products/iphone-17-black.jpg',
  iphone17AirSpaceBlack: '/products/iphone-17-air-space-black.png',
  iphone17ProCosmicOrange: '/products/iphone-17-pro-cosmic-orange.jpg',
  iphone17ProDeepBlue: '/products/iphone-17-pro-deep-blue.png',
  iphone17ProSilver: '/products/iphone-17-pro-silver.png',
  iphone18ProMax: '/products/iphone-18-pro-max.png',
  iphone18ProMaxColors: '/products/iphone-18-pro-max-colors.png',
  iphone18ProMaxDeepPurple: '/products/iphone-18-pro-max-deep-purple.png',
  iphone18ProMaxBlack: '/products/iphone-18-pro-max-black.png',
  iphone18ProMaxSilver: '/products/iphone-18-pro-max-silver.png',
  iphone18ProMaxSkyBlue: '/products/iphone-18-pro-max-sky-blue.png',
  placeholder: '/products/placeholder-phone.svg',
};

const IPHONE_15_COLOR_IMAGES = {
  Black: img.iphone15Black,
  Green: img.iphone15Green,
};

const IPHONE_15_PRO_COLOR_IMAGES = {
  'Blue Titanium': img.iphone15ProBlue,
  'Black Titanium': img.iphone15ProBlack,
};

const IPHONE_16_PRO_COLOR_IMAGES = {
  'Desert Titanium': img.iphone16ProDesert,
};

const IPHONE_12_COLOR_IMAGES = {
  Blue: img.iphone12Blue,
  White: img.iphone12White,
};

const IPHONE_13_COLOR_IMAGES = {
  Pink: img.iphone13Pink,
  Blue: img.iphone13Blue,
};

const IPHONE_13_PRO_COLOR_IMAGES = {
  Graphite: img.iphone13ProGraphite,
  Gold: img.iphone13ProGold,
  'Sierra Blue': img.iphone13ProSierraBlue,
  Silver: img.iphone13ProSilver,
  'Alpine Green': img.iphone13Pro,
};

const IPHONE_14_PRO_MAX_COLOR_IMAGES = {
  'Deep Purple': img.iphone14Pro,
  'Space Black': img.iphone14ProMaxSpaceBlack,
  Gold: img.iphone14ProMaxGold,
  Silver: img.iphone14ProMaxSilver,
  Blue: img.iphone14ProMaxBlue,
};

const IPHONE_17_PRO_COLORS = ['Cosmic Orange', 'Deep Blue', 'Silver'];
const IPHONE_17_PRO_COLOR_IMAGES = {
  'Cosmic Orange': img.iphone17ProCosmicOrange,
  'Deep Blue': img.iphone17ProDeepBlue,
  Silver: img.iphone17ProSilver,
};

const IPHONE_18_PRO_MAX_COLORS = ['Deep Purple', 'Black', 'Silver', 'Sky Blue'];
const IPHONE_18_PRO_MAX_COLOR_IMAGES = {
  'Deep Purple': img.iphone18ProMaxDeepPurple,
  Black: img.iphone18ProMaxBlack,
  Silver: img.iphone18ProMaxSilver,
  'Sky Blue': img.iphone18ProMaxSkyBlue,
};

function roundRating(value) {
  return Math.round(Number(value) * 10) / 10;
}

function storagePricing(base, storage, step = 100) {
  return Object.fromEntries(storage.map((s, i) => [s, base + i * step]));
}

function phone({
  name,
  slug,
  price,
  compareAt,
  image,
  storage,
  colors,
  colorImages,
  storageStep = 100,
  featured = false,
  concept = false,
  stock = 30,
  description,
  rating,
}) {
  const defaultColor = colors?.[0];
  const hasColorMap = colorImages && Object.keys(colorImages).length > 0;
  const firstMappedImage = hasColorMap
    ? colors.map((c) => colorImages[c]).find(Boolean)
    : null;
  const primaryImage = hasColorMap
    ? colorImages[defaultColor] || image || firstMappedImage || img.placeholder
    : image || img.placeholder;

  const colorAdd = Object.fromEntries(colors.map((c) => [c, 0]));

  return {
    name,
    slug,
    description:
      description ||
      `${name} demo listing for VOLTENIQ search and catalog. ${
        concept
          ? 'Labeled Concept — not an official Apple product.'
          : 'Demo prices only — not official Apple pricing.'
      }`,
    category: 'iPhone',
    brand: 'Apple',
    price,
    compareAt: compareAt ?? price + 50,
    image: primaryImage,
    images: hasColorMap
      ? colors.map((c) => colorImages[c] || img.placeholder)
      : [primaryImage],
    colorImages: hasColorMap ? colorImages : null,
    variantImages: hasColorMap ? { color: colorImages } : null,
    colors,
    storage,
    ram: [],
    size: [],
    options: [
      { key: 'color', label: 'Color', values: [...colors] },
      { key: 'storage', label: 'Storage', values: [...storage] },
    ],
    concept: Boolean(concept),
    variantPricing: {
      absolute: { storage: storagePricing(price, storage, storageStep) },
      add: { color: colorAdd },
    },
    specs: {
      note: concept
        ? 'Concept demo model — unverified / not an official Apple product'
        : 'Demo listing — specifications are illustrative only',
      family: name.replace(/ (mini|Plus|Pro Max|Pro|Air)$/, '') || name,
    },
    stock,
    featured,
    rating:
      rating != null
        ? roundRating(rating)
        : roundRating(concept ? 4.5 : 4.6 + Math.min(0.3, (price % 100) / 300)),
    reviewCount: concept ? 42 : 120 + (price % 400),
  };
}

/** Real / demo shipping lineups only — no invented mini/Plus/Air combos */
export const iphoneProducts = [
  // iPhone 12 — Blue & White assets matched; other colors use placeholder when selected
  // Demo USD bands: 12–14 ≈ $500–$899 | 15–16 ≈ $699–$1,299 | 17 ≈ $899–$1,699
  phone({
    name: 'iPhone 12',
    slug: 'iphone-12',
    price: 529,
    storageStep: 50,
    image: img.iphone12Blue,
    storage: ['64GB', '128GB', '256GB'],
    colors: ['Blue', 'White', 'Black', 'Green', 'Red', 'Purple'],
    colorImages: { ...IPHONE_12_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 12 mini',
    slug: 'iphone-12-mini',
    price: 509,
    storageStep: 50,
    image: img.iphone12Blue,
    storage: ['64GB', '128GB', '256GB'],
    colors: ['Blue', 'White', 'Black', 'Green', 'Red', 'Purple'],
    colorImages: { ...IPHONE_12_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 12 Pro',
    slug: 'iphone-12-pro',
    price: 699,
    storageStep: 50,
    image: img.iphone12Pro,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Pacific Blue', 'Graphite', 'Silver', 'Gold'],
    colorImages: { 'Pacific Blue': img.iphone12Pro },
  }),
  phone({
    name: 'iPhone 12 Pro Max',
    slug: 'iphone-12-pro-max',
    price: 749,
    storageStep: 50,
    image: img.iphone12Pro,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Pacific Blue', 'Graphite', 'Silver', 'Gold'],
    colorImages: { 'Pacific Blue': img.iphone12Pro },
  }),

  phone({
    name: 'iPhone 13',
    slug: 'iphone-13',
    price: 549,
    storageStep: 50,
    image: img.iphone13Pink,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red', 'Green'],
    colorImages: { ...IPHONE_13_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 13 mini',
    slug: 'iphone-13-mini',
    price: 529,
    storageStep: 50,
    image: img.iphone13Pink,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red', 'Green'],
    colorImages: { ...IPHONE_13_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 13 Pro',
    slug: 'iphone-13-pro',
    price: 749,
    storageStep: 50,
    image: img.iphone13ProGraphite,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Graphite', 'Gold', 'Sierra Blue', 'Silver', 'Alpine Green'],
    colorImages: { ...IPHONE_13_PRO_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 13 Pro Max',
    slug: 'iphone-13-pro-max',
    price: 799,
    storageStep: 30,
    image: img.iphone13Pro,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Alpine Green', 'Graphite', 'Gold', 'Silver', 'Sierra Blue'],
    colorImages: { 'Alpine Green': img.iphone13Pro },
  }),

  phone({
    name: 'iPhone 14',
    slug: 'iphone-14',
    price: 599,
    storageStep: 50,
    image: img.iphone14,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Purple', 'Midnight', 'Starlight', 'Blue', 'Yellow', 'Red'],
    colorImages: { Purple: img.iphone14 },
  }),
  phone({
    name: 'iPhone 14 Plus',
    slug: 'iphone-14-plus',
    price: 649,
    storageStep: 50,
    image: img.iphone14,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Purple', 'Midnight', 'Starlight', 'Blue', 'Yellow', 'Red'],
    colorImages: { Purple: img.iphone14 },
  }),
  phone({
    name: 'iPhone 14 Pro',
    slug: 'iphone-14-pro',
    price: 799,
    storageStep: 30,
    image: img.iphone14Pro,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Deep Purple', 'Space Black', 'Silver', 'Gold'],
    colorImages: { 'Deep Purple': img.iphone14Pro },
  }),
  phone({
    name: 'iPhone 14 Pro Max',
    slug: 'iphone-14-pro-max',
    price: 849,
    storageStep: 16,
    image: img.iphone14Pro,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Deep Purple', 'Space Black', 'Gold', 'Silver', 'Blue'],
    colorImages: { ...IPHONE_14_PRO_MAX_COLOR_IMAGES },
  }),

  phone({
    name: 'iPhone 15',
    slug: 'iphone-15',
    price: 699,
    storageStep: 100,
    image: img.iphone15Black,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Black', 'Green', 'Blue', 'Yellow', 'Pink'],
    colorImages: { ...IPHONE_15_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 15 Plus',
    slug: 'iphone-15-plus',
    price: 799,
    storageStep: 100,
    image: img.iphone15Black,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Black', 'Green', 'Blue', 'Yellow', 'Pink'],
    colorImages: { ...IPHONE_15_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    price: 999,
    storageStep: 100,
    image: img.iphone15ProBlue,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Blue Titanium', 'Black Titanium', 'White Titanium', 'Natural Titanium'],
    colorImages: { ...IPHONE_15_PRO_COLOR_IMAGES },
  }),
  phone({
    name: 'iPhone 15 Pro Max',
    slug: 'iphone-15-pro-max',
    price: 1099,
    storageStep: 100,
    image: img.iphone15ProBlue,
    storage: ['256GB', '512GB', '1TB'],
    colors: ['Blue Titanium', 'Black Titanium', 'White Titanium', 'Natural Titanium'],
    colorImages: { ...IPHONE_15_PRO_COLOR_IMAGES },
  }),

  phone({
    name: 'iPhone 16',
    slug: 'iphone-16',
    price: 799,
    storageStep: 100,
    image: img.iphone16,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
    colorImages: { Black: img.iphone16 },
    featured: true,
  }),
  phone({
    name: 'iPhone 16 Plus',
    slug: 'iphone-16-plus',
    price: 899,
    storageStep: 100,
    image: img.iphone16,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
    colorImages: { Black: img.iphone16 },
  }),
  phone({
    name: 'iPhone 16 Pro',
    slug: 'iphone-16-pro',
    price: 1099,
    storageStep: 66,
    image: img.iphone16ProDesert,
    storage: ['128GB', '256GB', '512GB', '1TB'],
    colors: ['Desert Titanium', 'Black Titanium', 'White Titanium', 'Natural Titanium'],
    colorImages: { ...IPHONE_16_PRO_COLOR_IMAGES },
    featured: true,
  }),
  phone({
    name: 'iPhone 16 Pro Max',
    slug: 'iphone-16-pro-max',
    price: 1199,
    storageStep: 50,
    image: img.iphone16ProDesert,
    storage: ['256GB', '512GB', '1TB'],
    colors: ['Desert Titanium', 'Black Titanium', 'White Titanium', 'Natural Titanium'],
    colorImages: { ...IPHONE_16_PRO_COLOR_IMAGES },
  }),

  phone({
    name: 'iPhone 17',
    slug: 'iphone-17',
    price: 899,
    storageStep: 100,
    image: img.iphone17Black,
    storage: ['128GB', '256GB', '512GB'],
    colors: ['Black', 'White', 'Sage', 'Lavender', 'Mist Blue'],
    colorImages: { Black: img.iphone17Black },
    featured: true,
  }),
  phone({
    name: 'iPhone 17 Air',
    slug: 'iphone-17-air',
    price: 1099,
    storageStep: 100,
    image: img.iphone17AirSpaceBlack,
    storage: ['256GB', '512GB', '1TB'],
    colors: ['Space Black', 'Cloud White', 'Sky Blue', 'Light Gold'],
    colorImages: { 'Space Black': img.iphone17AirSpaceBlack },
  }),
  phone({
    name: 'iPhone 17 Pro',
    slug: 'iphone-17-pro',
    price: 1299,
    storageStep: 100,
    image: IPHONE_17_PRO_COLOR_IMAGES['Cosmic Orange'],
    storage: ['256GB', '512GB', '1TB'],
    colors: [...IPHONE_17_PRO_COLORS],
    colorImages: { ...IPHONE_17_PRO_COLOR_IMAGES },
    rating: 4.9,
  }),
  phone({
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
    price: 1499,
    storageStep: 66,
    image: IPHONE_17_PRO_COLOR_IMAGES['Cosmic Orange'],
    storage: ['256GB', '512GB', '1TB', '2TB'],
    colors: [...IPHONE_17_PRO_COLORS],
    colorImages: { ...IPHONE_17_PRO_COLOR_IMAGES },
    featured: true,
    rating: 4.9,
  }),

  phone({
    name: 'iPhone 18 Pro Max',
    slug: 'iphone-18-pro-max',
    price: 1599,
    compareAt: 1799,
    storageStep: 100,
    image: img.iphone18ProMaxDeepPurple,
    storage: ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'],
    colors: [...IPHONE_18_PRO_MAX_COLORS],
    colorImages: { ...IPHONE_18_PRO_MAX_COLOR_IMAGES },
    concept: true,
    featured: true,
    rating: 4.9,
    description:
      'iPhone 18 Pro Max concept demo for VOLTENIQ. Choose Deep Purple, Black, Silver, or Sky Blue with storage from 64GB to 2TB — DEMO prices only, not an official Apple product.',
  }),
];
