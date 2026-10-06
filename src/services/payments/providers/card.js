/**
 * Karta orqali o'tkazma (karta raqamiga pul o'tkazish).
 * To'lov tasdiqlanishi operator tomonidan qo'lda belgilanadi.
 */
const provider = {
  code: 'card',
  label: '💳 Karta orqali o‘tkazma',
  enabled: true,
  online: false,

  instructions(order) {
    return [
      "Karta raqami: <code>8600 1234 5678 9012</code> (Telefon Store MChJ)",
      `To'lov summasi: <b>${order.total.toLocaleString('ru-RU')} so'm</b>`,
      `Izoh (comment) qismiga buyurtma raqamini yozing: <code>${order.order_number}</code>`,
    ].join('\n');
  },

  createPayment(_order) {
    return { ok: true, requiresManualConfirmation: true };
  },

  handleCallback() {
    return { ok: false, reason: 'Karta o‘tkazmasi webhook orqali tasdiqlanmaydi' };
  },
};

export default provider;
