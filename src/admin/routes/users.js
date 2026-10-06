/**
 * Foydalanuvchilar API: ro'yxat, batafsil (buyurtmalari bilan), bloklash.
 */
import { Router } from 'express';
import userModel from '../../models/userModel.js';
import orderService from '../../services/orderService.js';
import auditService from '../../services/auditService.js';
import { PAGE_SIZE } from '../../config/constants.js';
import { clean } from '../../utils/validate.js';

const router = Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(200, Number(req.query.perPage) || PAGE_SIZE.ADMIN);
  const result = userModel.list({
    query: clean(req.query.q, 60),
    onlyWithOrders: req.query.withOrders === '1',
    page,
    perPage,
  });
  res.json({ ok: true, data: result });
});

router.get('/:id', (req, res) => {
  const user = userModel.findById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Foydalanuvchi topilmadi' } });
    return;
  }

  const { items: orders } = orderService.getUserOrders(user.id, { page: 1, perPage: 10 });
  res.json({ ok: true, data: { ...user, orders } });
});

router.patch('/:id/block', (req, res) => {
  const user = userModel.findById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Foydalanuvchi topilmadi' } });
    return;
  }

  const blocked = Boolean(req.body?.blocked);
  userModel.setBlocked(user.id, blocked);
  auditService.log({
    actor: req.admin.username,
    action: blocked ? 'user_blocked' : 'user_unblocked',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
  });

  res.json({ ok: true, data: { ...userModel.findById(user.id), blocked } });
});

export default router;
