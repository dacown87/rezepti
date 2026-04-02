import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Eye, EyeOff, Key, Server, Info, Trash2, Save, ScrollText, Map } from 'lucide-react-native';
import { getDB } from '@/db/migrate';
import { getServerUrl, PRODUCTION_URL, SERVER_URL_KEY } from '@/utils/server-url';

const SECURE_KEY_GROQ = 'groq_key';
const STORAGE_KEY_FB_TOS = 'facebook_tos_accepted';

// ── Roadmap data ──────────────────────────────────────────────────────────────

const ROADMAP = [
  {
    category: '📥 Import & Extraktion',
    items: [
      { label: 'Webseiten (allgemein)', percent: 80 },
      { label: 'YouTube', percent: 80 },
      { label: 'TikTok', percent: 70 },
      { label: 'Instagram', percent: 70 },
      { label: 'Chefkoch', percent: 40 },
      { label: 'Cookidoo', percent: 100 },
      { label: 'Pinterest', percent: 0 },
      { label: 'Facebook', percent: 60 },
      { label: 'Foto-Import', percent: 100 },
    ],
  },
  {
    category: '🍽️ Rezeptanzeige & Navigation',
    items: [
      { label: 'Rezeptliste & Detailansicht', percent: 100 },
      { label: 'Personenzahl & Skalierung', percent: 100 },
      { label: 'Fullscreen Koch-Modus', percent: 100 },
      { label: 'Zutatenbasierte Rezeptsuche', percent: 100 },
    ],
  },
  {
    category: '🛒 Einkauf & Planung',
    items: [
      { label: 'Einkaufsliste', percent: 100 },
      { label: 'Wochenplaner (7 Tage)', percent: 100 },
      { label: 'Rezeptvorschläge aus Zutaten', percent: 0 },
    ],
  },
  {
    category: '👥 Community & Sozial',
    items: [
      { label: 'Benutzer-Login', percent: 0 },
      { label: 'Bewertungsfunktion', percent: 100 },
      { label: 'Persönliche Notizen', percent: 100 },
      { label: 'QR-Code teilen', percent: 100 },
    ],
  },
  {
    category: '📱 Mobile & App',
    items: [
      { label: 'React Native App', percent: 40 },
      { label: 'iOS / Android', percent: 0 },
      { label: 'PWA (Web)', percent: 100 },
    ],
  },
];

// ── Changelog data (hardcoded, no network) ────────────────────────────────────

const CHANGELOG = [
  {
    version: '1.0.49',
    date: '2026-03-31',
    changes: ['Kamera-Fix: video-Element, mediaDevices Null-Check'],
  },
  {
    version: '1.0.48',
    date: '2026-03-31',
    changes: ['Logo.png zu public/ und frontend/public/ hinzugefügt'],
  },
  {
    version: '1.0.46',
    date: '2026-03-31',
    changes: ['Logo, Chefkoch image fixes, PDF redesign, QR scanner fixes'],
  },
  {
    version: '1.0.44',
    date: '2026-03-29',
    changes: ['Docker build Vite config fix'],
  },
  {
    version: '1.0.43',
    date: '2026-03-29',
    changes: ['Phase 5: Wochenplaner Drag & Drop'],
  },
  {
    version: '1.0.40',
    date: '2026-03-28',
    changes: ['Phase 4: QR-Code, PDF-Export, Zutatenbibliothek'],
  },
  {
    version: '1.0.35',
    date: '2026-03-27',
    changes: ['Phase 3: Einkaufsliste, Bewertung, Notizen, Kamera'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function barColor(percent: number): string {
  if (percent >= 60) return '#22c55e';
  if (percent >= 20) return '#facc15';
  return '#e5e7eb';
}

function maskedKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

// ── Roadmap Modal ─────────────────────────────────────────────────────────────

const RoadmapModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Modal
    visible
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
        <View>
          <Text className="text-xl font-bold text-gray-900">Roadmap</Text>
          <Text className="text-xs text-gray-400 mt-0.5">Entwicklungsstand RecipeDeck</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="bg-gray-100 rounded-full px-4 py-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm font-semibold text-gray-600">Schließen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-4 pb-8">
        {ROADMAP.map((section) => (
          <View key={section.category} className="mb-6">
            <Text className="text-base font-bold text-gray-800 mb-3">{section.category}</Text>
            <View className="space-y-3">
              {section.items.map((item) => (
                <View key={item.label}>
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-sm text-gray-600 flex-1 mr-2">{item.label}</Text>
                    <Text
                      className={`text-xs font-semibold ${
                        item.percent >= 60
                          ? 'text-green-600'
                          : item.percent >= 20
                          ? 'text-yellow-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {item.percent}%
                    </Text>
                  </View>
                  {/* Track */}
                  <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      style={{
                        width: `${item.percent}%`,
                        height: 6,
                        backgroundColor: barColor(item.percent),
                        borderRadius: 99,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

// ── Changelog Modal ───────────────────────────────────────────────────────────

const ChangelogModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Modal
    visible
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
        <View>
          <Text className="text-xl font-bold text-gray-900">Changelog</Text>
          <Text className="text-xs text-gray-400 mt-0.5">Letzte Änderungen</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="bg-gray-100 rounded-full px-4 py-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm font-semibold text-gray-600">Schließen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-4 pb-8">
        {CHANGELOG.map((entry) => (
          <View key={entry.version} className="mb-5">
            <View className="flex-row items-center mb-2">
              <View className="bg-blue-100 rounded-full px-3 py-1 mr-3">
                <Text className="text-xs font-bold text-blue-700">v{entry.version}</Text>
              </View>
              <Text className="text-xs text-gray-400">{entry.date}</Text>
            </View>
            <View className="ml-1 space-y-1">
              {entry.changes.map((change, idx) => (
                <View key={idx} className="flex-row items-start">
                  <Text className="text-gray-400 mr-2 text-sm">•</Text>
                  <Text className="text-sm text-gray-700 flex-1">{change}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  // GROQ API Key
  const [groqKey, setGroqKey] = useState('');
  const [groqKeyStored, setGroqKeyStored] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savingGroqKey, setSavingGroqKey] = useState(false);

  // Server URL
  const [serverUrl, setServerUrl] = useState('');
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  // Cookidoo
  const [cookidooEmail, setCookidooEmail] = useState('');
  const [cookidooPassword, setCookidooPassword] = useState('');
  const [showCookidooPassword, setShowCookidooPassword] = useState(false);
  const [cookidooConnected, setCookidooConnected] = useState(false);
  const [cookidooConnectedEmail, setCookidooConnectedEmail] = useState<string | null>(null);
  const [savingCookidoo, setSavingCookidoo] = useState(false);
  const [loadingCookidooStatus, setLoadingCookidooStatus] = useState(true);

  // Facebook
  const [facebookTosAccepted, setFacebookTosAccepted] = useState(false);

  // Modals
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  // App info
  const [recipeCount, setRecipeCount] = useState<number | null>(null);

  // ── Load on mount ─────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    // GROQ key
    try {
      const storedKey = await SecureStore.getItemAsync(SECURE_KEY_GROQ);
      if (storedKey) {
        setGroqKey(storedKey);
        setGroqKeyStored(true);
      }
    } catch {
      // SecureStore unavailable — silently ignore
    }

    // Server URL
    try {
      const storedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
      if (storedUrl) setServerUrl(storedUrl);
    } catch {
      // Ignore
    }

    // Facebook TOS
    try {
      const fbTos = await AsyncStorage.getItem(STORAGE_KEY_FB_TOS);
      setFacebookTosAccepted(fbTos === 'true');
    } catch {
      // Ignore
    }

    // Recipe count
    try {
      const row = await getDB().getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM recipes'
      );
      setRecipeCount(row?.count ?? 0);
    } catch {
      setRecipeCount(null);
    }
  }, []);

  const loadCookidooStatus = useCallback(async () => {
    setLoadingCookidooStatus(true);
    try {
      const base = await getServerUrl();
      const res = await fetch(`${base}/api/v1/cookidoo/status`);
      if (res.ok) {
        const data = await res.json();
        setCookidooConnected(data.connected ?? false);
        setCookidooConnectedEmail(data.email ?? null);
        if (data.email) setCookidooEmail(data.email);
      }
    } catch {
      // Server not reachable — treat as disconnected
    } finally {
      setLoadingCookidooStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadCookidooStatus();
  }, [loadSettings, loadCookidooStatus]);

  // ── GROQ Key handlers ─────────────────────────────────────────────────────────

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

  // ── Server URL handlers ───────────────────────────────────────────────────────

  const handleSaveServerUrl = async () => {
    const trimmed = serverUrl.trim();
    setSavingServerUrl(true);
    try {
      if (trimmed) {
        await AsyncStorage.setItem(SERVER_URL_KEY, trimmed);
      } else {
        await AsyncStorage.removeItem(SERVER_URL_KEY);
      }
      Alert.alert(
        'Gespeichert',
        trimmed ? 'Server-URL wurde gespeichert.' : 'Standard-Server wird verwendet.'
      );
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
              await AsyncStorage.removeItem(SERVER_URL_KEY);
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

  // ── Cookidoo handlers ─────────────────────────────────────────────────────────

  const handleSaveCookidoo = async () => {
    if (!cookidooEmail.trim() || !cookidooPassword.trim()) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setSavingCookidoo(true);
    try {
      const base = await getServerUrl();
      const res = await fetch(`${base}/api/v1/cookidoo/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cookidooEmail.trim(), password: cookidooPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Refresh status
      await loadCookidooStatus();
      setCookidooPassword('');
      Alert.alert('Verbunden', 'Cookidoo-Zugangsdaten wurden gespeichert.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Zugangsdaten konnten nicht gespeichert werden.');
    } finally {
      setSavingCookidoo(false);
    }
  };

  const handleDisconnectCookidoo = () => {
    Alert.alert(
      'Trennen',
      'Möchtest du die Cookidoo-Verbindung wirklich trennen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Trennen',
          style: 'destructive',
          onPress: async () => {
            try {
              const base = await getServerUrl();
              await fetch(`${base}/api/v1/cookidoo/credentials`, { method: 'DELETE' });
              setCookidooConnected(false);
              setCookidooConnectedEmail(null);
              setCookidooEmail('');
              setCookidooPassword('');
            } catch {
              Alert.alert('Fehler', 'Trennung fehlgeschlagen.');
            }
          },
        },
      ]
    );
  };

  // ── Facebook TOS handler ──────────────────────────────────────────────────────

  const handleFacebookTosToggle = async (accepted: boolean) => {
    setFacebookTosAccepted(accepted);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FB_TOS, accepted ? 'true' : 'false');
    } catch {
      // Ignore
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Einstellungen</Text>
          <Text className="text-gray-500 mt-1">API-Keys, Server & Integrationen</Text>
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
              Aktuell gespeichert:{' '}
              <Text className="font-mono">{maskedKey(groqKey)}</Text>
            </Text>
          )}

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
            Leer lassen für Standard-Server ({PRODUCTION_URL.replace('https://', '')})
          </Text>

          <View className="border border-gray-200 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="px-4 py-3 text-sm text-gray-900"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder={PRODUCTION_URL}
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

        {/* ── Cookidoo ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">🍳</Text>
            <Text className="text-base font-semibold text-gray-800 ml-1">Cookidoo</Text>
            {loadingCookidooStatus ? (
              <ActivityIndicator size="small" color="#9CA3AF" style={{ marginLeft: 'auto' }} />
            ) : cookidooConnected ? (
              <View className="ml-auto bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-700 font-medium">Verbunden</Text>
              </View>
            ) : (
              <View className="ml-auto bg-yellow-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-yellow-700 font-medium">Nicht verbunden</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Zugangsdaten für Cookidoo (Thermomix)
          </Text>

          {cookidooConnected && cookidooConnectedEmail ? (
            /* Connected state */
            <View>
              <View className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                <Text className="text-sm text-green-700 font-medium">
                  Verbunden als {cookidooConnectedEmail}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleDisconnectCookidoo}
                className="flex-row items-center justify-center rounded-xl py-3 bg-red-50 border border-red-200"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">Trennen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Disconnected — show input form */
            <View>
              <View className="border border-gray-200 rounded-xl overflow-hidden mb-2">
                <TextInput
                  className="px-4 py-3 text-sm text-gray-900"
                  value={cookidooEmail}
                  onChangeText={setCookidooEmail}
                  placeholder="deine@email.de"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden mb-3">
                <TextInput
                  className="flex-1 px-4 py-3 text-sm text-gray-900"
                  value={cookidooPassword}
                  onChangeText={setCookidooPassword}
                  placeholder="Passwort"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showCookidooPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowCookidooPassword((v) => !v)}
                  className="px-3 py-3"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showCookidooPassword
                    ? <EyeOff size={18} color="#6B7280" />
                    : <Eye size={18} color="#6B7280" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleSaveCookidoo}
                disabled={savingCookidoo || !cookidooEmail.trim() || !cookidooPassword.trim()}
                className={`flex-row items-center justify-center rounded-xl py-3 ${
                  savingCookidoo || !cookidooEmail.trim() || !cookidooPassword.trim()
                    ? 'bg-blue-300'
                    : 'bg-blue-600'
                }`}
              >
                {savingCookidoo
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Save size={16} color="#fff" />}
                <Text className="text-white font-semibold text-sm ml-2">Verbinden</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="text-xs text-gray-400 mt-3">
            Zugangsdaten werden nur auf dem Server gespeichert.
          </Text>
        </View>

        {/* ── Facebook ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">📘</Text>
            <Text className="text-base font-semibold text-gray-800 ml-1">Facebook Import</Text>
            <View
              className={`ml-auto rounded-full px-2 py-0.5 ${
                facebookTosAccepted ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  facebookTosAccepted ? 'text-green-700' : 'text-gray-500'
                }`}
              >
                {facebookTosAccepted ? 'Aktiv' : 'Deaktiviert'}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-400 mb-4">
            Öffentliche Videos und Reels importieren
          </Text>

          {!facebookTosAccepted && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <Text className="text-xs text-yellow-800 font-medium mb-1">
                Facebook-Extraktion erfordert Akzeptanz der Nutzungsbedingungen
              </Text>
              <Text className="text-xs text-yellow-700">
                Facebooks ToS verbieten automatisiertes Scraping. Nur öffentliche Videos, max. 1
                Anfrage/Minute.
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-sm font-medium text-gray-700">
                Ich akzeptiere die Facebook-Nutzungsbedingungen
              </Text>
              {facebookTosAccepted && (
                <Text className="text-xs text-green-600 mt-0.5">
                  Facebook-Import aktiviert (URL-Extraktion via Server)
                </Text>
              )}
            </View>
            <Switch
              value={facebookTosAccepted}
              onValueChange={handleFacebookTosToggle}
              trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
              thumbColor={facebookTosAccepted ? '#16A34A' : '#9CA3AF'}
            />
          </View>

          <Text className="text-xs text-gray-400 mt-3">
            Cookie-Upload ist auf Mobile nicht verfügbar (Web-only Feature).
          </Text>
        </View>

        {/* ── App Info ── */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <View className="flex-row items-center mb-4">
            <Info size={18} color="#4B5563" />
            <Text className="text-base font-semibold text-gray-800 ml-2">App-Info</Text>

            {/* Roadmap + Changelog buttons */}
            <View className="ml-auto flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowChangelog(true)}
                className="flex-row items-center bg-gray-100 rounded-full px-3 py-1.5"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <ScrollText size={14} color="#4B5563" />
                <Text className="text-xs font-medium text-gray-600 ml-1">Changelog</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRoadmap(true)}
                className="flex-row items-center bg-gray-100 rounded-full px-3 py-1.5"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Map size={14} color="#4B5563" />
                <Text className="text-xs font-medium text-gray-600 ml-1">Roadmap</Text>
              </TouchableOpacity>
            </View>
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
                {recipeCount === null
                  ? '–'
                  : `${recipeCount} Rezept${recipeCount === 1 ? '' : 'e'}`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
