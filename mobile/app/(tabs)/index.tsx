import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  ActivityIndicator, RefreshControl, Platform, Image, Modal, ScrollView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  Search, X, ChefHat, Clock, Star, Plus,
  LayoutGrid, List, FileText, Refrigerator,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';
import { shareRecipePDF, shareRecipeCardsPDF } from '@/utils/pdf-export';

const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';
const SERVER_URL_KEY = 'recipedeck_server_url';
const VIEW_MODE_KEY = 'recipedeck_view_mode';

async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    return stored?.trim() || PRODUCTION_URL;
  } catch {
    return PRODUCTION_URL;
  }
}

interface ApiRecipe {
  id: number;
  name: string;
  emoji?: string;
  source_url?: string;
  image_url?: string;
  ingredients: string;
  steps: string;
  tags?: string;
  servings?: string;
  duration?: string;
  calories?: number;
  rating?: number;
  notes?: string;
  created_at?: number;
}

function apiToRecipe(r: ApiRecipe): Recipe {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? null,
    source_url: r.source_url ?? null,
    image_url: r.image_url ?? null,
    ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients ?? []),
    steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps ?? []),
    tags: r.tags ?? null,
    servings: r.servings ?? null,
    duration: r.duration ?? null,
    calories: r.calories ?? null,
    rating: r.rating ?? null,
    notes: r.notes ?? null,
    transcript: null,
    tried: 0,
    pdf_created: 0,
    created_at: null,
  };
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ─── List Card ────────────────────────────────────────────────────────────────

function ListCard({ recipe }: { recipe: Recipe }) {
  const tags = parseJSON<string[]>(recipe.tags, []);
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      className="flex-row items-center bg-white rounded-2xl mb-3 border border-gray-100 overflow-hidden"
    >
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} className="w-20 h-20" resizeMode="cover" />
      ) : (
        <View className="w-20 h-20 bg-purple-50 items-center justify-center">
          <Text className="text-4xl">{recipe.emoji ?? '🍽️'}</Text>
        </View>
      )}
      <View className="flex-1 px-3 py-2">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {recipe.name}
        </Text>
        <View className="flex-row items-center gap-3 mt-0.5">
          {recipe.duration ? (
            <View className="flex-row items-center gap-1">
              <Clock size={11} color="#9ca3af" />
              <Text className="text-xs text-gray-400">{recipe.duration}</Text>
            </View>
          ) : null}
          {recipe.rating ? (
            <View className="flex-row items-center gap-1">
              <Star size={11} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs text-amber-500">{recipe.rating}/5</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} className="bg-purple-50 rounded-full px-2 py-0.5">
                <Text className="text-xs text-purple-600">{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({ recipe }: { recipe: Recipe }) {
  const tags = parseJSON<string[]>(recipe.tags, []);
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      className="flex-1 bg-white rounded-2xl mb-3 border border-gray-100 overflow-hidden"
      style={{ margin: 4 }}
    >
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={{ width: '100%', height: 110 }} resizeMode="cover" />
      ) : (
        <View className="w-full bg-purple-50 items-center justify-center" style={{ height: 110 }}>
          <Text style={{ fontSize: 44 }}>{recipe.emoji ?? '🍽️'}</Text>
        </View>
      )}
      <View className="p-2.5">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
          {recipe.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          {recipe.duration ? (
            <View className="flex-row items-center gap-0.5">
              <Clock size={10} color="#9ca3af" />
              <Text className="text-xs text-gray-400">{recipe.duration}</Text>
            </View>
          ) : null}
          {recipe.rating ? (
            <View className="flex-row items-center gap-0.5">
              <Star size={10} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs text-amber-500">{recipe.rating}</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 2).map((tag) => (
              <View key={tag} className="bg-purple-50 rounded-full px-1.5 py-0.5">
                <Text className="text-xs text-purple-600" style={{ fontSize: 10 }}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipeListScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filtered, setFiltered] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredientResults, setIngredientResults] = useState<Recipe[]>([]);

  const loadRecipes = useCallback(async () => {
    try {
      let rows: Recipe[];
      if (Platform.OS === 'web') {
        const serverUrl = await getServerUrl();
        const res = await fetch(`${serverUrl}/api/v1/recipes`);
        if (!res.ok) throw new Error(`Server-Fehler ${res.status}`);
        const data = await res.json();
        const list: ApiRecipe[] = Array.isArray(data) ? data : (data.recipes ?? []);
        rows = list.map(apiToRecipe);
      } else {
        rows = await getDB().getAllAsync<Recipe>(
          'SELECT * FROM recipes ORDER BY id DESC'
        );
      }
      setRecipes(rows);
      setFiltered(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when tab focused (picks up newly added recipes)
  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadRecipes();
    // Load persisted view mode
    AsyncStorage.getItem(VIEW_MODE_KEY).then(v => {
      if (v === 'grid' || v === 'list') setViewMode(v);
    });
  }, [loadRecipes]));

  const toggleViewMode = async () => {
    const next = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(next);
    await AsyncStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q.trim()) { setFiltered(recipes); return; }
    const lower = q.toLowerCase();
    setFiltered(recipes.filter(r =>
      r.name.toLowerCase().includes(lower) ||
      (r.tags ?? '').toLowerCase().includes(lower)
    ));
  };

  const openCardModal = () => {
    // Vorauswahl: alle ohne PDF
    const noPdf = new Set(recipes.filter(r => !r.pdf_created).map(r => r.id));
    setSelectedIds(noPdf.size > 0 ? noPdf : new Set(recipes.map(r => r.id)));
    setShowCardModal(true);
  };

  const handleIngredientSearch = (input: string) => {
    setIngredientInput(input);
    if (!input.trim()) { setIngredientResults([]); return; }
    const terms = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const results = recipes.filter(recipe => {
      const ings = parseJSON<string[]>(recipe.ingredients, []).join(' ').toLowerCase();
      return terms.some(t => ings.includes(t));
    });
    // Sort by match count
    results.sort((a, b) => {
      const aIngs = parseJSON<string[]>(a.ingredients, []).join(' ').toLowerCase();
      const bIngs = parseJSON<string[]>(b.ingredients, []).join(' ').toLowerCase();
      const aCount = terms.filter(t => aIngs.includes(t)).length;
      const bCount = terms.filter(t => bIngs.includes(t)).length;
      return bCount - aCount;
    });
    setIngredientResults(results);
  };

  const handleExportCards = async () => {
    setShowCardModal(false);
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const toExport = recipes.filter(r => selectedIds.has(r.id));
      await shareRecipeCardsPDF(toExport as Parameters<typeof shareRecipeCardsPDF>[0]);
    } catch { /* ignore */ } finally {
      setExporting(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecipes();
    setRefreshing(false);
  }, [loadRecipes]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">RecipeDeck</Text>
          <View className="flex-row items-center gap-2">
            {recipes.length > 0 && (
              <>
                <Pressable
                  onPress={() => { setShowIngredientSearch(true); setIngredientInput(''); setIngredientResults([]); }}
                  className="bg-white rounded-full w-9 h-9 items-center justify-center border border-gray-200"
                >
                  <Refrigerator size={17} color="#6b7280" />
                </Pressable>
                <Pressable
                  onPress={openCardModal}
                  disabled={exporting}
                  className="bg-white rounded-full w-9 h-9 items-center justify-center border border-gray-200"
                >
                  {exporting
                    ? <ActivityIndicator size="small" color="#9333ea" />
                    : <FileText size={17} color="#6b7280" />}
                </Pressable>
              </>
            )}
            <Pressable
              onPress={toggleViewMode}
              className="bg-white rounded-full w-9 h-9 items-center justify-center border border-gray-200"
            >
              {viewMode === 'list'
                ? <LayoutGrid size={17} color="#6b7280" />
                : <List size={17} color="#6b7280" />}
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/extract')}
              className="bg-purple-600 rounded-full w-9 h-9 items-center justify-center"
            >
              <Plus size={19} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Suchfeld */}
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200">
          <Search size={16} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Rezepte suchen…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={handleSearch}
          />
          {search ? (
            <Pressable onPress={() => handleSearch('')}>
              <X size={16} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#9333ea" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">{error}</Text>
          <Pressable onPress={() => { setLoading(true); loadRecipes(); }} className="mt-4 px-4 py-2 bg-purple-600 rounded-xl">
            <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          key="grid"
          renderItem={({ item }) => <GridCard recipe={item} />}
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />}
          ListEmptyComponent={<EmptyState search={search} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          key="list"
          renderItem={({ item }) => <ListCard recipe={item} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />}
          ListEmptyComponent={<EmptyState search={search} />}
        />
      )}
      {/* ── Zutaten-Suche Modal ── */}
      <Modal visible={showIngredientSearch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowIngredientSearch(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">Was habe ich zu Hause?</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Zutaten eingeben, Rezepte finden</Text>
            </View>
            <Pressable onPress={() => setShowIngredientSearch(false)} className="p-2">
              <X size={22} color="#6b7280" />
            </Pressable>
          </View>

          <View className="px-4 py-3 border-b border-gray-100">
            <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
              <Search size={16} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-900"
                placeholder="Tomate, Käse, Nudeln…"
                placeholderTextColor="#9ca3af"
                value={ingredientInput}
                onChangeText={handleIngredientSearch}
                autoFocus
              />
              {ingredientInput ? (
                <Pressable onPress={() => { setIngredientInput(''); setIngredientResults([]); }}>
                  <X size={16} color="#9ca3af" />
                </Pressable>
              ) : null}
            </View>
            <Text className="text-xs text-gray-400 mt-2">Mehrere Zutaten mit Komma trennen</Text>
          </View>

          <FlatList
            data={ingredientResults}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const terms = ingredientInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
              const ings = parseJSON<string[]>(item.ingredients, []);
              const matched = terms.filter(t => ings.join(' ').toLowerCase().includes(t)).length;
              return (
                <Pressable
                  onPress={() => { setShowIngredientSearch(false); router.push(`/recipe/${item.id}`); }}
                  className="flex-row items-center bg-white rounded-2xl mb-3 border border-gray-100 px-4 py-3"
                >
                  <Text className="text-3xl mr-3">{item.emoji ?? '🍽️'}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-xs text-purple-600 mt-0.5">{matched} von {terms.length} Zutaten</Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              ingredientInput ? (
                <View className="items-center py-16">
                  <Text className="text-gray-400 text-sm text-center">Keine Rezepte mit diesen Zutaten gefunden.</Text>
                </View>
              ) : (
                <View className="items-center py-16">
                  <Refrigerator size={40} color="#d1d5db" />
                  <Text className="text-gray-400 text-sm text-center mt-3">Gib Zutaten ein die du{'\n'}zu Hause hast.</Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>

      {/* ── Rezeptkarten-Modal ── */}
      <Modal visible={showCardModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCardModal(false)}>
        <SafeAreaView className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">Rezeptkarten erstellen</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{selectedIds.size} von {recipes.length} ausgewählt</Text>
            </View>
            <Pressable onPress={() => setShowCardModal(false)} className="p-2">
              <X size={22} color="#6b7280" />
            </Pressable>
          </View>

          {/* Schnellauswahl */}
          <View className="flex-row gap-2 px-4 py-3 border-b border-gray-100">
            <Pressable
              onPress={() => setSelectedIds(new Set(recipes.map(r => r.id)))}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-full border border-purple-200"
            >
              <Text className="text-xs font-medium text-purple-600">Alle</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedIds(new Set())}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full"
            >
              <Text className="text-xs font-medium text-gray-600">Keine</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedIds(new Set(recipes.filter(r => !r.pdf_created).map(r => r.id)))}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full"
            >
              <Text className="text-xs font-medium text-gray-600">Noch keine PDF</Text>
            </Pressable>
          </View>

          {/* Rezeptliste */}
          <ScrollView className="flex-1">
            {recipes.map(recipe => {
              const selected = selectedIds.has(recipe.id);
              return (
                <Pressable
                  key={recipe.id}
                  onPress={() => {
                    const next = new Set(selectedIds);
                    selected ? next.delete(recipe.id) : next.add(recipe.id);
                    setSelectedIds(next);
                  }}
                  className={`flex-row items-center px-4 py-3 border-b border-gray-50 ${selected ? 'bg-purple-50' : ''}`}
                >
                  <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${selected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                    {selected && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                  <Text className="text-2xl mr-3">{recipe.emoji ?? '🍽️'}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{recipe.name}</Text>
                    {recipe.pdf_created ? (
                      <Text className="text-xs text-gray-400">PDF bereits erstellt</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Export-Button */}
          <View className="px-4 py-4 border-t border-gray-100">
            <Pressable
              onPress={handleExportCards}
              disabled={selectedIds.size === 0}
              className={`py-3.5 rounded-xl items-center ${selectedIds.size > 0 ? 'bg-purple-600' : 'bg-gray-200'}`}
            >
              <Text className={`font-semibold text-base ${selectedIds.size > 0 ? 'text-white' : 'text-gray-400'}`}>
                {selectedIds.size} Karte{selectedIds.size !== 1 ? 'n' : ''} als PDF exportieren
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <View className="items-center justify-center py-20">
      <ChefHat size={48} color="#d1d5db" />
      <Text className="text-gray-400 mt-4 text-center">
        {search ? 'Keine Rezepte gefunden.' : 'Noch keine Rezepte.\nFüge dein erstes Rezept hinzu!'}
      </Text>
    </View>
  );
}
