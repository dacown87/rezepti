import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, FolderOpen, Trash2 } from 'lucide-react-native';

import { useCollectionItems, useRemoveRecipeFromCollection } from '@/hooks/useCollections';
import { ApiRequestError, type ApiRecipe } from '@/utils/api';

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return 'Sammlung oder Rezept nicht gefunden.';
    if (error.status === 400) return 'Aktion nicht möglich.';
    return error.message;
  }
  return 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
}

// ── Remove confirm modal ──────────────────────────────────────────────────────
function RemoveItemModal({
  collectionId, recipe, onClose,
}: { collectionId: string; recipe: ApiRecipe; onClose: () => void }) {
  const remove = useRemoveRecipeFromCollection();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (remove.isPending) return;
    setError(null);
    try {
      await remove.mutateAsync({ collectionId, recipeId: recipe.id });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-2">Aus Sammlung entfernen</Text>
          <Text className="text-warm-500 dark:text-warm-400 mb-1">„{recipe.name}“ aus dieser Sammlung entfernen?</Text>
          <Text className="text-warm-500 dark:text-warm-400 mb-6 text-sm">Das Rezept selbst bleibt erhalten.</Text>
          {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}
          <View className="flex-row gap-3">
            <Pressable onPress={onClose} className="flex-1 py-3 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
              <Text className="text-warm-700 dark:text-warm-200 font-medium">Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={remove.isPending}
              testID="remove-confirm"
              className="flex-1 py-3 rounded-xl bg-red-500 items-center"
            >
              {remove.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className="text-white font-semibold">Entfernen</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CollectionContentsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const itemsQuery = useCollectionItems(id);
  const [removing, setRemoving] = useState<ApiRecipe | null>(null);

  const recipes = itemsQuery.data ?? [];
  const title = name && name.trim() ? name : 'Sammlung';

  const renderItem = ({ item }: { item: ApiRecipe }) => (
    <View
      testID={`collection-recipe-${item.id}`}
      className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 px-3 py-3"
    >
      <Pressable
        onPress={() => router.push(`/recipe/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} öffnen`}
        testID={`open-recipe-${item.id}`}
        className="flex-1 flex-row items-center"
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="w-12 h-12 rounded-xl" />
        ) : (
          <View className="w-12 h-12 rounded-xl bg-warm-100 dark:bg-espresso-700 items-center justify-center">
            <Text className="text-2xl">{item.emoji ?? '🍽️'}</Text>
          </View>
        )}
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold text-warm-900 dark:text-warm-50" numberOfLines={1}>{item.name}</Text>
          <Text className="text-xs text-warm-500 dark:text-warm-400">
            {item.scope === 'household' ? 'Haushalt' : 'Privat'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => setRemoving(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} aus Sammlung entfernen`}
        testID={`remove-recipe-${item.id}`}
        className="p-2"
      >
        <Trash2 size={18} color="#ef4444" />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Zurück" className="mr-3 p-1">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-base font-semibold text-warm-900 dark:text-warm-50 flex-1" numberOfLines={1}>{title}</Text>
      </View>

      {itemsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="collection-items-loading" size="large" color="#C84B31" />
        </View>
      ) : itemsQuery.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">Rezepte konnten nicht geladen werden.</Text>
          <Pressable onPress={() => itemsQuery.refetch()} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
            <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <FolderOpen size={40} color="#d1d5db" />
              <Text className="text-warm-500 dark:text-warm-400 text-sm text-center mt-3">
                Noch keine Rezepte in dieser Sammlung.
              </Text>
            </View>
          }
        />
      )}

      {removing && id && (
        <RemoveItemModal collectionId={id} recipe={removing} onClose={() => setRemoving(null)} />
      )}
    </SafeAreaView>
  );
}
