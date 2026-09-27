import type { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { LEGAL_LAST_UPDATED, LEGAL_PLACEHOLDERS_OPEN } from '@/utils/legal-operator';

// Shared shell for the public legal pages (/impressum, /datenschutz). Both are
// reachable without login, see isPublicLoginFirstPath.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Zurück" className="mr-3 p-1">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text accessibilityRole="header" className="text-base font-semibold text-warm-900 dark:text-warm-50 flex-1">
          {title}
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-5 py-6 max-w-3xl w-full self-center">
        {LEGAL_PLACEHOLDERS_OPEN ? (
          <View className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              Entwurf: Einige Angaben zum Betreiber fehlen noch und sind in eckigen Klammern markiert.
            </Text>
          </View>
        ) : null}
        {children}
        <Text className="mt-8 text-xs text-warm-500 dark:text-warm-400">Stand: {LEGAL_LAST_UPDATED}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="mt-6 mb-2 text-lg font-semibold text-warm-900 dark:text-warm-50">
      {children}
    </Text>
  );
}

export function LegalText({ children }: { children: ReactNode }) {
  return <Text className="mb-3 text-sm leading-6 text-warm-800 dark:text-warm-100">{children}</Text>;
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <View className="mb-3">
      {items.map((item) => (
        <Text key={item} className="mb-1 text-sm leading-6 text-warm-800 dark:text-warm-100">
          {'•  '}
          {item}
        </Text>
      ))}
    </View>
  );
}

// Footer links to the legal pages, shown on the login screen and in Settings.
export function LegalLinks() {
  return (
    <View className="mt-6 mb-2 flex-row justify-center gap-6">
      <Pressable onPress={() => router.push('/impressum')} accessibilityRole="link">
        <Text className="text-xs text-warm-500 underline dark:text-warm-400">Impressum</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/datenschutz')} accessibilityRole="link">
        <Text className="text-xs text-warm-500 underline dark:text-warm-400">Datenschutz</Text>
      </Pressable>
    </View>
  );
}
