import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  Search, X, ChefHat, Clock, Star, Plus,
  LayoutGrid, List, Tag, FileText, Refrigerator, QrCode,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';
import { shareRecipePDF, shareRecipeCardsPDF } from '@/utils/pdf-export';
import { getServerUrl } from '@/utils/server-url';

const VIEW_MODE_KEY = 'recipedeck_view_mode';

// mirrors src/ingredient-dictionary.ts — mobile cannot import from backend
const UNIT_RE_MOB = /\b(g|kg|ml|l|el|tl|tsp|tbsp|prise|stk|stück|pack|päckchen|dose|n)\b/i;
function extractIngName(full: string): string {
  const numMatch = full.match(/^(\d+(?:[.,]\d+)?)(.*)/)
  const rest = numMatch ? numMatch[2].trim() : full.trim();
  const unitMatch = rest.match(UNIT_RE_MOB);
  if (unitMatch) {
    const after = rest.slice(unitMatch.index! + unitMatch[0].length).trim();
    if (after) return after;
  }
  return rest || full.trim();
}
function isSimilarMob(a: string, b: string): boolean {
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (al.length === 0) return bl.length === 0;
  const m: number[][] = Array.from({ length: bl.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= al.length; j++) m[0][j] = j;
  for (let i = 1; i <= bl.length; i++)
    for (let j = 1; j <= al.length; j++)
      m[i][j] = bl[i-1] === al[j-1] ? m[i-1][j-1] :
        1 + Math.min(m[i-1][j-1], m[i][j-1], m[i-1][j]);
  const dist = m[bl.length][al.length];
  return dist <= Math.max(1, Math.floor(0.3 * Math.max(al.length, bl.length)));
}
function matchesIngredient(ing: string, term: string): boolean {
  const ingLower = ing.toLowerCase();
  const ingName = extractIngName(ing).toLowerCase();
  return ingLower.includes(term) || isSimilarMob(ingName, term) ||
         ingName.includes(term) || term.includes(ingName);
}

// mirrors src/db-react.ts CATEGORY_KEYWORDS — mobile cannot import from backend
const PREDEFINED_CATEGORIES: Array<{ name: string; icon: string; keywords: string[] }> = [
  { name: 'Auflauf',         icon: '🥘', keywords: ['auflauf', 'gratin', 'lasagne', 'überbacken'] },
  { name: 'Nudelgericht',    icon: '🍝', keywords: ['pasta', 'nudeln', 'spaghetti', 'penne', 'tagliatelle'] },
  { name: 'Fleischgericht',  icon: '🥩', keywords: ['fleisch', 'steak', 'schnitzel', 'hackfleisch', 'braten', 'gulasch'] },
  { name: 'Geflügel',        icon: '🍗', keywords: ['hähnchen', 'hühnchen', 'pute', 'geflügel'] },
  { name: 'Fischgericht',    icon: '🐟', keywords: ['fisch', 'lachs', 'thunfisch', 'shrimps', 'garnele', 'meeresfrüchte'] },
  { name: 'Suppe',           icon: '🍲', keywords: ['suppe', 'eintopf', 'brühe', 'cremesuppe', 'minestrone'] },
  { name: 'Salat',           icon: '🥗', keywords: ['salat'] },
  { name: 'Gebäck & Kuchen', icon: '🍰', keywords: ['kuchen', 'gebäck', 'muffin', 'torte', 'backen', 'kekse', 'brot'] },
  { name: 'Frühstück',       icon: '🥐', keywords: ['frühstück', 'pancake', 'pfannkuchen', 'porridge', 'müsli', 'granola'] },
  { name: 'Snack',           icon: '🧆', keywords: ['snack', 'vorspeise', 'fingerfood', 'dip', 'toast'] },
  { name: 'Vegetarisch',     icon: '🌱', keywords: ['vegetarisch', 'vegan'] },
  { name: 'Asiatisch',       icon: '🍜', keywords: ['asiatisch', 'wok', 'curry', 'sushi', 'ramen', 'thai', 'dim sum'] },
];

interface CategoryInfo { name: string; icon: string; count: number }
function buildCategories(recipeList: Recipe[]): CategoryInfo[] {
  const result: CategoryInfo[] = [];
  for (const cat of PREDEFINED_CATEGORIES) {
    const count = recipeList.filter(r =>
      r.category === cat.name ||
      (!r.category && cat.keywords.some(kw =>
        [...parseJSON<string[]>(r.tags, []), r.name].join(' ').toLowerCase().includes(kw)
      ))
    ).length;
    if (count > 0) result.push({ name: cat.name, icon: cat.icon, count });
  }
  return [{ name: 'Alle Rezepte', icon: '📖', count: recipeList.length }, ...result];
}

interface ApiRecipe {
  id: number;
  name: string;
  emoji?: string;
  source_url?: string;
  image_url?: string;
  ingredients: string;
  steps: string;
  tags?: string | string[];
  category?: string;
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
    tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags ?? null),
    category: r.category ?? null,
    servings: r.servings ?? null,
    duration: r.duration ?? null,
    calories: r.calories ?? null,
    rating: r.rating ?? null,
    notes: r.notes ?? null,
    transcript: null,
    equipment: null,
    nutrition_info: null,
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
      className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 overflow-hidden"
      style={{ borderLeftColor: '#C84B31', borderLeftWidth: 2 }}
    >
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} className="w-20 h-20" resizeMode="cover" />
      ) : (
        <View className="w-20 h-20 bg-primary-50 dark:bg-espresso-700 items-center justify-center">
          <Text className="text-4xl">{recipe.emoji ?? '🍽️'}</Text>
        </View>
      )}
      <View className="flex-1 px-3 py-2">
        <Text className="text-base font-semibold text-warm-900 dark:text-warm-50" numberOfLines={1}>
          {recipe.name}
        </Text>
        <View className="flex-row items-center gap-3 mt-0.5">
          {recipe.duration ? (
            <View className="flex-row items-center gap-1">
              <Clock size={11} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400">{recipe.duration}</Text>
            </View>
          ) : null}
          {recipe.rating ? (
            <View className="flex-row items-center gap-1">
              <Star size={11} color="#D4A853" fill="#D4A853" />
              <Text className="text-xs text-gold-500">{recipe.rating}/5</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} className="bg-primary-50 dark:bg-espresso-700 rounded-full px-2 py-0.5">
                <Text className="text-xs text-primary-500">{tag}</Text>
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
      className="flex-1 bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 overflow-hidden"
      style={{ margin: 4, borderLeftColor: '#C84B31', borderLeftWidth: 2 }}
    >
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={{ width: '100%', height: 110 }} resizeMode="cover" />
      ) : (
        <View className="w-full bg-primary-50 dark:bg-espresso-700 items-center justify-center" style={{ height: 110 }}>
          <Text style={{ fontSize: 44 }}>{recipe.emoji ?? '🍽️'}</Text>
        </View>
      )}
      <View className="p-2.5">
        <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50" numberOfLines={2}>
          {recipe.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          {recipe.duration ? (
            <View className="flex-row items-center gap-0.5">
              <Clock size={10} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400">{recipe.duration}</Text>
            </View>
          ) : null}
          {recipe.rating ? (
            <View className="flex-row items-center gap-0.5">
              <Star size={10} color="#D4A853" fill="#D4A853" />
              <Text className="text-xs text-gold-500">{recipe.rating}</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 2).map((tag) => (
              <View key={tag} className="bg-primary-50 dark:bg-espresso-700 rounded-full px-1.5 py-0.5">
                <Text className="text-xs text-primary-500" style={{ fontSize: 10 }}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ info, onPress }: { info: CategoryInfo; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      className="flex-1 m-1.5 bg-white dark:bg-espresso-800 rounded-2xl p-4 border border-warm-200 dark:border-warm-700 items-center justify-center min-h-[100px]"
    >
      <Text className="text-4xl mb-1">{info.icon}</Text>
      <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50 text-center" numberOfLines={2}>
        {info.name}
      </Text>
      <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">
        {info.count} {info.count === 1 ? 'Rezept' : 'Rezepte'}
      </Text>
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
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'categories'>('categories');
  const ingredientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredientResults, setIngredientResults] = useState<Recipe[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      if (v === 'grid' || v === 'list' || v === 'categories') setViewMode(v);
    });
  }, [loadRecipes]));

  const toggleViewMode = async () => {
    const next = viewMode === 'list' ? 'grid' : viewMode === 'grid' ? 'categories' : 'list';
    setViewMode(next);
    await AsyncStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (q.trim()) setSelectedCategory(null);
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

    if (Platform.OS === 'web') {
      // On web, the list API omits ingredients — use the backend search endpoint instead
      if (ingredientSearchTimer.current) clearTimeout(ingredientSearchTimer.current);
      ingredientSearchTimer.current = setTimeout(async () => {
        const terms = input.split(',').map(t => t.trim()).filter(Boolean);
        if (!terms.length) return;
        try {
          const serverUrl = await getServerUrl();
          const res = await fetch(
            `${serverUrl}/api/v1/recipes?ingredients=${encodeURIComponent(terms.join(','))}&match=or`
          );
          if (!res.ok) return;
          const data = await res.json();
          const list: ApiRecipe[] = Array.isArray(data.recipes) ? data.recipes : [];
          setIngredientResults(list.map(apiToRecipe));
        } catch { /* ignore network errors */ }
      }, 300);
    } else {
      // Native: SQLite returns full rows including ingredients — search in-memory
      const terms = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const scored = recipes
        .map(r => {
          const ings = parseJSON<string[]>(r.ingredients, []);
          const score = terms.filter(t => ings.some(ing => matchesIngredient(ing, t))).length;
          return { r, score };
        })
        .filter(s => s.score > 0);
      scored.sort((a, b) => b.score - a.score);
      setIngredientResults(scored.map(s => s.r));
    }
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

  const allCategories = useMemo(() => buildCategories(recipes), [recipes]);
  const categoryFiltered = useMemo(() => {
    if (!selectedCategory) return filtered;
    const cat = PREDEFINED_CATEGORIES.find(c => c.name === selectedCategory);
    if (!cat) return filtered;
    return filtered.filter(r =>
      r.category === cat.name ||
      (!r.category && cat.keywords.some(kw =>
        [...parseJSON<string[]>(r.tags, []), r.name].join(' ').toLowerCase().includes(kw)
      ))
    );
  }, [filtered, selectedCategory]);

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">RecipeDeck</Text>
          <View className="flex-row items-center gap-2">
            {recipes.length > 0 && (
              <>
                <Pressable
                  onPress={() => { setShowIngredientSearch(true); setIngredientInput(''); setIngredientResults([]); }}
                  className="bg-white dark:bg-espresso-800 rounded-full w-9 h-9 items-center justify-center border border-warm-200 dark:border-warm-700"
                >
                  <Refrigerator size={17} color="#9E8878" />
                </Pressable>
                <Pressable
                  onPress={openCardModal}
                  disabled={exporting}
                  className="bg-white dark:bg-espresso-800 rounded-full w-9 h-9 items-center justify-center border border-warm-200 dark:border-warm-700"
                >
                  {exporting
                    ? <ActivityIndicator size="small" color="#C84B31" />
                    : <FileText size={17} color="#9E8878" />}
                </Pressable>
              </>
            )}
            <Pressable
              onPress={() => router.push('/(tabs)/scanner?autoOpen=true')}
              className="bg-white dark:bg-espresso-800 rounded-full w-9 h-9 items-center justify-center border border-warm-200 dark:border-warm-700"
            >
              <QrCode size={17} color="#9E8878" />
            </Pressable>
            <Pressable
              onPress={toggleViewMode}
              className="bg-white dark:bg-espresso-800 rounded-full w-9 h-9 items-center justify-center border border-warm-200 dark:border-warm-700"
            >
              {viewMode === 'list'
                ? <LayoutGrid size={17} color="#9E8878" />
                : viewMode === 'grid'
                  ? <Tag size={17} color="#9E8878" />
                  : <List size={17} color="#9E8878" />}
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/extract')}
              className="bg-primary-500 rounded-full w-9 h-9 items-center justify-center"
            >
              <Plus size={19} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Suchfeld */}
        <View className="flex-row items-center bg-white dark:bg-espresso-800 rounded-xl px-3 py-2 border border-warm-200 dark:border-warm-700">
          <Search size={16} color="#9E8878" />
          <TextInput
            className="flex-1 ml-2 text-base text-warm-900 dark:text-warm-50"
            placeholder="Rezepte suchen…"
            placeholderTextColor="#9E8878"
            value={search}
            onChangeText={handleSearch}
          />
          {search ? (
            <Pressable onPress={() => handleSearch('')}>
              <X size={16} color="#9E8878" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {selectedCategory && !search && viewMode !== 'categories' && (
        <View className="flex-row items-center px-4 pb-2 gap-2">
          <Pressable
            onPress={() => {
              setSelectedCategory(null);
              setViewMode('categories');
              AsyncStorage.setItem(VIEW_MODE_KEY, 'categories');
            }}
            className="flex-row items-center gap-1"
          >
            <Text className="text-primary-500 text-sm font-medium">← Kategorien</Text>
          </Pressable>
          <Text className="text-warm-500 text-sm">/</Text>
          <Text className="text-warm-900 dark:text-warm-50 text-sm font-semibold">
            {PREDEFINED_CATEGORIES.find(c => c.name === selectedCategory)?.icon ?? '🍽️'} {selectedCategory}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C84B31" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">{error}</Text>
          <Pressable onPress={() => { setLoading(true); loadRecipes(); }} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
            <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : (viewMode === 'categories' && !search) ? (
        <FlatList
          data={allCategories}
          keyExtractor={(item) => item.name}
          numColumns={2}
          key="categories"
          renderItem={({ item }) => (
            <CategoryCard info={item} onPress={() => {
              if (item.name === 'Alle Rezepte') {
                setSelectedCategory(null);
                setFiltered(recipes);
                setViewMode('list');
                AsyncStorage.setItem(VIEW_MODE_KEY, 'list');
              } else {
                setSelectedCategory(item.name);
                setViewMode('list');
                AsyncStorage.setItem(VIEW_MODE_KEY, 'list');
              }
            }} />
          )}
          contentContainerStyle={{ padding: 8 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search="" />}
        />
      ) : viewMode === 'grid' ? (
        <FlatList
          data={categoryFiltered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          key="list-grid"
          renderItem={({ item }) => <GridCard recipe={item} />}
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search={search} />}
        />
      ) : (
        <FlatList
          data={categoryFiltered}
          keyExtractor={(item) => String(item.id)}
          key="list-list"
          renderItem={({ item }) => <ListCard recipe={item} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search={search} />}
        />
      )}
      {/* ── Zutaten-Suche Modal ── */}
      <Modal visible={showIngredientSearch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowIngredientSearch(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
          <View className="flex-row items-center px-4 py-3 border-b border-warm-200 dark:border-warm-700">
            <View className="flex-1">
              <Text className="text-lg font-bold text-warm-900 dark:text-warm-50">Was habe ich zu Hause?</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Zutaten eingeben, Rezepte finden</Text>
            </View>
            <Pressable onPress={() => setShowIngredientSearch(false)} className="p-2">
              <X size={22} color="#9E8878" />
            </Pressable>
          </View>

          <View className="px-4 py-3 border-b border-warm-200 dark:border-warm-700">
            <View className="flex-row items-center bg-warm-50 dark:bg-espresso-900 rounded-xl px-3 py-2.5 border border-warm-200 dark:border-warm-700">
              <Search size={16} color="#9E8878" />
              <TextInput
                className="flex-1 ml-2 text-base text-warm-900 dark:text-warm-50"
                placeholder="Tomate, Käse, Nudeln…"
                placeholderTextColor="#9E8878"
                value={ingredientInput}
                onChangeText={handleIngredientSearch}
                autoFocus
              />
              {ingredientInput ? (
                <Pressable onPress={() => { setIngredientInput(''); setIngredientResults([]); }}>
                  <X size={16} color="#9E8878" />
                </Pressable>
              ) : null}
            </View>
            <Text className="text-xs text-warm-500 dark:text-warm-400 mt-2">Mehrere Zutaten mit Komma trennen</Text>
          </View>

          <FlatList
            data={ingredientResults}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const terms = ingredientInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
              const ings = parseJSON<string[]>(item.ingredients, []);
              const matched = terms.filter(t => ings.some(ing => matchesIngredient(ing, t))).length;
              return (
                <Pressable
                  onPress={() => { setShowIngredientSearch(false); router.push(`/recipe/${item.id}`); }}
                  className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 px-4 py-3"
                >
                  <Text className="text-3xl mr-3">{item.emoji ?? '🍽️'}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-xs text-primary-500 mt-0.5">{matched} von {terms.length} Zutaten</Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              ingredientInput ? (
                <View className="items-center py-16">
                  <Text className="text-warm-500 dark:text-warm-400 text-sm text-center">Keine Rezepte mit diesen Zutaten gefunden.</Text>
                </View>
              ) : (
                <View className="items-center py-16">
                  <Refrigerator size={40} color="#d1d5db" />
                  <Text className="text-warm-500 dark:text-warm-400 text-sm text-center mt-3">Gib Zutaten ein die du{'\n'}zu Hause hast.</Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>

      {/* ── Rezeptkarten-Modal ── */}
      <Modal visible={showCardModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCardModal(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
          {/* Header */}
          <View className="flex-row items-center px-4 py-3 border-b border-warm-200 dark:border-warm-700">
            <View className="flex-1">
              <Text className="text-lg font-bold text-warm-900 dark:text-warm-50">Rezeptkarten erstellen</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{selectedIds.size} von {recipes.length} ausgewählt</Text>
            </View>
            <Pressable onPress={() => setShowCardModal(false)} className="p-2">
              <X size={22} color="#9E8878" />
            </Pressable>
          </View>

          {/* Schnellauswahl */}
          <View className="flex-row gap-2 px-4 py-3 border-b border-warm-200 dark:border-warm-700">
            <Pressable
              onPress={() => setSelectedIds(new Set(recipes.map(r => r.id)))}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-espresso-700 rounded-full border border-primary-200"
            >
              <Text className="text-xs font-medium text-primary-500">Alle</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedIds(new Set())}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-warm-100 dark:bg-espresso-800 rounded-full"
            >
              <Text className="text-xs font-medium text-warm-600 dark:text-warm-300">Keine</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedIds(new Set(recipes.filter(r => !r.pdf_created).map(r => r.id)))}
              className="flex-row items-center gap-1.5 px-3 py-1.5 bg-warm-100 dark:bg-espresso-800 rounded-full"
            >
              <Text className="text-xs font-medium text-warm-600 dark:text-warm-300">Noch keine PDF</Text>
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
                  className={`flex-row items-center px-4 py-3 border-b border-warm-100 ${selected ? 'bg-primary-50 dark:bg-espresso-700' : ''}`}
                >
                  <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${selected ? 'bg-primary-500 border-primary-500' : 'border-warm-300'}`}>
                    {selected && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                  <Text className="text-2xl mr-3">{recipe.emoji ?? '🍽️'}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-warm-900 dark:text-warm-50" numberOfLines={1}>{recipe.name}</Text>
                    {recipe.pdf_created ? (
                      <Text className="text-xs text-warm-500 dark:text-warm-400">PDF bereits erstellt</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Export-Button */}
          <View className="px-4 py-4 border-t border-warm-200 dark:border-warm-700">
            <Pressable
              onPress={handleExportCards}
              disabled={selectedIds.size === 0}
              className={`py-3.5 rounded-xl items-center ${selectedIds.size > 0 ? 'bg-primary-500' : 'bg-warm-200'}`}
            >
              <Text className={`font-semibold text-base ${selectedIds.size > 0 ? 'text-white' : 'text-warm-500 dark:text-warm-400'}`}>
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
  if (search) {
    return (
      <View className="items-center justify-center py-20">
        <ChefHat size={48} color="#d1d5db" />
        <Text className="text-warm-500 dark:text-warm-400 mt-4 text-center">Keine Rezepte gefunden.</Text>
      </View>
    );
  }
  return (
    <View className="px-4 pt-8 pb-4">
      <View className="items-center mb-8">
        <ChefHat size={52} color="#C84B31" />
        <Text className="text-xl font-bold text-warm-900 dark:text-warm-50 mt-3 text-center">
          Willkommen bei RecipeDeck
        </Text>
        <Text className="text-warm-500 dark:text-warm-400 text-sm text-center mt-2 leading-relaxed">
          Füge eine URL ein und RecipeDeck extrahiert{'\n'}das Rezept automatisch für dich.
        </Text>
      </View>

      {/* Supported platforms */}
      <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4 mb-4">
        <Text className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-3">
          Unterstützte Quellen
        </Text>
        <View className="gap-2.5">
          {[
            { emoji: '▶️', name: 'YouTube', hint: 'Videos & Shorts' },
            { emoji: '📸', name: 'Instagram', hint: 'Posts & Reels' },
            { emoji: '🎵', name: 'TikTok', hint: 'Videos' },
            { emoji: '🌐', name: 'Webseiten', hint: 'Chefkoch, BBC Good Food, …' },
            { emoji: '📷', name: 'Foto-Import', hint: 'Rezept aus dem Kochbuch fotografieren' },
          ].map((s) => (
            <View key={s.name} className="flex-row items-center gap-3">
              <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
              <View>
                <Text className="text-sm font-medium text-warm-800 dark:text-warm-100">{s.name}</Text>
                <Text className="text-xs text-warm-500 dark:text-warm-400">{s.hint}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/(tabs)/extract')}
        className="bg-primary-500 rounded-xl py-3.5 items-center"
      >
        <Text className="text-white font-semibold text-base">Erstes Rezept hinzufügen</Text>
      </Pressable>
    </View>
  );
}
