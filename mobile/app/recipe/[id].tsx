import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Platform,
  TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Star, Clock, Users, Flame, ExternalLink,
  Edit, Save, X, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight,
  Download, Plus, Minus,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';
import { parseServingsNumber, scaleIngredient } from '@/utils/scaling';
import { shareRecipePDF } from '@/utils/pdf-export';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function normalizeRecipe(r: Record<string, unknown>): Recipe {
  const createdAt = r.created_at;
  return {
    id: r.id as number,
    name: r.name as string,
    emoji: (r.emoji as string | null) ?? null,
    source_url: (r.source_url as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients ?? []),
    steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps ?? []),
    tags: typeof r.tags === 'string' ? r.tags : (r.tags ? JSON.stringify(r.tags) : null),
    servings: (r.servings as string | null) ?? null,
    duration: (r.duration as string | null) ?? null,
    calories: (r.calories as number | null) ?? null,
    rating: (r.rating as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    transcript: null,
    tried: 0,
    pdf_created: 0,
    created_at: typeof createdAt === 'number' ? createdAt : null,
  };
}

async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem('recipedeck_server_url');
    return stored?.trim() || PRODUCTION_URL;
  } catch { return PRODUCTION_URL; }
}

async function apiPatch(id: number, data: Record<string, unknown>): Promise<void> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH fehlgeschlagen: ${res.status}`);
}

async function sqlitePatch(id: number, data: Record<string, unknown>): Promise<void> {
  const db = getDB();
  const fields = Object.entries(data)
    .map(([k]) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data).map(v =>
    Array.isArray(v) ? JSON.stringify(v) : (v as string | number | null)
  );
  await db.runAsync(
    `UPDATE recipes SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ...values, id
  );
}

async function patchRecipe(id: number, data: Record<string, unknown>): Promise<void> {
  if (Platform.OS === 'web') {
    await apiPatch(id, data);
  } else {
    await sqlitePatch(id, data);
  }
}

async function deleteRecipeById(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE fehlgeschlagen: ${res.status}`);
  } else {
    const db = getDB();
    await db.runAsync('DELETE FROM recipes WHERE id = ?', id);
  }
}

// ─── Cook Mode Modal ──────────────────────────────────────────────────────────

function CookModal({ steps, onClose }: { steps: string[]; onClose: () => void }) {
  const [current, setCurrent] = useState(0);
  return (
    <Modal animationType="slide" statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-gray-400 text-sm">Schritt {current + 1} / {steps.length}</Text>
          <Pressable onPress={onClose} className="bg-gray-700 rounded-full p-2">
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Progress bar */}
        <View className="h-1 bg-gray-700 mx-4 rounded-full mb-6">
          <View
            className="h-full bg-purple-500 rounded-full"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </View>

        <ScrollView className="flex-1 px-6">
          <View className="bg-gray-700 rounded-full w-16 h-16 items-center justify-center mb-6">
            <Text className="text-white text-2xl font-bold">{current + 1}</Text>
          </View>
          <Text className="text-white text-xl leading-9">{steps[current]}</Text>
        </ScrollView>

        <View className="flex-row gap-3 px-4 pb-4 pt-4">
          <Pressable
            onPress={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className={`flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl ${current === 0 ? 'bg-gray-700' : 'bg-gray-600'}`}
          >
            <ChevronLeft size={20} color={current === 0 ? '#6b7280' : '#fff'} />
            <Text className={current === 0 ? 'text-gray-500' : 'text-white'}>Zurück</Text>
          </Pressable>
          {current < steps.length - 1 ? (
            <Pressable
              onPress={() => setCurrent(c => c + 1)}
              className="flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-purple-600"
            >
              <Text className="text-white font-semibold">Weiter</Text>
              <ChevronRight size={20} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={onClose}
              className="flex-1 items-center justify-center py-4 rounded-2xl bg-green-600"
            >
              <Text className="text-white font-bold text-lg">Fertig!</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [multiplier, setMultiplier] = useState(1);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cookMode, setCookMode] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    name: string; emoji: string; duration: string; servings: string;
    calories: string; tags: string; ingredients: string[]; steps: string[];
  } | null>(null);

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recipeId = Number(id);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadRecipe = useCallback(async () => {
    if (!id) return;
    try {
      let row: Recipe | null = null;
      if (Platform.OS === 'web') {
        const serverUrl = await getServerUrl();
        const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`);
        if (res.ok) row = normalizeRecipe(await res.json());
      } else {
        const db = getDB();
        row = await db.getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', recipeId) ?? null;
      }
      if (row) {
        setRecipe(row);
        setRating(row.rating ?? null);
        setNotes(row.notes ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [id, recipeId]);

  useEffect(() => { loadRecipe(); }, [loadRecipe]);

  // ── Rating ─────────────────────────────────────────────────────────────────
  const handleRating = async (stars: number) => {
    const newRating = rating === stars ? null : stars;
    setRating(newRating);
    try { await patchRecipe(recipeId, { rating: newRating }); } catch { /* silent */ }
  };

  // ── Notes auto-save ────────────────────────────────────────────────────────
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try { await patchRecipe(recipeId, { notes: value }); } catch { /* silent */ }
    }, 800);
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!recipe) return;
    const ingredients = parseJSON<string[]>(recipe.ingredients, []);
    const steps = parseJSON<string[]>(recipe.steps, []);
    const tags = parseJSON<string[]>(recipe.tags, []);
    setEditDraft({
      name: recipe.name,
      emoji: recipe.emoji ?? '🍽️',
      duration: recipe.duration ?? '',
      servings: recipe.servings ?? '',
      calories: String(recipe.calories ?? ''),
      tags: tags.join(', '),
      ingredients,
      steps,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!recipe || !editDraft) return;
    setIsSaving(true);
    try {
      const patch = {
        name: editDraft.name.trim(),
        emoji: editDraft.emoji.trim(),
        duration: editDraft.duration.trim(),
        servings: editDraft.servings.trim(),
        calories: editDraft.calories ? parseInt(editDraft.calories) : null,
        tags: JSON.stringify(editDraft.tags.split(',').map(t => t.trim()).filter(Boolean)),
        ingredients: JSON.stringify(editDraft.ingredients.filter(Boolean)),
        steps: JSON.stringify(editDraft.steps.filter(Boolean)),
      };
      await patchRecipe(recipeId, patch);
      setRecipe({ ...recipe, ...patch });
      setIsEditing(false);
      setEditDraft(null);
    } catch (e) {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert('Rezept löschen', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecipeById(recipeId);
            router.replace('/(tabs)' as never);
          } catch {
            Alert.alert('Fehler', 'Löschen fehlgeschlagen.');
          }
        },
      },
    ]);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = async () => {
    if (!recipe) return;
    try { await shareRecipePDF(recipe as Parameters<typeof shareRecipePDF>[0]); }
    catch { Alert.alert('Fehler', 'PDF konnte nicht erstellt werden.'); }
  };

  // ──────────────────────────────────────────────────────────────────────────
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
  const baseServings = parseServingsNumber(recipe.servings);
  const scaledServings = Math.round(baseServings * multiplier);

  return (
    <>
      {cookMode && <CookModal steps={steps} onClose={() => setCookMode(false)} />}

      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
            {recipe.name}
          </Text>
          {!isEditing ? (
            <Pressable onPress={startEdit} className="p-1 ml-2">
              <Edit size={20} color="#9333ea" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Hero ── */}
          <View className="bg-white px-4 pt-6 pb-4 items-center">
            {isEditing && editDraft ? (
              <View className="w-full gap-3">
                <View className="flex-row gap-2">
                  <TextInput
                    value={editDraft.emoji}
                    onChangeText={v => setEditDraft(d => d && { ...d, emoji: v })}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-2xl text-center w-16"
                    maxLength={2}
                  />
                  <TextInput
                    value={editDraft.name}
                    onChangeText={v => setEditDraft(d => d && { ...d, name: v })}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base font-semibold text-gray-900"
                    placeholder="Rezeptname"
                  />
                </View>
                <TextInput
                  value={editDraft.tags}
                  onChangeText={v => setEditDraft(d => d && { ...d, tags: v })}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700"
                  placeholder="Tags, kommagetrennt"
                />
              </View>
            ) : (
              <>
                <Text className="text-6xl mb-3">{recipe.emoji ?? '🍽️'}</Text>
                <Text className="text-2xl font-bold text-gray-900 text-center">{recipe.name}</Text>
                {tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 justify-center mt-3">
                    {tags.map(tag => (
                      <View key={tag} className="bg-purple-50 rounded-full px-3 py-1">
                        <Text className="text-xs text-purple-600">{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Meta ── */}
          <View className="flex-row gap-3 px-4 py-4">
            {/* Dauer */}
            <View className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 items-center">
              <Clock size={16} color="#9ca3af" />
              <Text className="text-xs text-gray-400 mt-1">Dauer</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.duration}
                  onChangeText={v => setEditDraft(d => d && { ...d, duration: v })}
                  className="text-sm font-bold text-gray-900 text-center mt-1 border-b border-gray-200 w-full"
                  placeholder="30 min"
                />
              ) : (
                <Text className="text-sm font-bold text-gray-900 mt-1">{recipe.duration ?? '—'}</Text>
              )}
            </View>

            {/* Portionen + Skaler */}
            <View className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 items-center">
              <Users size={16} color="#9ca3af" />
              <Text className="text-xs text-gray-400 mt-1">Portionen</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.servings}
                  onChangeText={v => setEditDraft(d => d && { ...d, servings: v })}
                  className="text-sm font-bold text-gray-900 text-center mt-1 border-b border-gray-200 w-full"
                  placeholder="4"
                />
              ) : (
                <>
                  <Text className="text-sm font-bold text-gray-900 mt-1">{scaledServings}</Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <Pressable
                      onPress={() => setMultiplier(m => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                      disabled={multiplier <= 0.5}
                      className={`w-7 h-7 rounded-full items-center justify-center ${multiplier <= 0.5 ? 'bg-gray-100' : 'bg-purple-600'}`}
                    >
                      <Minus size={14} color={multiplier <= 0.5 ? '#9ca3af' : '#fff'} />
                    </Pressable>
                    <Pressable
                      onPress={() => setMultiplier(m => Math.min(4, Math.round((m + 0.5) * 10) / 10))}
                      disabled={multiplier >= 4}
                      className={`w-7 h-7 rounded-full items-center justify-center ${multiplier >= 4 ? 'bg-gray-100' : 'bg-purple-600'}`}
                    >
                      <Plus size={14} color={multiplier >= 4 ? '#9ca3af' : '#fff'} />
                    </Pressable>
                  </View>
                  {multiplier !== 1 && (
                    <Pressable onPress={() => setMultiplier(1)}>
                      <Text className="text-xs text-purple-500 mt-1">×{multiplier} · Reset</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {/* Kalorien */}
            <View className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 items-center">
              <Flame size={16} color="#9ca3af" />
              <Text className="text-xs text-gray-400 mt-1">kcal</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.calories}
                  onChangeText={v => setEditDraft(d => d && { ...d, calories: v })}
                  className="text-sm font-bold text-gray-900 text-center mt-1 border-b border-gray-200 w-full"
                  placeholder="kcal"
                  keyboardType="numeric"
                />
              ) : (
                <Text className="text-sm font-bold text-gray-900 mt-1">
                  {recipe.calories ? `${recipe.calories}` : '—'}
                </Text>
              )}
            </View>
          </View>

          {/* ── Action Buttons ── */}
          {isEditing ? (
            <View className="flex-row gap-3 px-4 mb-4">
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${isSaving ? 'bg-purple-300' : 'bg-purple-600'}`}
              >
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Save size={18} color="#fff" />}
                <Text className="text-white font-semibold">Speichern</Text>
              </Pressable>
              <Pressable
                onPress={() => { setIsEditing(false); setEditDraft(null); }}
                className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white"
              >
                <X size={18} color="#6b7280" />
                <Text className="text-gray-600">Abbrechen</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-2 px-4 mb-4">
              <Pressable
                onPress={() => setCookMode(true)}
                className="flex-1 flex-col items-center justify-center py-3 rounded-xl bg-gray-900"
              >
                <UtensilsCrossed size={18} color="#fff" />
                <Text className="text-white text-xs font-medium mt-1">Kochen</Text>
              </Pressable>
              <Pressable
                onPress={handlePDF}
                className="flex-1 flex-col items-center justify-center py-3 rounded-xl bg-white border border-gray-200"
              >
                <Download size={18} color="#6b7280" />
                <Text className="text-gray-600 text-xs font-medium mt-1">PDF</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="flex-1 flex-col items-center justify-center py-3 rounded-xl bg-white border border-gray-200"
              >
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-red-500 text-xs font-medium mt-1">Löschen</Text>
              </Pressable>
            </View>
          )}

          {/* ── Zutaten ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <Text className="text-base font-bold text-gray-900 px-4 pt-4 pb-2">Zutaten</Text>
            {isEditing && editDraft ? (
              <View className="px-4 pb-4">
                {editDraft.ingredients.map((ing, i) => (
                  <View key={i} className="flex-row items-center gap-2 mb-2">
                    <TextInput
                      value={ing}
                      onChangeText={v => setEditDraft(d => {
                        if (!d) return d;
                        const ingredients = [...d.ingredients];
                        ingredients[i] = v;
                        return { ...d, ingredients };
                      })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                    />
                    <Pressable onPress={() => setEditDraft(d => d && {
                      ...d, ingredients: d.ingredients.filter((_, j) => j !== i)
                    })}>
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={() => setEditDraft(d => d && { ...d, ingredients: [...d.ingredients, ''] })}
                  className="flex-row items-center gap-1 mt-1"
                >
                  <Plus size={14} color="#9333ea" />
                  <Text className="text-purple-600 text-sm">Zutat hinzufügen</Text>
                </Pressable>
              </View>
            ) : (
              <View className="px-4 pb-4">
                {ingredients.map((ing, i) => (
                  <View key={i} className="flex-row items-start py-2 border-b border-gray-50">
                    <Text className="text-purple-400 mr-2 mt-0.5">•</Text>
                    <Text className="text-gray-700 flex-1 text-sm">
                      {multiplier !== 1 ? scaleIngredient(ing, multiplier) : ing}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Zubereitung ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <Text className="text-base font-bold text-gray-900 px-4 pt-4 pb-2">Zubereitung</Text>
            {isEditing && editDraft ? (
              <View className="px-4 pb-4">
                {editDraft.steps.map((step, i) => (
                  <View key={i} className="flex-row items-start gap-2 mb-2">
                    <View className="bg-purple-600 rounded-full w-6 h-6 items-center justify-center shrink-0 mt-2">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <TextInput
                      value={step}
                      onChangeText={v => setEditDraft(d => {
                        if (!d) return d;
                        const steps = [...d.steps];
                        steps[i] = v;
                        return { ...d, steps };
                      })}
                      multiline
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                    />
                    <Pressable onPress={() => setEditDraft(d => d && {
                      ...d, steps: d.steps.filter((_, j) => j !== i)
                    })} className="mt-2">
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={() => setEditDraft(d => d && { ...d, steps: [...d.steps, ''] })}
                  className="flex-row items-center gap-1 mt-1"
                >
                  <Plus size={14} color="#9333ea" />
                  <Text className="text-purple-600 text-sm">Schritt hinzufügen</Text>
                </Pressable>
              </View>
            ) : (
              <View className="px-4 pb-4">
                {steps.map((step, i) => (
                  <View key={i} className="flex-row items-start mb-4">
                    <View className="bg-purple-600 rounded-full w-7 h-7 items-center justify-center mr-3 mt-0.5 shrink-0">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <Text className="text-gray-700 flex-1 leading-6 text-sm">{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Bewertung ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 p-4">
            <Text className="text-base font-bold text-gray-900 mb-3">Meine Bewertung</Text>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <Pressable key={star} onPress={() => handleRating(star)}>
                  <Star
                    size={32}
                    color={star <= (rating ?? 0) ? '#f59e0b' : '#d1d5db'}
                    fill={star <= (rating ?? 0) ? '#f59e0b' : 'none'}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Notizen ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 p-4">
            <Text className="text-base font-bold text-gray-900 mb-2">Notizen</Text>
            <TextInput
              value={notes}
              onChangeText={handleNotesChange}
              placeholder="Eigene Anmerkungen, Tipps…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-3 min-h-20"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* ── Quelle ── */}
          {recipe.source_url ? (
            <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 p-4">
              <Text className="text-base font-bold text-gray-900 mb-2">Quelle</Text>
              <Pressable
                onPress={() => recipe.source_url && Linking.openURL(recipe.source_url)}
                className="flex-row items-center gap-2 bg-gray-50 rounded-xl p-3"
              >
                <ExternalLink size={16} color="#9333ea" />
                <Text className="text-purple-600 text-sm flex-1" numberOfLines={1}>
                  {recipe.source_url}
                </Text>
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
