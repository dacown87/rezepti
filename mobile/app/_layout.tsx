import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { useColorScheme } from '@/components/useColorScheme';
import { useThemeInit } from '@/utils/use-theme';
import { queryClient, asyncStoragePersister } from '@/utils/query-client';
import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({});

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <RootLayoutNav />
    </PersistQueryClientProvider>
  );
}

function RootLayoutNav() {
  const { colorScheme } = useColorScheme();
  useThemeInit();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
