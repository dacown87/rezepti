import { useState, useEffect, useCallback } from 'react';
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
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar, X, Search, BookOpen, QrCode } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScannerCamera from '@/components/ScannerCamera';
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '@/utils/recipe-qr';

import { getDB } from '@/db/migrate';
import type { Recipe, MealPlanEntry } from '@/db/schema';

const PRODUCTION_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';
const MEAL_PLAN_KEY = 'recipedeck_meal_plan';

async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem('recipedeck_server_url');
    return stored?.trim() || PRODUCTION_URL;
  } catch { return PRODUCTION_URL; }
}

// ─── Web Meal Plan (AsyncStorage / localStorage) ──────────────────────────────

async function webLoadEntries(weekStart: number): Promise<MealPlanEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(MEAL_PLAN_KEY);
    const all: MealPlanEntry[] = raw ? JSON.parse(raw) : [];
    return all.filter(e => e.week_start === weekStart);
  } catch { return []; }
}

async function webAddEntry(recipeId: number, dayOfWeek: number, weekStart: number): Promise<void> {
  const raw = await AsyncStorage.getItem(MEAL_PLAN_KEY);
  const all: MealPlanEntry[] = raw ? JSON.parse(raw) : [];
  const newEntry: MealPlanEntry = {
    id: Date.now(),
    recipe_id: recipeId,
    day_of_week: dayOfWeek,
    week_start: weekStart,
    created_at: Math.floor(Date.now() / 1000),
  };
  await AsyncStorage.setItem(MEAL_PLAN_KEY, JSON.stringify([...all, newEntry]));
}

async function webRemoveEntry(entryId: number): Promise<void> {
  const raw = await AsyncStorage.getItem(MEAL_PLAN_KEY);
  const all: MealPlanEntry[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(all.filter(e => e.id !== entryId)));
}

async function loadAllRecipes(): Promise<Recipe[]> {
  if (Platform.OS === 'web') {
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
      servings: (r.servings as string | null) ?? null,
      duration: (r.duration as string | null) ?? null,
      calories: r.calories != null ? Number(r.calories) : null,
      rating: r.rating != null ? Number(r.rating) : null,
      notes: (r.notes as string | null) ?? null,
      transcript: null,
      tried: 0,
      pdf_created: 0,
      created_at: null,
    }));
  }
  return getDB().getAllAsync<Recipe>('SELECT * FROM recipes ORDER BY name ASC');
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
  const [filtered, setFiltered] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    loadAllRecipes()
      .then(rows => { setRecipes(rows); setFiltered(rows); })
      .finally(() => setLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(recipes); return; }
    const q = search.toLowerCase();
    setFiltered(recipes.filter(r => r.name.toLowerCase().includes(q)));
  }, [search, recipes]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Rezept hinzufügen</Text>
            <Text className="text-sm text-gray-400">{dayName}</Text>
          </View>
          <Pressable onPress={onClose} className="p-2">
            <X size={22} color="#6b7280" />
          </Pressable>
        </View>

        {/* Suche */}
        <View className="px-4 py-3">
          <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2">
            <Search size={16} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-2 text-base text-gray-900"
              placeholder="Rezept suchen…"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator className="mt-8" color="#9333ea" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item.id); onClose(); }}
                className="flex-row items-center py-3 border-b border-gray-50"
              >
                <Text className="text-2xl mr-3">{item.emoji ?? '🍽️'}</Text>
                <Text className="flex-1 text-gray-800 font-medium" numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className="text-center text-gray-400 py-12">Keine Rezepte gefunden.</Text>
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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Rezept hinzufügen</Text>
            <Text className="text-sm text-gray-400">{dayName}</Text>
          </View>
          <Pressable onPress={onClose} className="p-2">
            <X size={22} color="#6b7280" />
          </Pressable>
        </View>

        <View className="p-6 gap-4">
          <Pressable
            onPress={onPickRecipe}
            className="flex-row items-center gap-4 p-5 bg-purple-50 rounded-2xl border border-purple-100"
          >
            <View className="w-12 h-12 bg-purple-600 rounded-xl items-center justify-center">
              <BookOpen size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">Rezept auswählen</Text>
              <Text className="text-sm text-gray-500 mt-0.5">Aus deiner Sammlung wählen</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onScanQR}
            className="flex-row items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100"
          >
            <View className="w-12 h-12 bg-gray-700 rounded-xl items-center justify-center">
              <QrCode size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">QR-Code scannen</Text>
              <Text className="text-sm text-gray-500 mt-0.5">Rezept von einer Rezeptkarte importieren</Text>
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
      <View style={StyleSheet.absoluteFillObject}>
        <ScannerCamera onScan={onScanned} onClose={onClose} />
      </View>
    </Modal>
  );
}

// ─── Day Column ──────────────────────────────────────────────────────────────

function DayColumn({
  dayIndex,
  monday,
  entries,
  recipes,
  onAdd,
  onRemove,
}: {
  dayIndex: number;
  monday: Date;
  entries: MealPlanEntry[];
  recipes: Map<number, Recipe>;
  onAdd: (dayIndex: number) => void;
  onRemove: (entryId: number) => void;
}) {
  const today = isToday(monday, dayIndex);
  const dateLabel = formatDateLabel(monday, dayIndex);
  const weekend = dayIndex >= 5;

  return (
    <View className={`w-36 mr-3 rounded-2xl overflow-hidden border ${today ? 'border-purple-300' : 'border-gray-100'} bg-white`}>
      {/* Day header */}
      <View className={`px-3 py-2.5 ${today ? 'bg-purple-600' : weekend ? 'bg-gray-50' : 'bg-white'}`}>
        <Text className={`text-xs font-bold ${today ? 'text-white' : 'text-gray-400'}`}>
          {DAYS_SHORT[dayIndex]}
        </Text>
        <Text className={`text-sm font-semibold ${today ? 'text-white' : 'text-gray-700'}`}>
          {dateLabel}
        </Text>
      </View>

      {/* Entries */}
      <View className="p-2 gap-2 min-h-16">
        {entries.map(entry => {
          const recipe = recipes.get(entry.recipe_id);
          return (
            <View key={entry.id} className="flex-row items-start bg-gray-50 rounded-xl px-2 py-2 gap-1">
              <Text className="text-base leading-5">{recipe?.emoji ?? '🍽️'}</Text>
              <Text className="flex-1 text-xs text-gray-700 leading-4" numberOfLines={2}>
                {recipe?.name ?? `Rezept #${entry.recipe_id}`}
              </Text>
              <Pressable onPress={() => onRemove(entry.id)} hitSlop={8}>
                <Trash2 size={12} color="#d1d5db" />
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Add button */}
      <Pressable
        onPress={() => onAdd(dayIndex)}
        className="mx-2 mb-2 py-2 rounded-xl border border-dashed border-gray-200 items-center"
      >
        <Plus size={14} color="#9ca3af" />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Map<number, Recipe>>(new Map());
  const [loading, setLoading] = useState(true);
  const [methodDay, setMethodDay] = useState<number | null>(null);   // Auswahl-Modal
  const [pickerDay, setPickerDay] = useState<number | null>(null);   // Rezept-Picker
  const [qrDay, setQrDay] = useState<number | null>(null);           // QR-Scanner

  const weekStart = Math.floor(monday.getTime() / 1000);

  const loadData = useCallback(async () => {
    let entries: MealPlanEntry[];
    if (Platform.OS === 'web') {
      entries = await webLoadEntries(weekStart);
    } else {
      entries = await getDB().getAllAsync<MealPlanEntry>(
        'SELECT * FROM meal_plan WHERE week_start = ?', weekStart
      );
    }
    setMealPlan(entries);

    const usedIds = [...new Set(entries.map(e => e.recipe_id))];
    if (usedIds.length === 0) { setRecipes(new Map()); return; }

    if (Platform.OS === 'web') {
      const serverUrl = await getServerUrl();
      const all = await loadAllRecipes();
      const map = new Map(all.map(r => [r.id, r]));
      const filtered = usedIds.reduce((acc, id) => {
        const r = map.get(id);
        if (r) acc.set(id, r);
        return acc;
      }, new Map<number, Recipe>());
      setRecipes(filtered);
    } else {
      const db = getDB();
      const placeholders = usedIds.map(() => '?').join(',');
      const rows = await db.getAllAsync<Recipe>(
        `SELECT * FROM recipes WHERE id IN (${placeholders})`, ...usedIds
      );
      setRecipes(new Map(rows.map(r => [r.id, r])));
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
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

  const handleQRScanned = async (value: string) => {
    const targetDay = qrDay;
    setQrDay(null);

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

    // Rezept in SQLite speichern und zum Planer hinzufügen
    const db = getDB();
    const result = await db.runAsync(
      `INSERT INTO recipes (name, emoji, ingredients, steps, tags, servings, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      data.name,
      data.emoji ?? '🍽️',
      JSON.stringify(data.ingredients),
      JSON.stringify(data.steps),
      JSON.stringify(data.tags ?? []),
      data.servings ?? null,
      data.duration ?? null,
    );
    const newId = result.lastInsertRowId;
    if (targetDay !== null) {
      await db.runAsync(
        'INSERT INTO meal_plan (recipe_id, day_of_week, week_start) VALUES (?, ?, ?)',
        newId, targetDay, weekStart,
      );
    }
    await loadData();
    Alert.alert('Importiert', `"${data.name}" wurde importiert und zum Planer hinzugefügt.`);
  };

  const handleAddRecipe = async (recipeId: number) => {
    if (pickerDay === null) return;
    if (Platform.OS === 'web') {
      await webAddEntry(recipeId, pickerDay, weekStart);
    } else {
      await getDB().runAsync(
        'INSERT INTO meal_plan (recipe_id, day_of_week, week_start) VALUES (?, ?, ?)',
        recipeId, pickerDay, weekStart
      );
    }
    await loadData();
  };

  const handleRemoveEntry = async (entryId: number) => {
    if (Platform.OS === 'web') {
      await webRemoveEntry(entryId);
      await loadData();
    } else {
      Alert.alert('Entfernen', 'Rezept aus dem Planer entfernen?', [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            await getDB().runAsync('DELETE FROM meal_plan WHERE id = ?', entryId);
            await loadData();
          },
        },
      ]);
    }
  };

  const weekLabel = (() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    return `${monday.getDate()}.${monday.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  })();

  const isCurrentWeek = monday.getTime() === getMondayOf(new Date()).getTime();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center gap-2 mb-3">
          <Calendar size={20} color="#9333ea" />
          <Text className="text-2xl font-bold text-gray-900">Wochenplaner</Text>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={goToPrevWeek} className="p-2 rounded-xl bg-white border border-gray-200">
            <ChevronLeft size={18} color="#6b7280" />
          </Pressable>

          <Pressable onPress={goToCurrentWeek} disabled={isCurrentWeek}>
            <Text className={`text-sm font-medium ${isCurrentWeek ? 'text-purple-600' : 'text-gray-600'}`}>
              {weekLabel}
            </Text>
          </Pressable>

          <Pressable onPress={goToNextWeek} className="p-2 rounded-xl bg-white border border-gray-200">
            <ChevronRight size={18} color="#6b7280" />
          </Pressable>
        </View>
      </View>

      {/* Day columns */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#9333ea" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        >
          {DAYS_FULL.map((dayName, dayIndex) => {
            const dayEntries = mealPlan.filter(e => e.day_of_week === dayIndex);
            return (
              <DayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                monday={monday}
                entries={dayEntries}
                recipes={recipes}
                onAdd={setMethodDay}
                onRemove={handleRemoveEntry}
              />
            );
          })}
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
