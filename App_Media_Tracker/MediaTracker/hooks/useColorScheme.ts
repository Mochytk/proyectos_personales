import { Appearance } from 'react-native';
import { useState, useEffect } from 'react';

export function useColorScheme(): 'light' | 'dark' {
  const scheme = Appearance.getColorScheme();
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(scheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    setColorScheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    return () => subscription.remove();
  }, []);

  return colorScheme;
}
