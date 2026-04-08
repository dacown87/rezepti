import { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle } from 'lucide-react-native';

interface ImagePickerModalProps {
  images: string[];
  onSelect: (url: string) => Promise<void>;
  onSkip: () => void;
}

export function ImagePickerModal({ images, onSelect, onSkip }: ImagePickerModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async () => {
    if (!selected) return;
    setSaving(true);
    await onSelect(selected);
    setSaving(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-50">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-2xl font-bold text-warm-900">Passendes Bild wählen</Text>
        <Text className="text-warm-500 mt-1 text-sm">
          Gefunden auf Chefkoch.de — tippe ein Bild an
        </Text>
      </View>

      <View className="flex-row flex-wrap px-4 gap-3">
        {images.map((uri) => (
          <Pressable
            key={uri}
            onPress={() => setSelected(uri)}
            className="rounded-2xl overflow-hidden"
            style={{ width: '47%', aspectRatio: 4 / 3 }}
          >
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {selected === uri && (
              <View
                className="absolute inset-0 rounded-2xl"
                style={{ borderWidth: 3, borderColor: '#C84B31' }}
              />
            )}
            {selected === uri && (
              <View className="absolute top-2 right-2 bg-primary-500 rounded-full p-1">
                <CheckCircle size={16} color="#fff" />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <View className="flex-row gap-3 px-4 mt-6">
        <Pressable
          onPress={onSkip}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border border-warm-200 bg-white items-center"
        >
          <Text className="text-warm-700 font-medium">Überspringen</Text>
        </Pressable>
        <Pressable
          onPress={handleSelect}
          disabled={!selected || saving}
          className={`flex-1 py-3 rounded-xl items-center ${selected ? 'bg-primary-500' : 'bg-warm-200'}`}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text className={`font-semibold ${selected ? 'text-white' : 'text-warm-500'}`}>Auswählen</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
