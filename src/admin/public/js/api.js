/**
 * API klienti: barcha so'rovlarga CSRF sarlavhasi qo'shiladi, 401 bo'lsa kirish sahifasiga o'tadi.
 * Serverga faqat shu modul orqali murojaat qilinadi — xatoliklar bir joyda boshqariladi.
 */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const HEADERS = { 'X-Requested-With': 'fetch' };

async function request(path, { method = 'GET', body, formData = null } = {}) {
  const options = { method, credentials: 'same-origin', headers: { ...HEADERS } };

  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api/admin${path}`, options);
  } catch {
    throw new ApiError('Server bilan aloqa yo‘q', 'network_error', 0);
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    throw new ApiError(payload?.error?.message ?? 'Sessiya tugadi', 'unauthorized', 401);
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Xatolik (${response.status})`,
      payload?.error?.code ?? 'error',
      response.status,
    );
  }

  return payload.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return request(path, { method: 'POST', formData });
  },
};

/** Query string yasash (undefined/null qiymatlar tushirib qoldiriladi) */
export function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, value === true ? '1' : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export default api;
