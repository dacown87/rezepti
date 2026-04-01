import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Eye, EyeOff, Key, Server, Info, Trash2, Save } from 'lucide-react-native';
import { getDB } from '@/db/migrate';

const SECURE_KEY_GROQ = 'groq_key';
const STORAGE_KEY_SERVER_URL = 'recipedeck_server_url';
const DEFAULT_SERVER_URL = 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run';

export default function SettingsScreen() {
  // GROQ API Key
  const [groqKey, setGroqKey] = useState('');
  const [groqKeyStored, setGroqKeyStored] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savingGroqKey, setSavingGroqKey] = useState(false);

  // Server URL
  const [serverUrl, setServerUrl] = useState('');
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  // App info
  const [recipeCount, setRecipeCount] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    // Load GROQ key from SecureStore
    try {
      const storedKey = await SecureStore.getItemAsync(SECURE_KEY_GROQ);
      if (storedKey) {
        setGroqKey(storedKey);
        setGroqKeyStored(true);
      }
    } catch {
      // SecureStore not available or key missing — silently ignore
    }

    // Load server URL from AsyncStorage
    try {
      const storedUrl = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
      if (storedUrl) {
        setServerUrl(storedUrl);
      }
    } catch {
      // Ignore
    }

    // Load recipe count
    try {
      const row = await getDB().getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM recipes'
      );
      setRecipeCount(row?.count ?? 0);
    } catch {
      setRecipeCount(null);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // --- GROQ Key handlers ---

  const handleSaveGroqKey = async () => {
    const trimmed = groqKey.trim();
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte einen API-Key eingeben.');
      return;
    }
    setSavingGroqKey(true);
    try {
      await SecureStore.setItemAsync(SECURE_KEY_GROQ, trimmed);
      setGroqKeyStored(true);
      Alert.alert('Gespeichert', 'Dein Groq API-Key wurde sicher auf dem Gerät gespeichert.');
    } catch {
      Alert.alert('Fehler', 'Der API-Key konnte nicht gespeichert werden.');
    } finally {
      setSavingGroqKey(false);
    }
  };

  const handleRemoveGroqKey = () => {
    Alert.alert(
      'Key entfernen',
      'Möchtest du den Groq API-Key wirklich entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(SECURE_KEY_GROQ);
              setGroqKey('');
              setGroqKeyStored(false);
            } catch {
              Alert.alert('Fehler', 'Der Key konnte nicht entfernt werden.');
            }
          },
        },
      ]
    );
  };

  // --- Server URL handlers ---

  const handleSaveServerUrl = async () => {
    const trimmed = serverUrl.trim();
    setSavingServerUrl(true);
    try {
      if (trimmed) {
        await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, trimmed);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY_SERVER_URL);
      }
      Alert.alert('Gespeichert', trimmed ? 'Server-URL wurde gespeichert.' : 'Standard-Server wird verwendet.');
    } catch {
      Alert.alert('Fehler', 'Die Server-URL konnte nicht gespeichert werden.');
    } finally {
      setSavingServerUrl(false);
    }
  };

  const handleResetServerUrl = () => {
    Alert.alert(
      'Zurücksetzen',
      'Möchtest du die Server-URL zurücksetzen und den Standard-Server verwenden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY_SERVER_URL);
              setServerUrl('');
              Alert.alert('Zurückgesetzt', 'Standard-Server wird jetzt verwendet.');
            } catch {
              Alert.alert('Fehler', 'Die URL konnte nicht zurückgesetzt werden.');
            }
          },
        },
      ]
    );
  };

  // --- Helpers ---

  const maskedKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Einstellungen</Text>
          <Text className="text-gray-500 mt-1">API-Keys und Server-Konfiguration</Text>
        </View>

        {/* ── GROQ API Key ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Key size={18} color="#4B5563" />
            <Text className="text-base font-semibold text-gray-800 ml-2">Groq API-Key</Text>
            {groqKeyStored && (
              <View className="ml-auto bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-700 font-medium">Gespeichert</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Dein Key wird sicher auf dem Gerät gespeichert (SecureStore).
          </Text>

          {/* Input row */}
          <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="flex-1 px-4 py-3 text-sm text-gray-900 font-mono"
              value={groqKey}
              onChangeText={setGroqKey}
              placeholder="gsk_..."
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showGroqKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowGroqKey((v) => !v)}
              className="px-3 py-3"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showGroqKey
                ? <EyeOff size={18} color="#6B7280" />
                : <Eye size={18} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          {groqKeyStored && (
            <Text className="text-xs text-gray-400 mb-3">
              Aktuell gespeichert: <Text className="font-mono">{maskedKey(groqKey)}</Text>
            </Text>
          )}

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleSaveGroqKey}
              disabled={savingGroqKey || !groqKey.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                savingGroqKey || !groqKey.trim() ? 'bg-blue-300' : 'bg-blue-600'
              }`}
            >
              {savingGroqKey
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={16} color="#fff" />}
              <Text className="text-white font-semibold text-sm ml-2">Speichern</Text>
            </TouchableOpacity>

            {groqKeyStored && (
              <TouchableOpacity
                onPress={handleRemoveGroqKey}
                className="flex-row items-center justify-center rounded-xl py-3 px-4 bg-red-50 border border-red-200"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">Entfernen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Server URL ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Server size={18} color="#4B5563" />
            <Text className="text-base font-semibold text-gray-800 ml-2">Server-URL</Text>
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Leer lassen für Standard-Server ({DEFAULT_SERVER_URL.replace('https://', '')})
          </Text>

          <View className="border border-gray-200 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="px-4 py-3 text-sm text-gray-900"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder={DEFAULT_SERVER_URL}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleSaveServerUrl}
              disabled={savingServerUrl}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                savingServerUrl ? 'bg-blue-300' : 'bg-blue-600'
              }`}
            >
              {savingServerUrl
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={16} color="#fff" />}
              <Text className="text-white font-semibold text-sm ml-2">Speichern</Text>
            </TouchableOpacity>

            {serverUrl.trim().length > 0 && (
              <TouchableOpacity
                onPress={handleResetServerUrl}
                className="flex-row items-center justify-center rounded-xl py-3 px-4 bg-red-50 border border-red-200"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">Zurücksetzen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── App Info ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <View className="flex-row items-center mb-4">
            <Info size={18} color="#4B5563" />
            <Text className="text-base font-semibold text-gray-800 ml-2">App-Info</Text>
          </View>

          <View className="space-y-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">App</Text>
              <Text className="text-sm font-semibold text-gray-900">RecipeDeck v1.0</Text>
            </View>

            <View className="h-px bg-gray-100" />

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">Beschreibung</Text>
              <Text className="text-sm text-gray-700 flex-shrink ml-4 text-right">
                Rezepte aus URLs extrahieren
              </Text>
            </View>

            <View className="h-px bg-gray-100" />

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">Datenbank</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {recipeCount === null ? '–' : `${recipeCount} Rezept${recipeCount === 1 ? '' : 'e'}`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
