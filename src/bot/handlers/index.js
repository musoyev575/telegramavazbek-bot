/**
 * Barcha handlerlarni ro'yxatdan o'tkazish.
 *
 * MUHIM tartib:
 *  1. Buyruqlar va menyu tugmalari
 *  2. Matn routeri (qidiruv / buyurtma oqimlari)
 *  3. Fallback handlerlar (oxirgi bo'lishi shart)
 */
import registerStart from './start.js';
import registerCatalog from './catalog.js';
import registerFilters from './filters.js';
import registerSearch, { runSearch } from './search.js';
import registerProduct from './product.js';
import registerCart from './cart.js';
import registerCheckout, { handleCheckoutContact, handleCheckoutText } from './checkout.js';
import registerOrders from './orders.js';
import registerAccount from './account.js';
import registerAdmin from './admin.js';
import registerFallback from './fallback.js';

export function registerHandlers(bot) {
  registerStart(bot);
  registerCatalog(bot);
  registerFilters(bot);
  registerSearch(bot);
  registerProduct(bot);
  registerCart(bot);
  registerCheckout(bot);
  registerOrders(bot);
  registerAccount(bot);
  registerAdmin(bot);

  // --- Matn routeri: faol oqimga qarab yo'naltiradi ---
  bot.on('text', async (ctx, next) => {
    const flow = ctx.session?.flow;
    if (!flow) return next();
    if (ctx.message.text.startsWith('/')) return next();

    if (flow === 'search') {
      await runSearch(ctx, ctx.message.text);
      return undefined;
    }
    if (flow === 'checkout') {
      const handled = await handleCheckoutText(ctx);
      if (handled) return undefined;
    }
    return next();
  });

  // --- Kontakt (telefon raqam) ---
  bot.on('contact', async (ctx, next) => {
    const handled = await handleCheckoutContact(ctx);
    if (handled) return undefined;
    return next();
  });

  // --- Fallback: eng oxirida ro'yxatdan o'tadi ---
  registerFallback(bot);

  return bot;
}

export default registerHandlers;
