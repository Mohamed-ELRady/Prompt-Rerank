/**
 * Theme resolution (FR-A7): the stored preference ('system' | 'light' |
 * 'dark') becomes a data-theme attribute that the Tailwind dark: variant
 * keys off. 'system' tracks the OS live via matchMedia.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') {
    return preference;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies the preference to `root` and keeps it updated while the preference
 * is 'system'. Returns a cleanup function.
 */
export function applyTheme(root: HTMLElement, preference: ThemePreference): () => void {
  root.dataset.theme = resolveTheme(preference);
  if (preference !== 'system') {
    return () => undefined;
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    root.dataset.theme = resolveTheme(preference);
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}
