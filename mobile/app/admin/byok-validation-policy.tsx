import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyRound, RotateCcw, Save } from 'lucide-react-native';
import { fetchByokValidationPolicy, saveByokValidationPolicy, type ByokValidationPolicyResponse } from '@/utils/admin';
import { ApiRequestError } from '@/utils/api';

const DEFAULT_WINDOW_MINUTES = 60;
const DEFAULT_MAX_REQUESTS = 20;

function formatTimestamp(value: string | null) {
  if (!value) return 'Noch nie gespeichert';
  const date = new Date(value);
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function ByokValidationPolicyScreen() {
  const [policy, setPolicy] = useState<ByokValidationPolicyResponse | null>(null);
  const [windowMinutes, setWindowMinutes] = useState('');
  const [maxRequests, setMaxRequests] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await fetchByokValidationPolicy();
      setPolicy(next);
      setWindowMinutes(String(next.windowMinutes));
      setMaxRequests(String(next.maxRequests));
    } catch (reason) {
      if (reason instanceof ApiRequestError) {
        setError(reason.code === 'admin_required' ? 'Diese Fläche ist nur für Admins freigeschaltet.' : reason.message);
      } else {
        setError('BYOK-Policy konnte nicht geladen werden.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const dirty = useMemo(() => {
    if (!policy) return false;
    return windowMinutes !== String(policy.windowMinutes) || maxRequests !== String(policy.maxRequests);
  }, [policy, windowMinutes, maxRequests]);

  const handleResetToDefault = () => {
    setWindowMinutes(String(DEFAULT_WINDOW_MINUTES));
    setMaxRequests(String(DEFAULT_MAX_REQUESTS));
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    const nextWindow = Number(windowMinutes);
    const nextRequests = Number(maxRequests);
    if (!Number.isInteger(nextWindow) || nextWindow < 1 || nextWindow > 1440) {
      setError('windowMinutes muss eine ganze Zahl zwischen 1 und 1440 sein.');
      return;
    }
    if (!Number.isInteger(nextRequests) || nextRequests < 1 || nextRequests > 1000) {
      setError('maxRequests muss eine ganze Zahl zwischen 1 und 1000 sein.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await saveByokValidationPolicy({
        windowMinutes: nextWindow,
        maxRequests: nextRequests,
      });
      setPolicy(next);
      setWindowMinutes(String(next.windowMinutes));
      setMaxRequests(String(next.maxRequests));
      setSuccess('BYOK-Policy gespeichert.');
    } catch (reason) {
      setError(reason instanceof ApiRequestError ? reason.message : 'BYOK-Policy konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 pb-10">
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <KeyRound size={20} color="#8B7355" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 ml-2">BYOK Validation Policy</Text>
          </View>
          <Text className="text-warm-500 dark:text-warm-400">
            Gilt global für `POST /api/v1/keys/validate` sowie `extract/react`, `extract/photo` und `extract/text`.
          </Text>
        </View>

        {loading ? (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5">
            <ActivityIndicator size="small" color="#C84B31" />
          </View>
        ) : (
          <>
            {error && (
              <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-red-200 p-4 mb-4">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            )}
            {success && (
              <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-green-200 p-4 mb-4">
                <Text className="text-sm text-green-700">{success}</Text>
              </View>
            )}

            {policy && (
              <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5 mb-4">
                <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 mb-3">Aktiver Zustand</Text>
                <Text className="text-sm text-warm-600 dark:text-warm-300">Quelle: {policy.source}</Text>
                <Text className="text-sm text-warm-600 dark:text-warm-300 mt-1">Status: {policy.status}</Text>
                <Text className="text-sm text-warm-600 dark:text-warm-300 mt-1">
                  Zuletzt geändert: {formatTimestamp(policy.updatedAt)}
                </Text>
                <Text className="text-sm text-warm-600 dark:text-warm-300 mt-1">
                  Geändert von: {policy.updatedBy ?? 'Code-Default'}
                </Text>
              </View>
            )}

            <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5 mb-4">
              <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 mb-4">Policy bearbeiten</Text>

              <Text className="text-sm font-medium text-warm-700 dark:text-warm-200 mb-2">Zeitfenster in Minuten</Text>
              <TextInput
                className="border border-warm-200 dark:border-warm-700 rounded-xl px-4 py-3 text-sm text-warm-900 dark:text-warm-50 mb-4"
                value={windowMinutes}
                onChangeText={setWindowMinutes}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="60"
                placeholderTextColor="#9E8878"
              />

              <Text className="text-sm font-medium text-warm-700 dark:text-warm-200 mb-2">Max. Validierungen</Text>
              <TextInput
                className="border border-warm-200 dark:border-warm-700 rounded-xl px-4 py-3 text-sm text-warm-900 dark:text-warm-50 mb-4"
                value={maxRequests}
                onChangeText={setMaxRequests}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="20"
                placeholderTextColor="#9E8878"
              />

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving || !dirty}
                  className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${saving || !dirty ? 'bg-blue-300' : 'bg-blue-600'}`}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
                  <Text className="text-white font-semibold text-sm ml-2">Speichern</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResetToDefault}
                  className="flex-row items-center justify-center rounded-xl py-3 px-4 bg-warm-100 dark:bg-espresso-700"
                >
                  <RotateCcw size={16} color="#8B7355" />
                  <Text className="text-warm-700 dark:text-warm-200 font-semibold text-sm ml-2">Default</Text>
                </TouchableOpacity>
              </View>
            </View>

            {policy && (
              <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5">
                <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 mb-3">Gilt für</Text>
                {policy.appliesTo.map((entry) => (
                  <Text key={entry} className="text-sm text-warm-600 dark:text-warm-300 mb-1">
                    {entry}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
