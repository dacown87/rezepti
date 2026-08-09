import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable } from 'react-native';
import 'react-native-reanimated';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Bug } from 'lucide-react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { BugReportHeaderAction } from '@/components/BugReportHeaderAction';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { useThemeInit } from '@/utils/use-theme';
import {
  queryClient,
  asyncStoragePersister,
  startAuthQueryCacheWatch,
  getSessionRestoring,
  subscribeSessionRestoring,
} from '@/utils/query-client';
import { getAuthSession, getSupabaseClient } from '@/utils/auth';
import BugReportModal from '@/components/BugReportModal';
import { openBugReportModal, registerBugReportModalController, type OpenBugReportIntent } from '@/utils/bug-reporting';
import {
  buildLoginFirstAccountHref,
  isPublicLoginFirstPath,
  LOGIN_FIRST_ACCOUNT_GATE_ENABLED,
} from '@/utils/login-first-routing';
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
  const pathname = usePathname();
  const [sessionRestoring, setSessionRestoring] = useState<boolean>(() => getSessionRestoring());
  const [bugReportIntent, setBugReportIntent] = useState<OpenBugReportIntent | null>(null);
  const [bugReportVisible, setBugReportVisible] = useState(false);
  const [authConfigured, setAuthConfigured] = useState<boolean>(() => getSupabaseClient() !== null);
  const [authState, setAuthState] = useState<'unknown' | 'signed_out' | 'signed_in'>('unknown');

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
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (e: MessageEvent) => {
      if ((e as MessageEvent).data?.type === 'FLUSH_QUEUE') {
        void import('@/offline/queue-singleton').then((m) => m.flushOnce());
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
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

  useEffect(() => {
    setAuthConfigured(getSupabaseClient() !== null);
    let active = true;

    void getAuthSession().then((session) => {
      if (!active) return;
      setAuthState(session?.user ? 'signed_in' : 'signed_out');
    }).catch(() => {
      if (!active) return;
      setAuthState('signed_out');
    });

    const client = getSupabaseClient();
    if (!client) {
      setAuthState('signed_out');
      return () => {
        active = false;
      };
    }

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthState(session?.user ? 'signed_in' : 'signed_out');
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!LOGIN_FIRST_ACCOUNT_GATE_ENABLED || sessionRestoring) {
      return;
    }

    if (authState !== 'signed_out' || isPublicLoginFirstPath(pathname)) {
      return;
    }

    router.replace(buildLoginFirstAccountHref(pathname));
  }, [authState, pathname, router, sessionRestoring]);

  useEffect(() => {
    return registerBugReportModalController((intent) => {
      setBugReportIntent(intent);
      setBugReportVisible(true);
    });
  }, []);

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

  const redirectingToAccount = LOGIN_FIRST_ACCOUNT_GATE_ENABLED
    && authState === 'signed_out'
    && !isPublicLoginFirstPath(pathname);

  const showHeaderBugAction = LOGIN_FIRST_ACCOUNT_GATE_ENABLED
    && authConfigured
    && authState === 'signed_in'
    && pathname !== '/account';

  const openGlobalBugReport = () => {
    openBugReportModal({
      reportType: 'general',
      sourceArea: 'global_button',
      route: pathname,
    });
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {redirectingToAccount ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colorScheme === 'dark' ? '#1a1008' : '#faf7f2',
            }}
          >
            <ActivityIndicator size="large" color="#C84B31" />
            <Text
              style={{
                marginTop: 12,
                fontSize: 14,
                color: colorScheme === 'dark' ? '#c8b89a' : '#8B7355',
              }}
            >
              Anmeldung wird geöffnet…
            </Text>
          </View>
        ) : (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen
            name="admin/index"
            options={{
              title: 'Admin Hub',
              headerRight: showHeaderBugAction ? () => (
                <BugReportHeaderAction onPress={openGlobalBugReport} />
              ) : undefined,
            }}
          />
          <Stack.Screen
            name="admin/byok-validation-policy"
            options={{
              title: 'BYOK Validation Policy',
              headerRight: showHeaderBugAction ? () => (
                <BugReportHeaderAction onPress={openGlobalBugReport} />
              ) : undefined,
            }}
          />
          <Stack.Screen
            name="admin/bug-reports"
            options={{
              title: 'Bug Reports',
              headerRight: showHeaderBugAction ? () => (
                <BugReportHeaderAction onPress={openGlobalBugReport} />
              ) : undefined,
            }}
          />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="share-invite/[token]" options={{ headerShown: false }} />
          <Stack.Screen name="collections" options={{ headerShown: false }} />
          <Stack.Screen name="collection/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        )}

        <PwaUpdateBanner />

        {!LOGIN_FIRST_ACCOUNT_GATE_ENABLED && authConfigured ? (
          <Pressable
            onPress={() => {
              if (authState === 'signed_in') {
                openGlobalBugReport();
                return;
              }

              router.push(buildLoginFirstAccountHref(pathname));
            }}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 24,
              backgroundColor: '#F5E6D8',
              borderColor: '#D9C2A8',
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Bug size={16} color="#8B7355" />
            <Text style={{ color: '#6B4F3A', fontWeight: '600', fontSize: 13 }}>
              {authState === 'signed_in' ? 'Problem melden' : 'Anmelden für Report'}
            </Text>
          </Pressable>
        ) : null}

        <BugReportModal
          visible={bugReportVisible}
          intent={bugReportIntent}
          onClose={() => {
            setBugReportVisible(false);
            setBugReportIntent(null);
          }}
        />
      </View>
    </ThemeProvider>
  );
}
