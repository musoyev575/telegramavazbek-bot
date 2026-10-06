/**
 * Demo buyurtma yaratish (ishlab chiqish uchun).
 *
 * Admin panelni sinash uchun bitta namunali buyurtma yaratadi:
 *   node scripts/demo-order.js [dona]
 *
 * Diqqat: haqiqiy bazaga yozadi (storage/db/shop.sqlite) va ombor qoldig'ini kamaytiradi.
 * Faqat ishlab chiqish muhitida ishlatilsin.
 */
import { initDatabase } from '../src/database/migrate.js';
import userModel from '../src/models/userModel.js';
import productModel from '../src/models/productModel.js';
import cartService from '../src/services/cartService.js';
import orderService from '../src/services/orderService.js';
import { DELIVERY_METHOD, PAYMENT_METHOD } from '../src/config/constants.js';
import logger from '../src/utils/logger.js';
import { closeDb } from '../src/database/db.js';

initDatabase();

const quantity = Math.max(1, Number(process.argv[2]) || 1);
const user = userModel.upsertFromTelegram({
  id: 900100200,
  first_name: 'Demo',
  last_name: 'Mijoz',
  username: 'demo_mijoz',
});

const product = productModel.search({ stockOnly: true, perPage: 1 }).items[0];
if (!product) {
  logger.error("Omborda mahsulot yo'q — avval `npm run seed` bajaring");
  process.exit(1);
}

cartService.clear(user.id);
const added = cartService.addItem(user.id, product.id, quantity);
if (!added.ok) {
  logger.error('Savatchaga qo‘shib bo‘lmadi', added.reason);
  process.exit(1);
}

const result = orderService.createFromCart({
  userId: user.id,
  customerName: 'Demo Mijoz',
  customerPhone: '+998901234567',
  address: 'Toshkent sh., Amir Temur shoh ko‘chasi 108',
  deliveryMethod: DELIVERY_METHOD.DELIVERY,
  paymentMethod: PAYMENT_METHOD.CASH,
  comment: 'Demo buyurtma — kuryer tushdan keyin kelsin',
});

if (!result.ok) {
  logger.error('Buyurtma yaratilmadi', result);
  process.exit(1);
}

logger.info(
  `✅ Demo buyurtma yaratildi: ${result.order.order_number} — ${result.order.total} so'm ` +
    `(${result.order.items[0].product_name} × ${quantity})`,
);

closeDb();
