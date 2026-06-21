import { Pressable, Text } from 'react-native';
import { Bug } from 'lucide-react-native';

export function BugReportHeaderAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Problem melden"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 16,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9C2A8',
        backgroundColor: '#F5E6D8',
      }}
    >
      <Bug size={16} color="#6B4F3A" />
      <Text
        style={{
          color: '#6B4F3A',
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        Problem melden
      </Text>
    </Pressable>
  );
}
