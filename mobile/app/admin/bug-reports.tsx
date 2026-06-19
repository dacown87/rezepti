import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bug } from 'lucide-react-native';

export default function AdminBugReportsPlaceholderScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <View className="px-4 py-6">
        <View className="flex-row items-center mb-3">
          <Bug size={20} color="#8B7355" />
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 ml-2">Bug Reports</Text>
        </View>
        <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5">
          <Text className="text-sm text-warm-600 dark:text-warm-300">
            Dieser Bereich ist als Andockstelle für den nächsten Slice reserviert:
            Admin-Übersicht, Detailansicht und Statuspflege für Bug Reports.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
