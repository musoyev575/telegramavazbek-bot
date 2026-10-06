/**
 * Buyurtmalar API: ro'yxat, batafsil, statusni o'zgartirish.
 * Status o'zgarishi mijozga Telegram orqali ham yuboriladi (bot ishlab turgan bo'lsa).
 */
import { Router } from 'express';
import orderService from '../../services/orderService.js';
import auditService from '../../services/auditService.js';
import { notifyStatusChange, notifyUser } from '../../bot/notifications.js';
import { ORDER_STATUS, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, PAGE_SIZE } from '../../config/constants.js';
import { clean, isPositiveInt } from '../../utils/validate.js';

const router = Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(200, Number(req.query.perPage) || PAGE_SIZE.ADMIN);
  const status = req.query.status && ORDER_STATUS[String(req.query.status).toUpperCase()] ? req.query.status : null;

  const result = orderService.listOrders({ status, query: clean(req.query.q, 60), page, perPage });
  res.json({
    ok: true,
    data: {
      ...result,
      statuses: Object.values(ORDER_STATUS).map((code) => ({ code, label: ORDER_STATUS_LABEL[code] })),
    },
  });
});

router.get('/:id', (req, res) => {
  const order = orderService.getOrder(Number(req.params.id));
  if (!order) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Buyurtma topilmadi' } });
    return;
  }
  res.json({
    ok: true,
    data: {
      ...order,
      allowedTransitions: ORDER_STATUS_FLOW[order.status] ?? [],
      statusLabel: ORDER_STATUS_LABEL[order.status] ?? order.status,
    },
  });
});

router.patch('/:id/status', async (req, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = clean(req.body?.status, 32);
  const comment = clean(req.body?.comment, 200) || null;

  if (!isPositiveInt(orderId, { min: 1 })) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Buyurtma ID noto‘g‘ri' } });
    return;
  }
  if (!Object.values(ORDER_STATUS).includes(nextStatus)) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Status noto‘g‘ri' } });
    return;
  }

  const result = orderService.changeStatus(orderId, nextStatus, {
    adminId: req.admin.id,
    changedBy: `admin:${req.admin.username}`,
    comment,
  });

  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 400;
    const message =
      result.reason === 'invalid_transition'
        ? `Bu holatga o‘tish mumkin emas (${result.from} → ${result.to})`
        : 'Buyurtma topilmadi';
    res.status(status).json({ ok: false, error: { code: result.reason, message } });
    return;
  }

  auditService.log({
    actor: req.admin.username,
    action: 'order_status_changed',
    entity: 'order',
    entityId: orderId,
    details: { from: result.previousStatus ?? null, to: nextStatus, comment },
    ip: req.ip,
  });

  // Mijozga va boshqa adminlarga xabar (bot ishlab turgan bo'lsa)
  if (!result.unchanged) {
    await notifyStatusChange(null, result.order, { previousStatus: result.previousStatus });
    await notifyUser(null, result.order, result.order.status);
  }

  res.json({
    ok: true,
    data: {
      ...result.order,
      allowedTransitions: ORDER_STATUS_FLOW[result.order.status] ?? [],
    },
  });
});

export default router;
