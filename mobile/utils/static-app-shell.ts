// Web-only companion of the static `rd-audit-shell` placeholder rendered by
// `app/+html.tsx`. The shell gives the first paint a stable, route-aware LCP
// candidate before Expo Web hydration. Once the real UI has rendered it must
// get out of the way instead of covering a ready screen until the fallback
// timer in +html.tsx fires.
export const STATIC_APP_SHELL_ID = 'rd-audit-shell';
const HIDDEN_CLASS = 'rd-audit-shell--hidden';
const FADE_MS = 200;

export function hideStaticAppShell(): void {
  if (typeof document === 'undefined') return;
  const shell = document.getElementById(STATIC_APP_SHELL_ID);
  if (!shell || shell.style.display === 'none') return;
  shell.classList.add(HIDDEN_CLASS);
  setTimeout(() => {
    shell.style.display = 'none';
  }, FADE_MS);
}
