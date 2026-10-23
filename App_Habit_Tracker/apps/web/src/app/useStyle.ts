import {
  resolveStyle,
  type LocalDate,
  type StyleSetting,
  type VisualStyle,
} from '@habit-tracker/shared';
import { useEffect } from 'react';

// Puts the active style on <html data-style>, which selects its CSS variables (ADR 0009).
export function useStyle(setting: StyleSetting, today: LocalDate): VisualStyle {
  const style = resolveStyle(setting, today);
  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);
  return style;
}
