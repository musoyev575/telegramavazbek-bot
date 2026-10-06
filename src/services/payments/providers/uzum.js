/**
 * Uzum Bank — ARXITEKTURA TAYYOR, MERCHANT KALITLARI KUTILMOQDA.
 *
 * Ulash tartibi:
 *  1. .env: UZUM_MERCHANT_ID, UZUM_SECRET_KEY.
 *  2. Uzum Bank API'si orqali to'lov sessiyasi yaratiladi va havola qaytariladi.
 *  3. Webhook: POST /api/payments/uzum -> imzo tekshiriladi -> buyurtma 'paid' bo'ladi.
 */
const provider = {
  code: 'uzum',
  label: '🟣 Uzum Bank',
  enabled: false,
  online: true,
  soon: "Uzum Bank to'lovi tez orada ulanadi",

  instructions() {
    return "Uzum Bank to'lovi hozircha mavjud emas. Naqd yoki karta orqali to'lashingiz mumkin.";
  },

  createPayment() {
    // TODO: Uzum Bank integratsiyasi
    return { ok: false, reason: 'not_configured' };
  },

  handleCallback() {
    // TODO: Uzum Bank webhook logikasi
    return { ok: false, reason: 'not_configured' };
  },
};

export default provider;
