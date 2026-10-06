/**
 * Foydalanuvchilar bo'limi: ro'yxat, batafsil (buyurtmalari bilan), bloklash.
 */
import api, { query } from '../api.js';
import { clear, dt, el, input, modal, money, statusBadge, toast } from '../ui.js';

const state = { page: 1, q: '', withOrders: false };

async function openUser(userId, onChanged) {
  const user = await api.get(`/users/${userId}`);

  const ordersTable = el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: 'Raqam' }),
      el('th', { text: 'Summa' }),
      el('th', { text: 'Holat' }),
      el('th', { text: 'Sana' }),
    ])),
    el(
      'tbody',
      {},
      user.orders.length === 0
        ? [el('tr', {}, [el('td', { colspan: 4, class: 'muted', text: 'Buyurtmalar yo‘q' })])]
        : user.orders.map((order) =>
            el('tr', {}, [
              el('td', { class: 'mono', text: order.order_number }),
              el('td', { text: money(order.total) }),
              el('td', {}, [statusBadge(order.status)]),
              el('td', { class: 'small muted', text: dt(order.created_at) }),
            ]),
          ),
    ),
  ]);

  const blockButton = el('button', {
    class: `btn ${user.is_blocked ? 'success' : 'danger'}`,
    text: user.is_blocked ? '✅ Blokdan chiqarish' : '🚫 Bloklash',
    onclick: async () => {
      try {
        await api.patch(`/users/${user.id}/block`, { blocked: !user.is_blocked });
        toast(user.is_blocked ? 'Blokdan chiqarildi' : 'Bloklandi', 'success');
        dialog.close();
        onChanged?.();
      } catch (error) {
        toast(error.message, 'error');
      }
    },
  });

  const dialog = modal({
    title: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || `Foydalanuvchi #${user.id}`,
    wide: true,
    content: [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'card' }, [
          el('h3', { class: 'mb-1', text: '📇 Ma’lumotlar' }),
          el('ul', { class: 'list-clean small' }, [
            el('li', {}, [el('span', { class: 'muted', text: 'Telegram ID' }), el('span', { class: 'spacer' }), el('span', { class: 'mono', text: String(user.telegram_id) })]),
            el('li', {}, [el('span', { class: 'muted', text: 'Username' }), el('span', { class: 'spacer' }), el('span', { text: user.username ? `@${user.username}` : '—' })]),
            el('li', {}, [el('span', { class: 'muted', text: 'Telefon' }), el('span', { class: 'spacer' }), el('span', { class: 'mono', text: user.phone ?? '—' })]),
            el('li', {}, [el('span', { class: 'muted', text: 'Ro‘yxatdan o‘tgan' }), el('span', { class: 'spacer' }), el('span', { text: dt(user.created_at) })]),
            el('li', {}, [el('span', { class: 'muted', text: 'Oxirgi faollik' }), el('span', { class: 'spacer' }), el('span', { text: dt(user.last_seen_at) })]),
            el('li', {}, [el('span', { class: 'muted', text: 'Holat' }), el('span', { class: 'spacer' }), el('span', { class: user.is_blocked ? 'badge cancelled' : 'badge paid', text: user.is_blocked ? 'Bloklangan' : 'Faol' })]),
          ]),
        ]),
        el('div', { class: 'card' }, [
          el('h3', { class: 'mb-1', text: '📊 Xarid statistikasi' }),
          el('div', { class: 'grid cols-2' }, [
            el('div', {}, [el('div', { class: 'faint small', text: 'Buyurtmalar' }), el('div', { class: 'strong', text: String(user.orders_count) })]),
            el('div', {}, [el('div', { class: 'faint small', text: 'Umumiy xarid' }), el('div', { class: 'strong', text: money(user.total_spent) })]),
          ]),
        ]),
      ]),
      el('div', { class: 'card mt-2' }, [
        el('h3', { class: 'mb-1', text: '📦 Oxirgi buyurtmalar' }),
        el('div', { class: 'table-wrap' }, ordersTable),
      ]),
    ],
    actions: [blockButton, el('button', { class: 'btn ghost', text: 'Yopish', onclick: () => dialog.close() })],
  });
}

export default {
  id: 'users',
  label: '👥 Foydalanuvchilar',
  title: 'Foydalanuvchilar',
  subtitle: 'Bot foydalanuvchilari va ularning xaridlari',

  async render({ mount, actions, params }) {
    clear(actions);
    const searchInput = input('q', { value: state.q, placeholder: 'Ism, username yoki telefon' });
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        state.q = searchInput.value.trim();
        state.page = 1;
        this.render({ mount, actions, params });
      }
    });

    const result = await api.get(`/users${query({ q: state.q, withOrders: state.withOrders, page: state.page, perPage: 20 })}`);
    const rerender = () => this.render({ mount, actions, params });
    clear(mount);

    const withOrdersPill = el('span', {
      class: `pill ${state.withOrders ? 'active' : ''}`,
      text: '🛒 Xarid qilganlar',
      onclick: () => {
        state.withOrders = !state.withOrders;
        state.page = 1;
        rerender();
      },
    });

    mount.append(
      el('div', { class: 'card' }, [
        el('div', { class: 'toolbar' }, [
          searchInput,
          withOrdersPill,
          el('span', { class: 'spacer' }),
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
      ]),
    );

    if (result.items.length === 0) {
      mount.append(el('div', { class: 'card empty', text: 'Foydalanuvchilar topilmadi' }));
      return;
    }

    const table = el('table', {}, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Foydalanuvchi' }),
        el('th', { text: 'Telegram' }),
        el('th', { text: 'Telefon' }),
        el('th', { text: 'Buyurtma' }),
        el('th', { text: 'Xarid' }),
        el('th', { text: 'Ro‘yxatdan o‘tgan' }),
        el('th', { text: '' }),
      ])),
      el(
        'tbody',
        {},
        result.items.map((user) =>
          el('tr', {}, [
            el('td', {}, [
              el('div', { class: 'strong', text: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || '—' }),
              user.is_blocked ? el('span', { class: 'badge cancelled', text: 'Bloklangan' }) : null,
            ]),
            el('td', { class: 'small muted', text: user.username ? `@${user.username}` : String(user.telegram_id) }),
            el('td', { class: 'mono small', text: user.phone ?? '—' }),
            el('td', { text: String(user.orders_count) }),
            el('td', { text: money(user.total_spent) }),
            el('td', { class: 'small muted', text: dt(user.created_at, { withTime: false }) }),
            el('td', { class: 'actions' }, [
              el('button', { class: 'btn sm', text: '👁 Batafsil', onclick: () => openUser(user.id, rerender) }),
            ]),
          ]),
        ),
      ),
    ]);

    mount.append(el('div', { class: 'card' }, [el('div', { class: 'table-wrap' }, table)]));
    mount.append(
      el('div', { class: 'between mt-1' }, [
        el('span', { class: 'small muted', text: `Jami: ${result.total} ta foydalanuvchi` }),
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
  },
};
