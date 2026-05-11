import { announce } from './a11y/announcer.ts';
import { moveFocusTo } from './a11y/focus.ts';

export type RouteHandler = (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];
let mainEl: HTMLElement | null = null;

export function defineRoute(path: string, handler: RouteHandler): void {
  // Convert /path/:param to a RegExp and extract param names
  const paramNames: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:([^/]+)/g, (_: string, name: string) => {
        paramNames.push(name);
        return '([^/]+)';
      }) +
      '/?$',
  );
  routes.push({ pattern, paramNames, handler });
}

export function navigate(to: string, replace = false): void {
  if (replace) {
    history.replaceState(null, '', to);
  } else {
    history.pushState(null, '', to);
  }
  void render(to);
}

async function render(path: string): Promise<void> {
  if (!mainEl) mainEl = document.getElementById('main');
  if (!mainEl) return;

  for (const route of routes) {
    const match = path.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1] ?? '');
    });

    // Show loading state
    mainEl.innerHTML =
      '<div class="loading-shell" aria-busy="true"><div class="loading-spinner" aria-hidden="true"></div></div>';

    try {
      const view = await route.handler(params);
      mainEl.innerHTML = '';
      mainEl.appendChild(view);
    } catch (err) {
      console.error('Route render error', err);
      mainEl.innerHTML =
        '<div class="alert alert--error" role="alert"><p>Napaka pri nalaganju strani.</p></div>';
    }

    // Move focus to main after route change (a11y: WCAG 2.4.3)
    moveFocusTo(mainEl);

    // Announce new page title to screen readers
    announce(document.title);

    // Update active nav link
    updateNavLinks(path);
    return;
  }

  // 404
  mainEl.innerHTML =
    '<section><h1>Stran ni najdena</h1><p><a href="/">Nazaj na seznam prijav</a></p></section>';
  moveFocusTo(mainEl);
}

function updateNavLinks(path: string): void {
  document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const isCurrent = href === path || (href !== '/' && path.startsWith(href));
    a.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    a.toggleAttribute('aria-current', isCurrent);
    if (isCurrent) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

export function initRouter(): void {
  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    void render(location.pathname + location.search);
  });

  // Intercept same-origin link clicks
  document.addEventListener('click', (e) => {
    const target = (e.target as Element).closest('a');
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:'))
      return;
    if (target.hasAttribute('download') || target.getAttribute('rel') === 'external') return;
    e.preventDefault();
    navigate(href);
  });

  // Initial render
  void render(location.pathname + location.search);
}
