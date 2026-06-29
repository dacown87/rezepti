import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  Search, X, ChefHat, Clock, Star, Plus,
  LayoutGrid, List, Tag, FileText, Refrigerator, QrCode,
  Heart, FolderOpen, Home, Lock,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recipe } from '@/db/schema';
import { ApiRequestError, apiFetch, assertApiOk, type ApiRecipe } from '@/utils/api';
import { ProtectedAccessNotice } from '@/components/ProtectedAccessNotice';
import { useRecipes } from '@/hooks/useRecipes';
import { OfflineBanner } from '@/components/OfflineBanner';
import { mapProtectedApiError } from '@/utils/protected-access';
import { apiToRecipe } from '@/utils/recipe-mapper';
import {
  buildIngredientResultRows,
  buildRecipeCategoryCounts,
  buildRecipeListItemData,
  filterRecipeListItemsByCategory,
  filterRecipeListItemsBySearch,
  parseIngredientTerms,
  type IngredientResultRow,
  type RecipeCategoryCount,
  type RecipeListItemData,
} from '@/utils/recipe-list-screen-data';

const VIEW_MODE_KEY = 'recipedeck_view_mode';

const CATEGORY_ICONS: Record<string, string> = {
  Auflauf: '🥘',
  Nudelgericht: '🍝',
  Fleischgericht: '🥩',
  Geflügel: '🍗',
  Fischgericht: '🐟',
  Suppe: '🍲',
  Salat: '🥗',
  'Gebäck & Kuchen': '🍰',
  Frühstück: '🥐',
  Snack: '🧆',
  Vegetarisch: '🌱',
  Asiatisch: '🍜',
};

interface CategoryInfo extends RecipeCategoryCount { icon: string }

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '🍽️';
}

// ─── Scope Badge ──────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: 'private' | 'household' }) {
  return (
    <View className="flex-row items-center gap-0.5" testID={`scope-badge-${scope}`}>
      {scope === 'household'
        ? <Home size={10} color="#9E8878" />
        : <Lock size={10} color="#9E8878" />}
      <Text className="text-xs text-warm-500 dark:text-warm-400">
        {scope === 'household' ? 'Haushalt' : 'Privat'}
      </Text>
    </View>
  );
}

// ─── List Card ────────────────────────────────────────────────────────────────

function ListCard({ recipe, tags }: { recipe: Recipe; tags: string[] }) {
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name} öffnen`}
      testID={`recipe-card-${recipe.id}`}
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
        <View className="flex-row items-center gap-1.5">
          <Text className="text-base font-semibold text-warm-900 dark:text-warm-50 flex-1" numberOfLines={1}>
            {recipe.name}
          </Text>
          {recipe.isFavorite ? <Heart size={13} color="#C84B31" fill="#C84B31" /> : null}
        </View>
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
          {recipe.scope ? <ScopeBadge scope={recipe.scope} /> : null}
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

function GridCard({ recipe, tags }: { recipe: Recipe; tags: string[] }) {
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name} öffnen`}
      testID={`recipe-card-${recipe.id}`}
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
        <View className="flex-row items-start gap-1">
          <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50 flex-1" numberOfLines={2}>
            {recipe.name}
          </Text>
          {recipe.isFavorite ? <Heart size={12} color="#C84B31" fill="#C84B31" /> : null}
        </View>
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
          {recipe.scope ? <ScopeBadge scope={recipe.scope} /> : null}
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
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'categories'>('categories');
  const ingredientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredientResults, setIngredientResults] = useState<Recipe[]>([]);
  const [ingredientResultMatchedCounts, setIngredientResultMatchedCounts] = useState<number[]>([]);
  const [ingredientSearchError, setIngredientSearchError] = useState<unknown>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const deferredIngredientInput = useDeferredValue(ingredientInput);

  // React Query: stale-while-revalidate, persisted to AsyncStorage
  const { data: apiRecipes, error: recipesError, isLoading: loading, isError, refetch } = useRecipes();
  const recipes = useMemo(() => (apiRecipes ?? []).map(apiToRecipe), [apiRecipes]);
  const recipeListProtectedState = useMemo(
    () => mapProtectedApiError(recipesError, '/(tabs)'),
    [recipesError],
  );
  const ingredientSearchProtectedState = useMemo(
    () => mapProtectedApiError(ingredientSearchError, '/(tabs)'),
    [ingredientSearchError],
  );
  const recipeEntries = useMemo<RecipeListItemData[]>(
    () => buildRecipeListItemData(recipes),
    [recipes],
  );

  // Refetch + load view mode when tab is focused
  useFocusEffect(useCallback(() => {
    refetch();
    AsyncStorage.getItem(VIEW_MODE_KEY).then(v => {
      if (v === 'grid' || v === 'list' || v === 'categories') setViewMode(v);
    });
  }, [refetch]));

  const toggleViewMode = async () => {
    const next = viewMode === 'list' ? 'grid' : viewMode === 'grid' ? 'categories' : 'list';
    setViewMode(next);
    await AsyncStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (q.trim()) setSelectedCategory(null);
  };

  const openCardModal = () => {
    // Vorauswahl: alle ohne PDF
    const noPdf = new Set(recipes.filter(r => !r.pdf_created).map(r => r.id));
    setSelectedIds(noPdf.size > 0 ? noPdf : new Set(recipes.map(r => r.id)));
    setShowCardModal(true);
  };

  const handleIngredientSearch = (input: string) => {
    setIngredientInput(input);
    setIngredientSearchError(null);
    if (!input.trim()) {
      setIngredientResults([]);
      setIngredientResultMatchedCounts([]);
      return;
    }

    // Use the backend search endpoint
    if (ingredientSearchTimer.current) clearTimeout(ingredientSearchTimer.current);
    ingredientSearchTimer.current = setTimeout(async () => {
      const terms = input.split(',').map(t => t.trim()).filter(Boolean);
      if (!terms.length) return;
      try {
        const res = await apiFetch(`/api/v1/recipes?ingredients=${encodeURIComponent(terms.join(','))}&match=or`);
        await assertApiOk(res, `Zutatensuche fehlgeschlagen (${res.status})`);
        const data = await res.json();
        const list: ApiRecipe[] = Array.isArray(data.recipes) ? data.recipes : [];
        const matchedCounts = Array.isArray(data.matched_counts)
          ? data.matched_counts.filter((value: unknown): value is number => Number.isInteger(value))
          : [];
        startTransition(() => {
          setIngredientResults(list.map(apiToRecipe));
          setIngredientResultMatchedCounts(matchedCounts);
        });
      } catch (error) {
        setIngredientResults([]);
        setIngredientResultMatchedCounts([]);
        setIngredientSearchError(error);
      }
    }, 300);
  };

  const handleExportCards = async () => {
    setShowCardModal(false);
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const toExport = recipes.filter(r => selectedIds.has(r.id));
      const { shareRecipeCardsPDF } = await import('@/utils/pdf-export');
      await shareRecipeCardsPDF(toExport);
    } catch { /* ignore */ } finally {
      setExporting(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filteredEntries = useMemo(
    () => filterRecipeListItemsBySearch(recipeEntries, deferredSearch),
    [recipeEntries, deferredSearch],
  );

  const allCategories = useMemo(
    () => buildRecipeCategoryCounts(recipeEntries).map((category) => ({
      ...category,
      icon: category.name === 'Alle Rezepte' ? '📖' : getCategoryIcon(category.name),
    })),
    [recipeEntries],
  );
  const categoryFilteredEntries = useMemo(
    () => filterRecipeListItemsByCategory(filteredEntries, selectedCategory),
    [filteredEntries, selectedCategory],
  );
  const visibleEntries = useMemo(
    () => (favoritesOnly ? categoryFilteredEntries.filter((e) => e.recipe.isFavorite) : categoryFilteredEntries),
    [categoryFilteredEntries, favoritesOnly],
  );
  const hasAnyFavorite = useMemo(() => recipes.some((r) => r.isFavorite), [recipes]);
  const ingredientResultTerms = useMemo(
    () => parseIngredientTerms(deferredIngredientInput),
    [deferredIngredientInput],
  );
  const ingredientResultEntries = useMemo(
    () => buildIngredientResultRows(ingredientResults, ingredientResultTerms, ingredientResultMatchedCounts),
    [ingredientResults, ingredientResultMatchedCounts, ingredientResultTerms],
  );
  const renderCategoryItem = useCallback(({ item }: { item: CategoryInfo }) => (
    <CategoryCard info={item} onPress={() => {
      if (item.name === 'Alle Rezepte') {
        setSelectedCategory(null);
        setViewMode('list');
        AsyncStorage.setItem(VIEW_MODE_KEY, 'list');
      } else {
        setSelectedCategory(item.name);
        setViewMode('list');
        AsyncStorage.setItem(VIEW_MODE_KEY, 'list');
      }
    }} />
  ), []);
  const renderGridItem = useCallback(
    ({ item }: { item: RecipeListItemData }) => <GridCard recipe={item.recipe} tags={item.tags} />,
    [],
  );
  const renderListItem = useCallback(
    ({ item }: { item: RecipeListItemData }) => <ListCard recipe={item.recipe} tags={item.tags} />,
    [],
  );
  const renderIngredientSearchItem = useCallback(
    ({ item }: { item: IngredientResultRow }) => (
      <Pressable
        onPress={() => { setShowIngredientSearch(false); router.push(`/recipe/${item.recipe.id}`); }}
        className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 px-4 py-3"
      >
        <Text className="text-3xl mr-3">{item.recipe.emoji ?? '🍽️'}</Text>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50" numberOfLines={1}>{item.recipe.name}</Text>
          <Text className="text-xs text-primary-500 mt-0.5">{item.matchedCount} von {ingredientResultTerms.length} Zutaten</Text>
        </View>
      </Pressable>
    ),
    [ingredientResultTerms.length],
  );

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <OfflineBanner
        isError={isError && !recipeListProtectedState}
        authExpired={!!recipeListProtectedState}
        onAuthPress={() => recipeListProtectedState && router.push(recipeListProtectedState.primaryHref)}
      />
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">RecipeDeck</Text>
          <View className="flex-row items-center gap-2">
            {recipes.length > 0 && (
              <>
                <Pressable
                  onPress={() => {
                    setShowIngredientSearch(true);
                    setIngredientInput('');
                    setIngredientResults([]);
                    setIngredientResultMatchedCounts([]);
                  }}
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
              onPress={() => router.push('/collections')}
              accessibilityRole="button"
              accessibilityLabel="Collections öffnen"
              testID="open-collections"
              className="bg-white dark:bg-espresso-800 rounded-full w-9 h-9 items-center justify-center border border-warm-200 dark:border-warm-700"
            >
              <FolderOpen size={17} color="#9E8878" />
            </Pressable>
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

        {/* Favoriten-Filter */}
        {hasAnyFavorite ? (
          <View className="flex-row mt-2">
            <Pressable
              onPress={() => {
                setFavoritesOnly((v) => {
                  const next = !v;
                  // Favorites filter only applies to list/grid; leave the categories
                  // overview when enabling so the filtered result is actually visible.
                  if (next && viewMode === 'categories') setViewMode('list');
                  return next;
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Nur Favoriten anzeigen"
              accessibilityState={{ selected: favoritesOnly }}
              testID="favorites-filter"
              className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                favoritesOnly
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white dark:bg-espresso-800 border-warm-200 dark:border-warm-700'
              }`}
            >
              <Heart size={13} color={favoritesOnly ? '#fff' : '#C84B31'} fill={favoritesOnly ? '#fff' : 'transparent'} />
              <Text className={`text-xs font-medium ${favoritesOnly ? 'text-white' : 'text-primary-500'}`}>
                Favoriten
              </Text>
            </Pressable>
          </View>
        ) : null}
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
            {getCategoryIcon(selectedCategory)} {selectedCategory}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading && !apiRecipes ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="recipe-list-loading" size="large" color="#C84B31" />
        </View>
      ) : isError && recipes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          {recipeListProtectedState ? (
            <ProtectedAccessNotice state={recipeListProtectedState} onRetry={() => void refetch()} />
          ) : (
            <>
              <Text className="text-red-500 text-center">
                {recipesError instanceof ApiRequestError ? recipesError.message : 'Rezepte konnten nicht geladen werden'}
              </Text>
              <Pressable onPress={() => refetch()} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
                <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (viewMode === 'categories' && !search) ? (
        <FlatList
          data={allCategories}
          keyExtractor={(item) => item.name}
          numColumns={2}
          key="categories"
          renderItem={renderCategoryItem}
          contentContainerStyle={{ padding: 8 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search="" />}
          initialNumToRender={8}
          windowSize={5}
        />
      ) : viewMode === 'grid' ? (
        <FlatList
          data={visibleEntries}
          keyExtractor={(item) => String(item.recipe.id)}
          numColumns={2}
          key="list-grid"
          renderItem={renderGridItem}
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search={search} />}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      ) : (
        <FlatList
          data={visibleEntries}
          keyExtractor={(item) => String(item.recipe.id)}
          key="list-list"
          renderItem={renderListItem}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C84B31" />}
          ListEmptyComponent={<EmptyState search={search} />}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
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
            data={ingredientResultEntries}
            keyExtractor={(item) => String(item.recipe.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={renderIngredientSearchItem}
            ListEmptyComponent={
              ingredientSearchProtectedState ? (
                <ProtectedAccessNotice
                  state={ingredientSearchProtectedState}
                  onRetry={() => handleIngredientSearch(ingredientInput)}
                  compact
                />
              ) : ingredientInput ? (
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
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={6}
            removeClippedSubviews
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
