import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getUnitPrice } from '../utils/pricing.js';
import { getProductById, listProducts } from '../services/productService.js';

const router = Router();
const script = fileURLToPath(new URL('../../../ai_python/main.py', import.meta.url));
let running = 0;

router.post('/', asyncHandler(async (req, res) => {
  const message = req.body?.message;
  const photo = req.body?.photo;
  if (photo !== undefined && (typeof photo !== 'string' || !photo.length || photo.length > 350000)) {
    return res.status(400).json({ message: 'Choose a smaller photo.' });
  }
  if (photo === undefined && (typeof message !== 'string' || !message.trim() || message.length > 4000)) {
    return res.status(400).json({ message: 'Enter a message of up to 4000 characters.' });
  }
  if (running >= 3) return res.status(503).json({ message: 'The assistant is busy. Try again shortly.' });
  running++;
  try {
    let payload;
    if (req.body.productId !== undefined) {
      const { productId, selections = {} } = req.body;
      if (typeof productId !== 'string' || !selections || typeof selections !== 'object' || Array.isArray(selections) ||
          Object.values(selections).some(value => typeof value !== 'string' || value.length > 150) || typeof message !== 'string') {
        return res.status(400).json({ message: 'Invalid product configuration.' });
      }
      const product = await getProductById(productId);
      if (!product) return res.status(404).json({ message: 'Product not found.' });
      payload = { message, product: { ...product, selections, unitPrice: getUnitPrice(product, selections) } };
    } else {
      const { products } = await listProducts();
      const catalog = products.map(({ name, category, description, price, stock, image, slug }) => ({ name, category, description, price, stock, image, slug }));
      payload = { message, photo, products: catalog };
    }
    const output = await new Promise((resolve, reject) => {
      const child = execFile(process.env.PYTHON_BIN || 'python', ['-X', 'utf8', script], {
        timeout: 12000, windowsHide: true
      }, (err, stdout) => err ? reject(new Error('Python recommender unavailable')) : resolve(stdout));
      child.stdin.on('error', reject);
      child.stdin.end(JSON.stringify(payload));
    });
    const data = JSON.parse(output);
    if (data.error) return res.status(400).json({ message: data.error });
    res.json({ success: true, data });
  } finally {
    running--;
  }
}));

export default router;
