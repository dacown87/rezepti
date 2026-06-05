import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  RefreshControl, TextInput, Share, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ShoppingCart, Trash2, Check, X, Share2, Plus } from 'lucide-react-native';

import type { ShoppingListItem } from '@/db/schema';
import { ApiRequestError, apiFetch, assertApiOk } from '@/utils/api';

// ─── Data layer ───────────────────────────────────────────────────────────────

async function fetchItems(): Promise<ShoppingListItem[]> {
  const res = await apiFetch('/api/v1/shopping');
  await assertApiOk(res, `Shopping fetch failed (${res.status})`);
  const data = await res.json();
  const raw: Array<Record<string, unknown>> = data.items ?? data ?? [];
  return raw.map(r => ({
    id: Number(r.id),
    recipe_id: r.recipe_id != null ? Number(r.recipe_id) : null,
    canonical_name: String(r.canonical_name ?? r.canonicalName ?? ''),
    quantity: (r.quantity as string | null) ?? null,
    unit: (r.unit as string | null) ?? null,
    checked: Number(r.checked ?? 0),
    created_at: null,
  }));
}

async function toggleItem(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/shopping/${id}`, { method: 'PATCH' });
  await assertApiOk(res, `Shopping toggle failed (${res.status})`);
}

async function deleteItem(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/shopping/${id}`, { method: 'DELETE' });
  await assertApiOk(res, `Shopping delete failed (${res.status})`);
}

async function clearChecked(): Promise<void> {
  const res = await apiFetch('/api/v1/shopping/checked', { method: 'DELETE' });
  await assertApiOk(res, `Shopping clear checked failed (${res.status})`);
}

async function clearAll(): Promise<void> {
  const res = await apiFetch('/api/v1/shopping/all', { method: 'DELETE' });
  await assertApiOk(res, `Shopping clear all failed (${res.status})`);
}

async function addManualItem(name: string): Promise<void> {
  const res = await apiFetch('/api/v1/shopping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canonicalName: name, recipeId: null }),
  });
  await assertApiOk(res, `Shopping add failed (${res.status})`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.code ? error.message : fallback;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShoppingScreen() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<null | (() => Promise<void>)>(null);
  const [retryingMutation, setRetryingMutation] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setItems(await fetchItems());
    } catch (error) {
      setItems((prev) => (prev.length === 0 ? [] : prev));
      setLoadError(errorMessage(error, 'Einkaufsliste konnte nicht geladen werden'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time the tab gets focused
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const clearMutationError = () => {
    setMutationError(null);
    setRetryAction(null);
  };

  const handleMutationError = (message: string, retry: () => Promise<void>) => {
    setMutationError(message);
    setRetryAction(() => retry);
  };

  const runRetryAction = async () => {
    if (!retryAction) return;
    try {
      setRetryingMutation(true);
      setMutationError(null);
      await retryAction();
      setRetryAction(null);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Erneuter Versuch fehlgeschlagen');
    } finally {
      setRetryingMutation(false);
    }
  };

  const handleToggle = async (item: ShoppingListItem) => {
    clearMutationError();
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: i.checked ? 0 : 1 } : i));
    try {
      await toggleItem(item.id);
    } catch (error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked } : i));
      handleMutationError(
        errorMessage(error, 'Status konnte nicht aktualisiert werden.'),
        async () => handleToggle(item),
      );
    }
  };

  const handleDelete = async (id: number) => {
    clearMutationError();
    const previousItems = items;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await deleteItem(id);
    } catch (error) {
      setItems(previousItems);
      handleMutationError(
        errorMessage(error, 'Artikel konnte nicht gelöscht werden.'),
        async () => handleDelete(id),
      );
    }
  };

  const handleClearChecked = async () => {
    clearMutationError();
    try {
      await clearChecked();
      await load();
    } catch (error) {
      handleMutationError(
        errorMessage(error, 'Erledigte Einträge konnten nicht entfernt werden.'),
        async () => handleClearChecked(),
      );
    }
  };

  const handleClearAll = () => setShowClearModal(true);

  const confirmClearAll = async () => {
    setShowClearModal(false);
    clearMutationError();
    try {
      await clearAll();
      await load();
    } catch (error) {
      handleMutationError(
        errorMessage(error, 'Einkaufsliste konnte nicht geleert werden.'),
        async () => confirmClearAll(),
      );
    }
  };

  const handleAddManual = async () => {
    const name = newItem.trim();
    if (!name) return;
    clearMutationError();
    setNewItem('');
    try {
      await addManualItem(name);
      await load();
    } catch (error) {
      setNewItem(name);
      handleMutationError(
        errorMessage(error, 'Artikel konnte nicht hinzugefügt werden.'),
        async () => {
          await addManualItem(name);
          await load();
        },
      );
    }
  };

  const handleCopy = async () => {
    const unchecked = uncheckedItems.map(i => `• ${i.canonical_name}`);
    const checked = checkedItems.map(i => `✓ ${i.canonical_name}`);
    const text = [...unchecked, ...(checked.length ? ['', '--- Erledigt ---', ...checked] : [])].join('\n');
    try { await Share.share({ message: text }); } catch { /* ignore */ }
  };

  const { uncheckedItems, checkedItems, orderedItems } = useMemo(() => {
    const unchecked: ShoppingListItem[] = [];
    const checked: ShoppingListItem[] = [];
    for (const item of items) {
      if (item.checked) checked.push(item);
      else unchecked.push(item);
    }
    return {
      uncheckedItems: unchecked,
      checkedItems: checked,
      orderedItems: [...unchecked, ...checked],
    };
  }, [items]);

  if (loadError && items.length === 0 && !loading) {
    return (
      <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900 items-center justify-center px-8">
        <Text className="text-red-500 text-center">{loadError}</Text>
        <Pressable onPress={() => load()} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
          <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {/* Header — always visible, auch während des Ladens */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <ShoppingCart size={20} color="#C84B31" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">Einkaufsliste</Text>
          </View>
          <View className="flex-row gap-2">
            {!loading && items.length > 0 && (
              <>
                <Pressable onPress={handleCopy} className="p-2 bg-white dark:bg-espresso-800 rounded-xl border border-warm-200 dark:border-warm-700">
                  <Share2 size={16} color="#9E8878" />
                </Pressable>
                {checkedItems.length > 0 && (
                  <Pressable onPress={handleClearChecked} className="p-2 bg-white dark:bg-espresso-800 rounded-xl border border-warm-200 dark:border-warm-700">
                    <Check size={16} color="#C84B31" />
                  </Pressable>
                )}
                <Pressable onPress={handleClearAll} className="p-2 bg-white dark:bg-espresso-800 rounded-xl border border-warm-200 dark:border-warm-700">
                  <Trash2 size={16} color="#ef4444" />
                </Pressable>
              </>
            )}
            {loading && (
              <ActivityIndicator size="small" color="#C84B31" />
            )}
          </View>
        </View>

        {mutationError && (
          <View className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <Text className="text-sm text-red-700">{mutationError}</Text>
            <View className="mt-2 flex-row gap-2">
              {retryAction && (
                <Pressable
                  onPress={runRetryAction}
                  disabled={retryingMutation}
                  className={`rounded-lg px-3 py-1.5 ${retryingMutation ? 'bg-red-200' : 'bg-red-600'}`}
                >
                  <Text className="text-xs font-medium text-white">
                    {retryingMutation ? 'Wird versucht…' : 'Erneut versuchen'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={clearMutationError} className="rounded-lg bg-red-100 px-3 py-1.5">
                <Text className="text-xs font-medium text-red-700">Schließen</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Manuell hinzufügen */}
        <View className="flex-row gap-2">
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={handleAddManual}
            placeholder="Artikel hinzufügen…"
            placeholderTextColor="#9E8878"
            returnKeyType="done"
            className="flex-1 bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50"
          />
          <Pressable
            onPress={handleAddManual}
            disabled={!newItem.trim()}
            className={`px-4 rounded-xl items-center justify-center ${newItem.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
          >
            <Plus size={18} color={newItem.trim() ? '#fff' : '#9E8878'} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        /* Skeleton-Platzhalter — sichtbarer Struktur-Shell vor dem ersten Daten-Frame */
        <View className="px-4 pt-2" testID="shopping-skeleton">
          {[72, 56, 80, 64, 48, 72, 56].map((width, i) => (
            <View
              key={i}
              className="bg-white dark:bg-espresso-800 rounded-xl mb-2 px-4 py-3 border border-warm-200 dark:border-warm-700 flex-row items-center"
            >
              <View className="w-6 h-6 rounded-full border-2 border-warm-200 dark:border-warm-600 mr-3" />
              <View
                className="h-3 rounded-full bg-warm-200 dark:bg-espresso-700"
                style={{ width: `${width}%` }}
              />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <ShoppingCart size={48} color="#d1d5db" />
          <Text className="text-warm-500 dark:text-warm-400 text-center mt-4">
            Noch nichts auf der Liste.{'\n'}Füge Zutaten aus einem Rezept hinzu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orderedItems}
          keyExtractor={item => String(item.id)}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          renderItem={({ item, index }) => {
            const isFirstChecked = !!item.checked && uncheckedItems.length > 0 && index === uncheckedItems.length;
            return (
              <>
                {isFirstChecked && checkedItems.length > 0 && (
                  <Text className="text-xs text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 mt-3">Erledigt</Text>
                )}
                <Pressable
                  onPress={() => handleToggle(item)}
                  className={`flex-row items-center bg-white dark:bg-espresso-800 rounded-xl mb-2 px-4 py-3 border ${item.checked ? 'border-warm-200 dark:border-warm-700 opacity-60' : 'border-warm-200 dark:border-warm-700'}`}
                >
                  <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${item.checked ? 'bg-primary-500 border-primary-500' : 'border-warm-300'}`}>
                    {item.checked ? <Check size={13} color="#fff" /> : null}
                  </View>
                  <Text className={`flex-1 text-sm ${item.checked ? 'line-through text-warm-500 dark:text-warm-400' : 'text-warm-800 dark:text-warm-100'}`}>
                    {item.canonical_name}
                  </Text>
                  <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} className="ml-2 p-1">
                    <X size={14} color="#d1d5db" />
                  </Pressable>
                </Pressable>
              </>
            );
          }}
        />
      )}

      {/* Löschen-Modal */}
      <Modal visible={showClearModal} transparent animationType="fade" onRequestClose={() => setShowClearModal(false)}>
        <View className="flex-1 bg-black/50 items-center justify-center px-8">
          <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full">
            <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-2">Alles löschen</Text>
            <Text className="text-sm text-warm-500 dark:text-warm-400 mb-6">Gesamte Einkaufsliste leeren?</Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setShowClearModal(false)} className="flex-1 py-3 rounded-xl bg-warm-100 dark:bg-espresso-800 items-center">
                <Text className="text-sm font-medium text-warm-700 dark:text-warm-200">Abbrechen</Text>
              </Pressable>
              <Pressable onPress={confirmClearAll} className="flex-1 py-3 rounded-xl bg-red-500 items-center">
                <Text className="text-sm font-medium text-white">Leeren</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
