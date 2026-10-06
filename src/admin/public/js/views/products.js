/**
 * Mahsulotlar bo'limi: qidiruv, filtrlar, jadval, qo'shish/tahrirlash formasi,
 * narx va omborni tez o'zgartirish, rasmlarni yuklash, o'chirish.
 */
import api, { query } from '../api.js';
import { clear, confirmAction, dt, el, field, input, modal, money, select, stockBadge, textarea, toast } from '../ui.js';

const state = { page: 1, q: '', brand: '', sort: 'new', inStock: false, onSale: false };

let meta = null;
async function loadMeta() {
  if (!meta) meta = await api.get('/products/meta');
  return meta;
}

function specsText(product) {
  const parts = [];
  if (product.ram || product.storage) parts.push(`${product.ram ?? '—'}/${product.storage ?? '—'} GB`);
  if (product.color) parts.push(product.color);
  return parts.join(' · ') || '—';
}

/** Mahsulot formasi (yangi yoki tahrirlash) */
async function openForm({ product = null, onSaved }) {
  const options = await loadMeta();
  const isNew = !product;
  const images = (product?.images ?? []).map((image) => ({ id: image.id, url: image.url }));

  const form = el('form', { class: 'form', onsubmit: (event) => event.preventDefault() });
  const brandList = el(
    'datalist',
    { id: 'brands-list' },
    options.categories.map((category) => el('option', { value: category.name })),
  );

  const fBrand = input('brand', { value: product?.brand ?? '', placeholder: 'Apple', attrs: { list: 'brands-list', required: true } });
  const fModel = input('model', { value: product?.model ?? '', placeholder: 'iPhone 15 Pro 256GB', attrs: { required: true } });
  const fPrice = input('price', { type: 'number', value: product?.price ?? '', attrs: { min: 0, required: true } });
  const fOldPrice = input('oldPrice', { type: 'number', value: product?.old_price ?? '', attrs: { min: 0 } });
  const fRam = input('ram', { type: 'number', value: product?.ram ?? '', attrs: { min: 1, placeholder: '8' } });
  const fStorage = input('storage', { type: 'number', value: product?.storage ?? '', attrs: { min: 1, placeholder: '256' } });
  const fStock = input('stock', { type: 'number', value: product?.stock ?? 0, attrs: { min: 0 } });
  const fColor = input('color', { value: product?.color ?? '', placeholder: 'Natural Titanium' });
  const fWarranty = input('warranty', { value: product?.warranty ?? '', placeholder: '1 yil rasmiy' });
  const fScreen = input('screen', { value: product?.screen ?? '', placeholder: '6.1" Super Retina XDR' });
  const fCamera = input('camera', { value: product?.camera ?? '', placeholder: '48 MP + 12 MP' });
  const fBattery = input('battery', { value: product?.battery ?? '', placeholder: '3270 mAh' });
  const fProcessor = input('processor', { value: product?.processor ?? '', placeholder: 'Apple A17 Pro' });
  const fOs = input('os', { value: product?.os ?? '', placeholder: 'iOS 17' });
  const fDescription = textarea('description', product?.description ?? '', { placeholder: 'Qisqa tavsif (botda ko‘rinadi)' });
  const fCategory = select(
    'categoryId',
    options.categories.map((category) => ({ value: category.id, label: category.name })),
    product?.category_id ?? '',
    { allowEmpty: true, emptyLabel: 'Kategoriya tanlanmagan' },
  );
  const fActive = el('input', { type: 'checkbox', name: 'isActive', checked: product ? product.is_active === 1 : true });
  const fFeatured = el('input', { type: 'checkbox', name: 'isFeatured', checked: product?.is_featured === 1 });

  // --- Rasmlar bo'limi ---
  const gallery = el('div', { class: 'img-grid' });
  const imageUrlInput = input('imageUrl', { placeholder: 'https://... yoki /uploads/rasm.jpg' });

  const renderGallery = () => {
    clear(gallery);
    if (images.length === 0) {
      gallery.append(el('div', { class: 'hint', text: 'Rasm qo‘shilmagan — bot kartasida faqat matn ko‘rinadi.' }));
      return;
    }
    for (const image of images) {
      gallery.append(
        el('figure', {}, [
          el('img', { src: image.url, alt: 'Mahsulot rasmi', loading: 'lazy' }),
          el('button', {
            type: 'button',
            text: '✕',
            title: 'Rasmni o‘chirish',
            onclick: async () => {
              if (image.id && product) {
                try {
                  await api.del(`/products/${product.id}/images/${image.id}`);
                } catch (error) {
                  toast(error.message, 'error');
                  return;
                }
              }
              const index = images.findIndex((item) => item === image);
              if (index >= 0) images.splice(index, 1);
              renderGallery();
            },
          }),
        ]),
      );
    }
  };
  renderGallery();

  const addImageUrl = async (url) => {
    if (!url) return;
    if (product) {
      try {
        const created = await api.post(`/products/${product.id}/images`, { url });
        images.push({ id: created.id, url: created.url });
      } catch (error) {
        toast(error.message, 'error');
        return;
      }
    } else {
      images.push({ id: null, url });
    }
    renderGallery();
  };

  const fileInput = el('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    attrs: { style: 'display:none' },
    onchange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('Rasm hajmi 5 MB dan oshmasin', 'error');
        return;
      }
      try {
        toast('Rasm yuklanmoqda...', 'info', 1500);
        const uploaded = await api.upload('/products/upload/image', file);
        await addImageUrl(uploaded.url);
        toast('Rasm yuklandi', 'success');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        event.target.value = '';
      }
    },
  });

  form.append(
    el('div', { class: 'field-row' }, [field('Brend *', fBrand), field('Model *', fModel)]),
    el('div', { class: 'field-row' }, [
      field('Narx (so‘m) *', fPrice),
      field('Eski narx', fOldPrice, 'Chegirma ko‘rinishi uchun eski narxni kiriting'),
    ]),
    el('div', { class: 'field-row' }, [
      field('RAM (GB)', fRam),
      field('Xotira (GB)', fStorage),
      field('Ombor (dona)', fStock),
    ]),
    el('div', { class: 'field-row' }, [
      field('Rang', fColor),
      field('Kafolat', fWarranty),
      field('Kategoriya', fCategory),
    ]),
    el('div', { class: 'field-row' }, [
      field('Ekran', fScreen),
      field('Kamera', fCamera),
    ]),
    el('div', { class: 'field-row' }, [
      field('Batareya', fBattery),
      field('Protsessor', fProcessor),
      field('OS', fOs),
    ]),
    field('Tavsif', fDescription),
    el('div', { class: 'field' }, [
      el('label', { text: 'Rasmlar' }),
      gallery,
      el('div', { class: 'row mt-1' }, [
        el('button', { class: 'btn sm', type: 'button', text: '📤 Rasm yuklash', onclick: () => fileInput.click() }),
        fileInput,
      ]),
      el('div', { class: 'row mt-1' }, [
        imageUrlInput,
        el('button', {
          class: 'btn sm',
          type: 'button',
          text: '➕ Havoladan qo‘shish',
          onclick: async () => {
            await addImageUrl(imageUrlInput.value.trim());
            imageUrlInput.value = '';
          },
        }),
      ]),
    ]),
    el('div', { class: 'row' }, [
      el('label', { class: 'row small' }, [fActive, ' Sotuvda faol']),
      el('label', { class: 'row small' }, [fFeatured, ' ⭐ Mashhur (mashhur telefonlar bo‘limida)']),
    ]),
  );

  const saveButton = el('button', { class: 'btn primary', text: isNew ? '➕ Qo‘shish' : '💾 Saqlash' });
  const dialog = modal({
    title: isNew ? 'Yangi telefon qo‘shish' : `Tahrirlash: ${product.brand} ${product.model}`,
    content: [form],
    wide: true,
    actions: [
      saveButton,
      el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() }),
    ],
  });

  saveButton.addEventListener('click', async () => {
    const payload = {
      brand: fBrand.value.trim(),
      model: fModel.value.trim(),
      price: Number(fPrice.value),
      oldPrice: fOldPrice.value === '' ? null : Number(fOldPrice.value),
      ram: fRam.value === '' ? null : Number(fRam.value),
      storage: fStorage.value === '' ? null : Number(fStorage.value),
      stock: Number(fStock.value || 0),
      color: fColor.value.trim() || null,
      warranty: fWarranty.value.trim() || null,
      screen: fScreen.value.trim() || null,
      camera: fCamera.value.trim() || null,
      battery: fBattery.value.trim() || null,
      processor: fProcessor.value.trim() || null,
      os: fOs.value.trim() || null,
      description: fDescription.value.trim() || null,
      categoryId: fCategory.value === '' ? null : Number(fCategory.value),
      isActive: fActive.checked,
      isFeatured: fFeatured.checked,
      ...(isNew ? { images: images.map((image) => image.url) } : {}),
    };

    if (!payload.brand || !payload.model || !Number.isFinite(payload.price)) {
      toast('Brend, model va narxni to‘ldiring', 'error');
      return;
    }

    saveButton.disabled = true;
    try {
      if (isNew) await api.post('/products', payload);
      else await api.put(`/products/${product.id}`, payload);
      toast(isNew ? 'Mahsulot qo‘shildi' : 'Saqlandi', 'success');
      dialog.close();
      onSaved?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      saveButton.disabled = false;
    }
  });
}

/** Narxni tez o'zgartirish */
function openPriceForm(product, onSaved) {
  const fPrice = input('price', { type: 'number', value: product.price, attrs: { min: 0 } });
  const fOld = input('oldPrice', { type: 'number', value: product.old_price ?? '', attrs: { min: 0 } });
  const save = el('button', { class: 'btn primary', text: '💾 Saqlash' });
  const dialog = modal({
    title: `Narx: ${product.brand} ${product.model}`,
    content: [
      el('div', { class: 'field-row' }, [
        field('Joriy narx *', fPrice),
        field('Eski narx (chegirma)', fOld, 'Eski narx joriy narxdan katta bo‘lsin'),
      ]),
    ],
    actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
  });

  save.addEventListener('click', async () => {
    try {
      await api.patch(`/products/${product.id}/price`, {
        price: Number(fPrice.value),
        oldPrice: fOld.value === '' ? null : Number(fOld.value),
      });
      toast('Narx yangilandi', 'success');
      dialog.close();
      onSaved?.();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

/** Omborni tez o'zgartirish */
function openStockForm(product, onSaved) {
  const fStock = input('stock', { type: 'number', value: product.stock, attrs: { min: 0 } });
  const save = el('button', { class: 'btn primary', text: '💾 Saqlash' });
  const dialog = modal({
    title: `Ombor: ${product.brand} ${product.model}`,
    content: [field('Ombordagi qoldiq (dona)', fStock)],
    actions: [save, el('button', { class: 'btn ghost', text: 'Bekor qilish', onclick: () => dialog.close() })],
  });

  save.addEventListener('click', async () => {
    try {
      await api.patch(`/products/${product.id}/stock`, { stock: Number(fStock.value) });
      toast('Ombor yangilandi', 'success');
      dialog.close();
      onSaved?.();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

export default {
  id: 'products',
  label: '📱 Mahsulotlar',
  title: 'Mahsulotlar',
  subtitle: 'Katalog, narxlar va omborni boshqarish',

  async render({ mount, actions, params }) {
    await loadMeta();
    if (params.q !== undefined) state.q = params.q;

    const addButton = el('button', {
      class: 'btn primary',
      text: '➕ Yangi telefon',
      onclick: () => openForm({ onSaved: () => this.render({ mount, actions, params }) }),
    });

    const searchInput = input('q', { value: state.q, placeholder: 'Nomi yoki modeli bo‘yicha qidirish' });
    const brandSelect = select('brand', meta.categories.map((c) => c.name), state.brand, {
      allowEmpty: true,
      emptyLabel: 'Barcha brendlar',
    });
    const sortSelect = select(
      'sort',
      [
        { value: 'new', label: 'Yangi qo‘shilganlar' },
        { value: 'price_asc', label: 'Arzon narxlar' },
        { value: 'price_desc', label: 'Qimmat narxlar' },
        { value: 'popular', label: 'Mashhur' },
      ],
      state.sort,
    );
    const stockPill = el('span', {
      class: `pill ${state.inStock ? 'active' : ''}`,
      text: '✅ Omborda bor',
      onclick: () => {
        state.inStock = !state.inStock;
        state.page = 1;
        this.render({ mount, actions, params });
      },
    });
    const salePill = el('span', {
      class: `pill ${state.onSale ? 'active' : ''}`,
      text: '🏷 Aksiyada',
      onclick: () => {
        state.onSale = !state.onSale;
        state.page = 1;
        this.render({ mount, actions, params });
      },
    });

    const applyFilters = () => {
      state.q = searchInput.value.trim();
      state.brand = brandSelect.value;
      state.sort = sortSelect.value;
      state.page = 1;
      this.render({ mount, actions, params });
    };

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyFilters();
    });
    brandSelect.addEventListener('change', applyFilters);
    sortSelect.addEventListener('change', applyFilters);

    clear(actions);
    actions.append(addButton);

    const result = await api.get(
      `/products${query({
        q: state.q,
        brand: state.brand,
        sort: state.sort,
        inStock: state.inStock,
        onSale: state.onSale,
        page: state.page,
      })}`,
    );

    const rerender = () => this.render({ mount, actions, params });
    clear(mount);

    const toolbar = el('div', { class: 'card' }, [
      el('div', { class: 'toolbar' }, [
        searchInput,
        brandSelect,
        sortSelect,
        stockPill,
        salePill,
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn sm', text: '🔎 Qidirish', onclick: applyFilters }),
        el('button', {
          class: 'btn sm ghost',
          text: '♻️ Tozalash',
          onclick: () => {
            state.q = '';
            state.brand = '';
            state.sort = 'new';
            state.inStock = false;
            state.onSale = false;
            state.page = 1;
            rerender();
          },
        }),
      ]),
    ]);
    mount.append(toolbar);

    if (result.items.length === 0) {
      mount.append(el('div', { class: 'card empty', text: 'Shartlarga mos mahsulot topilmadi' }));
      return;
    }

    const table = el('table', {}, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Rasm' }),
        el('th', { text: 'Nomi' }),
        el('th', { text: 'Xotira / rang' }),
        el('th', { text: 'Narx' }),
        el('th', { text: 'Ombor' }),
        el('th', { text: 'Holat' }),
        el('th', { text: '' }),
      ])),
      el(
        'tbody',
        {},
        result.items.map((product) =>
          el('tr', {}, [
            el('td', {}, [
              product.image
                ? el('img', { class: 'thumb', src: product.image, alt: product.model, loading: 'lazy' })
                : el('div', { class: 'thumb center muted', text: '—' }),
            ]),
            el('td', {}, [
              el('div', { class: 'strong', text: `${product.brand} ${product.model}` }),
              el('div', { class: 'faint small', text: `ID: ${product.id} · ${dt(product.created_at, { withTime: false })}` }),
            ]),
            el('td', { text: specsText(product) }),
            el('td', {}, [
              el('div', { class: 'strong', text: money(product.price) }),
              product.old_price
                ? el('div', { class: 'faint small', style: { textDecoration: 'line-through' }, text: money(product.old_price) })
                : null,
            ]),
            el('td', {}, [stockBadge(product.stock)]),
            el('td', {}, [
              product.is_active === 1
                ? el('span', { class: 'badge paid', text: 'Faol' })
                : el('span', { class: 'badge cancelled', text: 'O‘chirilgan' }),
              product.is_featured === 1 ? el('span', { class: 'badge new', text: '⭐ Mashhur' }) : null,
            ]),
            el('td', { class: 'actions' }, [
              el('div', { class: 'row' }, [
                el('button', {
                  class: 'btn sm icon',
                  title: 'Tahrirlash',
                  text: '✏️',
                  onclick: () => openForm({ product, onSaved: rerender }),
                }),
                el('button', {
                  class: 'btn sm icon',
                  title: 'Narxni o‘zgartirish',
                  text: '💰',
                  onclick: () => openPriceForm(product, rerender),
                }),
                el('button', {
                  class: 'btn sm icon',
                  title: 'Omborni o‘zgartirish',
                  text: '📦',
                  onclick: () => openStockForm(product, rerender),
                }),
                el('button', {
                  class: 'btn sm icon',
                  title: product.is_featured === 1 ? 'Mashhurlardan olib tashlash' : 'Mashhur qilish',
                  text: '⭐',
                  onclick: async () => {
                    try {
                      await api.patch(`/promotions/${product.id}/featured`, { featured: product.is_featured !== 1 });
                      toast('Yangilandi', 'success');
                      rerender();
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
                    const confirmed = await confirmAction(
                      `«${product.brand} ${product.model}» o‘chirilsinmi? Buyurtma tarixidagi yozuvlar saqlanib qoladi.`,
                      { confirmText: 'O‘chirish' },
                    );
                    if (!confirmed) return;
                    try {
                      await api.del(`/products/${product.id}`);
                      toast('Mahsulot o‘chirildi', 'success');
                      rerender();
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

    mount.append(el('div', { class: 'card' }, [el('div', { class: 'table-wrap' }, table)]));
    mount.append(
      el('div', { class: 'between mt-1' }, [
        el('span', { class: 'small muted', text: `Jami: ${result.total} ta mahsulot` }),
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
