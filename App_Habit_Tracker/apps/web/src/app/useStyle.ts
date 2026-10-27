import {
  resolveStyle,
  type LocalDate,
  type StyleSetting,
  type VisualStyle,
} from '@habit-tracker/shared';
import { useEffect } from 'react';

// The browser bar on the phone takes the page background of the active style and mode.
function syncThemeColor(): void {
  const color = getComputedStyle(document.body).backgroundColor;
  if (color === '') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = color;
}

// Puts the active style on <html data-style>, which selects its CSS variables (ADR 0009).
export function useStyle(setting: StyleSetting, today: LocalDate): VisualStyle {
  const style = resolveStyle(setting, today);
  useEffect(() => {
    document.documentElement.dataset.style = style;
    syncThemeColor();
    // jsdom (the unit tests' DOM) has no matchMedia.
    if (typeof window.matchMedia !== 'function') return;
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', syncThemeColor);
    return () => {
      scheme.removeEventListener('change', syncThemeColor);
    };
  }, [style]);
  return style;
}
