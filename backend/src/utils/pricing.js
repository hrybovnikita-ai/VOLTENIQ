/** Mirror of frontend demo variant pricing — unit price only (no quantity). */

const ABSOLUTE_PRIORITY = [
  'storage',
  'size',
  'chip',
  'model',
  'case',
  'connectivity',
];

export function getUnitPrice(product, selections = {}) {
  if (!product) return 0;

  const pricing = product.variantPricing || {};
  const absolute = pricing.absolute || {};
  const add = pricing.add || {};

  let unit = Number(product.price) || 0;
  let usedAbsolute = false;

  for (const key of ABSOLUTE_PRIORITY) {
    const selected = selections[key];
    if (selected != null && absolute[key]?.[selected] != null) {
      unit = Number(absolute[key][selected]);
      usedAbsolute = true;
      break;
    }
  }

  if (!usedAbsolute) {
    for (const [key, table] of Object.entries(absolute)) {
      const selected = selections[key];
      if (selected != null && table?.[selected] != null) {
        unit = Number(table[selected]);
        usedAbsolute = true;
        break;
      }
    }
  }

  for (const [key, table] of Object.entries(add)) {
    const selected = selections[key];
    if (selected != null && table?.[selected] != null) {
      if (key === 'size' && usedAbsolute && absolute.size?.[selected] != null) continue;
      if (key === 'storage' && absolute.storage?.[selected] != null) continue;
      unit += Number(table[selected]);
    }
  }

  return Math.round(unit * 100) / 100;
}

export function clampQuantity(quantity, stock = 1) {
  const max = Math.max(1, Number(stock) || 1);
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return 1;
  return Math.min(max, Math.max(1, Math.floor(qty)));
}
