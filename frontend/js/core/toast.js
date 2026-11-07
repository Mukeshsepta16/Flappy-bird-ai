export function toast(message, kind = 'info', ms = 3200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); }, ms);
}
