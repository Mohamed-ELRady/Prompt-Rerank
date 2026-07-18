import { useEffect } from 'react';
import { applyTheme, type ThemePreference } from './theme';

/** Keeps document.documentElement's data-theme in sync (extension pages). */
export function useTheme(preference: ThemePreference | undefined): void {
  useEffect(() => {
    if (preference === undefined) {
      return;
    }
    return applyTheme(document.documentElement, preference);
  }, [preference]);
}
