import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogIn, RefreshCcw } from 'lucide-react-native';
import type { ProtectedAccessState } from '@/utils/protected-access';

export function ProtectedAccessNotice({
  state,
  onRetry,
  compact = false,
}: {
  state: ProtectedAccessState;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View className={`rounded-2xl border border-amber-200 bg-amber-50 ${compact ? 'px-4 py-4' : 'px-5 py-5'}`}>
      <Text className="text-base font-semibold text-amber-900">{state.title}</Text>
      <Text className="mt-2 text-sm leading-5 text-amber-800">{state.message}</Text>
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => router.push(state.primaryHref)}
          className="flex-row items-center rounded-xl bg-amber-900 px-3 py-2"
        >
          <LogIn size={15} color="#fff" />
          <Text className="ml-2 text-sm font-medium text-white">{state.primaryLabel}</Text>
        </Pressable>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            className="flex-row items-center rounded-xl border border-amber-300 px-3 py-2"
          >
            <RefreshCcw size={15} color="#92400e" />
            <Text className="ml-2 text-sm font-medium text-amber-800">Erneut versuchen</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
