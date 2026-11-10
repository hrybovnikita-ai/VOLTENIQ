const photo = file => '/products/desktop/' + file;
const layouts = ['US English', 'British English'];
const labels = { color: 'Color', chip: 'Processor', storage: 'SSD storage', ram: 'Unified memory', layout: 'Keyboard layout' };

function listing({ name, slug, category, description, finishes, storagePrices = {}, upgrades = {}, specs, price }) {
  const colors = Object.keys(finishes);
  const storage = Object.keys(storagePrices);
  const groups = { color: colors, ...Object.fromEntries(Object.entries(upgrades).map(([key, prices]) => [key, Object.keys(prices)])) };
  if (storage.length) groups.storage = storage;
  const images = Object.values(finishes).map(photo);
  return {
    name, slug, category, description, specs, colors, storage, chip: groups.chip || [], ram: groups.ram || [],
    price: price ?? storagePrices[storage[0]], brand: 'Apple', stock: 20, reviewCount: 0,
    image: images[0], images, colorImages: Object.fromEntries(colors.map((color, i) => [color, images[i]])),
    options: Object.entries(groups).map(([key, values]) => ({ key, label: labels[key], values })),
    variantPricing: { absolute: { storage: storagePrices }, add: upgrades },
  };
}

const finishes = { Blue: 'blue.png', Silver: 'silver.png', Green: 'green.png', Pink: 'pink.png', Orange: 'orange.png', Purple: 'purple.png', Yellow: 'yellow.jpg' };

function imac(ports, cores, base, ram, capacities) {
  return listing({
    name: '24-inch iMac M4 · ' + cores + '-core', slug: 'imac-m4-' + ports + '-port', category: 'iMac', finishes,
    description: 'An all-in-one Mac with a 4.5K Retina display, a 12MP Center Stage camera and a six-speaker sound system.',
    specs: { Display: '4480 × 2520 pixels, 500 nits, P3 wide color', Processor: 'M4 · ' + cores + '-core CPU and GPU', Ports: ports + ' Thunderbolt 4 ports', Wireless: 'Wi-Fi 6E and Bluetooth 5.3' },
    storagePrices: Object.fromEntries(capacities.map((capacity, index) => [capacity, base * 2 ** index])),
    upgrades: { ram },
  });
}

const studio = {
  category: 'Mac Studio', finishes: { Silver: 'studio.jpg' },
  specs: { Network: '10Gb Ethernet', Expansion: 'Four rear Thunderbolt 5 ports, HDMI, two USB-A ports and SDXC', Finish: 'Silver aluminum' },
};
const keyboardLayouts = Object.fromEntries(layouts.map(layout => [layout, 0]));
function accessory(name, slug, price, description, finishes, upgrades = {}) {
  return listing({ name, slug, price, description, finishes, upgrades, category: 'Accessories', specs: { Connection: 'Bluetooth', Charging: 'USB-C' } });
}

export const desktopProducts = [
  listing({
    name: 'Apple Mac Pro Tower', slug: 'apple-mac-pro-tower', category: 'Mac Pro',
    description: 'A silver Apple desktop tower with a perforated front panel and integrated carrying handles.',
    price: 69000, finishes: { Silver: 'mac-pro-tower.png' },
    specs: { Finish: 'Silver', Form: 'Desktop tower' },
  }),
  imac(2, 8, 1299, { '16GB': 0, '24GB': 200 }, ['256GB', '512GB', '1TB']),
  imac(4, 10, 1499, { '16GB': 0, '24GB': 200, '32GB': 400 }, ['256GB', '512GB', '1TB', '2TB']),
  listing({ ...studio, name: 'Mac Studio · M4 Max', slug: 'mac-studio-m4-max',
    description: 'A compact production desktop with a 40-core GPU, hardware ray tracing and dedicated ProRes encode and decode engines.',
    upgrades: { chip: { 'M4 Max · 16-core CPU / 40-core GPU': 0 }, ram: { '48GB': 0, '64GB': 200, '128GB': 1000 } },
    storagePrices: { '512GB': 2499, '1TB': 2699, '2TB': 3099, '4TB': 3699, '8TB': 4899 } }),
  listing({ ...studio, name: 'Mac Studio · M3 Ultra', slug: 'mac-studio-m3-ultra',
    description: 'A workstation for large video timelines and GPU rendering with a 32-core Neural Engine and support for up to eight displays.',
    upgrades: { chip: { 'M3 Ultra · 28-core CPU / 60-core GPU': 0, 'M3 Ultra · 32-core CPU / 80-core GPU': 1500 }, ram: { '96GB': 0, '256GB': 2000 } },
    storagePrices: { '1TB': 3999, '2TB': 4399, '4TB': 4999, '8TB': 6199, '16TB': 8599 } }),
  accessory('Magic Keyboard', 'magic-keyboard', 99, 'A compact rechargeable wireless keyboard with a low-profile scissor mechanism.', { White: 'keyboard.png' }, { layout: keyboardLayouts }),
  accessory('Magic Keyboard with Touch ID and Numeric Keypad', 'magic-keyboard-touch-id', 179, 'An extended keyboard with biometric sign-in for Apple silicon Macs, full-size arrow keys and a numeric keypad.', { White: 'keyboard-white.jpg', Black: 'keyboard-black.jpg' }, { layout: keyboardLayouts, color: { White: 0, Black: 20 } }),
  accessory('Magic Mouse', 'magic-mouse', 79, 'A wireless mouse with a Multi-Touch surface for scrolling and swiping.', { White: 'mouse-white.jpg', Black: 'mouse-black.jpg' }, { color: { White: 0, Black: 20 } }),
  accessory('Magic Trackpad', 'magic-trackpad', 129, 'A glass Multi-Touch trackpad with Force Touch, pressure sensing and haptic feedback.', { White: 'trackpad-white.jpg', Black: 'trackpad-black.jpg' }, { color: { White: 0, Black: 20 } }),
];
