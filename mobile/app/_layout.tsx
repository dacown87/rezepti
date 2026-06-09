import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import 'react-native-reanimated';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { useColorScheme } from '@/components/useColorScheme';
import { useThemeInit } from '@/utils/use-theme';
import {
  queryClient,
  asyncStoragePersister,
  startAuthQueryCacheWatch,
  getSessionRestoring,
  subscribeSessionRestoring,
} from '@/utils/query-client';
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
  const [sessionRestoring, setSessionRestoring] = useState<boolean>(() => getSessionRestoring());

  useEffect(() => {
    // Subscribe to session-restore state so we stop showing the interstitial
    // as soon as Supabase fires the first INITIAL_SESSION event.
    if (!getSessionRestoring()) {
      // Already resolved before this component mounted (e.g. fast hydration).
      setSessionRestoring(false);
      return;
    }
    const unsub = subscribeSessionRestoring((restoring) => {
      setSessionRestoring(restoring);
    });
    return unsub;
  }, []);

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
        onConfirmationSuccess: (redirect) => {
          router.replace({
            pathname: '/account',
            params: {
              confirmationSuccess: '1',
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

  if (sessionRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#1a1008' : '#faf7f2' }}>
        <ActivityIndicator size="large" color="#C84B31" />
        <Text style={{ marginTop: 12, fontSize: 14, color: colorScheme === 'dark' ? '#c8b89a' : '#8B7355' }}>
          Session wird wiederhergestellt…
        </Text>
      </View>
    );
  }

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
