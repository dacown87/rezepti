import { View, Text, Pressable } from 'react-native'

// Web nutzt den QR-Scanner in ExtractionPage (Mode 'qr')
// Dieser Component wird auf Web nicht direkt genutzt
export default function ScannerCamera({
  onClose,
}: {
  onScan: (v: string) => void
  onClose: () => void
}) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-white">
      <Text className="text-base text-gray-600 text-center mb-6">
        QR-Scanner ist auf Web im Extrahieren-Tab verfügbar.
      </Text>
      <Pressable
        onPress={onClose}
        className="bg-orange-500 px-6 py-3 rounded-xl"
      >
        <Text className="text-white font-semibold">Schließen</Text>
      </Pressable>
    </View>
  )
}
