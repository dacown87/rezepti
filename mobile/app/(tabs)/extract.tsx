import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Globe, Camera, ImagePlus, CheckCircle, AlertCircle, X, UtensilsCrossed } from 'lucide-react-native';
import { ImagePickerModal } from '@/components/ImagePickerModal';
import { compressIfNeeded } from '@/utils/image-compress';

import { getServerUrl } from '@/utils/server-url';

// ─── Constants ───────────────────────────────────────────────────────────────

const GROQ_KEY_SECURE = 'groq_key';

type Mode = 'url' | 'photo';

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
  hint?: string;
  result?: {
    success?: boolean;
    recipe?: RecipePayload;
    recipeId?: number;
    error?: string;
    imageSuggestions?: string[];
  };
}

function detectUrlType(url: string): { label: string; estimate: string } | null {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { label: 'YouTube', estimate: '~30–60 Sek.' };
  if (u.includes('tiktok.com') || u.includes('vm.tiktok')) return { label: 'TikTok', estimate: '2–5 Min.' };
  if (u.includes('instagram.com')) return { label: 'Instagram', estimate: '1–3 Min.' };
  if (u.includes('chefkoch.de') || u.includes('bbcgoodfood.com') || u.includes('allrecipes.com')) return { label: 'Rezeptseite', estimate: '~10 Sek.' };
  if (u.startsWith('http')) return { label: 'Webseite', estimate: '~20 Sek.' };
  return null;
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
  equipment?: string[];
  nutritionInfo?: { carbs?: string; fat?: string; protein?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGroqKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GROQ_KEY_SECURE);
  } catch {
    return null;
  }
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
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [imageSuggestions, setImageSuggestions] = useState<string[]>([]);
  const [recipeIdForImage, setRecipeIdForImage] = useState<number | null>(null);
  const [recipeNameForImage, setRecipeNameForImage] = useState<string | undefined>(undefined);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [imageCount, setImageCount] = useState(4);
  const navRecipeIdRef = useRef<number | null>(null);

  const handledRef = useRef(false);
  const submittedUrlRef = useRef<string | undefined>(undefined);
  const submittedModeRef = useRef<Mode>('url');

  // ── Load image count setting (bei jedem Tab-Focus neu laden) ─────────────
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('image_search_count').then((val) => {
      const n = parseInt(val ?? '4', 10);
      if ([4, 8, 16].includes(n)) setImageCount(n);
    }).catch(() => {});
  }, []));

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

          setProgress(100);
          setStage('done');
          setIsLoading(false);
          setJobId(null);

          const suggestions = status.result?.imageSuggestions ?? [];
          const recipeId = status.result?.recipeId ?? null;
          // Server-ID als Nav-Target
          if (recipeId) navRecipeIdRef.current = recipeId;

          if (recipeId) {
            setImageSuggestions(suggestions);
            setRecipeIdForImage(recipeId);
            setRecipeNameForImage(status.result?.recipe?.name);
            try {
              const sUrl = await getServerUrl();
              const recipeRes = await fetch(`${sUrl}/api/v1/recipes/${recipeId}`);
              if (recipeRes.ok) {
                const recipeData = await recipeRes.json();
                setRecipeImageUrl(recipeData.image_url ?? null);
              }
            } catch { /* ignore */ }
          } else {
            setSuccess(true);
          }
        } else if (status.status === 'failed') {
          handledRef.current = true;
          clearInterval(interval);
          setError(status.result?.error || status.message || 'Extraktion fehlgeschlagen');
          setErrorHint(status.hint ?? null);
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
    setErrorHint(null);
    setImageSuggestions([]);
    setRecipeIdForImage(null);
    setRecipeNameForImage(undefined);
    setRecipeImageUrl(null);
    setShowImagePickerModal(false);
    submittedUrlRef.current = undefined;
    submittedModeRef.current = 'url';
    navRecipeIdRef.current = null;
  }, []);

  // ── URL submit ─────────────────────────────────────────────────────────────
  const handleUrlSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    submittedUrlRef.current = trimmed;
    submittedModeRef.current = 'url';
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

    submittedModeRef.current = 'photo';
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(10);
    setStage('analyzing_image');

    try {
      const serverUrl = await getServerUrl();
      const groqKey = await getGroqKey();

      const compressedUri = await compressIfNeeded(photoUri);
      const filename = (compressedUri.split('/').pop() ?? 'photo.jpg').replace(/[?#].*$/, '');
      const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

      const formData = new FormData();
      if (Platform.OS === 'web') {
        // On web, URIs are blob/data URLs — fetch + convert to real File
        const resp = await fetch(compressedUri);
        const blob = await resp.blob();
        formData.append('file', new File([blob], filename || 'photo.jpg', { type: mimeType }));
      } else {
        formData.append('file', { uri: compressedUri, name: filename, type: mimeType } as unknown as Blob);
      }

      const headers: Record<string, string> = {};
      if (groqKey) headers['x-groq-key'] = groqKey;

      const res = await fetch(`${serverUrl}/api/v1/extract/photo`, {
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
        <Text className="text-sm text-warm-500 dark:text-warm-400">
          {stage ? (STAGE_LABELS[stage] ?? stage) : 'Wird gestartet…'}
          {(stage === 'transcribing' || stage === 'analyzing_image' || stage === 'extracting') ? ' — bitte warten' : ''}
        </Text>
        <Text className="text-sm font-semibold text-primary-500">{progress}%</Text>
      </View>
      <View className="h-2 bg-warm-100 dark:bg-espresso-800 rounded-full overflow-hidden">
        <View
          className="h-full bg-primary-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  );

  // ── Bild-Review screen (nach Import) ──────────────────────────────────────
  if (recipeIdForImage) {
    return (
      <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
        {showImagePickerModal && (
          <ImagePickerModal
            images={imageSuggestions}
            initialQuery={recipeNameForImage}
            imageCount={imageCount}
            onSelect={async (selectedUrl) => {
              const sUrl = await getServerUrl();
              await fetch(`${sUrl}/api/v1/recipes/${recipeIdForImage}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: selectedUrl }),
              }).catch(() => {});
              const id = recipeIdForImage;
              reset();
              router.push(`/recipe/${id}` as never);
            }}
            onSkip={() => setShowImagePickerModal(false)}
          />
        )}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4">
          <View className="flex-1 items-center justify-center py-10">
            <CheckCircle size={40} color="#C84B31" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 mt-3 mb-6 text-center">
              Rezept gespeichert!
            </Text>

            {/* Bild-Vorschau */}
            <View className="w-full rounded-2xl overflow-hidden mb-6 bg-warm-100 dark:bg-espresso-800" style={{ aspectRatio: 16 / 9 }}>
              {recipeImageUrl ? (
                <Image source={{ uri: recipeImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center gap-2">
                  <UtensilsCrossed size={40} color="#9E8878" />
                  <Text className="text-warm-400 dark:text-warm-500 text-sm">Kein Bild gefunden</Text>
                </View>
              )}
            </View>

            {/* Aktionen */}
            <View className="flex-row gap-3 w-full mb-4">
              <Pressable
                onPress={() => {
                  const id = recipeIdForImage;
                  reset();
                  router.push(`/recipe/${id}` as never);
                }}
                className="flex-1 bg-primary-500 py-3.5 rounded-xl items-center"
              >
                <Text className="text-white font-semibold">Übernehmen</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowImagePickerModal(true)}
                className="flex-1 border border-warm-200 dark:border-warm-700 bg-white dark:bg-espresso-800 py-3.5 rounded-xl items-center"
              >
                <Text className="text-warm-700 dark:text-warm-200 font-semibold">Bearbeiten</Text>
              </Pressable>
            </View>

            <Pressable onPress={reset}>
              <Text className="text-warm-400 dark:text-warm-500 text-sm">Weiteres Rezept hinzufügen</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Success screen (Fallback wenn keine recipeId) ──────────────────────────
  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4">
          <View className="flex-1 items-center justify-center py-20">
            <CheckCircle size={64} color="#C84B31" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 mt-4 text-center">
              Rezept gespeichert!
            </Text>
            <Text className="text-warm-500 dark:text-warm-400 text-center mt-2 mb-8 leading-relaxed">
              Das Rezept wurde extrahiert und gespeichert.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  router.push('/(tabs)' as never);
                }}
                className="bg-primary-500 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">Zur Sammlung</Text>
              </Pressable>
              <Pressable
                onPress={reset}
                className="border border-warm-200 dark:border-warm-700 bg-white dark:bg-espresso-800 px-6 py-3 rounded-xl"
              >
                <Text className="text-warm-700 dark:text-warm-200 font-semibold">Weiteres Rezept</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">Rezept hinzufügen</Text>
          <Text className="text-warm-500 dark:text-warm-400 mt-1 text-sm">
            {mode === 'url'
              ? 'Füge eine URL ein — RecipeDeck extrahiert das Rezept automatisch.'
              : 'Foto eines Rezepts hochladen — KI erkennt Zutaten und Schritte.'}
          </Text>
        </View>

        {/* Mode switcher */}
        <View className="flex-row bg-white dark:bg-espresso-800 rounded-2xl p-1 mb-6 border border-warm-200 dark:border-warm-700 shadow-sm">
          <Pressable
            onPress={() => switchMode('url')}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              mode === 'url' ? 'bg-primary-500' : ''
            }`}
          >
            <Globe size={16} color={mode === 'url' ? '#fff' : '#9E8878'} />
            <Text className={`text-sm font-medium ${mode === 'url' ? 'text-white' : 'text-warm-500 dark:text-warm-400'}`}>
              URL
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('photo')}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
              mode === 'photo' ? 'bg-primary-500' : ''
            }`}
          >
            <Camera size={16} color={mode === 'photo' ? '#fff' : '#9E8878'} />
            <Text className={`text-sm font-medium ${mode === 'photo' ? 'text-white' : 'text-warm-500 dark:text-warm-400'}`}>
              Foto
            </Text>
          </Pressable>
        </View>

        {/* ── URL mode ── */}
        {mode === 'url' && (
          <View>
            <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 shadow-sm p-4 mb-4">
              <Text className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-3">
                Unterstützte Quellen
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['YouTube', 'Instagram', 'TikTok', 'Webseiten'].map((p) => (
                  <View key={p} className="bg-primary-50 dark:bg-espresso-700 rounded-full px-3 py-1">
                    <Text className="text-xs text-primary-500 font-medium">{p}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 shadow-sm p-4">
              <TextInput
                className="text-base text-warm-900 dark:text-warm-50 border border-warm-200 dark:border-warm-700 rounded-xl px-4 py-3 mb-2"
                placeholder="https://youtube.com/watch?v=…"
                placeholderTextColor="#9E8878"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />

              {/* DX-2: Time estimate based on URL type */}
              {(() => {
                const info = !isLoading && url.trim() ? detectUrlType(url.trim()) : null;
                return info ? (
                  <Text className="text-xs text-warm-400 dark:text-warm-500 mb-3 ml-1">
                    {info.label} erkannt · Geschätzte Dauer: {info.estimate}
                  </Text>
                ) : <View className="mb-3" />;
              })()}

              <Pressable
                onPress={handleUrlSubmit}
                disabled={isLoading || !url.trim()}
                className={`py-3.5 rounded-xl items-center ${
                  isLoading || !url.trim() ? 'bg-primary-200' : 'bg-primary-500'
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
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 shadow-sm p-4">
            {!photoUri ? (
              <View className="gap-3">
                <Pressable
                  onPress={pickFromCamera}
                  disabled={isLoading}
                  className="flex-row items-center gap-4 border-2 border-dashed border-warm-200 dark:border-warm-700 rounded-2xl p-6"
                >
                  <Camera size={32} color="#9E8878" />
                  <View>
                    <Text className="font-semibold text-warm-800 dark:text-warm-100">Kamera</Text>
                    <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Rezept fotografieren</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={pickFromGallery}
                  disabled={isLoading}
                  className="flex-row items-center gap-4 border-2 border-dashed border-warm-200 dark:border-warm-700 rounded-2xl p-6"
                >
                  <ImagePlus size={32} color="#9E8878" />
                  <View>
                    <Text className="font-semibold text-warm-800 dark:text-warm-100">Galerie</Text>
                    <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Foto aus der Galerie wählen</Text>
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
                    className="flex-1 py-3 rounded-xl border border-warm-200 dark:border-warm-700 items-center"
                  >
                    <Text className="text-warm-600 dark:text-warm-300 font-medium">Anderes Foto</Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePhotoSubmit}
                    disabled={isLoading}
                    className={`flex-1 py-3 rounded-xl items-center ${isLoading ? 'bg-primary-200' : 'bg-primary-500'}`}
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
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={reset}
                className="flex-1 border border-red-200 rounded-lg py-2 items-center"
              >
                <Text className="text-red-600 text-sm font-medium">Zurücksetzen</Text>
              </Pressable>
              {errorHint === 'byok' && (
                <Pressable
                  onPress={() => router.push('/(tabs)/settings' as never)}
                  className="flex-1 bg-primary-500 rounded-lg py-2 items-center"
                >
                  <Text className="text-white text-sm font-medium">API-Key hinzufügen</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
