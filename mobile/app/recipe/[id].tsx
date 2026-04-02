import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Platform,
  TextInput, Modal, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Star, Clock, Users, Flame, ExternalLink,
  Edit, Save, X, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight,
  Download, Plus, Minus, Pencil, RotateCcw, CheckSquare, Square, ShoppingCart, QrCode,
} from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDB } from '@/db/migrate';
import type { Recipe } from '@/db/schema';
import { parseServingsNumber, scaleIngredient, parseIngredientNumber } from '@/utils/scaling';
import { shareRecipePDF } from '@/utils/pdf-export';
import { addIngredients } from '@/app/(tabs)/shopping';
import { encodeRecipeToCompactJSON } from '@/utils/recipe-qr';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function normalizeRecipe(r: Record<string, unknown>): Recipe {
  return {
    id: Number(r.id),
    name: String(r.name),
    emoji: (r.emoji as string | null) ?? null,
    source_url: (r.source_url as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? (r.imageUrl as string | null) ?? null,
    ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients ?? []),
    steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps ?? []),
    tags: typeof r.tags === 'string' ? r.tags : (r.tags ? JSON.stringify(r.tags) : null),
    servings: (r.servings as string | null) ?? null,
    duration: (r.duration as string | null) ?? null,
    calories: r.calories != null ? Number(r.calories) : null,
    rating: r.rating != null ? Number(r.rating) : null,
    notes: (r.notes as string | null) ?? null,
    transcript: null,
    tried: 0,
    pdf_created: 0,
    created_at: typeof r.created_at === 'number'
      ? r.created_at
      : (typeof r.created_at === 'string' && r.created_at
          ? Math.floor(new Date(r.created_at).getTime() / 1000)
          : null),
  };
}

async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem('recipedeck_server_url');
    if (stored?.trim()) return stored.trim();
  } catch {}
  return Platform.OS === 'web' ? '' : PRODUCTION_URL;
}

async function apiPatch(id: number, data: Record<string, unknown>): Promise<void> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}`);
}

async function sqlitePatch(id: number, data: Record<string, unknown>): Promise<void> {
  const db = getDB();
  const fields = Object.entries(data).map(([k]) => `${k} = ?`).join(', ');
  const values = Object.values(data).map(v =>
    Array.isArray(v) ? JSON.stringify(v) : (v as string | number | null)
  );
  await db.runAsync(
    `UPDATE recipes SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ...values, id
  );
}

async function patchRecipe(id: number, data: Record<string, unknown>): Promise<void> {
  if (Platform.OS === 'web') await apiPatch(id, data);
  else await sqlitePatch(id, data);
}

async function deleteRecipeById(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const serverUrl = await getServerUrl();
    await fetch(`${serverUrl}/api/v1/recipes/${id}`, { method: 'DELETE' });
  } else {
    await getDB().runAsync('DELETE FROM recipes WHERE id = ?', id);
  }
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-lg font-bold text-gray-900 mb-2">Rezept löschen</Text>
          <Text className="text-gray-500 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</Text>
          <View className="flex-row gap-3">
            <Pressable onPress={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 items-center">
              <Text className="text-gray-700 font-medium">Abbrechen</Text>
            </Pressable>
            <Pressable onPress={onConfirm} className="flex-1 py-3 rounded-xl bg-red-500 items-center">
              <Text className="text-white font-semibold">Löschen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cook Mode Modal ──────────────────────────────────────────────────────────

function CookModal({ steps, ingredients, onClose }: {
  steps: string[];
  ingredients: string[];
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggleCheck = (i: number) =>
    setChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  return (
    <Modal animationType="slide" statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-gray-900">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-700">
          <Text className="text-white font-semibold text-base">Koch-Modus</Text>
          <Pressable onPress={onClose} className="bg-gray-700 rounded-full p-2">
            <X size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Split screen */}
        <View className="flex-1 flex-row">
          {/* Left: Zutaten */}
          <View className="w-2/5 border-r border-gray-700">
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-3 py-2">
              Zutaten
            </Text>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
              {ingredients.map((ing, i) => (
                <Pressable
                  key={i}
                  onPress={() => toggleCheck(i)}
                  className="flex-row items-start gap-2 py-2 border-b border-gray-800"
                >
                  {checked.has(i)
                    ? <CheckSquare size={16} color="#9333ea" />
                    : <Square size={16} color="#6b7280" />}
                  <Text className={`text-sm flex-1 leading-5 ${checked.has(i) ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                    {ing}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Right: Schritte */}
          <View className="flex-1 flex-col">
            {/* Progress */}
            <View className="h-1 bg-gray-700 mx-4 mt-3 rounded-full">
              <View
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${((current + 1) / steps.length) * 100}%` }}
              />
            </View>
            <Text className="text-gray-500 text-xs text-center mt-2">
              Schritt {current + 1} / {steps.length}
            </Text>

            <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="bg-purple-600 rounded-full w-12 h-12 items-center justify-center mb-4 self-start">
                <Text className="text-white text-xl font-bold">{current + 1}</Text>
              </View>
              <Text className="text-white text-base leading-7">{steps[current]}</Text>
            </ScrollView>

            {/* Navigation */}
            <View className="flex-row gap-2 px-4 pb-4">
              <Pressable
                onPress={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}
                className={`flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl ${current === 0 ? 'bg-gray-800' : 'bg-gray-700'}`}
              >
                <ChevronLeft size={18} color={current === 0 ? '#4b5563' : '#fff'} />
                <Text className={current === 0 ? 'text-gray-600' : 'text-white'}>Zurück</Text>
              </Pressable>
              {current < steps.length - 1 ? (
                <Pressable
                  onPress={() => setCurrent(c => c + 1)}
                  className="flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl bg-purple-600"
                >
                  <Text className="text-white font-semibold">Weiter</Text>
                  <ChevronRight size={18} color="#fff" />
                </Pressable>
              ) : (
                <Pressable onPress={onClose} className="flex-1 items-center justify-center py-3 rounded-xl bg-green-600">
                  <Text className="text-white font-bold">Fertig!</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Star Display ─────────────────────────────────────────────────────────────

function StarRow({ value, onPress }: { value: number | null; onPress?: (s: number) => void }) {
  return (
    <View className="flex-row gap-2 items-center">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = (value ?? 0) >= star;
        return (
          <Pressable key={star} onPress={() => onPress?.(star)} disabled={!onPress}>
            <Star size={30} color="#f59e0b" fill={filled ? '#f59e0b' : 'transparent'} strokeWidth={1.5} />
          </Pressable>
        );
      })}
      {onPress && value != null && (
        <Pressable onPress={() => onPress(value)} className="ml-1">
          <X size={14} color="#9ca3af" />
        </Pressable>
      )}
    </View>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [editingIngredientIdx, setEditingIngredientIdx] = useState<number | null>(null);
  const [editingIngredientValue, setEditingIngredientValue] = useState('');
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
        row = await getDB().getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', recipeId) ?? null;
      }
      if (row) {
        setRecipe(row);
        setRating(row.rating != null ? Number(row.rating) : null);
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

  // ── Notes ──────────────────────────────────────────────────────────────────
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try { await patchRecipe(recipeId, { notes: value }); } catch { /* silent */ }
    }, 800);
  };

  // ── Ingredient inline edit ─────────────────────────────────────────────────
  const startIngredientEdit = (index: number, ings: string[]) => {
    const num = parseIngredientNumber(ings[index]);
    const scaled = num != null ? Math.round(num * multiplier * 10) / 10 : null;
    setEditingIngredientIdx(index);
    setEditingIngredientValue(scaled != null ? String(scaled) : '');
  };

  const confirmIngredientEdit = (index: number, ings: string[]) => {
    const entered = parseFloat(editingIngredientValue.replace(',', '.'));
    if (!isNaN(entered) && entered > 0) {
      const orig = parseIngredientNumber(ings[index]);
      if (orig != null && orig > 0) {
        setMultiplier(Math.max(0.1, Math.round((entered / orig) * 100) / 100));
      }
    }
    setEditingIngredientIdx(null);
    setEditingIngredientValue('');
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!recipe) return;
    setEditDraft({
      name: recipe.name,
      emoji: recipe.emoji ?? '🍽️',
      duration: recipe.duration ?? '',
      servings: recipe.servings ?? '',
      calories: String(recipe.calories ?? ''),
      tags: parseJSON<string[]>(recipe.tags, []).join(', '),
      ingredients: parseJSON<string[]>(recipe.ingredients, []),
      steps: parseJSON<string[]>(recipe.steps, []),
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
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try { await deleteRecipeById(recipeId); } catch { /* ignore */ }
    router.navigate('/(tabs)' as never);
  };

  // ── Shopping ───────────────────────────────────────────────────────────────
  const handleAddToShopping = async () => {
    if (!recipe) return;
    const ings = parseJSON<string[]>(recipe.ingredients, []);
    const scaled = multiplier !== 1 ? ings.map(i => scaleIngredient(i, multiplier)) : ings;
    await addIngredients(scaled, recipe.id);
    router.navigate('/(tabs)/shopping' as never);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = async () => {
    if (!recipe) return;
    try { await shareRecipePDF(recipe as Parameters<typeof shareRecipePDF>[0]); }
    catch { /* ignore */ }
  };

  // ── QR Share ───────────────────────────────────────────────────────────────
  const handleShareText = async () => {
    if (!recipe) return;
    try {
      await Share.share({
        title: recipe.name,
        message: `${recipe.emoji ?? '🍽️'} ${recipe.name}\n\nRecipeDeck-Rezept`,
      });
    } catch { /* ignore */ }
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
  const scaledIngredients = multiplier !== 1
    ? ingredients.map(i => scaleIngredient(i, multiplier))
    : ingredients;
  const scaledServings = Math.round(parseServingsNumber(recipe.servings) * multiplier);

  return (
    <>
      {cookMode && (
        <CookModal steps={steps} ingredients={scaledIngredients} onClose={() => setCookMode(false)} />
      )}
      {showDeleteModal && (
        <DeleteModal onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} />
      )}

      {/* QR-Teilen-Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center px-8">
          <View className="bg-white rounded-2xl p-6 w-full items-center">
            <Text className="text-lg font-bold text-gray-900 mb-1">{recipe.emoji ?? '🍽️'} {recipe.name}</Text>
            <Text className="text-xs text-gray-400 mb-5 text-center">QR-Code scannen um das Rezept{'\n'}in RecipeDeck zu importieren</Text>
            {(() => {
              const qrData = encodeRecipeToCompactJSON({
                name: recipe.name,
                emoji: recipe.emoji ?? '',
                ingredients,
                steps,
                tags,
                rating: recipe.rating ?? undefined,
                servings: recipe.servings ?? undefined,
                duration: recipe.duration ?? undefined,
              });
              return qrData ? (
                <QRCodeSVG value={qrData} size={200} color="#111827" backgroundColor="#ffffff" />
              ) : (
                <Text className="text-gray-400 text-sm">Rezept zu groß für QR-Code</Text>
              );
            })()}
            <View className="flex-row gap-3 mt-6 w-full">
              <Pressable onPress={handleShareText} className="flex-1 py-3 rounded-xl bg-purple-600 items-center">
                <Text className="text-white text-sm font-semibold">Teilen</Text>
              </Pressable>
              <Pressable onPress={() => setShowQrModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 items-center">
                <Text className="text-gray-700 text-sm font-medium">Schließen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
            {recipe.name}
          </Text>
          {!isEditing && (
            <Pressable onPress={startEdit} className="p-1 ml-2">
              <Edit size={20} color="#9333ea" />
            </Pressable>
          )}
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Hero-Bild ── */}
          {recipe.image_url ? (
            <Image
              source={{ uri: recipe.image_url }}
              className="w-full h-52"
              resizeMode="cover"
            />
          ) : null}

          {/* ── Hero ── */}
          <View className="bg-white px-4 pt-5 pb-4 items-center">
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
                {!recipe.image_url && (
                  <Text className="text-6xl mb-3">{recipe.emoji ?? '🍽️'}</Text>
                )}
                <Text className="text-2xl font-bold text-gray-900 text-center">{recipe.name}</Text>

                {/* Rating Display */}
                {rating != null && (
                  <View className="mt-2">
                    <StarRow value={rating} />
                  </View>
                )}

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
                    <Pressable onPress={() => setMultiplier(1)} className="flex-row items-center gap-1 mt-1">
                      <RotateCcw size={10} color="#9333ea" />
                      <Text className="text-xs text-purple-500">×{multiplier}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            <View className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 items-center">
              <Flame size={16} color="#9ca3af" />
              <Text className="text-xs text-gray-400 mt-1">kcal</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.calories}
                  onChangeText={v => setEditDraft(d => d && { ...d, calories: v })}
                  className="text-sm font-bold text-gray-900 text-center mt-1 border-b border-gray-200 w-full"
                  keyboardType="numeric"
                />
              ) : (
                <Text className="text-sm font-bold text-gray-900 mt-1">{recipe.calories ?? '—'}</Text>
              )}
            </View>
          </View>

          {/* ── Actions ── */}
          {isEditing ? (
            <View className="flex-row gap-3 px-4 mb-4">
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${isSaving ? 'bg-purple-300' : 'bg-purple-600'}`}
              >
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" />}
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
              <Pressable onPress={() => setCookMode(true)} className="flex-1 items-center py-3 rounded-xl bg-gray-900">
                <UtensilsCrossed size={18} color="#fff" />
                <Text className="text-white text-xs font-medium mt-1">Kochen</Text>
              </Pressable>
              <Pressable onPress={handleAddToShopping} className="flex-1 items-center py-3 rounded-xl bg-purple-50 border border-purple-200">
                <ShoppingCart size={18} color="#9333ea" />
                <Text className="text-purple-600 text-xs font-medium mt-1">Einkauf</Text>
              </Pressable>
              <Pressable onPress={() => setShowQrModal(true)} className="flex-1 items-center py-3 rounded-xl bg-white border border-gray-200">
                <QrCode size={18} color="#6b7280" />
                <Text className="text-gray-600 text-xs font-medium mt-1">Teilen</Text>
              </Pressable>
              <Pressable onPress={handlePDF} className="flex-1 items-center py-3 rounded-xl bg-white border border-gray-200">
                <Download size={18} color="#6b7280" />
                <Text className="text-gray-600 text-xs font-medium mt-1">PDF</Text>
              </Pressable>
              <Pressable onPress={() => setShowDeleteModal(true)} className="flex-1 items-center py-3 rounded-xl bg-white border border-gray-200">
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-red-500 text-xs font-medium mt-1">Löschen</Text>
              </Pressable>
            </View>
          )}

          {/* ── Zutaten ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <Text className="text-base font-bold text-gray-900">Zutaten</Text>
              {!isEditing && multiplier !== 1 && (
                <Pressable onPress={() => setMultiplier(1)} className="flex-row items-center gap-1">
                  <RotateCcw size={12} color="#9333ea" />
                  <Text className="text-xs text-purple-600">Zurücksetzen</Text>
                </Pressable>
              )}
            </View>

            {isEditing && editDraft ? (
              <View className="px-4 pb-4">
                {editDraft.ingredients.map((ing, i) => (
                  <View key={i} className="flex-row items-center gap-2 mb-2">
                    <TextInput
                      value={ing}
                      onChangeText={v => setEditDraft(d => {
                        if (!d) return d;
                        const a = [...d.ingredients]; a[i] = v;
                        return { ...d, ingredients: a };
                      })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                    />
                    <Pressable onPress={() => setEditDraft(d => d && { ...d, ingredients: d.ingredients.filter((_, j) => j !== i) })}>
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => setEditDraft(d => d && { ...d, ingredients: [...d.ingredients, ''] })} className="flex-row items-center gap-1 mt-1">
                  <Plus size={14} color="#9333ea" />
                  <Text className="text-purple-600 text-sm">Zutat hinzufügen</Text>
                </Pressable>
              </View>
            ) : (
              <View className="px-4 pb-4">
                {ingredients.map((ing, i) => {
                  const hasNum = parseIngredientNumber(ing) != null;
                  const isEditingThis = editingIngredientIdx === i;
                  return (
                    <View key={i} className="flex-row items-center py-2 border-b border-gray-50">
                      <Text className="text-purple-400 mr-2 text-base">•</Text>
                      {isEditingThis ? (
                        <>
                          <TextInput
                            value={editingIngredientValue}
                            onChangeText={setEditingIngredientValue}
                            onBlur={() => confirmIngredientEdit(i, ingredients)}
                            onSubmitEditing={() => confirmIngredientEdit(i, ingredients)}
                            keyboardType="numeric"
                            autoFocus
                            className="w-20 border border-purple-400 rounded-lg px-2 py-1 text-sm text-gray-900 mr-2"
                          />
                          <Text className="text-gray-500 text-sm flex-1">
                            {ing.replace(/^[\d.,]+\s*/, '')}
                          </Text>
                          <Pressable onPress={() => { setEditingIngredientIdx(null); setEditingIngredientValue(''); }}>
                            <X size={14} color="#9ca3af" />
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <Text className="text-gray-700 flex-1 text-sm">{scaledIngredients[i]}</Text>
                          {hasNum && (
                            <Pressable onPress={() => startIngredientEdit(i, ingredients)} className="p-1">
                              <Pencil size={14} color="#d1d5db" />
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Zubereitung ── */}
          <View className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100">
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
                        const a = [...d.steps]; a[i] = v;
                        return { ...d, steps: a };
                      })}
                      multiline
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                    />
                    <Pressable onPress={() => setEditDraft(d => d && { ...d, steps: d.steps.filter((_, j) => j !== i) })} className="mt-2">
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => setEditDraft(d => d && { ...d, steps: [...d.steps, ''] })} className="flex-row items-center gap-1 mt-1">
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
            <StarRow value={rating} onPress={handleRating} />
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
              {recipe.created_at ? (
                <Text className="text-xs text-gray-400 mb-2">
                  Extrahiert am {new Date(recipe.created_at * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
              ) : null}
              <Pressable
                onPress={() => recipe.source_url && Linking.openURL(recipe.source_url)}
                className="flex-row items-center gap-2 bg-gray-50 rounded-xl p-3"
              >
                <ExternalLink size={16} color="#9333ea" />
                <Text className="text-purple-600 text-sm flex-1" numberOfLines={1}>{recipe.source_url}</Text>
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
