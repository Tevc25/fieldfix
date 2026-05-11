/**
 * Screen reader live region announcer.
 * Uses the #announcer element (role="status", aria-live="polite").
 * Clears and re-sets text so repeated identical messages are re-read.
 */

let announceTimeout = 0;

export function announce(message: string, delay = 100): void {
  const el = document.getElementById('announcer');
  if (!el) return;

  // Clear first so re-announcing the same string triggers a DOM change
  el.textContent = '';

  window.clearTimeout(announceTimeout);
  announceTimeout = window.setTimeout(() => {
    el.textContent = message;
  }, delay);
}
