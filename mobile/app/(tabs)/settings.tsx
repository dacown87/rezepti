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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Eye, EyeOff, Key, Server, Info, Trash2, Save, ScrollText, Map, HelpCircle, X, ExternalLink, Sun, Moon, User, Shield } from 'lucide-react-native';
import { useTheme } from '@/utils/use-theme';
import { getAuthSession, getSupabaseClient } from '@/utils/auth';
import { fetchAuthMe } from '@/utils/admin';
import {
  deleteCookidooHouseholdShare,
  deletePrivateCookidooCredentials,
  fetchCookidooStatus,
  savePrivateCookidooCredentials,
  shareCookidooCredentials,
  type CookidooStatusResponse,
} from '@/utils/cookidoo-settings';
import { getServerUrl, PRODUCTION_URL, SERVER_URL_KEY } from '@/utils/server-url';
import { usePwaUpdate } from '@/hooks/usePwaUpdate';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { usePushSubscription } from '@/hooks/usePushSubscription';

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
    <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-warm-200 dark:border-warm-700">
        <View>
          <Text className="text-xl font-bold text-warm-900 dark:text-warm-50">Roadmap</Text>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Entwicklungsstand RecipeDeck</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="bg-warm-100 dark:bg-espresso-800 rounded-full px-4 py-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm font-semibold text-warm-600 dark:text-warm-300">Schließen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-4 pb-8">
        {ROADMAP.map((section) => (
          <View key={section.category} className="mb-6">
            <Text className="text-base font-bold text-warm-800 dark:text-warm-100 mb-3">{section.category}</Text>
            <View className="space-y-3">
              {section.items.map((item) => (
                <View key={item.label}>
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-sm text-warm-600 dark:text-warm-300 flex-1 mr-2">{item.label}</Text>
                    <Text
                      className={`text-xs font-semibold ${
                        item.percent >= 60
                          ? 'text-green-600'
                          : item.percent >= 20
                          ? 'text-yellow-600'
                          : 'text-warm-500 dark:text-warm-400'
                      }`}
                    >
                      {item.percent}%
                    </Text>
                  </View>
                  {/* Track */}
                  <View className="h-1.5 bg-warm-100 dark:bg-espresso-800 rounded-full overflow-hidden">
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
    <SafeAreaView className="flex-1 bg-white dark:bg-espresso-800">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-warm-200 dark:border-warm-700">
        <View>
          <Text className="text-xl font-bold text-warm-900 dark:text-warm-50">Changelog</Text>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Letzte Änderungen</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="bg-warm-100 dark:bg-espresso-800 rounded-full px-4 py-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm font-semibold text-warm-600 dark:text-warm-300">Schließen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-4 pb-8">
        {CHANGELOG.map((entry) => (
          <View key={entry.version} className="mb-5">
            <View className="flex-row items-center mb-2">
              <View className="bg-blue-100 rounded-full px-3 py-1 mr-3">
                <Text className="text-xs font-bold text-blue-700">v{entry.version}</Text>
              </View>
              <Text className="text-xs text-warm-500 dark:text-warm-400">{entry.date}</Text>
            </View>
            <View className="ml-1 space-y-1">
              {entry.changes.map((change, idx) => (
                <View key={idx} className="flex-row items-start">
                  <Text className="text-warm-500 dark:text-warm-400 mr-2 text-sm">•</Text>
                  <Text className="text-sm text-warm-700 dark:text-warm-200 flex-1">{change}</Text>
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
  // Theme
  const { isDark, setTheme } = useTheme();

  // Account
  const [authSessionEmail, setAuthSessionEmail] = useState<string | null>(null);
  const [authAppRole, setAuthAppRole] = useState<'admin' | 'user' | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authConfigured, setAuthConfigured] = useState(false);

  // GROQ API Key
  const [groqKey, setGroqKey] = useState('');
  const [groqKeyStored, setGroqKeyStored] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savingGroqKey, setSavingGroqKey] = useState(false);
  const [showGroqHelp, setShowGroqHelp] = useState(false);

  // Server URL
  const [serverUrl, setServerUrl] = useState('');
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  // Cookidoo
  const [cookidooEmail, setCookidooEmail] = useState('');
  const [cookidooPassword, setCookidooPassword] = useState('');
  const [showCookidooPassword, setShowCookidooPassword] = useState(false);
  const [cookidooConnected, setCookidooConnected] = useState(false);
  const [cookidooScope, setCookidooScope] = useState<CookidooStatusResponse['scope']>('none');
  const [cookidooSharedByCurrentHousehold, setCookidooSharedByCurrentHousehold] = useState(false);
  const [cookidooCanManageHouseholdShare, setCookidooCanManageHouseholdShare] = useState(false);
  const [savingCookidoo, setSavingCookidoo] = useState(false);
  const [loadingCookidooStatus, setLoadingCookidooStatus] = useState(true);

  // Facebook
  const [facebookTosAccepted, setFacebookTosAccepted] = useState(false);

  // Image search count
  const [imageSearchCount, setImageSearchCount] = useState<4 | 8 | 16>(4);

  // PWA
  const { updateReady, applyUpdate } = usePwaUpdate();
  const { canInstall, install, showIOSHint } = usePwaInstall();

  // Push notifications
  const {
    supported: pushSupported,
    enabled: pushEnabled,
    loading: pushLoading,
    denied: pushDenied,
    iosNeedsInstall: pushIosNeedsInstall,
    toggle: togglePush,
  } = usePushSubscription(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '');

  // Modals
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  // App info
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ date: string; time: string } | null>(null);

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

    // Image search count
    try {
      const countStr = await AsyncStorage.getItem('image_search_count');
      const n = parseInt(countStr ?? '4', 10);
      if (n === 8 || n === 16) setImageSearchCount(n);
    } catch {
      // Ignore
    }

    // Recipe count from server health endpoint
    try {
      const base = await getServerUrl();
      const res = await fetch(`${base}/api/v1/health`);
      if (res.ok) {
        const data = await res.json();
        setRecipeCount(data.recipeCount ?? 0);
      }
    } catch {
      setRecipeCount(null);
    }

    // Last build timestamp from server
    try {
      const base = await getServerUrl();
      const res = await fetch(`${base}/changelog.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.lastUpdated?.date && data.lastUpdated?.time) {
          setLastUpdated({ date: data.lastUpdated.date, time: data.lastUpdated.time });
        }
      }
    } catch {
      // Server nicht erreichbar — kein Problem
    }
  }, []);

  const loadAuthSession = useCallback(async () => {
    setAuthConfigured(getSupabaseClient() !== null);
    setAuthLoading(true);
    try {
      const session = await getAuthSession();
      setAuthSessionEmail(session?.user.email ?? null);
      if (session?.user) {
        try {
          const me = await fetchAuthMe();
          setAuthAppRole(me.appRole);
        } catch {
          setAuthAppRole(null);
        }
      } else {
        setAuthAppRole(null);
      }
    } catch {
      setAuthSessionEmail(null);
      setAuthAppRole(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadCookidooStatus = useCallback(async () => {
    setLoadingCookidooStatus(true);
    try {
      const data = await fetchCookidooStatus();
      setCookidooConnected(data.connected ?? false);
      setCookidooScope(data.scope ?? 'none');
      setCookidooSharedByCurrentHousehold(data.sharedByCurrentHousehold ?? false);
      setCookidooCanManageHouseholdShare(data.canManageHouseholdShare ?? false);
    } catch {
      // Server not reachable — treat as disconnected
      setCookidooConnected(false);
      setCookidooScope('none');
      setCookidooSharedByCurrentHousehold(false);
      setCookidooCanManageHouseholdShare(false);
    } finally {
      setLoadingCookidooStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadAuthSession();
    loadCookidooStatus();
  }, [loadSettings, loadAuthSession, loadCookidooStatus]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return undefined;

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setAuthSessionEmail(session?.user.email ?? null);
      if (session?.user) {
        void fetchAuthMe().then((me) => {
          setAuthAppRole(me.appRole);
        }).catch(() => {
          setAuthAppRole(null);
        });
      } else {
        setAuthAppRole(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

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
      await savePrivateCookidooCredentials(cookidooEmail.trim(), cookidooPassword);
      await loadCookidooStatus();
      setCookidooPassword('');
      Alert.alert('Gespeichert', 'Deine Cookidoo-Zugangsdaten sind jetzt privat gespeichert.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Zugangsdaten konnten nicht gespeichert werden.');
    } finally {
      setSavingCookidoo(false);
    }
  };

  const handleDisconnectCookidoo = () => {
    Alert.alert(
      'Private Verbindung trennen',
      'Möchtest du deine privaten Cookidoo-Zugangsdaten wirklich entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Trennen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePrivateCookidooCredentials();
              setCookidooEmail('');
              setCookidooPassword('');
              await loadCookidooStatus();
            } catch {
              Alert.alert('Fehler', 'Trennung fehlgeschlagen.');
            }
          },
        },
      ]
    );
  };

  const handleShareCookidoo = async () => {
    setSavingCookidoo(true);
    try {
      await shareCookidooCredentials();
      await loadCookidooStatus();
      Alert.alert('Freigegeben', 'Deine privaten Cookidoo-Zugangsdaten sind jetzt für den Haushalt freigegeben.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Haushaltsfreigabe fehlgeschlagen.');
    } finally {
      setSavingCookidoo(false);
    }
  };

  const handleRemoveCookidooShare = () => {
    Alert.alert(
      'Haushaltsfreigabe entfernen',
      'Möchtest du die Cookidoo-Freigabe für den Haushalt wirklich entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCookidooHouseholdShare();
              await loadCookidooStatus();
            } catch (e: any) {
              Alert.alert('Fehler', e.message || 'Haushaltsfreigabe konnte nicht entfernt werden.');
            }
          },
        },
      ],
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

  // ── Image search count handler ────────────────────────────────────────────────

  const handleImageSearchCount = async (count: 4 | 8 | 16) => {
    setImageSearchCount(count);
    try {
      await AsyncStorage.setItem('image_search_count', String(count));
    } catch {
      // Ignore
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">Einstellungen</Text>
          <Text className="text-warm-500 dark:text-warm-400 mt-1">API-Keys, Server & Integrationen</Text>
        </View>

        {authAppRole === 'admin' && (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
            <View className="flex-row items-center mb-2">
              <Shield size={18} color="#8B7355" />
              <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Admin</Text>
              <View className="ml-auto bg-blue-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-blue-700 font-medium">Operator</Text>
              </View>
            </View>
            <Text className="text-sm text-warm-600 dark:text-warm-300 mb-4">
              Globaler Admin-Bereich für Runtime-Policies und spätere Bug-Reporting-Übersichten.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              className="bg-blue-600 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold">Admin Hub öffnen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Account ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <User size={18} color="#8B7355" />
              <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Account</Text>
            </View>
            {authLoading ? (
              <ActivityIndicator size="small" color="#C84B31" />
            ) : authSessionEmail ? (
              <View className="bg-green-100 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-green-700">Aktiv</Text>
              </View>
            ) : (
              <View className="bg-warm-100 dark:bg-espresso-700 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-warm-600 dark:text-warm-300">Nicht angemeldet</Text>
              </View>
            )}
          </View>

          {!authConfigured ? (
            <Text className="text-sm text-warm-600 dark:text-warm-300 leading-5">
              Supabase Auth ist noch nicht konfiguriert.
            </Text>
          ) : (
            <>
              <Text className="text-sm text-warm-600 dark:text-warm-300 mb-1">
                {authSessionEmail ?? 'Öffne den dedizierten Account-&-Workspace-Screen für Login, Signup, Passwort-Reset und Bootstrap.'}
              </Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
                Settings bleibt ein Einstiegspunkt, aber die primäre Auth-Oberfläche liegt jetzt separat.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/account')}
                className="bg-primary-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold">
                  {authSessionEmail ? 'Account & Workspace öffnen' : 'Anmelden oder Account erstellen'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── GROQ Help Modal ── */}
        <Modal visible={showGroqHelp} transparent animationType="fade" onRequestClose={() => setShowGroqHelp(false)}>
          <Pressable className="flex-1 bg-black/50 justify-center items-center px-6" onPress={() => setShowGroqHelp(false)}>
            <Pressable className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full max-w-sm" onPress={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-bold text-warm-900 dark:text-warm-50">Was ist der Groq API-Key?</Text>
                <TouchableOpacity onPress={() => setShowGroqHelp(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color="#9E8878" />
                </TouchableOpacity>
              </View>
              <Text className="text-sm text-warm-600 dark:text-warm-300 leading-6 mb-3">
                RecipeDeck nutzt <Text className="font-semibold text-warm-900 dark:text-warm-50">Groq</Text> als KI-Backend, um Rezepte aus Videos, Webseiten und Fotos zu extrahieren und ins Deutsche zu übersetzen.
              </Text>
              <Text className="text-sm text-warm-600 dark:text-warm-300 leading-6 mb-3">
                Ein Groq API-Key ist <Text className="font-semibold text-green-700">kostenlos</Text> und kann unter{' '}
                <Text className="font-semibold text-blue-600">console.groq.com</Text>{' '}
                in wenigen Sekunden erstellt werden.
              </Text>
              <View className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                <Text className="text-xs text-blue-700 leading-5">
                  1. console.groq.com öffnen{'\n'}
                  2. Kostenlosen Account erstellen{'\n'}
                  3. „API Keys" → „Create API Key"{'\n'}
                  4. Key hier einfügen und speichern
                </Text>
              </View>
              <Text className="text-xs text-warm-500 dark:text-warm-400 leading-5">
                Der Key wird lokal auf deinem Gerät gespeichert und bei Anfragen an Groq übermittelt.
              </Text>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Erscheinungsbild ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-4">
            {isDark ? <Moon size={18} color="#8B7355" /> : <Sun size={18} color="#8B7355" />}
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Erscheinungsbild</Text>
          </View>
          <View className="flex-row bg-warm-100 dark:bg-espresso-800 rounded-xl p-1">
            <Pressable
              onPress={() => setTheme('light')}
              className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-lg ${!isDark ? 'bg-white dark:bg-espresso-800 shadow-sm' : ''}`}
            >
              <Sun size={16} color={!isDark ? '#C84B31' : '#9E8878'} />
              <Text className={`text-sm font-medium ${!isDark ? 'text-primary-500' : 'text-warm-500 dark:text-warm-400'}`}>
                Hell
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme('dark')}
              className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-lg ${isDark ? 'bg-warm-800 shadow-sm' : ''}`}
            >
              <Moon size={16} color={isDark ? '#FFFBF5' : '#9E8878'} />
              <Text className={`text-sm font-medium ${isDark ? 'text-warm-50' : 'text-warm-500 dark:text-warm-400'}`}>
                Dunkel
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── GROQ API Key ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Key size={18} color="#8B7355" />
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Groq API-Key</Text>
            <TouchableOpacity
              onPress={() => setShowGroqHelp(true)}
              className="ml-2 flex-row items-center bg-warm-100 dark:bg-espresso-800 rounded-full px-2.5 py-1"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <HelpCircle size={14} color="#9E8878" />
              <Text className="text-xs text-warm-500 dark:text-warm-400 font-medium ml-1">Hilfe</Text>
            </TouchableOpacity>
            {groqKeyStored && (
              <View className="ml-auto bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-700 font-medium">Gespeichert</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
            Dein Key wird auf dem Gerät gespeichert (SecureStore) und bei Anfragen an Groq übermittelt.
          </Text>

          <View className="flex-row items-center border border-warm-200 dark:border-warm-700 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="flex-1 px-4 py-3 text-sm text-warm-900 dark:text-warm-50 font-mono"
              value={groqKey}
              onChangeText={setGroqKey}
              placeholder="gsk_..."
              placeholderTextColor="#9E8878"
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
                ? <EyeOff size={18} color="#9E8878" />
                : <Eye size={18} color="#9E8878" />}
            </TouchableOpacity>
          </View>

          {groqKeyStored && (
            <Text className="text-xs text-warm-500 dark:text-warm-400 mb-3">
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
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Server size={18} color="#8B7355" />
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Server-URL</Text>
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
            Leer lassen für Standard-Server ({PRODUCTION_URL.replace('https://', '')})
          </Text>

          <View className="border border-warm-200 dark:border-warm-700 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="px-4 py-3 text-sm text-warm-900 dark:text-warm-50"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder={PRODUCTION_URL}
              placeholderTextColor="#9E8878"
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
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">🍳</Text>
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-1">Cookidoo</Text>
            {loadingCookidooStatus ? (
              <ActivityIndicator size="small" color="#9E8878" style={{ marginLeft: 'auto' }} />
            ) : cookidooScope === 'user' ? (
              <View className="ml-auto bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-700 font-medium">Privat verbunden</Text>
              </View>
            ) : cookidooScope === 'household' ? (
              <View className="ml-auto bg-blue-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-blue-700 font-medium">Über Haushalt verbunden</Text>
              </View>
            ) : (
              <View className="ml-auto bg-yellow-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-yellow-700 font-medium">Nicht verbunden</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
            Private Cookidoo-Zugangsdaten pro Account mit optionaler Haushaltsfreigabe
          </Text>

          <View className="bg-warm-50 dark:bg-espresso-900 border border-warm-200 dark:border-warm-700 rounded-xl p-3 mb-3">
            <Text className="text-sm text-warm-800 dark:text-warm-100 font-medium mb-1">Privat</Text>
            <Text className="text-xs text-warm-500 dark:text-warm-400">
              Deine Cookidoo-Zugangsdaten sind privat.
            </Text>
          </View>

          {cookidooScope === 'user' && (
            <View className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
              <Text className="text-sm text-green-700 font-medium">Privat verbunden</Text>
            </View>
          )}

          {cookidooScope === 'household' && (
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
              <Text className="text-sm text-blue-700 font-medium">Über Haushalt verbunden</Text>
            </View>
          )}

          <View className="border border-warm-200 dark:border-warm-700 rounded-xl overflow-hidden mb-2">
            <TextInput
              className="px-4 py-3 text-sm text-warm-900 dark:text-warm-50"
              value={cookidooEmail}
              onChangeText={setCookidooEmail}
              placeholder="deine@email.de"
              placeholderTextColor="#9E8878"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View className="flex-row items-center border border-warm-200 dark:border-warm-700 rounded-xl overflow-hidden mb-3">
            <TextInput
              className="flex-1 px-4 py-3 text-sm text-warm-900 dark:text-warm-50"
              value={cookidooPassword}
              onChangeText={setCookidooPassword}
              placeholder="Passwort"
              placeholderTextColor="#9E8878"
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
                ? <EyeOff size={18} color="#9E8878" />
                : <Eye size={18} color="#9E8878" />}
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={handleSaveCookidoo}
              disabled={savingCookidoo || !cookidooEmail.trim() || !cookidooPassword.trim()}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                savingCookidoo || !cookidooEmail.trim() || !cookidooPassword.trim()
                  ? 'bg-blue-300'
                  : 'bg-blue-600'
              }`}
            >
              {savingCookidoo
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={16} color="#fff" />}
              <Text className="text-white font-semibold text-sm ml-2">Privat speichern</Text>
            </TouchableOpacity>

            {cookidooScope === 'user' && (
              <TouchableOpacity
                onPress={handleDisconnectCookidoo}
                className="flex-row items-center justify-center rounded-xl py-3 px-4 bg-red-50 border border-red-200"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">Privat trennen</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="bg-warm-50 dark:bg-espresso-900 border border-warm-200 dark:border-warm-700 rounded-xl p-3 mb-3">
            <Text className="text-sm text-warm-800 dark:text-warm-100 font-medium mb-1">Haushalt</Text>
            <Text className="text-xs text-warm-500 dark:text-warm-400">
              {cookidooSharedByCurrentHousehold ? 'Für Haushalt freigegeben' : 'Nicht für Haushalt freigegeben'}
            </Text>
          </View>

          {!cookidooCanManageHouseholdShare && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
              <Text className="text-xs text-yellow-800">
                Nur Haushalts-Owner können die Cookidoo-Freigabe für den Haushalt ändern.
              </Text>
            </View>
          )}

          {cookidooSharedByCurrentHousehold ? (
            <TouchableOpacity
              onPress={handleRemoveCookidooShare}
              disabled={!cookidooCanManageHouseholdShare}
              className="flex-row items-center justify-center rounded-xl py-3 bg-red-50 border border-red-200"
              style={!cookidooCanManageHouseholdShare ? { opacity: 0.5 } : undefined}
            >
              <Trash2 size={16} color="#DC2626" />
              <Text className="text-red-600 font-semibold text-sm ml-2">Haushaltsfreigabe entfernen</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleShareCookidoo}
              disabled={savingCookidoo || cookidooScope !== 'user' || !cookidooCanManageHouseholdShare}
              className={`flex-row items-center justify-center rounded-xl py-3 ${
                savingCookidoo || cookidooScope !== 'user' || !cookidooCanManageHouseholdShare
                  ? 'bg-warm-200 dark:bg-espresso-700'
                  : 'bg-warm-800'
              }`}
            >
              {savingCookidoo
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={16} color="#fff" />}
              <Text className="text-white font-semibold text-sm ml-2">Für Haushalt freigeben</Text>
            </TouchableOpacity>
          )}

          <Text className="text-xs text-warm-500 dark:text-warm-400 mt-3">
            Private Zugangsdaten haben Vorrang. Ohne private Verbindung wird eine vorhandene Haushaltsfreigabe genutzt.
          </Text>
        </View>

        {/* ── Facebook ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">📘</Text>
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-1">Facebook Import</Text>
            <View
              className={`ml-auto rounded-full px-2 py-0.5 ${
                facebookTosAccepted ? 'bg-green-100' : 'bg-warm-100 dark:bg-espresso-800'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  facebookTosAccepted ? 'text-green-700' : 'text-warm-500 dark:text-warm-400'
                }`}
              >
                {facebookTosAccepted ? 'Aktiv' : 'Deaktiviert'}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
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
              <Text className="text-sm font-medium text-warm-700 dark:text-warm-200">
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
              thumbColor={facebookTosAccepted ? '#16A34A' : '#9E8878'}
            />
          </View>

          <Text className="text-xs text-warm-500 dark:text-warm-400 mt-3">
            Cookie-Upload ist auf Mobile nicht verfügbar (Web-only Feature).
          </Text>
        </View>

        {/* ── Foto-Import ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">📷</Text>
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-1">Foto-Import</Text>
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
            Anzahl Bildvorschläge bei der Bildauswahl nach Foto-Import
          </Text>
          <View className="flex-row bg-warm-100 dark:bg-espresso-700 rounded-xl p-1 gap-1">
            {([4, 8, 16] as const).map((n) => (
              <Pressable
                key={n}
                onPress={() => handleImageSearchCount(n)}
                className={`flex-1 py-2.5 rounded-lg items-center ${imageSearchCount === n ? 'bg-white dark:bg-espresso-800 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-semibold ${imageSearchCount === n ? 'text-primary-500' : 'text-warm-500 dark:text-warm-400'}`}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── PWA Install / Update ── */}
        {(canInstall || showIOSHint || updateReady) && (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-lg mr-1">📲</Text>
              <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-1">App</Text>
            </View>

            {updateReady && (
              <TouchableOpacity
                onPress={applyUpdate}
                className="flex-row items-center bg-blue-50 dark:bg-espresso-700 border border-blue-200 dark:border-warm-600 rounded-xl px-4 py-3 mb-3"
              >
                <Text className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex-1">
                  Neue Version verfügbar — jetzt anwenden
                </Text>
              </TouchableOpacity>
            )}

            {canInstall && (
              <TouchableOpacity
                onPress={install}
                className="flex-row items-center justify-center bg-primary-500 rounded-xl px-4 py-3 mb-2"
              >
                <Text className="text-sm font-semibold text-white">App installieren</Text>
              </TouchableOpacity>
            )}

            {showIOSHint && (
              <View className="bg-warm-50 dark:bg-espresso-700 border border-warm-200 dark:border-warm-600 rounded-xl px-4 py-3">
                <Text className="text-sm font-semibold text-warm-800 dark:text-warm-100 mb-1">
                  Zum Home-Bildschirm hinzufügen
                </Text>
                <Text className="text-xs text-warm-500 dark:text-warm-400">
                  Tippe auf das Teilen-Symbol (↑) und dann auf „Zum Home-Bildschirm".
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Push-Benachrichtigungen ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-lg mr-1">🔔</Text>
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-1">Push-Benachrichtigungen</Text>
          </View>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-4">
            Benachrichtigungen wenn ein Rezept-Import abgeschlossen ist
          </Text>

          {pushDenied ? (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <Text className="text-xs text-yellow-800 leading-5">
                Benachrichtigungen sind im Browser blockiert — in den Browsereinstellungen aktivieren.
              </Text>
            </View>
          ) : pushIosNeedsInstall ? (
            <View className="bg-warm-50 dark:bg-espresso-700 border border-warm-200 dark:border-warm-600 rounded-xl p-3">
              <Text className="text-xs text-warm-700 dark:text-warm-200 leading-5">
                Erst zum Home-Bildschirm hinzufügen (iOS 16.4+)
              </Text>
            </View>
          ) : !pushSupported ? (
            <View className="bg-warm-50 dark:bg-espresso-700 border border-warm-200 dark:border-warm-600 rounded-xl p-3">
              <Text className="text-xs text-warm-500 dark:text-warm-400 leading-5">
                Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-between" style={{ minHeight: 44 }}>
              <View className="flex-1 mr-4">
                <Text className="text-sm font-medium text-warm-700 dark:text-warm-200">
                  Benachrichtigungen aktivieren
                </Text>
                {pushEnabled && (
                  <Text className="text-xs text-green-600 mt-0.5">
                    Aktiv — du wirst bei abgeschlossenen Importen benachrichtigt
                  </Text>
                )}
              </View>
              {pushLoading ? (
                <ActivityIndicator size="small" color="#C84B31" />
              ) : (
                <Switch
                  value={pushEnabled}
                  onValueChange={togglePush}
                  disabled={pushLoading || !pushSupported || pushIosNeedsInstall}
                  trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                  thumbColor={pushEnabled ? '#16A34A' : '#9E8878'}
                />
              )}
            </View>
          )}
        </View>

        {/* ── App Info ── */}
        <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5">
          <View className="flex-row items-center mb-4">
            <Info size={18} color="#8B7355" />
            <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">App-Info</Text>

            {/* Roadmap + Changelog buttons */}
            <View className="ml-auto flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowChangelog(true)}
                className="flex-row items-center bg-warm-100 dark:bg-espresso-800 rounded-full px-3 py-1.5"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <ScrollText size={14} color="#8B7355" />
                <Text className="text-xs font-medium text-warm-600 dark:text-warm-300 ml-1">Changelog</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRoadmap(true)}
                className="flex-row items-center bg-warm-100 dark:bg-espresso-800 rounded-full px-3 py-1.5"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Map size={14} color="#8B7355" />
                <Text className="text-xs font-medium text-warm-600 dark:text-warm-300 ml-1">Roadmap</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="space-y-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-warm-500 dark:text-warm-400">App</Text>
              <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50">RecipeDeck v1.0</Text>
            </View>

            <View className="h-px bg-warm-100 dark:bg-espresso-800" />

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-warm-500 dark:text-warm-400">Beschreibung</Text>
              <Text className="text-sm text-warm-700 dark:text-warm-200 flex-shrink ml-4 text-right">
                Rezepte aus URLs extrahieren
              </Text>
            </View>

            <View className="h-px bg-warm-100 dark:bg-espresso-800" />

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-warm-500 dark:text-warm-400">Datenbank</Text>
              <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50">
                {recipeCount === null
                  ? '–'
                  : `${recipeCount} Rezept${recipeCount === 1 ? '' : 'e'}`}
              </Text>
            </View>

            {lastUpdated && (
              <>
                <View className="h-px bg-warm-100 dark:bg-espresso-800" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-warm-500 dark:text-warm-400">Letzte Änderung</Text>
                  <Text className="text-sm font-semibold text-warm-900 dark:text-warm-50">
                    {lastUpdated.date} · {lastUpdated.time}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
