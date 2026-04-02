import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  RefreshControl, TextInput, Share, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ShoppingCart, Trash2, Check, X, Share2, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { ShoppingListItem } from '@/db/schema';
import { getServerUrl } from '@/utils/server-url';

// ─── Data layer ───────────────────────────────────────────────────────────────

async function fetchItems(): Promise<ShoppingListItem[]> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    const res = await fetch(`${url}/api/v1/shopping`);
    if (!res.ok) return [];
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
  return getDB().getAllAsync<ShoppingListItem>('SELECT * FROM shopping_list ORDER BY checked ASC, id DESC');
}

async function toggleItem(id: number, checked: number): Promise<void> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    await fetch(`${url}/api/v1/shopping/${id}`, { method: 'PATCH' });
  } else {
    await getDB().runAsync('UPDATE shopping_list SET checked = ? WHERE id = ?', checked ? 0 : 1, id);
  }
}

async function deleteItem(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    await fetch(`${url}/api/v1/shopping/${id}`, { method: 'DELETE' });
  } else {
    await getDB().runAsync('DELETE FROM shopping_list WHERE id = ?', id);
  }
}

async function clearChecked(): Promise<void> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    await fetch(`${url}/api/v1/shopping/checked`, { method: 'DELETE' });
  } else {
    await getDB().runAsync('DELETE FROM shopping_list WHERE checked = 1');
  }
}

async function clearAll(): Promise<void> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    await fetch(`${url}/api/v1/shopping/all`, { method: 'DELETE' });
  } else {
    await getDB().runAsync('DELETE FROM shopping_list');
  }
}

export async function addIngredients(
  ingredients: string[],
  recipeId?: number
): Promise<void> {
  if (Platform.OS === 'web') {
    const url = await getServerUrl();
    await Promise.all(
      ingredients.map(ing =>
        fetch(`${url}/api/v1/shopping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canonicalName: ing, recipeId: recipeId ?? null }),
        })
      )
    );
  } else {
    const db = getDB();
    for (const ing of ingredients) {
      await db.runAsync(
        'INSERT INTO shopping_list (recipe_id, canonical_name) VALUES (?, ?)',
        recipeId ?? null, ing
      );
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShoppingScreen() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchItems());
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

  const handleToggle = async (item: ShoppingListItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: i.checked ? 0 : 1 } : i));
    await toggleItem(item.id, item.checked);
  };

  const handleDelete = async (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await deleteItem(id);
  };

  const handleClearChecked = async () => {
    await clearChecked();
    await load();
  };

  const handleClearAll = () => setShowClearModal(true);

  const confirmClearAll = async () => {
    setShowClearModal(false);
    await clearAll();
    await load();
  };

  const handleAddManual = async () => {
    const name = newItem.trim();
    if (!name) return;
    setNewItem('');
    if (Platform.OS === 'web') {
      const url = await getServerUrl();
      await fetch(`${url}/api/v1/shopping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalName: name }),
      });
    } else {
      await getDB().runAsync('INSERT INTO shopping_list (canonical_name) VALUES (?)', name);
    }
    await load();
  };

  const handleCopy = async () => {
    const unchecked = items.filter(i => !i.checked).map(i => `• ${i.canonical_name}`);
    const checked = items.filter(i => i.checked).map(i => `✓ ${i.canonical_name}`);
    const text = [...unchecked, ...(checked.length ? ['', '--- Erledigt ---', ...checked] : [])].join('\n');
    try { await Share.share({ message: text }); } catch { /* ignore */ }
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#9333ea" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <ShoppingCart size={20} color="#9333ea" />
            <Text className="text-2xl font-bold text-gray-900">Einkaufsliste</Text>
          </View>
          <View className="flex-row gap-2">
            {items.length > 0 && (
              <>
                <Pressable onPress={handleCopy} className="p-2 bg-white rounded-xl border border-gray-200">
                  <Share2 size={16} color="#6b7280" />
                </Pressable>
                {checked.length > 0 && (
                  <Pressable onPress={handleClearChecked} className="p-2 bg-white rounded-xl border border-gray-200">
                    <Check size={16} color="#9333ea" />
                  </Pressable>
                )}
                <Pressable onPress={handleClearAll} className="p-2 bg-white rounded-xl border border-gray-200">
                  <Trash2 size={16} color="#ef4444" />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Manuell hinzufügen */}
        <View className="flex-row gap-2">
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={handleAddManual}
            placeholder="Artikel hinzufügen…"
            placeholderTextColor="#9ca3af"
            returnKeyType="done"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
          />
          <Pressable
            onPress={handleAddManual}
            disabled={!newItem.trim()}
            className={`px-4 rounded-xl items-center justify-center ${newItem.trim() ? 'bg-purple-600' : 'bg-gray-200'}`}
          >
            <Plus size={18} color={newItem.trim() ? '#fff' : '#9ca3af'} />
          </Pressable>
        </View>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <ShoppingCart size={48} color="#d1d5db" />
          <Text className="text-gray-400 text-center mt-4">
            Noch nichts auf der Liste.{'\n'}Füge Zutaten aus einem Rezept hinzu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...unchecked, ...checked]}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />}
          renderItem={({ item, index }) => {
            const isFirstChecked = !!item.checked && unchecked.length > 0 && index === unchecked.length;
            return (
              <>
                {isFirstChecked && checked.length > 0 && (
                  <Text className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-3">Erledigt</Text>
                )}
                <Pressable
                  onPress={() => handleToggle(item)}
                  className={`flex-row items-center bg-white rounded-xl mb-2 px-4 py-3 border ${item.checked ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}
                >
                  <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${item.checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                    {item.checked ? <Check size={13} color="#fff" /> : null}
                  </View>
                  <Text className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
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
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-lg font-bold text-gray-900 mb-2">Alles löschen</Text>
            <Text className="text-sm text-gray-500 mb-6">Gesamte Einkaufsliste leeren?</Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setShowClearModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 items-center">
                <Text className="text-sm font-medium text-gray-700">Abbrechen</Text>
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
