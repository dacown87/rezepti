import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, X, ChefHat, Clock, Star, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';

const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';
const SERVER_URL_KEY = 'recipedeck_server_url';

async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    return stored?.trim() || PRODUCTION_URL;
  } catch {
    return PRODUCTION_URL;
  }
}

// API recipe shape (snake_case from backend)
interface ApiRecipe {
  id: number;
  name: string;
  emoji?: string;
  source_url?: string;
  ingredients: string;
  steps: string;
  tags?: string;
  servings?: string;
  duration?: string;
  calories?: number;
  rating?: number;
  notes?: string;
  created_at?: string;
}

function apiToRecipe(r: ApiRecipe): Recipe {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? null,
    source_url: r.source_url ?? null,
    ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients),
    steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps),
    tags: r.tags ?? null,
    servings: r.servings ?? null,
    duration: r.duration ?? null,
    calories: r.calories ?? null,
    rating: r.rating ?? null,
    notes: r.notes ?? null,
    transcript: null,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.created_at ?? new Date().toISOString(),
  };
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tags = parseJSON<string[]>(recipe.tags, []);
  const emoji = recipe.emoji ?? '🍽️';

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      className="flex-row items-center bg-white rounded-2xl mb-3 p-4 shadow-sm border border-gray-100"
    >
      <Text className="text-4xl mr-4">{emoji}</Text>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {recipe.name}
        </Text>
        <View className="flex-row items-center gap-3 mt-1">
          {recipe.duration ? (
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-400">{recipe.duration}</Text>
            </View>
          ) : null}
          {recipe.rating ? (
            <View className="flex-row items-center gap-1">
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs text-amber-500">{recipe.rating}/5</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-2">
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

export default function RecipeListScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filtered, setFiltered] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const db = getDB();
        rows = await db.getAllAsync<Recipe>(
          'SELECT * FROM recipes ORDER BY created_at DESC'
        );
      }
      setRecipes(rows);
      setFiltered(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    }
  }, []);

  useEffect(() => {
    loadRecipes().finally(() => setLoading(false));
  }, [loadRecipes]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(recipes);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.tags ?? '').toLowerCase().includes(q)
      )
    );
  }, [search, recipes]);

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
          <Pressable
            onPress={() => router.push('/(tabs)/extract')}
            className="bg-purple-600 rounded-full w-10 h-10 items-center justify-center"
          >
            <Plus size={20} color="white" />
          </Pressable>
        </View>

        {/* Suchfeld */}
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200">
          <Search size={16} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Rezepte suchen…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
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
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <ChefHat size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4 text-center">
                {search ? 'Keine Rezepte gefunden.' : 'Noch keine Rezepte.\nFüge dein erstes Rezept hinzu!'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
