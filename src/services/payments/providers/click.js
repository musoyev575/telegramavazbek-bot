/**
 * Click (click.uz) — ARXITEKTURA TAYYOR, MERCHANT KALITLARI KUTILMOQDA.
 *
 * Ulash tartibi (keyingi bosqich):
 *  1. .env ga CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY qo'shiladi.
 *  2. `createPayment` da Click'ning "Prepare/Complete" API'siga so'rov yuborilib,
 *     foydalanuvchiga to'lov havolasi qaytariladi.
 *  3. `src/admin/routes/payments.js` da webhook endpointi ochiladi:
 *     POST /api/payments/click/prepare  va  POST /api/payments/click/complete
 *  4. `handleCallback` imzoni (sign_string) tekshiradi va `orderService.setPaymentStatus`
 *     orqali buyurtmani 'paid' holatiga o'tkazadi.
 */
const provider = {
  code: 'click',
  label: '🟢 Click',
  enabled: false,
  online: true,
  soon: "Click to'lovi tez orada ulanadi",

  instructions() {
    return "Click to'lovi hozircha mavjud emas. Naqd yoki karta orqali to'lashingiz mumkin.";
  },

  createPayment() {
    // TODO: Click API integratsiyasi (merchant kalitlari .env da bo'lganda)
    return { ok: false, reason: 'not_configured' };
  },

  handleCallback() {
    // TODO: sign_string tekshiruvi va buyurtmani to'langan deb belgilash
    return { ok: false, reason: 'not_configured' };
  },
};

export default provider;
