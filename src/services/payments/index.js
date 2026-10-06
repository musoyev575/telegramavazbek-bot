/**
 * To'lov tizimi registri.
 *
 * Arxitektura: har bir to'lov usuli alohida "provider" moduli. Yangi provayder qo'shish uchun
 * `providers/` papkasiga fayl qo'shib, quyidagi interfeysni amalga oshirish kifoya:
 *
 *   {
 *     code: 'click',
 *     label: 'Click',
 *     enabled: boolean,          // interfeysda ko'rinadimi
 *     online: boolean,           // avtomatik (webhook bilan) tasdiqlanadimi
 *     instructions(order) -> string,
 *     createPayment(order) -> { ok, paymentId?, requiresManualConfirmation?, reason? },
 *     handleCallback(payload) -> { ok, orderId?, status?, externalId? }
 *   }
 *
 * Hozircha Click / Payme / Uzum "stub" holatida: ular `enabled: false` va interfeysda
 * "tez orada" deb ko'rinadi. Merchant kalitlari .env orqali beriladi.
 */
import { getDb } from '../../database/db.js';
import cashProvider from './providers/cash.js';
import cardProvider from './providers/card.js';
import clickProvider from './providers/click.js';
import paymeProvider from './providers/payme.js';
import uzumProvider from './providers/uzum.js';
import { PAYMENT_METHOD } from '../../config/constants.js';

const registry = new Map([
  [PAYMENT_METHOD.CASH, cashProvider],
  [PAYMENT_METHOD.CARD, cardProvider],
  [PAYMENT_METHOD.CLICK, clickProvider],
  [PAYMENT_METHOD.PAYME, paymeProvider],
  [PAYMENT_METHOD.UZUM, uzumProvider],
]);

export function getProvider(code) {
  return registry.get(code) ?? null;
}

export function listProviders({ enabledOnly = false } = {}) {
  return [...registry.values()].filter((provider) => (enabledOnly ? provider.enabled : true));
}

/** To'lov yozuvini bazaga qo'shadi (payments jadvali) */
export function recordPayment({ orderId, provider, amount, status = 'pending', externalId = null, payload = null }) {
  const info = getDb()
    .prepare(
      `INSERT INTO payments (order_id, provider, amount, status, external_id, payload, paid_at)
       VALUES (@orderId, @provider, @amount, @status, @externalId, @payload, @paidAt)`,
    )
    .run({
      orderId,
      provider,
      amount,
      status,
      externalId,
      payload: payload ? JSON.stringify(payload) : null,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
    });
  return Number(info.lastInsertRowid);
}

export function paymentsForOrder(orderId) {
  return getDb().prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC').all(orderId);
}

export default { getProvider, listProviders, recordPayment, paymentsForOrder };
