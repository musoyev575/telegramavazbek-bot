/**
 * Statistika API: dashboard, savdo grafigi, eng ko'p sotilgan mahsulotlar.
 */
import { Router } from 'express';
import statsService from '../../services/statsService.js';
import orderService from '../../services/orderService.js';

const router = Router();

router.get('/dashboard', (_req, res) => {
  const { items: recentOrders } = orderService.listOrders({ page: 1, perPage: 6 });
  res.json({
    ok: true,
    data: {
      ...statsService.dashboard(),
      recentOrders,
    },
  });
});

router.get('/revenue', (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  res.json({ ok: true, data: { series: statsService.revenueSeries(days), days } });
});

router.get('/top-products', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  res.json({ ok: true, data: statsService.topProducts(limit) });
});

router.get('/statuses', (_req, res) => {
  res.json({ ok: true, data: statsService.ordersByStatus() });
});

export default router;
