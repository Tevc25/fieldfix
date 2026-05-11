export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  duration?: number; // ms, 0 = persistent
}

export function showToast(message: string, opts: ToastOptions = {}): void {
  const { type = 'info', duration = 5000 } = opts;

  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'Zapri obvestilo');
  close.textContent = '✕';
  close.addEventListener('click', () => dismiss());

  toast.append(text, close);
  container.appendChild(toast);

  function dismiss(): void {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(1rem)';
    toast.style.transition = 'opacity 200ms, transform 200ms';
    window.setTimeout(() => toast.remove(), 200);
  }

  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }
}
