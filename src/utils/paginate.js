/**
 * Sahifalash (pagination) yordamchisi — bot katalogi va admin API uchun umumiy.
 */

export function paginate(items, page = 1, perPage = 10) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(perPage) || 10);
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (current - 1) * size;
  return {
    items: list.slice(start, start + size),
    page: current,
    perPage: size,
    total: list.length,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
    from: list.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, list.length),
  };
}

/** SQL uchun LIMIT/OFFSET hisoblash */
export function pageToOffset(page = 1, perPage = 10) {
  const current = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(perPage) || 10);
  return { limit: size, offset: (current - 1) * size, page: current, perPage: size };
}

export default { paginate, pageToOffset };
