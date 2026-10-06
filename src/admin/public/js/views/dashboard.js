/**
 * Dashboard: asosiy ko'rsatkichlar, savdo grafigi (SVG emas, CSS ustunlar),
 * top mahsulotlar, ombor ogohlantirishlari va oxirgi buyurtmalar.
 */
import api from '../api.js';
import { clear, dt, el, money, moneyShort, statusBadge, toast } from '../ui.js';

function statCard({ icon, label, value, sub }) {
  return el('div', { class: 'card stat' }, [
    el('div', { class: 'label' }, [icon ? `${icon} ` : '', label]),
    el('div', { class: 'value', text: value }),
    sub ? el('div', { class: 'sub', text: sub }) : null,
  ]);
}

function revenueChart(series) {
  const max = Math.max(...series.map((point) => point.revenue), 1);
  const bars = el(
    'div',
    { class: 'chart' },
    series.map((point) =>
      el('div', {
        class: 'bar',
        style: { height: `${Math.max(3, Math.round((point.revenue / max) * 100))}%` },
        title: `${point.day}: ${money(point.revenue)} (${point.orders} ta)`,
      }),
    ),
  );
  const labels = el(
    'div',
    { class: 'chart-labels' },
    series.map((point) => el('div', { text: point.day.slice(5) })),
  );
  return el('div', {}, [bars, labels]);
}

function simpleList(items, render) {
  if (items.length === 0) return el('div', { class: 'empty', text: 'Ma’lumot yo‘q' });
  return el('ul', { class: 'list-clean' }, items.map((item) => el('li', {}, render(item))));
}

export default {
  id: 'dashboard',
  label: '📊 Dashboard',
  title: 'Umumiy ko‘rsatkichlar',
  subtitle: 'Do‘kon savdosi va buyurtmalar bo‘yicha umumiy holat',

  async render({ mount, actions, navigate }) {
    const data = await api.get('/stats/dashboard');
    clear(mount);

    actions.append(
      el('button', { class: 'btn', text: '🔄 Yangilash', onclick: () => navigate('dashboard') }),
      el('button', { class: 'btn primary', text: '📦 Buyurtmalar', onclick: () => navigate('orders') }),
    );

    // 1) Ko'rsatkichlar
    mount.append(
      el('div', { class: 'grid cols-4' }, [
        statCard({
          icon: '💰',
          label: 'Umumiy savdo',
          value: money(data.revenue),
          sub: `${data.paidOrders} ta to‘langan buyurtma`,
        }),
        statCard({
          icon: '📅',
          label: 'Bugun',
          value: money(data.todayRevenue),
          sub: `${data.todayPaidOrders} ta buyurtma`,
        }),
        statCard({
          icon: '📦',
          label: 'Buyurtmalar',
          value: String(data.allOrders),
          sub: `Kutilmoqda: ${data.pendingOrders}`,
        }),
        statCard({
          icon: '👥',
          label: 'Foydalanuvchilar',
          value: String(data.users),
          sub: `Bugun +${data.newUsersToday}`,
        }),
      ]),
    );

    mount.append(
      el('div', { class: 'grid cols-5 mt-2' }, [
        statCard({ icon: '🧾', label: 'O‘rtacha chek', value: money(data.averageOrder) }),
        statCard({ icon: '📱', label: 'Faol mahsulot', value: `${data.activeProducts}/${data.products}` }),
        statCard({ icon: '🆕', label: 'Yangi buyurtma', value: String(data.byStatus.new ?? 0) }),
        statCard({ icon: '🚚', label: 'Yetkazilmoqda', value: String(data.byStatus.delivering ?? 0) }),
        statCard({ icon: '❌', label: 'Bekor qilingan', value: String(data.byStatus.cancelled ?? 0) }),
      ]),
    );

    // 2) Savdo grafigi + top mahsulotlar
    mount.append(
      el('div', { class: 'grid cols-2 mt-2' }, [
        el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('h2', { text: 'Oxirgi 7 kun savdosi' }),
            el('span', { class: 'spacer' }),
            el('span', { class: 'faint small', text: `Jami: ${money(data.revenueSeries.reduce((sum, p) => sum + p.revenue, 0))}` }),
          ]),
          revenueChart(data.revenueSeries),
        ]),
        el('div', { class: 'card' }, [
          el('h2', { class: 'mb-1', text: 'Eng ko‘p sotilgan' }),
          simpleList(data.topProducts, (product) => [
            el('span', { text: '📱' }),
            el('div', {}, [
              el('div', { class: 'strong', text: product.name }),
              el('div', { class: 'faint small', text: `${product.sold} dona · ${money(product.revenue)}` }),
            ]),
          ]),
        ]),
      ]),
    );

    // 3) Ombor ogohlantirishlari + oxirgi buyurtmalar
    mount.append(
      el('div', { class: 'grid cols-2 mt-2' }, [
        el('div', { class: 'card' }, [
          el('h2', { class: 'mb-1', text: '⚠️ Ombor kam qolgan' }),
          simpleList(data.lowStock, (product) => [
            el('div', {}, [
              el('div', { class: 'strong', text: `${product.brand} ${product.model}` }),
              el('div', { class: 'faint small', text: money(product.price) }),
            ]),
            el('span', { class: 'spacer' }),
            el('span', { class: `badge ${product.stock === 0 ? 'out' : 'low'}`, text: `${product.stock} dona` }),
          ]),
        ]),
        el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('h2', { text: 'Oxirgi buyurtmalar' }),
            el('span', { class: 'spacer' }),
            el('button', { class: 'btn sm', text: 'Barchasi →', onclick: () => navigate('orders') }),
          ]),
          data.recentOrders.length === 0
            ? el('div', { class: 'empty', text: 'Buyurtmalar yo‘q' })
            : el(
                'div',
                { class: 'table-wrap' },
                el('table', {}, [
                  el('thead', {}, el('tr', {}, [
                    el('th', { text: 'Raqam' }),
                    el('th', { text: 'Mijoz' }),
                    el('th', { text: 'Summa' }),
                    el('th', { text: 'Holat' }),
                  ])),
                  el(
                    'tbody',
                    {},
                    data.recentOrders.map((order) =>
                      el(
                        'tr',
                        {
                          style: { cursor: 'pointer' },
                          onclick: () => navigate('orders', { focus: order.id }),
                        },
                        [
                          el('td', { class: 'mono', text: order.order_number }),
                          el('td', { text: order.customer_name }),
                          el('td', { text: money(order.total) }),
                          el('td', {}, [statusBadge(order.status)]),
                        ],
                      ),
                    ),
                  ),
                ]),
              ),
        ]),
      ]),
    );

    toast('Ma’lumotlar yangilandi', 'success', 1800);
    void dt;
  },
};
