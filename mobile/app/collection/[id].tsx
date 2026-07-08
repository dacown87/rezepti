import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, FolderOpen, Trash2, CheckSquare, Square, Copy } from 'lucide-react-native';

import {
  useCollectionItems,
  useRemoveRecipeFromCollection,
  useBulkRemoveFromCollection,
  useBulkCopyCollectionItems,
  useCollections,
} from '@/hooks/useCollections';
import { ApiRequestError, type ApiRecipe, type CollectionBulkResult } from '@/utils/api';

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return 'Sammlung oder Rezept nicht gefunden.';
    if (error.status === 400) return 'Aktion nicht möglich.';
    return error.message;
  }
  return 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
}

type SortMode = 'manual' | 'newest' | 'title';

function bulkMessage(result: CollectionBulkResult) {
  const ok = result.succeeded.length;
  const failed = result.failed.length;
  if (failed === 0) return `${ok} ${ok === 1 ? 'Rezept' : 'Rezepte'} verarbeitet.`;
  return `${ok} verarbeitet, ${failed} nicht verarbeitet.`;
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
  const collectionsQuery = useCollections();
  const bulkRemove = useBulkRemoveFromCollection();
  const bulkCopy = useBulkCopyCollectionItems();
  const [removing, setRemoving] = useState<ApiRecipe | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [showCopyTargets, setShowCopyTargets] = useState(false);

  const recipes = [...(itemsQuery.data ?? [])].sort((a, b) => {
    if (sortMode === 'title') return a.name.localeCompare(b.name, 'de');
    if (sortMode === 'newest') return Number(b.id) - Number(a.id);
    return 0;
  });
  const title = name && name.trim() ? name : 'Sammlung';
  const selectedRecipeIds = [...selectedIds];
  const selectableTargetCollections = (collectionsQuery.data ?? []).filter((collection) => !collection.is_system && collection.id !== id);

  const toggleSelected = (recipeId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkRemove = async () => {
    if (!id || selectedRecipeIds.length === 0 || bulkRemove.isPending) return;
    setBulkError(null);
    setBulkFeedback(null);
    try {
      const result = await bulkRemove.mutateAsync({ collectionId: id, recipeIds: selectedRecipeIds });
      setBulkFeedback(bulkMessage(result));
      clearSelection();
    } catch (error) {
      setBulkError(errorMessage(error));
    }
  };

  const handleBulkCopy = async (targetCollectionId: string) => {
    if (!id || selectedRecipeIds.length === 0 || bulkCopy.isPending) return;
    setBulkError(null);
    setBulkFeedback(null);
    try {
      const result = await bulkCopy.mutateAsync({ collectionId: id, targetCollectionId, recipeIds: selectedRecipeIds });
      setBulkFeedback(bulkMessage(result));
      setShowCopyTargets(false);
      clearSelection();
    } catch (error) {
      setBulkError(errorMessage(error));
    }
  };

  const renderItem = ({ item }: { item: ApiRecipe }) => (
    <View
      testID={`collection-recipe-${item.id}`}
      className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 px-3 py-3"
    >
      <Pressable
        onPress={() => selectionMode ? toggleSelected(item.id) : router.push(`/recipe/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={selectionMode ? `${item.name} auswählen` : `${item.name} öffnen`}
        testID={`open-recipe-${item.id}`}
        className="flex-1 flex-row items-center"
      >
        {selectionMode && (
          <View className="mr-2">
            {selectedIds.has(item.id)
              ? <CheckSquare size={20} color="#C84B31" />
              : <Square size={20} color="#9E8878" />}
          </View>
        )}
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
      {!selectionMode && (
        <Pressable
          onPress={() => setRemoving(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} aus Sammlung entfernen`}
          testID={`remove-recipe-${item.id}`}
          className="p-2"
        >
          <Trash2 size={18} color="#ef4444" />
        </Pressable>
      )}
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
        <Pressable
          onPress={() => selectionMode ? clearSelection() : setSelectionMode(true)}
          testID="collection-selection-toggle"
          className="px-3 py-1.5 rounded-xl border border-warm-200 dark:border-warm-700"
        >
          <Text className="text-xs font-medium text-warm-700 dark:text-warm-200">
            {selectionMode ? 'Fertig' : 'Auswahl'}
          </Text>
        </Pressable>
      </View>

      <View className="px-4 py-3 gap-2 bg-white dark:bg-espresso-800 border-b border-warm-100 dark:border-warm-700">
        <View className="flex-row gap-2">
          {(['manual', 'newest', 'title'] as SortMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setSortMode(mode)}
              testID={`collection-sort-${mode}`}
              className={`px-3 py-1.5 rounded-full border ${sortMode === mode ? 'bg-primary-500 border-primary-500' : 'border-warm-200 dark:border-warm-700'}`}
            >
              <Text className={`text-xs font-medium ${sortMode === mode ? 'text-white' : 'text-warm-600 dark:text-warm-300'}`}>
                {mode === 'manual' ? 'Manuell' : mode === 'newest' ? 'Neueste' : 'Titel'}
              </Text>
            </Pressable>
          ))}
        </View>
        {selectionMode && (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-xs text-warm-500 dark:text-warm-400">{selectedIds.size} ausgewählt</Text>
            <Pressable
              onPress={() => setShowCopyTargets(true)}
              disabled={selectedIds.size === 0}
              testID="bulk-copy-open"
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-xl ${selectedIds.size ? 'bg-primary-50 border border-primary-200' : 'bg-warm-100'}`}
            >
              <Copy size={14} color={selectedIds.size ? '#C84B31' : '#9E8878'} />
              <Text className={`text-xs font-medium ${selectedIds.size ? 'text-primary-500' : 'text-warm-500'}`}>Kopieren</Text>
            </Pressable>
            <Pressable
              onPress={handleBulkRemove}
              disabled={selectedIds.size === 0 || bulkRemove.isPending}
              testID="bulk-remove-confirm"
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-xl ${selectedIds.size ? 'bg-red-50 border border-red-200' : 'bg-warm-100'}`}
            >
              <Trash2 size={14} color={selectedIds.size ? '#ef4444' : '#9E8878'} />
              <Text className={`text-xs font-medium ${selectedIds.size ? 'text-red-600' : 'text-warm-500'}`}>Entfernen</Text>
            </Pressable>
          </View>
        )}
        {bulkError && <Text className="text-xs text-red-600" testID="collection-bulk-error">{bulkError}</Text>}
        {bulkFeedback && <Text className="text-xs text-green-700" testID="collection-bulk-feedback">{bulkFeedback}</Text>}
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
      {showCopyTargets && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowCopyTargets(false)}>
          <View className="flex-1 bg-black/50 items-center justify-center px-8">
            <View className="bg-white dark:bg-espresso-800 rounded-2xl p-5 w-full max-w-sm">
              <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-3">In Collection kopieren</Text>
              {selectableTargetCollections.length === 0 ? (
                <Text className="text-sm text-warm-500 dark:text-warm-400">Keine Ziel-Collection verfügbar.</Text>
              ) : selectableTargetCollections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={() => handleBulkCopy(collection.id)}
                  testID={`bulk-copy-target-${collection.id}`}
                  className="py-3 border-b border-warm-100 dark:border-warm-700"
                >
                  <Text className="text-sm font-medium text-warm-900 dark:text-warm-50">{collection.name}</Text>
                  <Text className="text-xs text-warm-500 dark:text-warm-400">
                    {collection.owner_type === 'household' ? 'Haushalt' : 'Privat'}
                  </Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowCopyTargets(false)} className="mt-4 py-2.5 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
                <Text className="text-sm text-warm-600 dark:text-warm-300">Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
