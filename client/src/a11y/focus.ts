/**
 * Focus management utilities.
 * - moveFocusTo: moves focus to an element after route transitions
 * - trapFocus: traps keyboard focus inside a modal/dialog
 * - restoreFocus: restores focus to the element that triggered an overlay
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Move focus to element; falls back to #main then <body>. */
export function moveFocusTo(el: HTMLElement | null): void {
  if (!el) return;
  // Make transiently focusable if needed
  const hadTabIndex = el.hasAttribute('tabindex');
  if (!hadTabIndex) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: false });
  if (!hadTabIndex) el.removeAttribute('tabindex');
}

/** Move focus to the first heading or first focusable element in a container. */
export function moveFocusToContent(container: HTMLElement): void {
  const heading = container.querySelector<HTMLElement>('h1, h2, h3');
  if (heading) {
    moveFocusTo(heading);
    return;
  }
  const first = container.querySelector<HTMLElement>(FOCUSABLE);
  moveFocusTo(first ?? container);
}

let savedFocusEl: HTMLElement | null = null;

export function saveFocus(): void {
  savedFocusEl = document.activeElement as HTMLElement | null;
}

export function restoreFocus(): void {
  if (savedFocusEl && document.contains(savedFocusEl)) {
    savedFocusEl.focus();
  }
  savedFocusEl = null;
}

/** Trap keyboard focus inside container (for modals/dialogs). Returns cleanup fn. */
export function trapFocus(container: HTMLElement): () => void {
  const getFocusable = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none',
    );

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);
  return () => container.removeEventListener('keydown', handleKeyDown);
}
