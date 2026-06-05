import React, { useState, useEffect, useCallback, useDeferredValue, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar, X, Search, BookOpen, QrCode, ShoppingCart } from 'lucide-react-native';
import { router } from 'expo-router';
import ScannerCamera from '@/components/ScannerCamera';
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '@/utils/recipe-qr';

import type { Recipe, MealPlanEntry } from '@/db/schema';
import { addIngredients } from '@/utils/shopping-service';
import { apiFetch, assertApiOk } from '@/utils/api';
import { getServerUrl } from '@/utils/server-url';
import {
  buildRecipeIdMap,
  filterPickerRecipes,
  groupEntriesByDay,
  pickRecipesByIds,
} from '@/utils/planner-screen-data';

// ─── Server API helpers ───────────────────────────────────────────────────────

async function loadAllRecipes(): Promise<Recipe[]> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes`);
  if (!res.ok) return [];
  const data: Array<Record<string, unknown>> = await res.json();
  return data.map(r => ({
      id: Number(r.id),
      name: String(r.name),
      emoji: (r.emoji as string | null) ?? null,
      source_url: (r.source_url as string | null) ?? null,
      image_url: (r.image_url as string | null) ?? null,
      ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients ?? []),
      steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps ?? []),
      tags: typeof r.tags === 'string' ? r.tags : (r.tags ? JSON.stringify(r.tags) : null),
      category: (r.category as string | null) ?? null,
      servings: (r.servings as string | null) ?? null,
      duration: (r.duration as string | null) ?? null,
      calories: r.calories != null ? Number(r.calories) : null,
      rating: r.rating != null ? Number(r.rating) : null,
      notes: (r.notes as string | null) ?? null,
      equipment: null,
      nutrition_info: null,
      ingredient_groups: null,
      transcript: null,
      tried: 0,
      pdf_created: 0,
      created_at: null,
    }));
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust: 0=Sunday → -6
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(monday: Date, dayIndex: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function isToday(monday: Date, dayIndex: number): boolean {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ─── Recipe Picker Modal ─────────────────────────────────────────────────────

function RecipePickerModal({
  visible,
  dayIndex,
  dayName,
  onClose,
  onSelect,
}: {
  visible: boolean;
  dayIndex: number;
  dayName: string;
  onClose: () => void;
  onSelect: (recipeId: number) => void;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await loadAllRecipes();
      setRecipes(rows);
    } catch (error) {
      setRecipes([]);
      setLoadError(errorMessage(error, 'Rezepte konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadRecipes();
  }, [visible, loadRecipes]);

  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(
    () => filterPickerRecipes(recipes, deferredSearch),
    [recipes, deferredSearch],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-warm-200 dark:border-warm-700">
          <View className="flex-1">
            <Text className="text-lg font-bold text-warm-900 dark:text-warm-50">Rezept hinzufügen</Text>
            <Text className="text-sm text-warm-500 dark:text-warm-400">{dayName}</Text>
          </View>
          <Pressable onPress={onClose} className="p-2">
            <X size={22} color="#9E8878" />
          </Pressable>
        </View>

        {/* Suche */}
        <View className="px-4 py-3">
          <View className="flex-row items-center bg-warm-50 dark:bg-espresso-900 rounded-xl px-3 py-2">
            <Search size={16} color="#9E8878" />
            <TextInput
              className="flex-1 ml-2 text-base text-warm-900 dark:text-warm-50"
              placeholder="Rezept suchen…"
              placeholderTextColor="#9E8878"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator className="mt-8" color="#C84B31" />
        ) : loadError ? (
          <View className="mx-4 mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3">
            <Text className="text-sm text-red-700">{loadError}</Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable onPress={() => void loadRecipes()} className="rounded-lg bg-red-600 px-3 py-1.5">
                <Text className="text-xs font-medium text-white">Erneut versuchen</Text>
              </Pressable>
              <Pressable onPress={onClose} className="rounded-lg bg-red-100 px-3 py-1.5">
                <Text className="text-xs font-medium text-red-700">Schließen</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item.id); onClose(); }}
                className="flex-row items-center py-3 border-b border-warm-100"
              >
                <Text className="text-2xl mr-3">{item.emoji ?? '🍽️'}</Text>
                <Text className="flex-1 text-warm-800 dark:text-warm-100 font-medium" numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className="text-center text-warm-500 dark:text-warm-400 py-12">Keine Rezepte gefunden.</Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Add Method Modal (Rezept auswählen | QR scannen) ────────────────────────

function AddMethodModal({
  visible,
  dayName,
  onClose,
  onPickRecipe,
  onScanQR,
}: {
  visible: boolean;
  dayName: string;
  onClose: () => void;
  onPickRecipe: () => void;
  onScanQR: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
        <View className="flex-row items-center px-4 py-3 border-b border-warm-200 dark:border-warm-700">
          <View className="flex-1">
            <Text className="text-lg font-bold text-warm-900 dark:text-warm-50">Rezept hinzufügen</Text>
            <Text className="text-sm text-warm-500 dark:text-warm-400">{dayName}</Text>
          </View>
          <Pressable onPress={onClose} className="p-2">
            <X size={22} color="#9E8878" />
          </Pressable>
        </View>

        <View className="p-6 gap-4">
          <Pressable
            onPress={onPickRecipe}
            className="flex-row items-center gap-4 p-5 bg-primary-50 rounded-2xl border border-primary-100"
          >
            <View className="w-12 h-12 bg-primary-500 rounded-xl items-center justify-center">
              <BookOpen size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-warm-900 dark:text-warm-50">Rezept auswählen</Text>
              <Text className="text-sm text-warm-500 dark:text-warm-400 mt-0.5">Aus deiner Sammlung wählen</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onScanQR}
            className="flex-row items-center gap-4 p-5 bg-warm-50 dark:bg-espresso-900 rounded-2xl border border-warm-200 dark:border-warm-700"
          >
            <View className="w-12 h-12 bg-espresso-700 rounded-xl items-center justify-center">
              <QrCode size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-warm-900 dark:text-warm-50">QR-Code scannen</Text>
              <Text className="text-sm text-warm-500 dark:text-warm-400 mt-0.5">Rezept von einer Rezeptkarte importieren</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────

function QRScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <ScannerCamera onScan={onScanned} onClose={onClose} />
      </View>
    </Modal>
  );
}

// ─── Day Column ──────────────────────────────────────────────────────────────

const DayColumn = React.memo(function DayColumn({
  dayIndex,
  monday,
  entries,
  recipes,
  onAdd,
  onRemove,
  mutationPending,
}: {
  dayIndex: number;
  monday: Date;
  entries: MealPlanEntry[];
  recipes: Map<number, Recipe>;
  onAdd: (dayIndex: number) => void;
  onRemove: (entryId: number) => void;
  mutationPending: boolean;
}) {
  const today = isToday(monday, dayIndex);
  const dateLabel = formatDateLabel(monday, dayIndex);
  const weekend = dayIndex >= 5;

  return (
    <View className={`w-36 mr-3 rounded-2xl overflow-hidden border ${today ? 'border-primary-300' : 'border-warm-200 dark:border-warm-700'} bg-white dark:bg-espresso-800`}>
      {/* Day header */}
      <View className={`px-3 py-2.5 ${today ? 'bg-primary-500' : weekend ? 'bg-warm-50 dark:bg-espresso-900' : 'bg-white dark:bg-espresso-800'}`}>
        <Text className={`text-xs font-bold ${today ? 'text-white' : 'text-warm-500 dark:text-warm-400'}`}>
          {DAYS_SHORT[dayIndex]}
        </Text>
        <Text className={`text-sm font-semibold ${today ? 'text-white' : 'text-warm-700 dark:text-warm-200'}`}>
          {dateLabel}
        </Text>
      </View>

      {/* Entries */}
      <View className="p-2 gap-2 min-h-16">
        {entries.map(entry => {
          const recipe = recipes.get(entry.recipe_id);
          return (
            <View key={entry.id} className="flex-row items-start bg-warm-50 dark:bg-espresso-900 rounded-xl px-2 py-2 gap-1">
              <Text className="text-base leading-5">{recipe?.emoji ?? '🍽️'}</Text>
              <Text className="flex-1 text-xs text-warm-700 dark:text-warm-200 leading-4" numberOfLines={2}>
                {recipe?.name ?? `Rezept #${entry.recipe_id}`}
              </Text>
              <Pressable
                onPress={() => onRemove(entry.id)}
                hitSlop={8}
                disabled={mutationPending}
                accessibilityRole="button"
                accessibilityLabel={`${recipe?.name ?? `Rezept #${entry.recipe_id}`} entfernen`}
                testID={`planner-remove-entry-${entry.id}`}
              >
                <Trash2 size={12} color="#d1d5db" />
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Add button */}
      <Pressable
        onPress={() => onAdd(dayIndex)}
        disabled={mutationPending}
        accessibilityRole="button"
        accessibilityLabel={`${DAYS_FULL[dayIndex]} Rezept hinzufügen`}
        testID={`planner-add-day-${dayIndex}`}
        className={`mx-2 mb-2 py-2 rounded-xl border border-dashed items-center ${mutationPending ? 'border-warm-100 dark:border-warm-800 opacity-50' : 'border-warm-200 dark:border-warm-700'}`}
      >
        <Plus size={14} color="#9E8878" />
      </Pressable>
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Map<number, Recipe>>(new Map());
  const [loading, setLoading] = useState(true);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [retryPlannerAction, setRetryPlannerAction] = useState<null | (() => Promise<void>)>(null);
  const [retryingPlannerAction, setRetryingPlannerAction] = useState(false);
  const [plannerMutationPending, setPlannerMutationPending] = useState(false);
  const [methodDay, setMethodDay] = useState<number | null>(null);   // Auswahl-Modal
  const [pickerDay, setPickerDay] = useState<number | null>(null);   // Rezept-Picker
  const [qrDay, setQrDay] = useState<number | null>(null);           // QR-Scanner

  const weekStart = Math.floor(monday.getTime() / 1000);

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/planner?week=${weekStart}`);
      await assertApiOk(res, `Planner fetch failed (${res.status})`);
      const body = await res.json();
      const entries: MealPlanEntry[] = Array.isArray(body) ? body : (body.entries ?? []);
      setMealPlan(entries);

      const usedIds = [...new Set(entries.map(e => e.recipe_id))];
      if (usedIds.length === 0) {
        setRecipes(new Map());
        clearPlannerError();
        return;
      }

      const all = await loadAllRecipes();
      setRecipes(pickRecipesByIds(all, usedIds));
      clearPlannerError();
    } catch (error) {
      const message = errorMessage(error, 'Wochenplan konnte nicht geladen werden.');
      handlePlannerActionError(
        message,
        async () => loadData(),
      );
      throw new Error(message);
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadData]);

  const goToPrevWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  };

  const goToNextWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  };

  const goToCurrentWeek = () => setMonday(getMondayOf(new Date()));

  const clearPlannerError = () => {
    setPlannerError(null);
    setRetryPlannerAction(null);
  };

  const handlePlannerActionError = (message: string, retry: () => Promise<void>) => {
    setPlannerError(message);
    setRetryPlannerAction(() => retry);
  };

  const runRetryPlannerAction = async () => {
    if (!retryPlannerAction) return;
    try {
      setRetryingPlannerAction(true);
      await retryPlannerAction();
      setPlannerError(null);
      setRetryPlannerAction(null);
    } catch (error) {
      setPlannerError(error instanceof Error ? error.message : 'Erneuter Versuch fehlgeschlagen');
    } finally {
      setRetryingPlannerAction(false);
    }
  };

  const handleAddWeekToShopping = async () => {
    clearPlannerError();
    try {
      const allRecipes = await loadAllRecipes();
      const recipeMap = buildRecipeIdMap(allRecipes);
      const ids = [...new Set(mealPlan.map(e => e.recipe_id))];
      const ingredients: string[] = [];
      for (const id of ids) {
        const r = recipeMap.get(id);
        if (r) {
          const ings = parseJSON<string[]>(r.ingredients, []);
          ingredients.push(...ings);
        }
      }
      if (ingredients.length === 0) return;
      await addIngredients(ingredients);
      router.navigate('/(tabs)/shopping' as never);
    } catch (error) {
      handlePlannerActionError(
        errorMessage(error, 'Einkaufsliste konnte nicht erstellt werden.'),
        async () => handleAddWeekToShopping(),
      );
    }
  };

  const handleQRScanned = async (value: string) => {
    const targetDay = qrDay;
    setQrDay(null);
    const serverUrl = await getServerUrl();

    // Neues Format: direkter Rezept-Link "<serverUrl>/recipe/<id>"
    const urlMatch = value.match(/\/recipe\/(\d+)$/);
    if (urlMatch) {
      const recipeId = parseInt(urlMatch[1], 10);
      if (targetDay !== null) {
        try {
          const res = await apiFetch('/api/v1/planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId, dayOfWeek: targetDay, weekStart }),
          });
          await assertApiOk(res, `Planner POST failed (${res.status})`);
          await loadData();
          Alert.alert('Hinzugefügt', 'Rezept wurde zum Planer hinzugefügt.');
        } catch (error) {
          handlePlannerActionError(
            errorMessage(error, 'Rezept konnte nicht zum Wochenplan hinzugefügt werden.'),
            async () => {
              const res2 = await apiFetch('/api/v1/planner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeId, dayOfWeek: targetDay, weekStart }),
              });
              await assertApiOk(res2, `Planner POST failed (${res2.status})`);
              await loadData();
              Alert.alert('Hinzugefügt', 'Rezept wurde zum Planer hinzugefügt.');
            },
          );
        }
      }
      return;
    }

    // Legacy: kompaktes JSON-Format (ältere PDFs)
    if (!isRecipeJSONQR(value)) {
      Alert.alert('Kein Rezept-QR', 'Dieser QR-Code enthält kein RecipeDeck-Rezept.');
      return;
    }
    const decoded = decodeRecipeFromCompactJSON(value);
    if (!decoded) {
      Alert.alert('Fehler', 'QR-Code konnte nicht gelesen werden.');
      return;
    }
    const data = parseCompactRecipeToFull(decoded);

    const recipeRes = await fetch(`${serverUrl}/api/v1/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        emoji: data.emoji ?? '🍽️',
        ingredients: data.ingredients,
        steps: data.steps,
        tags: data.tags ?? [],
        servings: data.servings ?? null,
        duration: data.duration ?? null,
      }),
    });
    if (!recipeRes.ok) {
      Alert.alert('Fehler', 'Rezept konnte nicht gespeichert werden.');
      return;
    }
    const saved = await recipeRes.json();
    const newId: number = saved.id;
    if (targetDay !== null) {
      const plannerRes = await apiFetch('/api/v1/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: newId, dayOfWeek: targetDay, weekStart }),
      });
      await assertApiOk(plannerRes, 'Rezept konnte nicht zum Wochenplan hinzugefügt werden.');
    }
    await loadData();
    Alert.alert('Importiert', `"${data.name}" wurde importiert und zum Planer hinzugefügt.`);
  };

  const handleAddRecipe = async (recipeId: number, dayOverride?: number) => {
    const targetDay = dayOverride ?? pickerDay;
    if (targetDay === null || plannerMutationPending) return;
    clearPlannerError();
    setPlannerMutationPending(true);
    try {
      const res = await apiFetch('/api/v1/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, dayOfWeek: targetDay, weekStart }),
      });
      await assertApiOk(res, 'Rezept konnte nicht zum Wochenplan hinzugefügt werden.');
      await loadData();
    } catch (error) {
      handlePlannerActionError(
        errorMessage(error, 'Rezept konnte nicht zum Wochenplan hinzugefügt werden.'),
        async () => handleAddRecipe(recipeId, targetDay),
      );
    } finally {
      setPlannerMutationPending(false);
    }
  };

  const retryRemoveEntry = async (entryId: number) => {
    clearPlannerError();
    setPlannerMutationPending(true);
    try {
      const res = await apiFetch(`/api/v1/planner/${entryId}`, { method: 'DELETE' });
      await assertApiOk(res, 'Rezept konnte nicht entfernt werden.');
      await loadData();
    } catch (error) {
      handlePlannerActionError(
        errorMessage(error, 'Rezept konnte nicht entfernt werden.'),
        async () => retryRemoveEntry(entryId),
      );
    } finally {
      setPlannerMutationPending(false);
    }
  };

  const handleRemoveEntry = useCallback(async (entryId: number) => {
    if (plannerMutationPending) return;
    Alert.alert('Entfernen', 'Rezept aus dem Planer entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => retryRemoveEntry(entryId),
      },
    ]);
  // retryRemoveEntry is defined in the same render scope; the Alert callback
  // captures it by closure at the time the Alert is shown, which is correct.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerMutationPending]);

  const weekLabel = (() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    return `${monday.getDate()}.${monday.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  })();

  const isCurrentWeek = monday.getTime() === getMondayOf(new Date()).getTime();

  const entriesByDay = useMemo(() => groupEntriesByDay(mealPlan), [mealPlan]);

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Calendar size={20} color="#C84B31" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">Wochenplaner</Text>
          </View>
          {mealPlan.length > 0 && (
            <Pressable onPress={handleAddWeekToShopping} className="flex-row items-center gap-1.5 px-3 py-2 bg-primary-50 rounded-xl border border-primary-200">
              <ShoppingCart size={15} color="#C84B31" />
              <Text className="text-xs font-medium text-primary-500">Einkaufsliste</Text>
            </Pressable>
          )}
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={goToPrevWeek} className="p-2 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700">
            <ChevronLeft size={18} color="#9E8878" />
          </Pressable>

          <Pressable onPress={goToCurrentWeek} disabled={isCurrentWeek}>
            <Text className={`text-sm font-medium ${isCurrentWeek ? 'text-primary-500' : 'text-warm-600 dark:text-warm-300'}`}>
              {weekLabel}
            </Text>
          </Pressable>

          <Pressable onPress={goToNextWeek} className="p-2 rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700">
            <ChevronRight size={18} color="#9E8878" />
          </Pressable>
        </View>

        {plannerError && (
          <View className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <Text className="text-sm text-red-700">{plannerError}</Text>
            <View className="mt-2 flex-row gap-2">
              {retryPlannerAction && (
                <Pressable
                  onPress={runRetryPlannerAction}
                  disabled={retryingPlannerAction}
                  className={`rounded-lg px-3 py-1.5 ${retryingPlannerAction ? 'bg-red-200' : 'bg-red-600'}`}
                >
                  <Text className="text-xs font-medium text-white">
                    {retryingPlannerAction ? 'Wird versucht…' : 'Erneut versuchen'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={clearPlannerError} className="rounded-lg bg-red-100 px-3 py-1.5">
                <Text className="text-xs font-medium text-red-700">Schließen</Text>
              </Pressable>
            </View>
          </View>
        )}
        {plannerMutationPending && (
          <Text className="mt-2 text-xs text-warm-500 dark:text-warm-400">Änderung wird gespeichert…</Text>
        )}
      </View>

      {/* Day columns */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="planner-loading" size="large" color="#C84B31" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          contentContainerStyle={{ padding: 16, paddingTop: 8, ...(Platform.OS === 'web' ? { minWidth: '100%' } : { flexGrow: 1 }) }}
        >
          {DAYS_FULL.map((_dayName, dayIndex) => (
            <DayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              monday={monday}
              entries={entriesByDay.get(dayIndex) ?? []}
              recipes={recipes}
              onAdd={setMethodDay}
              onRemove={handleRemoveEntry}
              mutationPending={plannerMutationPending}
            />
          ))}
        </ScrollView>
      )}

      {/* Auswahl-Modal: Rezept oder QR */}
      <AddMethodModal
        visible={methodDay !== null}
        dayName={methodDay !== null ? DAYS_FULL[methodDay] : ''}
        onClose={() => setMethodDay(null)}
        onPickRecipe={() => { setPickerDay(methodDay); setMethodDay(null); }}
        onScanQR={() => { setQrDay(methodDay); setMethodDay(null); }}
      />

      {/* Rezept-Picker */}
      <RecipePickerModal
        visible={pickerDay !== null}
        dayIndex={pickerDay ?? 0}
        dayName={pickerDay !== null ? DAYS_FULL[pickerDay] : ''}
        onClose={() => setPickerDay(null)}
        onSelect={handleAddRecipe}
      />

      {/* QR-Scanner */}
      <QRScannerModal
        visible={qrDay !== null}
        onClose={() => setQrDay(null)}
        onScanned={handleQRScanned}
      />
    </SafeAreaView>
  );
}
