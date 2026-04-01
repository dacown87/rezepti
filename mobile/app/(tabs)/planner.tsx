import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlannerScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-xl font-semibold text-gray-700">Wochenplaner</Text>
        <Text className="text-gray-400 mt-2">Kommt in Phase 3</Text>
      </View>
    </SafeAreaView>
  );
}
