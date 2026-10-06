/**
 * Admin panel shassi: sessiyani tekshirish, yon menyu, hash-router.
 * Har bir bo'lim `views/` papkasidagi alohida modul — kod bo'lingan va kengaytirishga qulay.
 */
import api from './api.js';
import { clear, el, toast } from './ui.js';
import dashboard from './views/dashboard.js';
import products from './views/products.js';
import orders from './views/orders.js';
import users from './views/users.js';
import marketing from './views/marketing.js';
import settings from './views/settings.js';

const ROUTES = [dashboard, products, orders, users, marketing, settings];

const navEl = document.getElementById('nav');
const viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const subtitleEl = document.getElementById('page-subtitle');
const actionsEl = document.getElementById('page-actions');
const whoEl = document.getElementById('who');

const app = { me: null, current: null };

export function navigate(id, params = {}) {
  const search = new URLSearchParams(params).toString();
  window.location.hash = `#/${id}${search ? `?${search}` : ''}`;
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [id, queryString = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString));
  const route = ROUTES.find((item) => item.id === (id || ROUTES[0].id)) ?? ROUTES[0];
  return { route, params };
}

function renderNav() {
  clear(navEl);
  for (const route of ROUTES) {
    navEl.append(
      el('a', {
        class: `nav-item ${app.current?.id === route.id ? 'active' : ''}`,
        href: `#/${route.id}`,
        text: route.label,
        dataset: { route: route.id },
      }),
    );
  }
}

let renderToken = 0;

async function renderRoute() {
  const token = (renderToken += 1);
  const { route, params } = parseHash();
  app.current = route;

  renderNav();
  titleEl.textContent = route.title;
  subtitleEl.textContent = route.subtitle ?? '';

  // Har bir render uchun YANGI konteyner: sekin API javobi kelganda eski (eskirgan)
  // render natijalari ekranga tushmaydi.
  const mount = el('div', {});
  const actions = el('div', { class: 'row' });
  viewEl.replaceChildren(mount);
  actionsEl.replaceChildren(actions);
  mount.append(el('div', { class: 'card center muted' }, [el('span', { class: 'spinner' }), ' Yuklanmoqda...']));

  const isStale = () => token !== renderToken;

  try {
    await route.render({
      mount,
      actions,
      me: app.me,
      params,
      navigate,
      refresh: renderRoute,
      isStale,
      setSubtitle: (text) => {
        if (!isStale()) subtitleEl.textContent = text;
      },
    });
  } catch (error) {
    if (isStale()) return;
    clear(mount);
    mount.append(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Xatolik yuz berdi' }),
        el('p', { text: error.message ?? 'Noma’lum xatolik' }),
        el('button', { class: 'btn', text: '🔄 Qayta urinish', onclick: () => renderRoute() }),
      ]),
    );
    if (error.status !== 401) toast(error.message ?? 'Xatolik', 'error');
  }
}

async function init() {
  try {
    app.me = await api.get('/me');
  } catch {
    return; // 401 bo'lsa api.js kirish sahifasiga o'tkazadi
  }

  whoEl.textContent = `${app.me.admin.fullName ?? app.me.admin.username} (${app.me.admin.role})`;

  document.getElementById('logout')?.addEventListener('click', async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      window.location.href = '/login';
    }
  });

  window.addEventListener('hashchange', renderRoute);

  // Hash bo'sh bo'lsa — o'rnatamiz; `hashchange` hodisasi renderRoute'ni chaqiradi
  // (qo'shimcha chaqiruv ikki marta render bo'lishiga olib kelardi).
  if (!window.location.hash) {
    window.location.hash = `#/${ROUTES[0].id}`;
    return;
  }
  await renderRoute();
}

/** Ilovani ishga tushirish */
init();

export { init, renderRoute, app, ROUTES };
export default app;
