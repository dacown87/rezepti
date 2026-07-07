import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  TextInput, Modal, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Star, Clock, Users, Flame, ExternalLink,
  Edit, Save, X, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight,
  Download, Plus, Minus, Pencil, RotateCcw, CheckSquare, Square, ShoppingCart, QrCode, WifiOff,
  Heart, FolderPlus, Home, Copy, Lock, Mail, Send,
} from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { OfflineBanner } from '@/components/OfflineBanner';
import { ProtectedAccessNotice } from '@/components/ProtectedAccessNotice';
import type { Recipe } from '@/db/schema';
import { ImagePickerModal } from '@/components/ImagePickerModal';
import { parseServingsNumber, scaleIngredient, parseIngredientNumber } from '@/utils/scaling';
import { StepText } from '@/components/StepText';
import { addIngredients } from '@/utils/shopping-service';
import { encodeRecipeToCompactJSON } from '@/utils/recipe-qr';
import { buildRecipeEditPatchPayload, type RecipeEditDraft } from '@/utils/recipe-mapper';
import { ApiRequestError, apiFetch, assertApiOk } from '@/utils/api';
import { mapProtectedApiError } from '@/utils/protected-access';
import { useToggleFavorite, useShareRecipe, useCreateRecipeShareInvite } from '@/hooks/useCollections';
import { AddToCollectionModal } from '@/components/AddToCollectionModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

type NutritionInfo = { carbs?: string; fat?: string; protein?: string; fiber?: string };
type IngredientDisplayParts = { mainText: string; altText: string | null; descLine: string | null };

function splitIngredientDisplay(raw: string): IngredientDisplayParts {
  const nlIdx = raw.indexOf('\n');
  const mainLine = nlIdx === -1 ? raw : raw.slice(0, nlIdx);
  const descLine = nlIdx === -1 ? null : raw.slice(nlIdx + 1);
  const oderIdx = mainLine.indexOf(' (oder: ');
  return {
    mainText: oderIdx === -1 ? mainLine : mainLine.slice(0, oderIdx),
    altText: oderIdx === -1 ? null : mainLine.slice(oderIdx + 8, -1),
    descLine,
  };
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
    category: (r.category as string | null) ?? null,
    equipment: typeof r.equipment === 'string' ? r.equipment : (r.equipment ? JSON.stringify(r.equipment) : null),
    nutrition_info: typeof (r as any).nutrition_info === 'string'
      ? (r as any).nutrition_info
      : ((r as any).nutritionInfo ? JSON.stringify((r as any).nutritionInfo) : null),
    ingredient_groups: typeof (r as any).ingredient_groups === 'string'
      ? (r as any).ingredient_groups
      : ((r as any).ingredientGroups ? JSON.stringify((r as any).ingredientGroups) : null),
    transcript: null,
    tried: 0,
    pdf_created: 0,
    created_at: typeof r.created_at === 'number'
      ? r.created_at
      : (typeof r.created_at === 'string' && r.created_at
          ? Math.floor(new Date(r.created_at).getTime() / 1000)
          : null),
    scope: r.scope === 'household' ? 'household' : r.scope === 'private' ? 'private' : undefined,
    isFavorite: r.isFavorite === true,
  };
}

// Sharing capability flags — read from the raw API payload, kept outside the
// Recipe type (which models only the DB-shaped fields).
type ShareCapabilities = { canShareToHousehold: boolean; canCopyToPrivate: boolean };

function readShareCapabilities(r: Record<string, unknown>): ShareCapabilities {
  return {
    canShareToHousehold: r.canShareToHousehold === true,
    canCopyToPrivate: r.canCopyToPrivate === true,
  };
}

async function apiPatch(id: number, data: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`/api/v1/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertApiOk(res, `PATCH ${res.status}`);
}

async function patchRecipe(id: number, data: Record<string, unknown>): Promise<void> {
  await apiPatch(id, data);
}

async function deleteRecipeById(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/recipes/${id}`, { method: 'DELETE' });
  await assertApiOk(res, `DELETE ${res.status}`);
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-2">Rezept löschen</Text>
          <Text className="text-warm-500 dark:text-warm-400 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</Text>
          <View className="flex-row gap-3">
            <Pressable onPress={onCancel} className="flex-1 py-3 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
              <Text className="text-warm-700 dark:text-warm-200 font-medium">Abbrechen</Text>
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
      <SafeAreaView className="flex-1 bg-espresso-900">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-espresso-700">
          <Text className="text-white font-semibold text-base">Koch-Modus</Text>
          <Pressable onPress={onClose} className="bg-espresso-700 rounded-full p-2">
            <X size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Split screen */}
        <View className="flex-1 flex-row">
          {/* Left: Zutaten */}
          <View className="w-2/5 border-r border-espresso-700">
            <Text className="text-warm-500 dark:text-warm-400 text-xs font-semibold uppercase tracking-wider px-3 py-2">
              Zutaten
            </Text>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
              {ingredients.map((ing, i) => (
                <Pressable
                  key={i}
                  onPress={() => toggleCheck(i)}
                  className="flex-row items-start gap-2 py-2 border-b border-espresso-800"
                >
                  {checked.has(i)
                    ? <CheckSquare size={16} color="#C84B31" />
                    : <Square size={16} color="#9E8878" />}
                  <Text className={`text-sm flex-1 leading-5 ${checked.has(i) ? 'line-through text-warm-600 dark:text-warm-300' : 'text-warm-300'}`}>
                    {ing}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Right: Schritte */}
          <View className="flex-1 flex-col">
            {/* Progress */}
            <View className="h-1 bg-espresso-700 mx-4 mt-3 rounded-full">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${((current + 1) / steps.length) * 100}%` }}
              />
            </View>
            <Text className="text-warm-500 dark:text-warm-400 text-xs text-center mt-2">
              Schritt {current + 1} / {steps.length}
            </Text>

            <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="bg-primary-500 rounded-full w-12 h-12 items-center justify-center mb-4 self-start">
                <Text className="text-white text-xl font-bold">{current + 1}</Text>
              </View>
              <Text className="text-white text-base leading-7">{steps[current]}</Text>
            </ScrollView>

            {/* Navigation */}
            <View className="flex-row gap-2 px-4 pb-4">
              <Pressable
                onPress={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}
                className={`flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl ${current === 0 ? 'bg-espresso-800' : 'bg-espresso-700'}`}
              >
                <ChevronLeft size={18} color={current === 0 ? '#4b5563' : '#fff'} />
                <Text className={current === 0 ? 'text-warm-600 dark:text-warm-300' : 'text-white'}>Zurück</Text>
              </Pressable>
              {current < steps.length - 1 ? (
                <Pressable
                  onPress={() => setCurrent(c => c + 1)}
                  className="flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl bg-primary-500"
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
            <Star size={30} color="#D4A853" fill={filled ? '#f59e0b' : 'transparent'} strokeWidth={1.5} />
          </Pressable>
        );
      })}
      {onPress && value != null && (
        <Pressable onPress={() => onPress(value)} className="ml-1">
          <X size={14} color="#9E8878" />
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
  const [loadError, setLoadError] = useState<'not_found' | 'request_failed' | null>(null);
  const [loadFailure, setLoadFailure] = useState<unknown>(null);
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
  const [editDraft, setEditDraft] = useState<RecipeEditDraft | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [shareCaps, setShareCaps] = useState<ShareCapabilities>({ canShareToHousehold: false, canCopyToPrivate: false });
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{ recipeId: number; message: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const toggleFavorite = useToggleFavorite();
  const shareRecipeMutation = useShareRecipe();
  const createShareInviteMutation = useCreateRecipeShareInvite();

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recipeId = Number(id);

  // True when the device is offline (web only; native always false here).
  // Reactive: updates on online/offline events so reconnect clears the error screen.
  const [isOffline, setIsOffline] = useState(
    typeof window !== 'undefined' && typeof navigator !== 'undefined'
      ? !navigator.onLine
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline  = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadRecipe = useCallback(async () => {
    if (!id) {
      setRecipe(null);
      setLoadError('not_found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setLoadFailure(null);
    try {
      const res = await apiFetch(`/api/v1/recipes/${id}`);
      await assertApiOk(res, `Rezept konnte nicht geladen werden (${res.status})`);
      const raw = await res.json();
      const row = normalizeRecipe(raw);
      setRecipe(row);
      setShareCaps(readShareCapabilities(raw));
      setRating(row.rating != null ? Number(row.rating) : null);
      setNotes(row.notes ?? '');
      setImageError(false);
    } catch (error) {
      setRecipe(null);
      setLoadFailure(error);
      if (error instanceof ApiRequestError && error.status === 404) {
        setLoadError('not_found');
      } else {
        setLoadError('request_failed');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

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
    const groups = parseJSON<{ heading: string; items: string[] }[] | null>((recipe as any).ingredient_groups ?? null, null);
    setEditDraft({
      name: recipe.name,
      emoji: recipe.emoji ?? '🍽️',
      duration: recipe.duration ?? '',
      servings: recipe.servings ?? '',
      calories: String(recipe.calories ?? ''),
      tags: parseJSON<string[]>(recipe.tags, []).join(', '),
      ingredients: parseJSON<string[]>(recipe.ingredients, []),
      steps: parseJSON<string[]>(recipe.steps, []),
      ingredientGroups: groups && groups.length >= 2 ? groups : null,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!recipe || !editDraft) return;
    setIsSaving(true);
    try {
      const { patch, flatIngredients, ingredientGroups } = buildRecipeEditPatchPayload(editDraft);
      await patchRecipe(recipeId, patch);
      setRecipe({
        ...recipe,
        name: patch.name,
        emoji: patch.emoji,
        duration: patch.duration,
        servings: patch.servings,
        calories: patch.calories,
        tags: JSON.stringify(patch.tags),
        steps: JSON.stringify(patch.steps),
        ingredients: JSON.stringify(flatIngredients),
        ingredient_groups: ingredientGroups ? JSON.stringify(ingredientGroups) : null,
      } as Recipe);
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
    try {
      const { shareRecipePDF } = await import('@/utils/pdf-export');
      await shareRecipePDF(recipe);
    }
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

  // ── Favorit toggle ───────────────────────────────────────────────────────
  // Gotcha #1: the detail screen holds local state (not React Query), so the
  // hook's recipeQueryKey invalidation does NOT refresh this view. We update the
  // local recipe state from the mutation result ourselves.
  const handleToggleFavorite = async () => {
    if (!recipe || toggleFavorite.isPending) return;
    const next = !recipe.isFavorite;
    try {
      const isFavorite = await toggleFavorite.mutateAsync({ id: recipeId, on: next });
      setRecipe(r => (r ? { ...r, isFavorite } : r));
    } catch {
      // Leave local state untouched on failure; the heart stays in its prior state.
    }
  };

  // ── Share / copy ───────────────────────────────────────────────────────────
  const handleShareTo = async (target: 'household' | 'user') => {
    if (shareRecipeMutation.isPending) return;
    setShareError(null);
    setShareFeedback(null);
    try {
      const copy = await shareRecipeMutation.mutateAsync({ id: recipeId, target });
      setShareFeedback({
        recipeId: copy.id,
        message: target === 'household' ? 'Kopie im Haushalt erstellt.' : 'Private Kopie erstellt.',
      });
    } catch (error) {
      setShareError(
        error instanceof ApiRequestError ? error.message : 'Kopieren fehlgeschlagen. Bitte erneut versuchen.',
      );
    }
  };

  const handleCreateShareInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || createShareInviteMutation.isPending) return;
    setInviteError(null);
    setInviteFeedback(null);
    try {
      const invite = await createShareInviteMutation.mutateAsync({ id: recipeId, email });
      const url = Linking.createURL(`/share-invite/${invite.token}`);
      await Share.share({
        title: recipe?.name ?? 'Rezept',
        message: url,
      });
      setInviteEmail('');
      setInviteFeedback('Einladung erstellt. Beim Annehmen entsteht eine private Kopie.');
    } catch (error) {
      setInviteError(
        error instanceof ApiRequestError ? error.message : 'Einladung konnte nicht erstellt werden.',
      );
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
        {/* Header-Shell — sofort sichtbar, LCP-Anker */}
        <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            className="mr-3 p-1"
          >
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <View className="flex-1 h-4 rounded-full bg-warm-200 dark:bg-espresso-700" />
          <ActivityIndicator size="small" color="#C84B31" style={{ marginLeft: 8 }} />
        </View>
        {/* Skeleton-Inhalt */}
        <View className="px-4 pt-5" testID="recipe-skeleton">
          {/* Titel-Placeholder */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-warm-200 dark:bg-espresso-700 mb-3" />
            <View className="h-5 rounded-full bg-warm-200 dark:bg-espresso-700 w-3/4 mb-2" />
            <View className="h-4 rounded-full bg-warm-200 dark:bg-espresso-700 w-1/2" />
          </View>
          {/* Meta-Zeile */}
          <View className="flex-row gap-3 mb-5">
            {[1, 2, 3].map(i => (
              <View key={i} className="flex-1 h-8 rounded-xl bg-warm-200 dark:bg-espresso-700" />
            ))}
          </View>
          {/* Zutaten-Placeholder */}
          <View className="h-4 rounded-full bg-warm-200 dark:bg-espresso-700 w-1/3 mb-3" />
          {[80, 65, 72, 58, 68].map((width, i) => (
            <View key={i} className="h-3 rounded-full bg-warm-200 dark:bg-espresso-700 mb-2" style={{ width: `${width}%` }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    if (loadError === 'request_failed') {
      const protectedState = mapProtectedApiError(loadFailure, `/recipe/${id}`);
      // Offline + cache-miss: the SW could not serve the recipe from cache.
      if (isOffline && !protectedState) {
        return (
          <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800 items-center justify-center px-8" testID="offline-cache-miss">
            <WifiOff size={36} color="#9E8878" />
            <Text className="text-warm-900 dark:text-warm-50 font-semibold text-center mt-4">
              Rezept ist offline nicht verfügbar
            </Text>
            <Text className="text-warm-500 dark:text-warm-400 text-center mt-2 text-sm">
              Dieses Rezept wurde noch nicht im Cache gespeichert. Bitte stelle eine Verbindung her.
            </Text>
            <Pressable onPress={loadRecipe} className="mt-6 px-4 py-2 bg-primary-500 rounded-xl">
              <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} className="mt-3">
              <Text className="text-primary-500">Zurück zur Liste</Text>
            </Pressable>
          </SafeAreaView>
        );
      }
      return (
        <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800 items-center justify-center px-8">
          {protectedState ? (
            <ProtectedAccessNotice state={protectedState} onRetry={() => void loadRecipe()} />
          ) : (
            <>
              <Text className="text-red-500 text-center">Rezept konnte nicht geladen werden.</Text>
              <Text className="text-warm-500 dark:text-warm-400 text-center mt-2">
                Bitte Verbindung prüfen und erneut versuchen.
              </Text>
              <Pressable onPress={loadRecipe} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
                <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
              </Pressable>
            </>
          )}
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800 items-center justify-center px-8">
        <Text className="text-warm-500 dark:text-warm-400 text-center">Rezept nicht gefunden.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-500">Zurück</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ingredients = parseJSON<string[]>(recipe.ingredients, []);
  const steps = parseJSON<string[]>(recipe.steps, []);
  const tags = parseJSON<string[]>(recipe.tags, []);
  const equipment = parseJSON<string[]>(recipe.equipment ?? null, []);
  const nutritionInfo = parseJSON<NutritionInfo | null>((recipe as any).nutrition_info ?? null, null);
  const ingredientGroups = parseJSON<{ heading: string; items: string[] }[] | null>((recipe as any).ingredient_groups ?? null, null);
  const scaledIngredients = multiplier !== 1 ? ingredients.map(i => scaleIngredient(i, multiplier)) : ingredients;
  const scaledIngredientDisplay = scaledIngredients.map(splitIngredientDisplay);
  let ingredientOffset = 0;
  const ingredientGroupStartIndices = ingredientGroups?.map((group) => {
    const start = ingredientOffset;
    ingredientOffset += group.items.length;
    return start;
  }) ?? [];
  const scaledServings = Math.round(parseServingsNumber(recipe.servings) * multiplier);
  const qrData = showQrModal
    ? encodeRecipeToCompactJSON({
      name: recipe.name,
      emoji: recipe.emoji ?? '',
      ingredients,
      steps,
      tags,
      rating: recipe.rating ?? undefined,
      servings: recipe.servings ?? undefined,
      duration: recipe.duration ?? undefined,
    })
    : null;

  return (
    <>
      {cookMode && (
        <CookModal steps={steps} ingredients={scaledIngredients} onClose={() => setCookMode(false)} />
      )}
      {showDeleteModal && (
        <DeleteModal onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} />
      )}

      <AddToCollectionModal
        visible={showCollectionModal}
        recipeId={recipeId}
        recipeScope={recipe.scope}
        onClose={() => setShowCollectionModal(false)}
      />

      <Modal visible={showImagePicker} animationType="slide" onRequestClose={() => setShowImagePicker(false)}>
        <ImagePickerModal
          images={[]}
          initialQuery={recipe.name}
          imageCount={8}
          onSelect={async (url) => {
            setShowImagePicker(false);
            try {
              await patchRecipe(recipeId, { imageUrl: url });
              setRecipe(r => r ? { ...r, image_url: url } : r);
            } catch { /* ignore */ }
          }}
          onSkip={() => setShowImagePicker(false)}
        />
      </Modal>

      {/* QR-Teilen-Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center px-8">
          <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full items-center">
            <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-1">{recipe.emoji ?? '🍽️'} {recipe.name}</Text>
            <Text className="text-xs text-warm-500 dark:text-warm-400 mb-5 text-center">QR-Code scannen um das Rezept{'\n'}in RecipeDeck zu importieren</Text>
            {qrData ? (
              <QRCodeSVG value={qrData} size={200} color="#111827" backgroundColor="#ffffff" />
            ) : (
              <Text className="text-warm-500 dark:text-warm-400 text-sm">Rezept zu groß für QR-Code</Text>
            )}
            <View className="flex-row gap-3 mt-6 w-full">
              <Pressable onPress={handleShareText} className="flex-1 py-3 rounded-xl bg-primary-500 items-center">
                <Text className="text-white text-sm font-semibold">Teilen</Text>
              </Pressable>
              <Pressable onPress={() => setShowQrModal(false)} className="flex-1 py-3 rounded-xl bg-warm-100 dark:bg-espresso-800 items-center">
                <Text className="text-warm-700 dark:text-warm-200 text-sm font-medium">Schließen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <Text className="text-base font-semibold text-warm-900 dark:text-warm-50 flex-1" numberOfLines={1}>
            {recipe.name}
          </Text>
          {!isEditing && (
            <Pressable
              onPress={handleToggleFavorite}
              disabled={toggleFavorite.isPending}
              accessibilityRole="button"
              accessibilityLabel={recipe.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
              accessibilityState={{ selected: !!recipe.isFavorite }}
              testID="favorite-toggle"
              className="p-1 ml-2"
            >
              <Heart
                size={20}
                color="#C84B31"
                fill={recipe.isFavorite ? '#C84B31' : 'transparent'}
              />
            </Pressable>
          )}
          {!isEditing && (
            <Pressable onPress={startEdit} className="p-1 ml-2">
              <Edit size={20} color="#C84B31" />
            </Pressable>
          )}
        </View>

        {/* Offline cache-hit indicator — shown when recipe is served from SW cache */}
        <OfflineBanner offlineMessage="Offline — Rezept aus Cache" />

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Hero-Bild ── */}
          {((recipe.image_url && !imageError) || isEditing) ? (
            <View className="relative">
              {recipe.image_url && !imageError ? (
                <Image
                  source={{ uri: recipe.image_url }}
                  className="w-full h-52"
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <View className="w-full h-52 bg-warm-100 dark:bg-espresso-800 items-center justify-center">
                  <UtensilsCrossed size={40} color="#9E8878" />
                </View>
              )}
              <Pressable
                onPress={() => setShowImagePicker(true)}
                className="absolute bottom-2 right-2 bg-black/50 rounded-full px-3 py-1.5 flex-row items-center gap-1"
              >
                <Pencil size={12} color="#fff" />
                <Text className="text-white text-xs">{recipe.image_url ? 'Bild ändern' : 'Bild hinzufügen'}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Hero ── */}
          <View className="bg-white dark:bg-espresso-800 px-4 pt-5 pb-4 items-center">
            {isEditing && editDraft ? (
              <View className="w-full gap-3">
                <View className="flex-row gap-2">
                  <TextInput
                    value={editDraft.emoji}
                    onChangeText={v => setEditDraft(d => d && { ...d, emoji: v })}
                    className="border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-2xl text-center w-16"
                    maxLength={2}
                  />
                  <TextInput
                    value={editDraft.name}
                    onChangeText={v => setEditDraft(d => d && { ...d, name: v })}
                    className="flex-1 border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-base font-semibold text-warm-900 dark:text-warm-50"
                    placeholder="Rezeptname"
                  />
                </View>
                <TextInput
                  value={editDraft.tags}
                  onChangeText={v => setEditDraft(d => d && { ...d, tags: v })}
                  className="border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-700 dark:text-warm-200"
                  placeholder="Tags, kommagetrennt"
                />
              </View>
            ) : (
              <>
                {(!recipe.image_url || imageError) && (
                  <Text className="text-6xl mb-3">{recipe.emoji ?? '🍽️'}</Text>
                )}
                <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 text-center">{recipe.name}</Text>

                {/* Scope-Hinweis (Privat / Haushalt) */}
                {recipe.scope && (
                  <View
                    testID="scope-badge"
                    className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-warm-100 dark:bg-espresso-700"
                  >
                    {recipe.scope === 'household'
                      ? <Home size={12} color="#9E8878" />
                      : <Lock size={12} color="#9E8878" />}
                    <Text className="text-xs text-warm-600 dark:text-warm-300">
                      {recipe.scope === 'household' ? 'Haushalt' : 'Privat'}
                    </Text>
                  </View>
                )}

                {/* Rating Display */}
                {rating != null && (
                  <View className="mt-2">
                    <StarRow value={rating} />
                  </View>
                )}

                {tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 justify-center mt-3">
                    {tags.map(tag => (
                      <View key={tag} className="bg-primary-50 dark:bg-espresso-700 rounded-full px-3 py-1">
                        <Text className="text-xs text-primary-500">{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Meta ── */}
          <View className="flex-row gap-3 px-4 py-4">
            <View className="flex-1 bg-white dark:bg-espresso-800 rounded-2xl p-3 border border-warm-200 dark:border-warm-700 items-center">
              <Clock size={16} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400 mt-1">Dauer</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.duration}
                  onChangeText={v => setEditDraft(d => d && { ...d, duration: v })}
                  className="text-sm font-bold text-warm-900 dark:text-warm-50 text-center mt-1 border-b border-warm-200 dark:border-warm-700 w-full"
                  placeholder="30 min"
                />
              ) : (
                <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-1">{recipe.duration ?? '—'}</Text>
              )}
            </View>

            <View className="flex-1 bg-white dark:bg-espresso-800 rounded-2xl p-3 border border-warm-200 dark:border-warm-700 items-center">
              <Users size={16} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400 mt-1">Portionen</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.servings}
                  onChangeText={v => setEditDraft(d => d && { ...d, servings: v })}
                  className="text-sm font-bold text-warm-900 dark:text-warm-50 text-center mt-1 border-b border-warm-200 dark:border-warm-700 w-full"
                  placeholder="4"
                />
              ) : (
                <>
                  <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-1">{scaledServings}</Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <Pressable
                      onPress={() => setMultiplier(m => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                      disabled={multiplier <= 0.5}
                      className={`w-7 h-7 rounded-full items-center justify-center ${multiplier <= 0.5 ? 'bg-warm-100 dark:bg-espresso-800' : 'bg-primary-500'}`}
                    >
                      <Minus size={14} color={multiplier <= 0.5 ? '#9E8878' : '#fff'} />
                    </Pressable>
                    <Pressable
                      onPress={() => setMultiplier(m => Math.min(4, Math.round((m + 0.5) * 10) / 10))}
                      disabled={multiplier >= 4}
                      className={`w-7 h-7 rounded-full items-center justify-center ${multiplier >= 4 ? 'bg-warm-100 dark:bg-espresso-800' : 'bg-primary-500'}`}
                    >
                      <Plus size={14} color={multiplier >= 4 ? '#9E8878' : '#fff'} />
                    </Pressable>
                  </View>
                  {multiplier !== 1 && (
                    <Pressable onPress={() => setMultiplier(1)} className="flex-row items-center gap-1 mt-1">
                      <RotateCcw size={10} color="#C84B31" />
                      <Text className="text-xs text-primary-500">×{multiplier}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            <View className="flex-1 bg-white dark:bg-espresso-800 rounded-2xl p-3 border border-warm-200 dark:border-warm-700 items-center">
              <Flame size={16} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400 mt-1">kcal</Text>
              {isEditing && editDraft ? (
                <TextInput
                  value={editDraft.calories}
                  onChangeText={v => setEditDraft(d => d && { ...d, calories: v })}
                  className="text-sm font-bold text-warm-900 dark:text-warm-50 text-center mt-1 border-b border-warm-200 dark:border-warm-700 w-full"
                  keyboardType="numeric"
                />
              ) : (
                <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-1">{recipe.calories ?? '—'}</Text>
              )}
            </View>
          </View>

          {/* ── Actions ── */}
          {isEditing ? (
            <View className="flex-row gap-3 px-4 mb-4">
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${isSaving ? 'bg-primary-300' : 'bg-primary-500'}`}
              >
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" />}
                <Text className="text-white font-semibold">Speichern</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowImagePicker(true)}
                className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl border border-warm-200 dark:border-warm-700 bg-white dark:bg-espresso-800"
              >
                <Pencil size={18} color="#9E8878" />
                <Text className="text-warm-600 dark:text-warm-300">Bild</Text>
              </Pressable>
              <Pressable
                onPress={() => { setIsEditing(false); setEditDraft(null); }}
                className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl border border-warm-200 dark:border-warm-700 bg-white dark:bg-espresso-800"
              >
                <X size={18} color="#9E8878" />
                <Text className="text-warm-600 dark:text-warm-300">Abbrechen</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-2 px-4 mb-4">
              <Pressable onPress={() => setCookMode(true)} className="flex-1 items-center py-3 rounded-xl bg-espresso-900">
                <UtensilsCrossed size={18} color="#fff" />
                <Text className="text-white text-xs font-medium mt-1">Kochen</Text>
              </Pressable>
              <Pressable onPress={handleAddToShopping} className="flex-1 items-center py-3 rounded-xl bg-primary-50 dark:bg-espresso-700 border border-primary-200">
                <ShoppingCart size={18} color="#C84B31" />
                <Text className="text-primary-500 text-xs font-medium mt-1">Einkauf</Text>
              </Pressable>
              <Pressable onPress={() => setShowQrModal(true)} className="flex-1 items-center py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700">
                <QrCode size={18} color="#9E8878" />
                <Text className="text-warm-600 dark:text-warm-300 text-xs font-medium mt-1">Teilen</Text>
              </Pressable>
              <Pressable onPress={handlePDF} className="flex-1 items-center py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700">
                <Download size={18} color="#9E8878" />
                <Text className="text-warm-600 dark:text-warm-300 text-xs font-medium mt-1">PDF</Text>
              </Pressable>
              <Pressable onPress={() => setShowDeleteModal(true)} className="flex-1 items-center py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700">
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-red-500 text-xs font-medium mt-1">Löschen</Text>
              </Pressable>
            </View>
          )}

          {/* ── Collections & Teilen ── */}
          {!isEditing && (
            <View className="px-4 mb-4 gap-2">
              <Pressable
                onPress={() => setShowCollectionModal(true)}
                testID="add-to-collection-cta"
                className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700"
              >
                <FolderPlus size={18} color="#C84B31" />
                <Text className="text-primary-500 text-sm font-medium">Zu Collection hinzufügen</Text>
              </Pressable>

              <View className="rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700 px-3 py-3 gap-2">
                <View className="flex-row items-center gap-2">
                  <Mail size={18} color="#C84B31" />
                  <Text className="text-sm font-medium text-warm-900 dark:text-warm-50">An Person schicken</Text>
                </View>
                <View className="flex-row gap-2">
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="email@example.com"
                    placeholderTextColor="#9E8878"
                    testID="recipe-share-invite-email"
                    className="flex-1 border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50"
                  />
                  <Pressable
                    onPress={handleCreateShareInvite}
                    disabled={!inviteEmail.trim() || createShareInviteMutation.isPending}
                    testID="recipe-share-invite-send"
                    className={`w-12 items-center justify-center rounded-xl ${inviteEmail.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
                  >
                    {createShareInviteMutation.isPending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Send size={17} color={inviteEmail.trim() ? '#fff' : '#9E8878'} />}
                  </Pressable>
                </View>
                {inviteError && (
                  <Text className="text-xs text-red-600" testID="recipe-share-invite-error">{inviteError}</Text>
                )}
                {inviteFeedback && (
                  <Text className="text-xs text-green-700" testID="recipe-share-invite-feedback">{inviteFeedback}</Text>
                )}
              </View>

              {shareCaps.canShareToHousehold && (
                <Pressable
                  onPress={() => handleShareTo('household')}
                  disabled={shareRecipeMutation.isPending}
                  testID="copy-to-household-cta"
                  className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700"
                >
                  {shareRecipeMutation.isPending
                    ? <ActivityIndicator size="small" color="#C84B31" />
                    : <Home size={18} color="#C84B31" />}
                  <Text className="text-primary-500 text-sm font-medium">In Haushalt kopieren</Text>
                </Pressable>
              )}

              {shareCaps.canCopyToPrivate && (
                <Pressable
                  onPress={() => handleShareTo('user')}
                  disabled={shareRecipeMutation.isPending}
                  testID="copy-to-private-cta"
                  className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700"
                >
                  {shareRecipeMutation.isPending
                    ? <ActivityIndicator size="small" color="#C84B31" />
                    : <Copy size={18} color="#C84B31" />}
                  <Text className="text-primary-500 text-sm font-medium">Private Kopie erstellen</Text>
                </Pressable>
              )}

              {shareError && (
                <View className="rounded-xl bg-red-50 px-3 py-2">
                  <Text className="text-red-600 text-sm" testID="share-error">{shareError}</Text>
                </View>
              )}

              {shareFeedback && (
                <View className="rounded-xl bg-green-50 px-3 py-2.5 flex-row items-center justify-between" testID="share-feedback">
                  <Text className="text-green-700 text-sm flex-1">{shareFeedback.message}</Text>
                  <Pressable
                    onPress={() => { const target = shareFeedback.recipeId; setShareFeedback(null); router.push(`/recipe/${target}`); }}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-green-600"
                  >
                    <Text className="text-white text-xs font-semibold">Öffnen</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* ── Zutaten ── */}
          <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <Text className="text-base font-bold text-warm-900 dark:text-warm-50">Zutaten</Text>
              {!isEditing && multiplier !== 1 && (
                <Pressable onPress={() => setMultiplier(1)} className="flex-row items-center gap-1">
                  <RotateCcw size={12} color="#C84B31" />
                  <Text className="text-xs text-primary-500">Zurücksetzen</Text>
                </Pressable>
              )}
            </View>

            {isEditing && editDraft ? (
              <View className="px-4 pb-4">
                {editDraft.ingredientGroups ? (
                  /* Grouped edit mode */
                  <>
                    {editDraft.ingredientGroups.map((group, gi) => (
                      <View key={gi} className="mb-4">
                        <View className="flex-row items-center gap-2 mb-2">
                          <TextInput
                            value={group.heading}
                            onChangeText={v => setEditDraft(d => {
                              if (!d || !d.ingredientGroups) return d;
                              const g = [...d.ingredientGroups];
                              g[gi] = { ...g[gi], heading: v };
                              return { ...d, ingredientGroups: g };
                            })}
                            className="flex-1 border border-warm-300 dark:border-warm-600 rounded-lg px-3 py-2 text-sm font-semibold text-warm-700 dark:text-warm-200 bg-warm-50 dark:bg-espresso-900"
                            placeholder="Gruppenname"
                          />
                          <Pressable onPress={() => setEditDraft(d => {
                            if (!d || !d.ingredientGroups) return d;
                            const g = d.ingredientGroups.filter((_, j) => j !== gi);
                            return { ...d, ingredientGroups: g.length >= 2 ? g : null, ingredients: g.flatMap(x => x.items) };
                          })}>
                            <X size={16} color="#ef4444" />
                          </Pressable>
                        </View>
                        {group.items.map((item, ii) => (
                          <View key={ii} className="flex-row items-center gap-2 mb-2 pl-2">
                            <TextInput
                              value={item}
                              onChangeText={v => setEditDraft(d => {
                                if (!d || !d.ingredientGroups) return d;
                                const g = [...d.ingredientGroups];
                                const items = [...g[gi].items]; items[ii] = v;
                                g[gi] = { ...g[gi], items };
                                return { ...d, ingredientGroups: g };
                              })}
                              className="flex-1 border border-warm-200 dark:border-warm-700 rounded-lg px-3 py-2 text-sm text-warm-700 dark:text-warm-200"
                            />
                            <Pressable onPress={() => setEditDraft(d => {
                              if (!d || !d.ingredientGroups) return d;
                              const g = [...d.ingredientGroups];
                              g[gi] = { ...g[gi], items: g[gi].items.filter((_, j) => j !== ii) };
                              return { ...d, ingredientGroups: g };
                            })}>
                              <X size={16} color="#ef4444" />
                            </Pressable>
                          </View>
                        ))}
                        <Pressable onPress={() => setEditDraft(d => {
                          if (!d || !d.ingredientGroups) return d;
                          const g = [...d.ingredientGroups];
                          g[gi] = { ...g[gi], items: [...g[gi].items, ''] };
                          return { ...d, ingredientGroups: g };
                        })} className="flex-row items-center gap-1 pl-2 mt-1">
                          <Plus size={12} color="#C84B31" />
                          <Text className="text-primary-500 text-xs">Zutat hinzufügen</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => setEditDraft(d => {
                      if (!d) return d;
                      const g = [...(d.ingredientGroups ?? []), { heading: 'Neue Gruppe', items: [''] }];
                      return { ...d, ingredientGroups: g };
                    })} className="flex-row items-center gap-1 mt-1 mb-2">
                      <Plus size={14} color="#C84B31" />
                      <Text className="text-primary-500 text-sm">Gruppe hinzufügen</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditDraft(d => {
                      if (!d || !d.ingredientGroups) return d;
                      return { ...d, ingredientGroups: null, ingredients: d.ingredientGroups.flatMap(g => g.items) };
                    })} className="flex-row items-center gap-1">
                      <Text className="text-warm-400 text-xs">Gruppen aufheben</Text>
                    </Pressable>
                  </>
                ) : (
                  /* Flat edit mode */
                  <>
                    {editDraft.ingredients.map((ing, i) => (
                      <View key={i} className="flex-row items-center gap-2 mb-2">
                        <TextInput
                          value={ing}
                          onChangeText={v => setEditDraft(d => {
                            if (!d) return d;
                            const a = [...d.ingredients]; a[i] = v;
                            return { ...d, ingredients: a };
                          })}
                          className="flex-1 border border-warm-200 dark:border-warm-700 rounded-lg px-3 py-2 text-sm text-warm-700 dark:text-warm-200"
                        />
                        <Pressable onPress={() => setEditDraft(d => d && { ...d, ingredients: d.ingredients.filter((_, j) => j !== i) })}>
                          <X size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => setEditDraft(d => d && { ...d, ingredients: [...d.ingredients, ''] })} className="flex-row items-center gap-1 mt-1">
                      <Plus size={14} color="#C84B31" />
                      <Text className="text-primary-500 text-sm">Zutat hinzufügen</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : ingredientGroups && ingredientGroups.length >= 2 ? (
              /* Grouped display */
              <View className="px-4 pb-4">
                {ingredientGroups.map((group, gi) => (
                  <View key={gi} className="mb-3">
                    <Text className="text-xs font-semibold text-warm-400 dark:text-warm-500 uppercase tracking-wider mb-2">{group.heading}</Text>
                    {group.items.map((ing, i) => {
                      const globalIdx = (ingredientGroupStartIndices[gi] ?? 0) + i;
                      const display = scaledIngredientDisplay[globalIdx] ?? splitIngredientDisplay(ing);
                      return (
                        <View key={i} className="flex-row items-center py-1.5 border-b border-warm-50 dark:border-espresso-700">
                          <Text className="text-primary-400 mr-2 text-base">•</Text>
                          <View className="flex-1">
                            <Text className="text-warm-700 dark:text-warm-200 text-sm">{display.mainText}</Text>
                            {display.altText && <Text className="text-warm-500 dark:text-warm-400 text-xs mt-0.5">↺ {display.altText}</Text>}
                            {display.descLine && <Text className="text-warm-500 dark:text-warm-400 text-xs mt-0.5">{display.descLine}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : (
              /* Flat display */
              <View className="px-4 pb-4">
                {ingredients.map((ing, i) => {
                  const hasNum = parseIngredientNumber(ing) != null;
                  const isEditingThis = editingIngredientIdx === i;
                  const display = scaledIngredientDisplay[i];
                  return (
                    <View key={i} className="flex-row items-center py-2 border-b border-warm-100">
                      <Text className="text-primary-400 mr-2 text-base">•</Text>
                      {isEditingThis ? (
                        <>
                          <TextInput
                            value={editingIngredientValue}
                            onChangeText={setEditingIngredientValue}
                            onBlur={() => confirmIngredientEdit(i, ingredients)}
                            onSubmitEditing={() => confirmIngredientEdit(i, ingredients)}
                            keyboardType="numeric"
                            autoFocus
                            className="w-20 border border-primary-400 rounded-lg px-2 py-1 text-sm text-warm-900 dark:text-warm-50 mr-2"
                          />
                          <Text className="text-warm-500 dark:text-warm-400 text-sm flex-1">
                            {ing.replace(/^[\d.,]+\s*/, '')}
                          </Text>
                          <Pressable onPress={() => { setEditingIngredientIdx(null); setEditingIngredientValue(''); }}>
                            <X size={14} color="#9E8878" />
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <View className="flex-1">
                            <Text className="text-warm-700 dark:text-warm-200 text-sm">{display?.mainText ?? ing}</Text>
                            {display?.altText && <Text className="text-warm-500 dark:text-warm-400 text-xs mt-0.5">↺ {display.altText}</Text>}
                            {display?.descLine && <Text className="text-warm-500 dark:text-warm-400 text-xs mt-0.5">{display.descLine}</Text>}
                          </View>
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
          <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700">
            <Text className="text-base font-bold text-warm-900 dark:text-warm-50 px-4 pt-4 pb-2">Zubereitung</Text>
            {isEditing && editDraft ? (
              <View className="px-4 pb-4">
                {editDraft.steps.map((step, i) => (
                  <View key={i} className="flex-row items-start gap-2 mb-2">
                    <View className="bg-primary-500 rounded-full w-6 h-6 items-center justify-center shrink-0 mt-2">
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
                      className="flex-1 border border-warm-200 dark:border-warm-700 rounded-lg px-3 py-2 text-sm text-warm-700 dark:text-warm-200"
                    />
                    <Pressable onPress={() => setEditDraft(d => d && { ...d, steps: d.steps.filter((_, j) => j !== i) })} className="mt-2">
                      <X size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => setEditDraft(d => d && { ...d, steps: [...d.steps, ''] })} className="flex-row items-center gap-1 mt-1">
                  <Plus size={14} color="#C84B31" />
                  <Text className="text-primary-500 text-sm">Schritt hinzufügen</Text>
                </Pressable>
              </View>
            ) : (
              <View className="px-4 pb-4">
                {steps.map((step, i) => (
                  <View key={i} className="flex-row items-start mb-4">
                    <View className="bg-primary-500 rounded-full w-7 h-7 items-center justify-center mr-3 mt-0.5 shrink-0">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <StepText>{step}</StepText>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Geräte & Zubehör (nur wenn vorhanden) ── */}
          {equipment.length > 0 && (
            <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
              <Text className="text-base font-bold text-warm-900 dark:text-warm-50 mb-3">Geräte & Zubehör</Text>
              <View className="flex-row flex-wrap gap-2">
                {equipment.map((item, i) => (
                  <View key={i} className="bg-primary-50 dark:bg-espresso-700 border border-primary-200 rounded-xl px-3 py-1.5">
                    <Text className="text-primary-700 text-sm">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Nährwerte (nur wenn vorhanden) ── */}
          {nutritionInfo && (
            <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
              <Text className="text-base font-bold text-warm-900 dark:text-warm-50 mb-3">Nährwerte pro Portion</Text>
              <View className="flex-row gap-3">
                {nutritionInfo.carbs && (
                  <View className="flex-1 items-center bg-orange-50 rounded-xl py-2 px-1">
                    <Text className="text-xs text-warm-500 dark:text-warm-400">Kohlenhydrate</Text>
                    <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-0.5">{nutritionInfo.carbs}</Text>
                  </View>
                )}
                {nutritionInfo.fat && (
                  <View className="flex-1 items-center bg-yellow-50 rounded-xl py-2 px-1">
                    <Text className="text-xs text-warm-500 dark:text-warm-400">Fett</Text>
                    <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-0.5">{nutritionInfo.fat}</Text>
                  </View>
                )}
                {nutritionInfo.protein && (
                  <View className="flex-1 items-center bg-blue-50 rounded-xl py-2 px-1">
                    <Text className="text-xs text-warm-500 dark:text-warm-400">Eiweiß</Text>
                    <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-0.5">{nutritionInfo.protein}</Text>
                  </View>
                )}
                {nutritionInfo.fiber && (
                  <View className="flex-1 items-center bg-green-50 rounded-xl py-2 px-1">
                    <Text className="text-xs text-warm-500 dark:text-warm-400">Ballaststoffe</Text>
                    <Text className="text-sm font-bold text-warm-900 dark:text-warm-50 mt-0.5">{nutritionInfo.fiber}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Bewertung ── */}
          <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
            <Text className="text-base font-bold text-warm-900 dark:text-warm-50 mb-3">Meine Bewertung</Text>
            <StarRow value={rating} onPress={handleRating} />
          </View>

          {/* ── Notizen ── */}
          <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
            <Text className="text-base font-bold text-warm-900 dark:text-warm-50 mb-2">Notizen</Text>
            <TextInput
              value={notes}
              onChangeText={handleNotesChange}
              placeholder="Eigene Anmerkungen, Tipps…"
              placeholderTextColor="#9E8878"
              multiline
              numberOfLines={3}
              className="text-sm text-warm-700 dark:text-warm-200 bg-warm-50 dark:bg-espresso-900 rounded-xl px-3 py-3 min-h-20"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* ── Quelle ── */}
          {recipe.source_url ? (
            <View className="mx-4 mb-4 bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
              <Text className="text-base font-bold text-warm-900 dark:text-warm-50 mb-2">Quelle</Text>
              {recipe.created_at ? (
                <Text className="text-xs text-warm-500 dark:text-warm-400 mb-2">
                  Extrahiert am {new Date(recipe.created_at * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
              ) : null}
              <Pressable
                onPress={() => recipe.source_url && Linking.openURL(recipe.source_url)}
                className="flex-row items-center gap-2 bg-warm-50 dark:bg-espresso-900 rounded-xl p-3"
              >
                <ExternalLink size={16} color="#C84B31" />
                <Text className="text-primary-500 text-sm flex-1" numberOfLines={1}>{recipe.source_url}</Text>
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
