import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Check, Mail, X } from 'lucide-react-native';

import {
  useAcceptRecipeShareInvite,
  useRecipeShareInvite,
} from '@/hooks/useCollections';
import { getAuthSession } from '@/utils/auth';
import { buildLoginFirstAccountHref } from '@/utils/login-first-routing';
import { ApiRequestError } from '@/utils/api';

type SessionState = 'loading' | 'signed-in' | 'signed-out';

function statusText(status: string) {
  if (status === 'accepted') return 'Diese Einladung wurde bereits angenommen.';
  if (status === 'revoked') return 'Diese Einladung wurde widerrufen.';
  if (status === 'expired') return 'Diese Einladung ist abgelaufen.';
  return null;
}

export default function RecipeShareInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const inviteQuery = useRecipeShareInvite(token);
  const acceptInvite = useAcceptRecipeShareInvite();
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('loading');

  const returnTo = token ? `/share-invite/${token}` : '/(tabs)';

  useEffect(() => {
    let cancelled = false;
    getAuthSession()
      .then((session) => {
        if (!cancelled) setSessionState(session ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (!cancelled) setSessionState('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async () => {
    if (!token || acceptInvite.isPending || sessionState !== 'signed-in') return;
    setError(null);

    try {
      const result = await acceptInvite.mutateAsync(token);
      router.replace({ pathname: '/recipe/[id]', params: { id: String(result.recipe.id) } });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'email_mismatch') {
          setError('Diese Einladung ist fuer eine andere E-Mail-Adresse bestimmt.');
          return;
        }
        if (err.code === 'invite_expired') {
          setError('Diese Einladung ist abgelaufen.');
          return;
        }
        if (err.code === 'invite_revoked') {
          setError('Diese Einladung wurde widerrufen.');
          return;
        }
        setError(err.message);
        return;
      }
      setError('Einladung konnte nicht angenommen werden.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurueck"
          className="mr-3 p-1"
        >
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-lg font-semibold text-warm-900 dark:text-warm-50">Rezept-Einladung</Text>
      </View>

      <View className="flex-1 px-5 py-8">
        {inviteQuery.isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#C84B31" />
          </View>
        ) : inviteQuery.isError || !inviteQuery.data ? (
          <View className="rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700 px-4 py-5 items-center">
            <X size={24} color="#ef4444" />
            <Text className="text-warm-900 dark:text-warm-50 font-semibold mt-3">Einladung nicht gefunden</Text>
          </View>
        ) : (
          <View className="rounded-xl bg-white dark:bg-espresso-800 border border-warm-200 dark:border-warm-700 px-4 py-5 gap-4">
            <View className="flex-row items-center gap-3">
              <Mail size={22} color="#C84B31" />
              <View className="flex-1">
                <Text className="text-xs text-warm-500 dark:text-warm-400">Rezept</Text>
                <Text className="text-xl font-bold text-warm-900 dark:text-warm-50">{inviteQuery.data.recipeName}</Text>
              </View>
            </View>

            <View>
              <Text className="text-sm text-warm-600 dark:text-warm-300">
                An {inviteQuery.data.recipientEmail}
              </Text>
              {inviteQuery.data.senderEmail && (
                <Text className="text-sm text-warm-500 dark:text-warm-400 mt-1">
                  Von {inviteQuery.data.senderEmail}
                </Text>
              )}
            </View>

            {statusText(inviteQuery.data.status) ? (
              <Text className="text-sm text-warm-600 dark:text-warm-300">
                {statusText(inviteQuery.data.status)}
              </Text>
            ) : sessionState === 'loading' ? (
              <View className="items-center py-2" testID="share-invite-session-loading">
                <ActivityIndicator size="small" color="#C84B31" />
              </View>
            ) : sessionState === 'signed-out' ? (
              <View className="gap-3" testID="share-invite-signed-out">
                <Text className="text-sm text-warm-600 dark:text-warm-300">
                  Diese Einladung ist an {inviteQuery.data.recipientEmail} gebunden. Zum Annehmen brauchst du ein
                  Konto mit genau dieser E-Mail-Adresse.
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => router.push(
                      buildLoginFirstAccountHref(returnTo, 'signup', inviteQuery.data.recipientEmail),
                    )}
                    testID="share-invite-signup-cta"
                    className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-primary-500"
                  >
                    <Text className="text-white font-semibold">Account erstellen</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(
                      buildLoginFirstAccountHref(returnTo, 'signin', inviteQuery.data.recipientEmail),
                    )}
                    testID="share-invite-signin-cta"
                    className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-primary-500"
                  >
                    <Text className="text-white font-semibold">Anmelden</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={accept}
                disabled={acceptInvite.isPending}
                testID="accept-recipe-share-invite"
                className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-primary-500"
              >
                {acceptInvite.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Check size={18} color="#fff" />}
                <Text className="text-white font-semibold">Als private Kopie annehmen</Text>
              </Pressable>
            )}

            {error && (
              <Text className="text-sm text-red-600" testID="recipe-share-invite-accept-error">{error}</Text>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
