/**
 * Marketing bo'limi:
 *  - Aksiyalar: chegirma qo'llash (eski narx), mashhur belgisi, chegirmani olib tashlash
 *  - Promokodlar: yaratish/boshqarish (FEATURE_PROMOCODES yoqilgan bo'lsa)
 */
import api, { query } from '../api.js';
import { clear, confirmAction, el, field, input, modal, money, select, toast } from '../ui.js';

function discountCell(product) {
  if (!product.old_price || product.old_price <= product.price) {
    return el('span', { class: 'badge', text: 'Chegirma yo‘q' });
  }
  const percent = Math.round(((product.old_price - product.price) / product.old_price) * 100);
  return el('span', { class: 'badge new', text: `−${percent}%` });
}

/** Chegirma qo'llash oynasi */
function openDiscountForm(product, onSaved) {
  const fOldPrice = input('oldPrice', { type: 'number', value: product.old_price ?? product.price, attrs: { min: 0 } });
  const fPrice = input('price', { type: 'number', value: product.price, attrs: { min: 0 } });
  const save = el('button', { class: 'btn primary', text: '🏷 Chegirmani qo‘llash' });

  const dialog = modal({
    title: `Aksiya: ${product.brand} ${product.model}`,
    content: [
      el('div', { class: 'field-row' }, [
        field('Eski narx (mijoz ko‘radi)', fOldPrice, 'Chizilgan narx — chegirma foizi shundan hisoblanadi'),
        field('Yangi narx (joriy)', fPrice),
      ]),
    ],
    actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
  });

  save.addEventListener('click', async () => {
    try {
      await api.post(`/promotions/${product.id}/discount`, {
        oldPrice: Number(fOldPrice.value),
        price: Number(fPrice.value),
      });
      toast('Aksiya qo‘llandi', 'success');
      dialog.close();
      onSaved?.();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

export default {
  id: 'marketing',
  label: '🏷 Aksiyalar',
  title: 'Aksiyalar va promokodlar',
  subtitle: 'Chegirmalar, mashhur mahsulotlar va promokodlar',

  async render({ mount, actions, params }) {
    clear(actions);
    const me = await api.get('/me');
    const tab = params.tab === 'promocodes' ? 'promocodes' : 'sale';
    const rerender = (nextTab = tab) => this.render({ mount, actions, params: { ...params, tab: nextTab } });

    clear(mount);
    mount.append(
      el('div', { class: 'card' }, [
        el('div', { class: 'pill-tabs' }, [
          el('span', { class: `pill ${tab === 'sale' ? 'active' : ''}`, text: '🏷 Aksiyadagi telefonlar', onclick: () => rerender('sale') }),
          el('span', { class: `pill ${tab === 'promocodes' ? 'active' : ''}`, text: '🎟 Promokodlar', onclick: () => rerender('promocodes') }),
        ]),
      ]),
    );

    if (tab === 'sale') {
      const { items } = await api.get('/promotions/sale');
      const search = input('q', { placeholder: 'Mahsulot qidirish (aksiya qo‘shish uchun)' });
      const results = el('div', {});

      const runSearch = async () => {
        const found = await api.get(`/products${query({ q: search.value.trim(), page: 1 })}`);
        clear(results);
        if (!search.value.trim()) return;
        if (found.items.length === 0) {
          results.append(el('div', { class: 'empty', text: 'Mahsulot topilmadi' }));
          return;
        }
        results.append(
          el(
            'ul',
            { class: 'list-clean' },
            found.items.map((product) =>
              el('li', {}, [
                el('div', {}, [
                  el('div', { class: 'strong', text: `${product.brand} ${product.model}` }),
                  el('div', { class: 'faint small', text: money(product.price) }),
                ]),
                el('span', { class: 'spacer' }),
                el('button', { class: 'btn sm', text: '🏷 Aksiya', onclick: () => openDiscountForm(product, () => rerender('sale')) }),
              ]),
            ),
          ),
        );
      };

      search.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runSearch();
      });

      mount.append(
        el('div', { class: 'card mt-2' }, [
          el('div', { class: 'toolbar' }, [search, el('button', { class: 'btn sm', text: '🔎 Qidirish', onclick: runSearch })]),
          results,
        ]),
      );

      mount.append(
        el('div', { class: 'card mt-2' }, [
          el('div', { class: 'card-head' }, [
            el('h2', { text: 'Aksiyadagi mahsulotlar' }),
            el('span', { class: 'spacer' }),
            el('span', { class: 'faint small', text: `${items.length} ta` }),
          ]),
          items.length === 0
            ? el('div', { class: 'empty', text: 'Hozircha aksiya yo‘q. Yuqoridagi qidiruvdan chegirma qo‘shing.' })
            : el(
                'div',
                { class: 'table-wrap' },
                el('table', {}, [
                  el('thead', {}, el('tr', {}, [
                    el('th', { text: 'Mahsulot' }),
                    el('th', { text: 'Chegirma' }),
                    el('th', { text: 'Eski narx' }),
                    el('th', { text: 'Joriy narx' }),
                    el('th', { text: 'Ombor' }),
                    el('th', { text: '' }),
                  ])),
                  el(
                    'tbody',
                    {},
                    items.map((product) =>
                      el('tr', {}, [
                        el('td', { class: 'strong', text: `${product.brand} ${product.model}` }),
                        el('td', {}, [discountCell(product)]),
                        el('td', { class: 'muted', style: { textDecoration: 'line-through' }, text: money(product.old_price) }),
                        el('td', { class: 'strong', text: money(product.price) }),
                        el('td', { text: `${product.stock} dona` }),
                        el('td', { class: 'actions' }, [
                          el('div', { class: 'row' }, [
                            el('button', { class: 'btn sm icon', title: 'Narxni o‘zgartirish', text: '✏️', onclick: () => openDiscountForm(product, () => rerender('sale')) }),
                            el('button', {
                              class: 'btn sm icon danger',
                              title: 'Chegirmani olib tashlash',
                              text: '🗑',
                              onclick: async () => {
                                if (!(await confirmAction('Chegirma olib tashlansinmi?', { confirmText: 'Olib tashlash' }))) return;
                                try {
                                  await api.del(`/promotions/${product.id}/discount`);
                                  toast('Chegirma olib tashlandi', 'success');
                                  rerender('sale');
                                } catch (error) {
                                  toast(error.message, 'error');
                                }
                              },
                            }),
                          ]),
                        ]),
                      ]),
                    ),
                  ),
                ]),
              ),
        ]),
      );
      return;
    }

    // --- Promokodlar ---
    const { enabled, items } = await api.get('/promotions/promocodes');

    const createButton = el('button', {
      class: 'btn primary',
      text: '➕ Promokod yaratish',
      onclick: () => {
        const fCode = input('code', { placeholder: 'SUMMER2026' });
        const fType = select('discountType', [
          { value: 'percent', label: 'Foiz (%)' },
          { value: 'fixed', label: 'Belgilangan summa (so‘m)' },
        ], 'percent');
        const fValue = input('discountValue', { type: 'number', attrs: { min: 1 } });
        const fMin = input('minAmount', { type: 'number', value: 0, attrs: { min: 0 } });
        const fLimit = input('usageLimit', { type: 'number', placeholder: 'Cheksiz' });
        const fExpires = input('expiresAt', { type: 'date' });
        const save = el('button', { class: 'btn primary', text: '💾 Yaratish' });

        const dialog = modal({
          title: 'Yangi promokod',
          content: [
            el('div', { class: 'field-row' }, [field('Kod *', fCode), field('Chegirma turi', fType)]),
            el('div', { class: 'field-row' }, [
              field('Chegirma qiymati *', fValue),
              field('Minimal buyurtma', fMin),
            ]),
            el('div', { class: 'field-row' }, [field('Ishlatilish limiti', fLimit), field('Amal qilish muddati', fExpires)]),
          ],
          actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
        });

        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await api.post('/promotions/promocodes', {
              code: fCode.value.trim(),
              discountType: fType.value,
              discountValue: Number(fValue.value),
              minAmount: Number(fMin.value || 0),
              usageLimit: fLimit.value === '' ? null : Number(fLimit.value),
              expiresAt: fExpires.value || null,
            });
            toast('Promokod yaratildi', 'success');
            dialog.close();
            rerender('promocodes');
          } catch (error) {
            toast(error.message, 'error');
          } finally {
            save.disabled = false;
          }
        });
      },
    });

    clear(actions);
    if (enabled) actions.append(createButton);

    mount.append(
      el('div', { class: 'card mt-2' }, [
        el('div', { class: 'card-head' }, [
          el('h2', { text: 'Promokodlar' }),
          el('span', { class: 'spacer' }),
          enabled
            ? el('span', { class: 'badge paid', text: 'Yoqilgan' })
            : el('span', { class: 'badge cancelled', text: 'O‘chirilgan' }),
        ]),
        !enabled
          ? el('div', { class: 'hint', text: 'Promokodlar hozircha o‘chirilgan. Yoqish uchun .env faylida FEATURE_PROMOCODES=1 qilib botni qayta ishga tushiring.' })
          : null,
        items.length === 0
          ? el('div', { class: 'empty', text: 'Promokodlar yo‘q' })
          : el(
              'div',
              { class: 'table-wrap' },
              el('table', {}, [
                el('thead', {}, el('tr', {}, [
                  el('th', { text: 'Kod' }),
                  el('th', { text: 'Chegirma' }),
                  el('th', { text: 'Minimal summa' }),
                  el('th', { text: 'Ishlatildi' }),
                  el('th', { text: 'Muddat' }),
                  el('th', { text: 'Holat' }),
                  el('th', { text: '' }),
                ])),
                el(
                  'tbody',
                  {},
                  items.map((promo) =>
                    el('tr', {}, [
                      el('td', { class: 'mono strong', text: promo.code }),
                      el('td', { text: promo.discount_type === 'percent' ? `${promo.discount_value}%` : money(promo.discount_value) }),
                      el('td', { text: money(promo.min_amount) }),
                      el('td', { text: `${promo.used_count}${promo.usage_limit ? ` / ${promo.usage_limit}` : ''}` }),
                      el('td', { class: 'small muted', text: promo.expires_at ?? '—' }),
                      el('td', {}, [el('span', { class: promo.is_active ? 'badge paid' : 'badge cancelled', text: promo.is_active ? 'Faol' : 'O‘chirilgan' })]),
                      el('td', { class: 'actions' }, [
                        el('div', { class: 'row' }, [
                          el('button', {
                            class: 'btn sm icon',
                            title: promo.is_active ? 'O‘chirish' : 'Yoqish',
                            text: promo.is_active ? '⏸' : '▶️',
                            onclick: async () => {
                              try {
                                await api.patch(`/promotions/promocodes/${promo.id}`, { isActive: !promo.is_active });
                                toast('Yangilandi', 'success');
                                rerender('promocodes');
                              } catch (error) {
                                toast(error.message, 'error');
                              }
                            },
                          }),
                          el('button', {
                            class: 'btn sm icon danger',
                            title: 'O‘chirish',
                            text: '🗑',
                            onclick: async () => {
                              if (!(await confirmAction(`${promo.code} o‘chirilsinmi?`, { confirmText: 'O‘chirish' }))) return;
                              try {
                                await api.del(`/promotions/promocodes/${promo.id}`);
                                toast('O‘chirildi', 'success');
                                rerender('promocodes');
                              } catch (error) {
                                toast(error.message, 'error');
                              }
                            },
                          }),
                        ]),
                      ]),
                    ]),
                  ),
                ),
              ]),
            ),
      ]),
    );

    void me;
  },
};
