/**
 * Kirish sahifasi logikasi: login so'rovi, xatoliklarni ko'rsatish, muvaffaqiyatda panelga o'tish.
 */
const form = document.getElementById('login-form');
const errorBox = document.getElementById('error');
const submit = document.getElementById('submit');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Tekshirilmoqda...';

  try {
    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({
        username: form.username.value.trim(),
        password: form.password.value,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      errorBox.textContent = payload?.error?.message ?? `Kirish amalga oshmadi (${response.status})`;
      return;
    }

    window.location.href = '/';
  } catch (error) {
    errorBox.textContent = 'Server bilan aloqa yo‘q. Internetni tekshiring.';
    console.error(error);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Kirish';
  }
});
