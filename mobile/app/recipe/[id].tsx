import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Star, Clock, Users, Flame, ExternalLink } from 'lucide-react-native';
import * as Linking from 'expo-linking';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const db = getDB();
    db.getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', Number(id))
      .then((row) => setRecipe(row ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#9333ea" />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-gray-500 text-center">Rezept nicht gefunden.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-purple-600">Zurück</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ingredients = parseJSON<string[]>(recipe.ingredients, []);
  const steps = parseJSON<string[]>(recipe.steps, []);
  const tags = parseJSON<string[]>(recipe.tags, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900 flex-1" numberOfLines={1}>
            {recipe.name}
          </Text>
        </View>

        {/* Emoji + Titel */}
        <View className="px-4 pb-4 items-center">
          <Text className="text-6xl mb-3">{recipe.emoji ?? '🍽️'}</Text>
          <Text className="text-2xl font-bold text-gray-900 text-center">{recipe.name}</Text>

          {/* Meta-Badges */}
          <View className="flex-row flex-wrap gap-3 justify-center mt-3">
            {recipe.duration ? (
              <View className="flex-row items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
                <Clock size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600">{recipe.duration}</Text>
              </View>
            ) : null}
            {recipe.servings ? (
              <View className="flex-row items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
                <Users size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600">{recipe.servings}</Text>
              </View>
            ) : null}
            {recipe.calories ? (
              <View className="flex-row items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
                <Flame size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600">{recipe.calories} kcal</Text>
              </View>
            ) : null}
            {recipe.rating ? (
              <View className="flex-row items-center gap-1 bg-amber-50 rounded-full px-3 py-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm text-amber-600">{recipe.rating}/5</Text>
              </View>
            ) : null}
          </View>

          {/* Tags */}
          {tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 justify-center mt-3">
              {tags.map((tag) => (
                <View key={tag} className="bg-purple-50 rounded-full px-3 py-1">
                  <Text className="text-xs text-purple-600">{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Zutaten */}
        <View className="px-4 pb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Zutaten</Text>
          <View className="bg-gray-50 rounded-2xl p-4">
            {ingredients.map((ing, i) => (
              <View key={i} className="flex-row items-start py-1.5 border-b border-gray-100 last:border-0">
                <Text className="text-purple-400 mr-2 mt-0.5">•</Text>
                <Text className="text-gray-700 flex-1">{ing}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Schritte */}
        <View className="px-4 pb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Zubereitung</Text>
          {steps.map((step, i) => (
            <View key={i} className="flex-row items-start mb-4">
              <View className="bg-purple-600 rounded-full w-7 h-7 items-center justify-center mr-3 mt-0.5 shrink-0">
                <Text className="text-white text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-gray-700 flex-1 leading-6">{step}</Text>
            </View>
          ))}
        </View>

        {/* Notizen */}
        {recipe.notes ? (
          <View className="px-4 pb-4">
            <Text className="text-lg font-bold text-gray-900 mb-2">Notizen</Text>
            <View className="bg-amber-50 rounded-2xl p-4">
              <Text className="text-amber-800">{recipe.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Quelle */}
        {recipe.source_url ? (
          <View className="px-4 pb-8">
            <Pressable
              onPress={() => recipe.source_url && Linking.openURL(recipe.source_url)}
              className="flex-row items-center gap-2 bg-gray-100 rounded-xl p-4"
            >
              <ExternalLink size={16} color="#6b7280" />
              <Text className="text-gray-600 text-sm flex-1" numberOfLines={1}>
                {recipe.source_url}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
