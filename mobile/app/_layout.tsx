import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { useColorScheme } from '@/components/useColorScheme';
import { useThemeInit } from '@/utils/use-theme';
import { queryClient, asyncStoragePersister, startAuthQueryCacheWatch } from '@/utils/query-client';
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
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let stopWatching = () => {};

    void startAuthQueryCacheWatch().then((stop) => {
      if (!active) {
        stop();
        return;
      }
      stopWatching = stop;
    });

    return () => {
      active = false;
      stopWatching();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let stopObserving = () => {};

    void import('@/utils/auth').then(({ registerAuthRedirectObserver }) => {
      if (!active) {
        return;
      }

      stopObserving = registerAuthRedirectObserver({
        onPasswordRecovery: (redirect) => {
          router.replace({
            pathname: '/account',
            params: {
              mode: 'update-password',
              ...(redirect?.returnTo ? { returnTo: redirect.returnTo } : {}),
            },
          });
        },
        onLinkError: (message) => {
          router.replace({
            pathname: '/account',
            params: { authError: message },
          });
        },
      });
    });

    return () => {
      active = false;
      stopObserving();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
