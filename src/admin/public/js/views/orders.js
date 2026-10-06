/**
 * Buyurtmalar bo'limi: status bo'yicha filtrlar, qidiruv, batafsil ko'rish,
 * statusni o'zgartirish (faqat ruxsat etilgan o'tishlar taklif qilinadi) va izoh yozish.
 */
import api, { query } from '../api.js';
import { clear, dt, el, field, input, money, modal, select, statusBadge, statusLabel, textarea, toast } from '../ui.js';

const state = { page: 1, q: '', status: '' };
let statuses = [];

function orderTotals(order) {
  const rows = [
    ['Mahsulotlar', money(order.subtotal)],
    order.discount_total > 0 ? ['Chegirma bilan tejaldi', `−${money(order.discount_total)}`] : null,
    order.delivery_fee > 0 ? ['Yetkazish', money(order.delivery_fee)] : ['Yetkazish', 'Bepul'],
    order.promo_discount > 0 ? [`Promokod (${order.promo_code})`, `−${money(order.promo_discount)}`] : null,
    ['Jami', money(order.total)],
  ].filter(Boolean);

  return el(
    'ul',
    { class: 'list-clean' },
    rows.map(([label, value], index) =>
      el('li', { class: index === rows.length - 1 ? 'strong' : '' }, [
        el('span', { class: 'muted', text: label }),
        el('span', { class: 'spacer' }),
        el('span', { text: value }),
      ]),
    ),
  );
}

async function openOrder(orderId, onChanged) {
  const order = await api.get(`/orders/${orderId}`);

  const itemsTable = el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: 'Mahsulot' }),
      el('th', { text: 'Narx' }),
      el('th', { text: 'Soni' }),
      el('th', { text: 'Summa' }),
    ])),
    el(
      'tbody',
      {},
      order.items.map((item) =>
        el('tr', {}, [
          el('td', {}, [
            el('div', { class: 'strong', text: `${item.brand ?? ''} ${item.model ?? item.product_name}`.trim() }),
            el('div', { class: 'faint small', text: [item.color, item.warranty].filter(Boolean).join(' · ') || '—' }),
          ]),
          el('td', { text: money(item.unit_price) }),
          el('td', { text: `${item.quantity} dona` }),
          el('td', { text: money(item.total) }),
        ]),
      ),
    ),
  ]);

  const historyList = el(
    'ul',
    { class: 'list-clean' },
    order.history.map((entry) =>
      el('li', {}, [
        statusBadge(entry.status),
        el('div', { class: 'small muted', text: `${dt(entry.created_at)} · ${entry.changed_by ?? '—'}` }),
        el('span', { class: 'spacer' }),
        entry.comment ? el('span', { class: 'faint small', text: entry.comment }) : null,
      ]),
    ),
  );

  const statusSelect = select(
    'status',
    order.allowedTransitions.map((code) => ({ value: code, label: statusLabel(code) })),
    '',
    { allowEmpty: true, emptyLabel: 'Holatni o‘zgartirish...' },
  );
  const commentInput = input('comment', { placeholder: 'Izoh (mijoz va adminlarga yuboriladi)' });

  const saveStatus = el('button', {
    class: 'btn primary',
    text: '💾 Holatni saqlash',
    disabled: order.allowedTransitions.length === 0,
    onclick: async () => {
      if (!statusSelect.value) {
        toast('Holatni tanlang', 'error');
        return;
      }
      saveStatus.disabled = true;
      try {
        await api.patch(`/orders/${order.id}/status`, {
          status: statusSelect.value,
          comment: commentInput.value.trim() || null,
        });
        toast('Holat yangilandi', 'success');
        dialog.close();
        onChanged?.();
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        saveStatus.disabled = false;
      }
    },
  });

  const dialog = modal({
    title: `Buyurtma ${order.order_number}`,
    wide: true,
    content: [
      el('div', { class: 'between mb-2' }, [
        el('div', { class: 'row' }, [statusBadge(order.status), el('span', { class: 'faint small', text: dt(order.created_at) })]),
        el('div', { class: 'strong', text: money(order.total) }),
      ]),
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'card' }, [
          el('h3', { class: 'mb-1', text: '👤 Mijoz' }),
          el('div', { class: 'small' }, [
            el('div', { text: order.customer_name }),
            el('div', { class: 'mono', text: order.customer_phone }),
            order.customer?.username ? el('div', { class: 'muted', text: `@${order.customer.username}` }) : null,
            order.customer?.telegram_id
              ? el('div', { class: 'faint', text: `Telegram ID: ${order.customer.telegram_id}` })
              : null,
          ]),
        ]),
        el('div', { class: 'card' }, [
          el('h3', { class: 'mb-1', text: '🚚 Yetkazish va to‘lov' }),
          el('div', { class: 'small' }, [
            el('div', { text: order.delivery_method === 'pickup' ? '🏬 Do‘kondan olib ketish' : '🚚 Kuryer orqali' }),
            order.customer_address ? el('div', { class: 'muted', text: order.customer_address }) : null,
            el('div', { class: 'muted', text: `To‘lov: ${order.payment_method} · ${order.payment_status}` }),
            order.comment ? el('div', { class: 'faint', text: `Izoh: ${order.comment}` }) : null,
          ]),
        ]),
      ]),
      el('div', { class: 'card mt-2' }, [
        el('h3', { class: 'mb-1', text: '🛒 Mahsulotlar' }),
        el('div', { class: 'table-wrap' }, itemsTable),
        orderTotals(order),
      ]),
      el('div', { class: 'card mt-2' }, [
        el('h3', { class: 'mb-1', text: '🕓 Holatlar tarixi' }),
        historyList,
      ]),
      order.allowedTransitions.length > 0
        ? el('div', { class: 'card mt-2' }, [
            el('h3', { class: 'mb-1', text: '🔄 Holatni o‘zgartirish' }),
            el('div', { class: 'field-row' }, [statusSelect, commentInput]),
          ])
        : el('div', { class: 'card mt-2 muted', text: 'Bu buyurtma yakuniy holatda — o‘zgartirish mumkin emas.' }),
    ],
    actions: [saveStatus, el('button', { class: 'btn ghost', text: 'Yopish', onclick: () => dialog.close() })],
  });
}

export default {
  id: 'orders',
  label: '📦 Buyurtmalar',
  title: 'Buyurtmalar',
  subtitle: 'Buyurtmalarni ko‘rish va holatini boshqarish',

  async render({ mount, actions, params }) {
    clear(actions);
    if (params.status !== undefined) state.status = params.status;

    const searchInput = input('q', { value: state.q, placeholder: 'Raqam, ism yoki telefon' });
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        state.q = searchInput.value.trim();
        state.page = 1;
        this.render({ mount, actions, params });
      }
    });

    const result = await api.get(`/orders${query({ q: state.q, status: state.status, page: state.page, perPage: 20 })}`);
    statuses = result.statuses;

    const rerender = () => this.render({ mount, actions, params });
    clear(mount);

    // Status bo'yicha tez filtrlar
    const pills = el('div', { class: 'pill-tabs' }, [
      el('span', {
        class: `pill ${state.status === '' ? 'active' : ''}`,
        text: 'Barchasi',
        onclick: () => {
          state.status = '';
          state.page = 1;
          rerender();
        },
      }),
      ...statuses.map((status) =>
        el('span', {
          class: `pill ${state.status === status.code ? 'active' : ''}`,
          text: status.label,
          onclick: () => {
            state.status = status.code;
            state.page = 1;
            rerender();
          },
        }),
      ),
    ]);

    mount.append(
      el('div', { class: 'card' }, [
        el('div', { class: 'toolbar' }, [
          searchInput,
          el('button', {
            class: 'btn sm',
            text: '🔎 Qidirish',
            onclick: () => {
              state.q = searchInput.value.trim();
              state.page = 1;
              rerender();
            },
          }),
        ]),
        el('div', { class: 'mt-1' }, [pills]),
      ]),
    );

    if (result.items.length === 0) {
      mount.append(el('div', { class: 'card empty', text: 'Buyurtmalar topilmadi' }));
      return;
    }

    const table = el('table', {}, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Raqam' }),
        el('th', { text: 'Mijoz' }),
        el('th', { text: 'Mahsulot' }),
        el('th', { text: 'Summa' }),
        el('th', { text: 'Holat' }),
        el('th', { text: 'Sana' }),
        el('th', { text: '' }),
      ])),
      el(
        'tbody',
        {},
        result.items.map((order) =>
          el('tr', {}, [
            el('td', {}, [
              el('div', { class: 'mono', text: order.order_number }),
              el('div', { class: 'faint small', text: order.payment_method }),
            ]),
            el('td', {}, [
              el('div', { text: order.customer_name }),
              el('div', { class: 'mono small muted', text: order.customer_phone }),
            ]),
            el('td', { text: `${order.units_count} dona` }),
            el('td', { class: 'strong', text: money(order.total) }),
            el('td', {}, [statusBadge(order.status)]),
            el('td', { class: 'small muted', text: dt(order.created_at) }),
            el('td', { class: 'actions' }, [
              el('button', { class: 'btn sm', text: '👁 Batafsil', onclick: () => openOrder(order.id, rerender) }),
            ]),
          ]),
        ),
      ),
    ]);

    mount.append(el('div', { class: 'card' }, [el('div', { class: 'table-wrap' }, table)]));

    mount.append(
      el('div', { class: 'between mt-1' }, [
        el('span', { class: 'small muted', text: `Jami: ${result.total} ta buyurtma` }),
        result.totalPages > 1
          ? el('div', { class: 'pagination' }, [
              el('button', {
                class: 'btn sm',
                text: '⬅️',
                disabled: result.page <= 1,
                onclick: () => {
                  state.page = result.page - 1;
                  rerender();
                },
              }),
              el('span', { class: 'small muted', text: `${result.page} / ${result.totalPages}` }),
              el('button', {
                class: 'btn sm',
                text: '➡️',
                disabled: result.page >= result.totalPages,
                onclick: () => {
                  state.page = result.page + 1;
                  rerender();
                },
              }),
            ])
          : null,
      ]),
    );

    // Botdagi xabardan kelgan havola (#/orders?focus=12) — buyurtmani darhol ochamiz
    if (params.focus) {
      await openOrder(Number(params.focus), rerender);
    }

    void field;
    void textarea;
  },
};
