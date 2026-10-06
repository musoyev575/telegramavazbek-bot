/**
 * UI yordamchilari: element yaratish, toast, modal, formatlash, badge.
 * XAVFSIZLIK: matn har doim `textContent` orqali qo'yiladi (innerHTML ishlatilmaydi) —
 * mahsulot nomi yoki mijoz izohidagi HTML hech qachon bajarilmaydi (XSS himoyasi).
 */

/** Element yaratish: el('div', { class: 'card' }, [child1, 'matn']) */
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = value; // faqat ichki, ishonchli shablonlar uchun
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** 4500000 -> "4 500 000 so'm" */
export function money(amount, currency = "so'm") {
  const value = Number(amount) || 0;
  return `${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${currency}`;
}

export function moneyShort(amount) {
  const value = Number(amount) || 0;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mlrd`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mln`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} ming`;
  return String(value);
}

/** "2026-10-05 09:12:30" (UTC) -> "05.10.2026 14:12" */
export function dt(value, { withTime = true } = {}) {
  if (!value) return '—';
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

export function statusLabel(code) {
  const labels = {
    new: '🆕 Yangi',
    accepted: '✅ Qabul qilindi',
    awaiting_payment: '⏳ To‘lov kutilmoqda',
    paid: '💳 To‘landi',
    preparing: '📦 Tayyorlanmoqda',
    delivering: '🚚 Yetkazilmoqda',
    delivered: '🎉 Yetkazildi',
    cancelled: '❌ Bekor qilindi',
  };
  return labels[code] ?? code;
}

export function statusBadge(code) {
  return el('span', { class: `badge ${code}`, text: statusLabel(code) });
}

export function stockBadge(stock) {
  if (stock <= 0) return el('span', { class: 'badge out', text: '❌ Mavjud emas' });
  if (stock <= 3) return el('span', { class: 'badge low', text: `🔥 ${stock} dona` });
  return el('span', { class: 'badge', text: `${stock} dona` });
}

/** Toast xabarnoma */
export function toast(message, type = 'info', timeout = 3800) {
  let container = document.querySelector('.toasts');
  if (!container) {
    container = el('div', { class: 'toasts' });
    document.body.append(container);
  }
  const node = el('div', { class: `toast ${type}`, text: message });
  container.append(node);
  setTimeout(() => node.remove(), timeout);
  return node;
}

/** Modal oyna. `onClose` — yopilganda chaqiriladi. */
export function modal({ title, content, actions = [], wide = false, onClose = null }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const box = el('div', { class: `modal ${wide ? 'wide' : ''}` });

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  const head = el('div', { class: 'card-head' }, [
    el('h2', { text: title }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn icon ghost', text: '✕', onclick: close, title: 'Yopish' }),
  ]);

  const body = el('div', {}, content);
  const footer =
    actions.length > 0
      ? el('div', { class: 'modal-actions' }, actions.map((action) => (action instanceof Node ? action : action)))
      : null;

  box.append(head, body);
  if (footer) box.append(footer);
  backdrop.append(box);
  document.body.append(backdrop);

  return { close, box, backdrop };
}

/**
 * Tasdiqlash oynasi. Qaytadi: true — tasdiqlandi, false — bekor qilindi.
 * MUHIM: javob `close()` dan OLDIN yoziladi — aks holda `onClose` hodisasi
 * tasdiqni ham "bekor" deb belgilab qo'yardi.
 */
export function confirmAction(message, { confirmText = 'Tasdiqlash', danger = true } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (value) => {
      if (answered) return;
      answered = true;
      resolve(value);
    };

    const confirmButton = el('button', {
      class: `btn ${danger ? 'danger' : 'primary'}`,
      text: confirmText,
      onclick: () => {
        finish(true);
        dialog.close();
      },
    });

    const cancelButton = el('button', {
      class: 'btn ghost',
      text: 'Bekor qilish',
      onclick: () => {
        finish(false);
        dialog.close();
      },
    });

    const dialog = modal({
      title: 'Tasdiqlang',
      content: [el('p', { text: message })],
      actions: [confirmButton, cancelButton],
      onClose: () => finish(false),
    });
  });
}

/** Form maydoni */
export function field(label, input, hint = null) {
  return el('div', { class: 'field' }, [
    el('label', { text: label }),
    input,
    hint ? el('div', { class: 'hint', text: hint }) : null,
  ]);
}

export function input(name, { value = '', type = 'text', placeholder = '', attrs = {} } = {}) {
  return el('input', { name, type, value, placeholder, ...attrs });
}

export function select(name, options, current, { allowEmpty = false, emptyLabel = 'Barchasi' } = {}) {
  const node = el('select', { name });
  if (allowEmpty) node.append(el('option', { value: '', text: emptyLabel }));
  for (const option of options) {
    const value = typeof option === 'object' ? option.value : option;
    const label = typeof option === 'object' ? option.label : option;
    node.append(el('option', { value, text: label, ...(String(value) === String(current ?? '') ? { selected: true } : {}) }));
  }
  return node;
}

export function textarea(name, value = '', attrs = {}) {
  return el('textarea', { name, rows: 3, ...attrs, text: value });
}

export function pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return el('div');
  return el('div', { class: 'pagination' }, [
    el('button', {
      class: 'btn sm',
      text: '⬅️ Oldingi',
      disabled: page <= 1,
      onclick: () => onPage(page - 1),
    }),
    el('span', { class: 'small muted', text: `${page} / ${totalPages}` }),
    el('button', {
      class: 'btn sm',
      text: 'Keyingi ➡️',
      disabled: page >= totalPages,
      onclick: () => onPage(page + 1),
    }),
  ]);
}

export default { el, clear, money, moneyShort, dt, statusLabel, statusBadge, stockBadge, toast, modal, confirmAction, field, input, select, textarea, pagination };
