/**
 * Naqd to'lov (yetkazib berishda to'lanadi). Onlayn tasdiqlash yo'q — operator
 * "To'landi" statusini qo'lda qo'yadi.
 */
const provider = {
  code: 'cash',
  label: '💵 Naqd (yetkazilganda)',
  enabled: true,
  online: false,

  instructions(order) {
    return `Buyurtma yetkazilganda kuryerga ${order.total.toLocaleString('ru-RU')} so'm naqd to'laysiz.`;
  },

  createPayment(_order) {
    // Onlayn to'lov yo'q: yozuv faqat buyurtma "To'landi" bo'lganda qo'shiladi.
    return { ok: true, requiresManualConfirmation: true };
  },

  handleCallback() {
    return { ok: false, reason: "Naqd to‘lov uchun webhook mavjud emas" };
  },
};

export default provider;
