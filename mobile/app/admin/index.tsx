import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Shield, ChevronRight, Bug, KeyRound } from 'lucide-react-native';
import { fetchAuthMe, type AuthMeResponse } from '@/utils/admin';
import { ApiRequestError } from '@/utils/api';

export default function AdminHubScreen() {
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchAuthMe().then((data) => {
      if (!active) return;
      setAuth(data);
      setError(null);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiRequestError) {
        setError(reason.code === 'admin_required' ? 'Diese Fläche ist nur für Admins freigeschaltet.' : reason.message);
      } else {
        setError('Admin-Profil konnte nicht geladen werden.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 pb-10">
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <Shield size={20} color="#8B7355" />
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 ml-2">Admin Hub</Text>
          </View>
          <Text className="text-warm-500 dark:text-warm-400">
            Globaler Operator-Bereich für Runtime-Regler und kommende Admin-Slices.
          </Text>
        </View>

        {loading ? (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5">
            <ActivityIndicator size="small" color="#C84B31" />
          </View>
        ) : error ? (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-red-200 p-5">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : auth?.appRole !== 'admin' ? (
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-red-200 p-5">
            <Text className="text-sm text-red-700">Diese Fläche ist nur für Admins freigeschaltet.</Text>
          </View>
        ) : (
          <>
            <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5 mb-4">
              <Text className="text-base font-semibold text-warm-800 dark:text-warm-100">Angemeldet als</Text>
              <Text className="text-sm text-warm-600 dark:text-warm-300 mt-1">{auth.email ?? auth.userId}</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/admin/byok-validation-policy')}
              className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5 mb-4"
            >
              <View className="flex-row items-center">
                <KeyRound size={18} color="#8B7355" />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-warm-800 dark:text-warm-100">BYOK Validation Policy</Text>
                  <Text className="text-sm text-warm-500 dark:text-warm-400 mt-1">
                    Globaler Regler für `keys/validate` und alle BYOK-Extraction-Einstiege.
                  </Text>
                </View>
                <ChevronRight size={18} color="#9E8878" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/admin/bug-reports')}
              className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5"
            >
              <View className="flex-row items-center">
                <Bug size={18} color="#8B7355" />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-warm-800 dark:text-warm-100">Bug Reports</Text>
                  <Text className="text-sm text-warm-500 dark:text-warm-400 mt-1">
                    Platzhalter für den nächsten Slice mit Admin-Übersicht und Bearbeitung.
                  </Text>
                </View>
                <ChevronRight size={18} color="#9E8878" />
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
