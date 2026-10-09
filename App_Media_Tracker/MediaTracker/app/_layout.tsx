import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenuActions } from '@/hooks/useMenuActions';
import { useReminders } from '@/hooks/useReminders';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useReminders();
  useMenuActions();
  
  const PastelDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#23201D',
      card: '#2D2824',
      text: '#F2E8D5',
      border: '#3F3933',
      notification: '#E36E4F',
      primary: '#9CA3AF'
    },
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? PastelDarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Añadir Elemento' }} />
        <Stack.Screen name="newListModal" options={{ presentation: 'modal', title: 'Nueva Lista' }} />
        <Stack.Screen name="globalSettingsModal" options={{ presentation: 'modal', title: 'Ajustes Globales' }} />
        <Stack.Screen name="pileSettingsModal" options={{ presentation: 'modal', title: 'Opciones de Visualización' }} />
        <Stack.Screen name="listSettingsModal" options={{ presentation: 'modal', title: 'Ajustes de Lista' }} />
        <Stack.Screen name="searchModal" options={{ presentation: 'modal', title: 'Buscar', headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="list/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </ThemeProvider>
  );
}
