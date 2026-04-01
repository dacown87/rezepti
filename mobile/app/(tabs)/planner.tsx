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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar, X, Search } from 'lucide-react-native';
import { TextInput } from 'react-native';

import { getDB } from '@/db/migrate';
import type { Recipe, MealPlanEntry } from '@/db/schema';

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
    const db = getDB();
    db.getAllAsync<Recipe>('SELECT * FROM recipes ORDER BY name ASC')
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
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const weekStart = Math.floor(monday.getTime() / 1000);

  const loadData = useCallback(async () => {
    const db = getDB();
    const entries = await db.getAllAsync<MealPlanEntry>(
      'SELECT * FROM meal_plan WHERE week_start = ?',
      weekStart
    );
    setMealPlan(entries);

    // Alle verwendeten Rezepte laden
    const usedIds = [...new Set(entries.map(e => e.recipe_id))];
    if (usedIds.length > 0) {
      const placeholders = usedIds.map(() => '?').join(',');
      const rows = await db.getAllAsync<Recipe>(
        `SELECT * FROM recipes WHERE id IN (${placeholders})`,
        ...usedIds
      );
      setRecipes(new Map(rows.map(r => [r.id, r])));
    } else {
      setRecipes(new Map());
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

  const handleAddRecipe = async (recipeId: number) => {
    if (pickerDay === null) return;
    const db = getDB();
    await db.runAsync(
      'INSERT INTO meal_plan (recipe_id, day_of_week, week_start) VALUES (?, ?, ?)',
      recipeId,
      pickerDay,
      weekStart
    );
    // Rezept-Cache aktualisieren
    if (!recipes.has(recipeId)) {
      const recipe = await db.getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', recipeId);
      if (recipe) {
        setRecipes(prev => new Map(prev).set(recipeId, recipe));
      }
    }
    await loadData();
  };

  const handleRemoveEntry = async (entryId: number) => {
    Alert.alert('Entfernen', 'Rezept aus dem Planer entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => {
          const db = getDB();
          await db.runAsync('DELETE FROM meal_plan WHERE id = ?', entryId);
          await loadData();
        },
      },
    ]);
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
                onAdd={setPickerDay}
                onRemove={handleRemoveEntry}
              />
            );
          })}
        </ScrollView>
      )}

      {/* Recipe picker modal */}
      <RecipePickerModal
        visible={pickerDay !== null}
        dayIndex={pickerDay ?? 0}
        dayName={pickerDay !== null ? DAYS_FULL[pickerDay] : ''}
        onClose={() => setPickerDay(null)}
        onSelect={handleAddRecipe}
      />
    </SafeAreaView>
  );
}
