import { useEffect, useState } from 'react';
import { View, Text, Platform, Animated } from 'react-native';
import { WifiOff } from 'lucide-react-native';

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
 * Slim banner shown at the top of a screen when the device is offline.
 * Uses navigator.onLine on web. On native, relies on React Query's
 * error state (pass isError=true when a query fails with a network error).
 */
export function OfflineBanner({ isError = false }: { isError?: boolean }) {
  const isOnline = useIsOnline();
  const [opacity] = useState(new Animated.Value(0));

  const visible = !isOnline || isError;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity }}>
      <View className="bg-warm-700 dark:bg-warm-800 flex-row items-center justify-center gap-2 py-1.5 px-4">
        <WifiOff size={13} color="#fef2f2" />
        <Text className="text-xs text-red-100 font-medium">
          {!isOnline ? 'Keine Verbindung — gespeicherte Rezepte werden angezeigt' : 'Rezepte konnten nicht geladen werden'}
        </Text>
      </View>
    </Animated.View>
  );
}
