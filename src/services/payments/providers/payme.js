/**
 * Payme (payme.uz) — ARXITEKTURA TAYYOR, MERCHANT KALITLARI KUTILMOQDA.
 *
 * Ulash tartibi:
 *  1. .env: PAYME_MERCHANT_ID, PAYME_SECRET_KEY.
 *  2. Payme JSON-RPC metodlari: CheckPerformTransaction, CreateTransaction,
 *     PerformTransaction, CancelTransaction, CheckTransaction, GetStatement.
 *  3. `src/admin/routes/payments.js` da POST /api/payments/payme endpointi ochiladi;
 *     Basic auth (Payme:kalit) tekshiriladi.
 *  4. PerformTransaction -> `orderService.setPaymentStatus(orderId, 'paid', {...})`.
 */
const provider = {
  code: 'payme',
  label: '🔵 Payme',
  enabled: false,
  online: true,
  soon: "Payme to'lovi tez orada ulanadi",

  instructions() {
    return "Payme to'lovi hozircha mavjud emas. Naqd yoki karta orqali to'lashingiz mumkin.";
  },

  createPayment() {
    // TODO: Payme JSON-RPC integratsiyasi
    return { ok: false, reason: 'not_configured' };
  },

  handleCallback() {
    // TODO: Payme JSON-RPC webhook logikasi
    return { ok: false, reason: 'not_configured' };
  },
};

export default provider;
