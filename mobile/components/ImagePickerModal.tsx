import { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, TextInput as RNTextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Search } from 'lucide-react-native';
import { getServerUrl } from '@/utils/server-url';

interface ImagePickerModalProps {
  images: string[];
  onSelect: (url: string) => Promise<void>;
  onSkip: () => void;
}

export function ImagePickerModal({ images, onSelect, onSkip }: ImagePickerModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const handleSelect = async () => {
    if (!selected) return;
    setSaving(true);
    await onSelect(selected);
    setSaving(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(false);
    try {
      const serverUrl = await getServerUrl();
      const res = await fetch(`${serverUrl}/api/v1/images/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.images ?? []);
    } catch {
      setSearchError(true);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const displayedImages = searchResults.length > 0 ? searchResults : images;

  return (
    <SafeAreaView className="flex-1 bg-warm-50">
      {/* Fixed header */}
      <View className="px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-warm-900">Passendes Bild wählen</Text>
        <Text className="text-warm-500 mt-1 text-sm">
          {searchResults.length > 0
            ? 'Suchergebnisse'
            : images.length > 0
              ? 'Von Chefkoch.de — oder eigene Suche'
              : 'Suche nach einem Bild für dein Rezept'}
        </Text>
      </View>

      {/* Fixed search */}
      <View className="px-4 pb-3">
        <View className="flex-row gap-2">
          <View className="flex-1 bg-white border border-warm-200 rounded-xl px-3 py-2.5">
            <RNTextInput
              className="text-base text-warm-900"
              placeholder="Bild suchen..."
              placeholderTextColor="#9E8878"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <Pressable
            onPress={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className={`px-4 rounded-xl items-center justify-center ${isSearching || !searchQuery.trim() ? 'bg-warm-200' : 'bg-primary-500'}`}
          >
            {isSearching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Search size={20} color={searchQuery.trim() ? '#fff' : '#9E8878'} />
            )}
          </Pressable>
        </View>
        {searchError && (
          <Text className="text-red-500 text-sm mt-2">Suche fehlgeschlagen — bitte nochmal versuchen</Text>
        )}
      </View>

      {/* Fixed action buttons */}
      <View className="flex-row gap-3 px-4 pb-4">
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

      {/* Scrollable image grid */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, flexDirection: 'row', flexWrap: 'wrap' }}>
        {displayedImages.length === 0 ? (
          <Text className="text-warm-400 text-sm">Keine Treffer gefunden — suche selbst nach einem Bild</Text>
        ) : (
          displayedImages.map((uri) => (
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
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
