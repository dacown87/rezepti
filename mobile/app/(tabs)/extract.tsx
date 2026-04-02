import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Globe, Camera, ScanLine, ImagePlus, CheckCircle, AlertCircle, X } from 'lucide-react-native';

import { getDB } from '@/db/migrate';
import { getServerUrl } from '@/utils/server-url';

// ─── Constants ───────────────────────────────────────────────────────────────

const GROQ_KEY_SECURE = 'groq_key';

type Mode = 'url' | 'photo' | 'qr';

const STAGES: Record<string, number> = {
  classifying: 20,
  fetching: 35,
  transcribing: 50,
  analyzing_image: 65,
  extracting: 80,
  exporting: 92,
  done: 100,
};

const STAGE_LABELS: Record<string, string> = {
  classifying: 'URL wird analysiert',
  fetching: 'Inhalte werden abgerufen',
  transcribing: 'Audio wird transkribiert',
  analyzing_image: 'Bild wird analysiert',
  extracting: 'Rezept wird extrahiert',
  exporting: 'Wird gespeichert',
  done: 'Fertig!',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStage?: string;
  progress?: number;
  message?: string;
  result?: {
    success?: boolean;
    recipe?: RecipePayload;
    recipeId?: number;
    error?: string;
  };
}

interface RecipePayload {
  name: string;
  emoji?: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  servings?: string;
  duration?: string;
  calories?: number;
  transcript?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGroqKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GROQ_KEY_SECURE);
  } catch {
    return null;
  }
}

async function saveRecipeToLocalDB(recipe: RecipePayload, sourceUrl?: string): Promise<void> {
  const db = getDB();
  await db.runAsync(
    `INSERT INTO recipes (name, emoji, source_url, ingredients, steps, tags, servings, duration, calories, transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    recipe.name,
    recipe.emoji ?? '🍽️',
    sourceUrl ?? null,
    JSON.stringify(recipe.ingredients),
    JSON.stringify(recipe.steps),
    JSON.stringify(recipe.tags ?? []),
    recipe.servings ?? null,
    recipe.duration ?? null,
    recipe.calories ?? null,
    recipe.transcript ?? null,
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExtractScreen() {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handledRef = useRef(false);
  const submittedUrlRef = useRef<string | undefined>(undefined);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    handledRef.current = false;

    const interval = setInterval(async () => {
      if (handledRef.current) return;
      try {
        const serverUrl = await getServerUrl();
        const res = await fetch(`${serverUrl}/api/v1/extract/react/${jobId}`);
        if (!res.ok) return; // transient error, keep polling

        const status: JobStatus = await res.json();
        const p = status.progress ?? STAGES[status.currentStage ?? ''] ?? 0;
        setProgress(p);
        if (status.currentStage) setStage(status.currentStage);

        if (status.status === 'completed') {
          handledRef.current = true;
          clearInterval(interval);

          const recipe = status.result?.recipe;
          // On web SQLite is a no-op stub; recipe is already saved server-side.
          if (recipe && Platform.OS !== 'web') {
            try {
              await saveRecipeToLocalDB(recipe, submittedUrlRef.current);
            } catch (dbErr) {
              console.error('SQLite save failed:', dbErr);
              setError('Rezept extrahiert, aber Speichern fehlgeschlagen.');
              setIsLoading(false);
              setJobId(null);
              return;
            }
          }

          setProgress(100);
          setStage('done');
          setSuccess(true);
          setIsLoading(false);
          setJobId(null);
        } else if (status.status === 'failed') {
          handledRef.current = true;
          clearInterval(interval);
          setError(status.result?.error || status.message || 'Extraktion fehlgeschlagen');
          setIsLoading(false);
          setJobId(null);
        }
      } catch {
        // keep polling on transient network errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setUrl('');
    setPhotoUri(null);
    setIsLoading(false);
    setJobId(null);
    setProgress(0);
    setStage(null);
    setSuccess(false);
    setError(null);
    submittedUrlRef.current = undefined;
  }, []);

  // ── URL submit ─────────────────────────────────────────────────────────────
  const handleUrlSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    submittedUrlRef.current = trimmed;
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(5);
    setStage('classifying');

    try {
      const serverUrl = await getServerUrl();
      const groqKey = await getGroqKey();

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (groqKey) headers['x-groq-key'] = groqKey;

      const res = await fetch(`${serverUrl}/api/v1/extract/react`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server-Fehler ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Starten der Extraktion';
      setError(msg);
      setIsLoading(false);
      setProgress(0);
      setStage(null);
    }
  };

  // ── Photo pick ─────────────────────────────────────────────────────────────
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kein Kamera-Zugriff', 'Bitte Kamera-Berechtigung in den Einstellungen erteilen.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kein Galerie-Zugriff', 'Bitte Galerie-Berechtigung in den Einstellungen erteilen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ── Photo submit ───────────────────────────────────────────────────────────
  const handlePhotoSubmit = async () => {
    if (!photoUri) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(10);
    setStage('analyzing_image');

    try {
      const serverUrl = await getServerUrl();
      const groqKey = await getGroqKey();

      const filename = photoUri.split('/').pop() ?? 'photo.jpg';
      const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

      const formData = new FormData();
      formData.append('photo', { uri: photoUri, name: filename, type: mimeType } as unknown as Blob);

      const headers: Record<string, string> = {};
      if (groqKey) headers['x-groq-key'] = groqKey;

      const res = await fetch(`${serverUrl}/api/v1/extract/react`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server-Fehler ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Hochladen des Fotos';
      setError(msg);
      setIsLoading(false);
      setProgress(0);
      setStage(null);
    }
  };

  // ── Mode-switch helper ─────────────────────────────────────────────────────
  const switchMode = (m: Mode) => {
    reset();
    setMode(m);
  };

  // ── Progress bar ───────────────────────────────────────────────────────────
  const ProgressSection = () => (
    <View className="mt-6">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm text-gray-500">
          {stage ? (STAGE_LABELS[stage] ?? stage) : 'Wird gestartet…'}
          {(stage === 'transcribing' || stage === 'analyzing_image' || stage === 'extracting') ? ' — bitte warten' : ''}
        </Text>
        <Text className="text-sm font-semibold text-purple-600">{progress}%</Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View
          className="h-full bg-purple-600 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4">
          <View className="flex-1 items-center justify-center py-20">
            <CheckCircle size={64} color="#9333ea" />
            <Text className="text-2xl font-bold text-gray-900 mt-4 text-center">
              Rezept gespeichert!
            </Text>
            <Text className="text-gray-500 text-center mt-2 mb-8 leading-relaxed">
              Das Rezept wurde extrahiert und in deiner lokalen Sammlung gespeichert.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => router.push('/(tabs)' as never)}
                className="bg-purple-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">Zur Sammlung</Text>
              </Pressable>
              <Pressable
                onPress={reset}
                className="border border-gray-200 bg-white px-6 py-3 rounded-xl"
              >
                <Text className="text-gray-700 font-semibold">Weiteres Rezept</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Rezept hinzufügen</Text>
          <Text className="text-gray-400 mt-1 text-sm">
            {mode === 'url'
              ? 'Füge eine URL ein — RecipeDeck extrahiert das Rezept automatisch.'
              : mode === 'photo'
              ? 'Foto eines Rezepts hochladen — KI erkennt Zutaten und Schritte.'
              : 'QR-Code eines gespeicherten Rezepts scannen.'}
          </Text>
        </View>

        {/* Mode switcher */}
        <View className="flex-row bg-white rounded-2xl p-1 mb-6 border border-gray-100 shadow-sm">
          <Pressable
            onPress={() => switchMode('url')}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              mode === 'url' ? 'bg-purple-600' : ''
            }`}
          >
            <Globe size={16} color={mode === 'url' ? '#fff' : '#9ca3af'} />
            <Text className={`text-sm font-medium ${mode === 'url' ? 'text-white' : 'text-gray-400'}`}>
              URL
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('photo')}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              mode === 'photo' ? 'bg-purple-600' : ''
            }`}
          >
            <Camera size={16} color={mode === 'photo' ? '#fff' : '#9ca3af'} />
            <Text className={`text-sm font-medium ${mode === 'photo' ? 'text-white' : 'text-gray-400'}`}>
              Foto
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('qr')}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              mode === 'qr' ? 'bg-purple-600' : ''
            }`}
          >
            <ScanLine size={16} color={mode === 'qr' ? '#fff' : '#9ca3af'} />
            <Text className={`text-sm font-medium ${mode === 'qr' ? 'text-white' : 'text-gray-400'}`}>
              QR
            </Text>
          </Pressable>
        </View>

        {/* ── URL mode ── */}
        {mode === 'url' && (
          <View>
            <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Unterstützte Quellen
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['YouTube', 'Instagram', 'TikTok', 'Webseiten'].map((p) => (
                  <View key={p} className="bg-purple-50 rounded-full px-3 py-1">
                    <Text className="text-xs text-purple-600 font-medium">{p}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <TextInput
                className="text-base text-gray-900 border border-gray-200 rounded-xl px-4 py-3 mb-4"
                placeholder="https://youtube.com/watch?v=…"
                placeholderTextColor="#9ca3af"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />
              <Pressable
                onPress={handleUrlSubmit}
                disabled={isLoading || !url.trim()}
                className={`py-3.5 rounded-xl items-center ${
                  isLoading || !url.trim() ? 'bg-purple-200' : 'bg-purple-600'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Extrahieren</Text>
                )}
              </Pressable>

              {isLoading && <ProgressSection />}
            </View>
          </View>
        )}

        {/* ── Photo mode ── */}
        {mode === 'photo' && (
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {!photoUri ? (
              <View className="gap-3">
                <Pressable
                  onPress={pickFromCamera}
                  disabled={isLoading}
                  className="flex-row items-center gap-4 border-2 border-dashed border-gray-200 rounded-2xl p-6"
                >
                  <Camera size={32} color="#9ca3af" />
                  <View>
                    <Text className="font-semibold text-gray-800">Kamera</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">Rezept fotografieren</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={pickFromGallery}
                  disabled={isLoading}
                  className="flex-row items-center gap-4 border-2 border-dashed border-gray-200 rounded-2xl p-6"
                >
                  <ImagePlus size={32} color="#9ca3af" />
                  <View>
                    <Text className="font-semibold text-gray-800">Galerie</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">Foto aus der Galerie wählen</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View>
                <View className="relative rounded-xl overflow-hidden mb-4">
                  <Image
                    source={{ uri: photoUri }}
                    className="w-full h-56"
                    resizeMode="cover"
                  />
                  {!isLoading && (
                    <Pressable
                      onPress={() => setPhotoUri(null)}
                      className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5"
                    >
                      <X size={16} color="#fff" />
                    </Pressable>
                  )}
                </View>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setPhotoUri(null)}
                    disabled={isLoading}
                    className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
                  >
                    <Text className="text-gray-600 font-medium">Anderes Foto</Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePhotoSubmit}
                    disabled={isLoading}
                    className={`flex-1 py-3 rounded-xl items-center ${isLoading ? 'bg-purple-200' : 'bg-purple-600'}`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold">Extrahieren</Text>
                    )}
                  </Pressable>
                </View>

                {isLoading && <ProgressSection />}
              </View>
            )}
          </View>
        )}

        {/* ── QR mode ── */}
        {mode === 'qr' && (
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 items-center">
            <ScanLine size={56} color="#9333ea" />
            <Text className="text-lg font-semibold text-gray-900 mt-4 text-center">
              QR-Code scannen
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2 mb-6 leading-relaxed">
              Nutze den Scanner-Tab, um einen Rezept-QR-Code zu scannen und direkt zu importieren.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/scanner')}
              className="bg-purple-600 px-8 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Zum Scanner</Text>
            </Pressable>
          </View>
        )}

        {/* ── Error ── */}
        {error && (
          <View className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <AlertCircle size={18} color="#dc2626" />
              <View className="flex-1">
                <Text className="text-red-700 text-sm leading-relaxed">{error}</Text>
              </View>
              <Pressable onPress={() => setError(null)}>
                <X size={16} color="#dc2626" />
              </Pressable>
            </View>
            <Pressable
              onPress={reset}
              className="mt-3 border border-red-200 rounded-lg py-2 items-center"
            >
              <Text className="text-red-600 text-sm font-medium">Zurücksetzen</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
