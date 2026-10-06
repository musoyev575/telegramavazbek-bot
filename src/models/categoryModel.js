/**
 * Kategoriyalar (= brendlar) modeli.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow, bool } from './helpers.js';

export function list({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE c.is_active = 1' : '';
  return getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS products_count
       FROM categories c ${where}
       ORDER BY c.sort_order ASC, c.name ASC`,
    )
    .all();
}

export function findById(id) {
  return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id) ?? null;
}

export function findBySlug(slug) {
  return getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) ?? null;
}

export function create(data) {
  const { id } = insertRow('categories', {
    name: data.name,
    slug: data.slug,
    description: data.description ?? null,
    logo_url: data.logoUrl ?? null,
    sort_order: data.sortOrder ?? 0,
    is_active: data.isActive === undefined ? 1 : bool(data.isActive),
  });
  return findById(id);
}

export function update(id, data) {
  updateRow('categories', id, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.slug !== undefined ? { slug: data.slug } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
    ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
    ...(data.isActive !== undefined ? { is_active: bool(data.isActive) } : {}),
  });
  return findById(id);
}

export function remove(id) {
  return getDb().prepare('DELETE FROM categories WHERE id = ?').run(id).changes;
}

export function countProducts(categoryId) {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND is_active = 1')
    .get(categoryId);
  return row?.total ?? 0;
}

export default { list, findById, findBySlug, create, update, remove, countProducts };
