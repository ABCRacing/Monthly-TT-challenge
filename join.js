'use strict';
(() => {
  const link = document.getElementById('steam-register');
  const status = document.getElementById('registration-status');
  const raw = String(window.ABC_REGISTRATION_ORIGIN || '').trim();
  if (!link || !status || !raw) return;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return;
    link.href = url.origin + '/auth/start';
    link.removeAttribute('aria-disabled');
    status.textContent = 'Registration is open. You will be redirected to Steam to verify your account.';
  } catch (err) {
    console.warn('Registration URL is not configured', err);
  }
})();
