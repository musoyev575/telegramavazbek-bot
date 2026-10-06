/**
 * Admin API marshrutlari.
 * Har bir marshrut `requireAdmin` orqali himoyalangan (login sahifasidan tashqari).
 */
import { Router } from 'express';
import authRoutes from './auth.js';
import productRoutes from './products.js';
import orderRoutes from './orders.js';
import statsRoutes from './stats.js';
import userRoutes from './users.js';
import promotionRoutes from './promotions.js';
import settingsRoutes from './settings.js';
import { requireAdmin } from '../auth.js';
import auditService from '../../services/auditService.js';
import config from '../../config/index.js';

const router = Router();

// Autentifikatsiya (login ochiq, qolganlari ichida himoyalangan)
router.use('/auth', authRoutes);

// Qolgan barcha endpointlar faqat administratorlar uchun
router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({
    ok: true,
    data: {
      admin: req.admin,
      features: config.features,
      shop: { currency: config.currency },
    },
  });
});

router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/stats', statsRoutes);
router.use('/users', userRoutes);
router.use('/promotions', promotionRoutes);
router.use('/settings', settingsRoutes);

router.get('/audit', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json({ ok: true, data: auditService.recent(limit) });
});

export default router;
