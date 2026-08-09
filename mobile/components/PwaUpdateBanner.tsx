import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { RefreshCw, X } from 'lucide-react-native';
import { usePwaUpdate } from '@/hooks/usePwaUpdate';

/**
 * Global, always-mounted counterpart to the update card in Settings
 * (`mobile/app/(tabs)/settings.tsx`). Deploys silently leave the installed
 * PWA on the old build until reload — this makes that fact visible no matter
 * which screen the user is on, not just when they happen to scroll through
 * Settings.
 *
 * Uses its own `usePwaUpdate()` instance (see hook docs for why two
 * instances instead of a Context). Dismissal is session-only local state;
 * the update path stays reachable via the Settings card regardless.
 */
export function PwaUpdateBanner() {
  const { updateReady, applyUpdate } = usePwaUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateReady || dismissed) return null;

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 }}
      pointerEvents="box-none"
    >
      <View
        className="bg-blue-600 dark:bg-blue-700 flex-row items-center justify-between gap-3 px-4 py-3"
        accessibilityRole="alert"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <RefreshCw size={16} color="#eff6ff" />
          <Text className="text-sm font-semibold text-white flex-1">
            Neue Version verfügbar
          </Text>
        </View>

        <Pressable
          onPress={applyUpdate}
          accessibilityRole="button"
          accessibilityLabel="Update jetzt anwenden"
          className="bg-white/20 rounded-lg px-3 py-1.5"
        >
          <Text className="text-xs font-semibold text-white">Aktualisieren</Text>
        </Pressable>

        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Hinweis ausblenden"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={16} color="#eff6ff" />
        </Pressable>
      </View>
    </View>
  );
}
