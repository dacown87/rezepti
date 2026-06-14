import { useEffect, useState } from 'react';
import { View, Text, Platform, Animated, Pressable } from 'react-native';
import { WifiOff, LogIn, RefreshCw, Check } from 'lucide-react-native';

function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Slim banner shown at the top of a screen when the device is offline,
 * a load error occurred, or mutations are being synced.
 *
 * Render precedence (first match wins):
 *   authExpired → offline → isError (load error) → syncing/pending → synced → hidden
 *
 * @param authExpired    Render the distinct "session expired" variant instead of
 *                       the offline/WifiOff framing — a 401 is an auth problem,
 *                       not a network problem, and must not look like one.
 * @param onAuthPress    Tap handler for the authExpired variant (route to login).
 * @param offlineMessage Override the default offline text (shown when !isOnline).
 * @param pending        Number of queued mutations waiting to sync.
 * @param syncState      Current sync state: 'idle' | 'syncing' | 'synced'.
 */
export function OfflineBanner({
  isError = false,
  authExpired = false,
  onAuthPress,
  offlineMessage,
  pending,
  syncState,
}: {
  isError?: boolean;
  authExpired?: boolean;
  onAuthPress?: () => void;
  offlineMessage?: string;
  pending?: number;
  syncState?: 'idle' | 'syncing' | 'synced';
}) {
  const isOnline = useIsOnline();
  const [opacity] = useState(new Animated.Value(0));

  const isSyncing = syncState === 'syncing' || (pending != null && pending > 0 && isOnline && syncState !== 'synced');
  const isSynced = syncState === 'synced';

  const visible = authExpired || !isOnline || isError || isSyncing || isSynced;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  // Auth failure takes precedence: never show the misleading "offline" framing
  // for an expired session — show a tappable re-login prompt instead.
  if (authExpired) {
    return (
      <Animated.View style={{ opacity }}>
        <Pressable
          onPress={onAuthPress}
          accessibilityRole="button"
          accessibilityLabel="Erneut anmelden"
        >
          <View className="bg-amber-600 dark:bg-amber-700 flex-row items-center justify-center gap-2 py-1.5 px-4">
            <LogIn size={13} color="#fffbeb" />
            <Text className="text-xs text-amber-50 font-medium">
              Sitzung abgelaufen — zum Neuanmelden tippen
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // Offline: WifiOff, red framing, alert role. Show pending count if any.
  if (!isOnline) {
    const pendingNote = pending != null && pending > 0
      ? ` · ${pending} Änderung${pending === 1 ? '' : 'en'} wird gespeichert`
      : '';
    return (
      <Animated.View style={{ opacity }}>
        <View
          className="bg-warm-700 dark:bg-warm-800 flex-row items-center justify-center gap-2 py-1.5 px-4"
          accessibilityRole="alert"
        >
          <WifiOff size={13} color="#fef2f2" />
          <Text className="text-xs text-red-100 font-medium">
            {offlineMessage ?? `Offline — zuletzt geladene Rezepte werden angezeigt${pendingNote}`}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Load/permanent error
  if (isError) {
    return (
      <Animated.View style={{ opacity }}>
        <View
          className="bg-warm-700 dark:bg-warm-800 flex-row items-center justify-center gap-2 py-1.5 px-4"
          accessibilityRole="alert"
        >
          <WifiOff size={13} color="#fef2f2" />
          <Text className="text-xs text-red-100 font-medium">
            Rezepte konnten nicht geladen werden
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Syncing: amber, RefreshCw, status role (polite)
  if (isSyncing) {
    const n = pending ?? 1;
    return (
      <Animated.View style={{ opacity }}>
        <View
          className="bg-amber-600 dark:bg-amber-700 flex-row items-center justify-center gap-2 py-1.5 px-4"
          accessibilityRole="status"
        >
          <RefreshCw size={13} color="#fffbeb" />
          <Text className="text-xs text-amber-50 font-medium">
            {`${n} Änderung${n === 1 ? '' : 'en'} ${n === 1 ? 'wird' : 'werden'} synchronisiert…`}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Synced: amber, Check icon, status role (polite)
  if (isSynced) {
    return (
      <Animated.View style={{ opacity }}>
        <View
          className="bg-amber-600 dark:bg-amber-700 flex-row items-center justify-center gap-2 py-1.5 px-4"
          accessibilityRole="status"
        >
          <Check size={13} color="#fffbeb" />
          <Text className="text-xs text-amber-50 font-medium">
            Alle Änderungen gespeichert ✓
          </Text>
        </View>
      </Animated.View>
    );
  }

  return null;
}
