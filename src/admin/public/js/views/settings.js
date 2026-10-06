/**
 * Sozlamalar bo'limi: do'kon ma'lumotlari, yetkazish narxi, administratorlar va parolni almashtirish.
 */
import api from '../api.js';
import { clear, confirmAction, dt, el, field, input, modal, select, textarea, toast } from '../ui.js';

const NUMERIC_KEYS = new Set(['delivery_fee', 'free_delivery_threshold', 'low_stock_threshold']);

function settingsForm(settings, onSaved) {
  const fields = [
    ['shop_name', 'Do‘kon nomi', 'text'],
    ['shop_phone', 'Telefon raqami', 'text'],
    ['shop_hours', 'Ish vaqti', 'text'],
    ['shop_map_url', 'Xarita havolasi (https://...)', 'text'],
    ['delivery_fee', 'Yetkazib berish narxi (so‘m)', 'number'],
    ['free_delivery_threshold', 'Bepul yetkazish chegarasi (so‘m)', 'number'],
    ['low_stock_threshold', 'Ombor ogohlantirish chegarasi (dona)', 'number'],
    ['order_prefix', 'Buyurtma raqami prefiksi', 'text'],
  ];

  const inputs = {};
  const rows = [];

  for (let index = 0; index < fields.length; index += 2) {
    const row = el('div', { class: 'field-row' });
    for (const [key, label, type] of fields.slice(index, index + 2)) {
      const node = input(key, { type, value: settings[key] ?? '' });
      inputs[key] = node;
      row.append(field(label, node));
    }
    rows.push(row);
  }

  const addressInput = textarea('shop_address', settings.shop_address ?? '', { rows: 2 });
  const supportInput = textarea('support_text', settings.support_text ?? '', { rows: 2 });
  inputs.shop_address = addressInput;
  inputs.support_text = supportInput;
  rows.push(field('Do‘kon manzili', addressInput));
  rows.push(field('Qo‘shimcha matn (yordam bo‘limida)', supportInput));

  const form = el('form', { onsubmit: (event) => event.preventDefault() }, rows);
  const saveButton = el('button', { class: 'btn primary', text: '💾 Saqlash' });

  saveButton.addEventListener('click', async () => {
    const payload = {};
    for (const [key, node] of Object.entries(inputs)) {
      payload[key] = NUMERIC_KEYS.has(key) ? Number(node.value || 0) : node.value.trim();
    }
    saveButton.disabled = true;
    try {
      await api.put('/settings', payload);
      toast('Sozlamalar saqlandi', 'success');
      onSaved?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      saveButton.disabled = false;
    }
  });

  return { form, saveButton };
}

function adminsTable(admins, { me, reload }) {
  const canManage = ['superadmin', 'admin'].includes(me.admin.role);
  const isSuper = me.admin.role === 'superadmin';

  const table = el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: 'Login' }),
      el('th', { text: 'Ism' }),
      el('th', { text: 'Rol' }),
      el('th', { text: 'Telegram ID' }),
      el('th', { text: 'Oxirgi kirish' }),
      el('th', { text: 'Holat' }),
      el('th', { text: '' }),
    ])),
    el(
      'tbody',
      {},
      admins.map((admin) =>
        el('tr', {}, [
          el('td', { class: 'mono', text: admin.username }),
          el('td', { text: admin.full_name ?? '—' }),
          el('td', {}, [el('span', { class: admin.role === 'superadmin' ? 'badge new' : 'badge', text: admin.role })]),
          el('td', { class: 'mono small', text: admin.telegram_id ?? '—' }),
          el('td', { class: 'small muted', text: dt(admin.last_login_at) }),
          el('td', {}, [el('span', { class: admin.is_active ? 'badge paid' : 'badge cancelled', text: admin.is_active ? 'Faol' : 'Bloklangan' })]),
          el('td', { class: 'actions' }, [
            el('div', { class: 'row' }, [
              el('button', {
                class: 'btn sm icon',
                title: admin.is_active ? 'Faolsizlantirish' : 'Faollashtirish',
                text: admin.is_active ? '⏸' : '▶️',
                disabled: !canManage || admin.id === me.admin.id,
                onclick: async () => {
                  try {
                    await api.patch(`/settings/admins/${admin.id}`, { isActive: !admin.is_active });
                    toast('Yangilandi', 'success');
                    reload();
                  } catch (error) {
                    toast(error.message, 'error');
                  }
                },
              }),
              el('button', {
                class: 'btn sm icon',
                title: 'Telegram ID ni o‘zgartirish',
                text: '🔗',
                disabled: !canManage,
                onclick: () => {
                  const fTelegram = input('telegramId', { type: 'number', value: admin.telegram_id ?? '', placeholder: '123456789' });
                  const save = el('button', { class: 'btn primary', text: '💾 Saqlash' });
                  const dialog = modal({
                    title: `Telegram ID: ${admin.username}`,
                    content: [
                      field('Telegram ID', fTelegram, 'Botda /adminim buyrug‘i bilan ham ulash mumkin'),
                    ],
                    actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
                  });
                  save.addEventListener('click', async () => {
                    try {
                      await api.patch(`/settings/admins/${admin.id}`, {
                        telegramId: fTelegram.value === '' ? null : Number(fTelegram.value),
                      });
                      toast('Saqlandi', 'success');
                      dialog.close();
                      reload();
                    } catch (error) {
                      toast(error.message, 'error');
                    }
                  });
                },
              }),
              el('button', {
                class: 'btn sm icon danger',
                title: 'O‘chirish (faolsizlantirish)',
                text: '🗑',
                disabled: !isSuper || admin.id === me.admin.id,
                onclick: async () => {
                  if (!(await confirmAction(`${admin.username} faolsizlantirilsinmi?`))) return;
                  try {
                    await api.del(`/settings/admins/${admin.id}`);
                    toast('Faolsizlantirildi', 'success');
                    reload();
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
  ]);

  return table;
}

export default {
  id: 'settings',
  label: '⚙️ Sozlamalar',
  title: 'Sozlamalar',
  subtitle: 'Do‘kon ma’lumotlari, yetkazish shartlari va administratorlar',

  async render({ mount, actions, me }) {
    clear(actions);
    const settings = await api.get('/settings');
    const reload = () => this.render({ mount, actions, me });

    // --- Do'kon sozlamalari ---
    const { form, saveButton } = settingsForm(settings, reload);
    clear(mount);
    mount.append(
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('h2', { text: '🏬 Do‘kon ma’lumotlari' }),
          el('span', { class: 'spacer' }),
          saveButton,
        ]),
        form,
      ]),
    );

    // --- Administratorlar ---
    let admins = [];
    try {
      admins = (await api.get('/settings/admins')).items;
    } catch (error) {
      toast(error.message, 'error');
    }

    const addButton = el('button', {
      class: 'btn primary',
      text: '➕ Administrator qo‘shish',
      onclick: () => {
        const fUsername = input('username', { placeholder: 'login' });
        const fFullName = input('fullName', { placeholder: 'Ism familiya' });
        const fPassword = input('password', { type: 'password', placeholder: 'Kamida 8 belgi, harf va raqam' });
        const fRole = select('role', [
          { value: 'admin', label: 'admin' },
          { value: 'manager', label: 'manager' },
          { value: 'superadmin', label: 'superadmin' },
        ], 'admin');
        const save = el('button', { class: 'btn primary', text: '💾 Yaratish' });
        const dialog = modal({
          title: 'Yangi administrator',
          content: [
            el('div', { class: 'field-row' }, [field('Login *', fUsername), field('Ism', fFullName)]),
            el('div', { class: 'field-row' }, [field('Parol *', fPassword), field('Rol', fRole)]),
          ],
          actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
        });
        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await api.post('/settings/admins', {
              username: fUsername.value.trim(),
              fullName: fFullName.value.trim() || null,
              password: fPassword.value,
              role: fRole.value,
            });
            toast('Administrator qo‘shildi', 'success');
            dialog.close();
            reload();
          } catch (error) {
            toast(error.message, 'error');
          } finally {
            save.disabled = false;
          }
        });
      },
    });

    mount.append(
      el('div', { class: 'card mt-2' }, [
        el('div', { class: 'card-head' }, [
          el('h2', { text: '👤 Administratorlar' }),
          el('span', { class: 'spacer' }),
          me.admin.role === 'superadmin' ? addButton : null,
        ]),
        admins.length === 0
          ? el('div', { class: 'empty', text: 'Ma’lumot yo‘q' })
          : el('div', { class: 'table-wrap' }, adminsTable(admins, { me, reload })),
      ]),
    );

    // --- Parolni almashtirish ---
    const fCurrent = input('currentPassword', { type: 'password' });
    const fNew = input('newPassword', { type: 'password' });
    const changeButton = el('button', { class: 'btn', text: '🔐 Parolni o‘zgartirish' });
    changeButton.addEventListener('click', async () => {
      changeButton.disabled = true;
      try {
        await api.post('/auth/password', {
          currentPassword: fCurrent.value,
          newPassword: fNew.value,
        });
        toast('Parol o‘zgartirildi. Qaytadan kiring.', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        changeButton.disabled = false;
      }
    });

    mount.append(
      el('div', { class: 'card mt-2' }, [
        el('h2', { class: 'mb-1', text: '🔐 Xavfsizlik' }),
        el('div', { class: 'field-row' }, [
          field('Joriy parol', fCurrent),
          field('Yangi parol', fNew, 'Kamida 8 belgi, harf va raqam. Barcha sessiyalar bekor qilinadi.'),
        ]),
        changeButton,
      ]),
    );
  },
};
