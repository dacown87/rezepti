import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { Trash2 } from '@/components/icons';
import { isOnline } from '@/offline/network-status';
import { ApiRequestError, deleteAccount } from '@/utils/api';
import { signInWithPassword, signOutLocal } from '@/utils/auth';
import { SECURE_KEY_GROQ } from '@/utils/byok-storage';

export const DELETE_CONFIRMATION_WORD = 'LÖSCHEN';

interface DeleteAccountSectionProps {
  email: string;
  /** Called after the account is gone and the local session is closed. */
  onDeleted: () => void;
}

/** Wipes everything the device still holds for the deleted user. Best effort. */
async function clearLocalUserData(): Promise<void> {
  try {
    const { offlineQueue } = await import('@/offline/queue-singleton');
    await offlineQueue.clear();
  } catch {
    // Queue unavailable (SSR/tests) — nothing to clear.
  }
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY_GROQ);
  } catch {
    // SecureStore is not available on every platform.
  }
}

export function DeleteAccountSection({ email, onDeleted }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && confirmation === DELETE_CONFIRMATION_WORD && !busy;

  const close = () => {
    setOpen(false);
    setPassword('');
    setConfirmation('');
    setError(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (!isOnline()) {
      setError('Zum Löschen deines Kontos brauchst du eine Internetverbindung.');
      return;
    }

    setBusy(true);
    setError(null);

    // Re-check the password first: a stolen, still-signed-in device must not be
    // able to delete the account.
    try {
      await signInWithPassword(email, password);
    } catch {
      setError('Das Passwort ist nicht korrekt.');
      setBusy(false);
      return;
    }

    try {
      await deleteAccount();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && cause.status === 409
          ? 'Dein Haushalt hat weitere Mitglieder. Das Konto kann erst gelöscht werden, wenn du allein im Haushalt bist.'
          : 'Dein Konto konnte nicht gelöscht werden. Bitte versuche es erneut.',
      );
      setBusy(false);
      return;
    }

    await clearLocalUserData();
    try {
      await signOutLocal();
    } catch {
      // The account is already gone; a failing local sign-out must not block the exit.
    }
    setBusy(false);
    onDeleted();
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="mt-6 flex-row items-center justify-center rounded-xl border border-red-300 py-3 dark:border-red-800"
      >
        <Trash2 size={16} color="#B91C1C" />
        <Text className="ml-2 font-semibold text-red-700 dark:text-red-400">Konto löschen</Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950">
      <Text className="text-base font-semibold text-red-800 dark:text-red-200">Konto endgültig löschen</Text>
      <Text className="mt-2 text-sm text-red-800 dark:text-red-200">
        Dabei werden unwiderruflich gelöscht: deine Rezepte, Sammlungen und Favoriten, Einkaufsliste und Wochenplaner,
        die Cookidoo-Verbindung, Benachrichtigungen und offene Einladungen.
      </Text>
      <Text className="mt-2 text-sm text-red-800 dark:text-red-200">
        Fehlerberichte, die du gesendet hast, bleiben ohne Bezug zu dir erhalten.
      </Text>

      <Text className="mt-4 text-xs font-medium text-red-800 dark:text-red-200">Passwort</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        accessibilityLabel="Passwort zur Bestätigung"
        editable={!busy}
        className="mt-1 rounded-xl border border-red-200 bg-white px-3 py-3 text-warm-900 dark:border-red-900 dark:bg-espresso-900 dark:text-warm-50"
      />

      <Text className="mt-3 text-xs font-medium text-red-800 dark:text-red-200">
        Tippe „{DELETE_CONFIRMATION_WORD}“ zur Bestätigung
      </Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Bestätigungswort"
        editable={!busy}
        className="mt-1 rounded-xl border border-red-200 bg-white px-3 py-3 text-warm-900 dark:border-red-900 dark:bg-espresso-900 dark:text-warm-50"
      />

      {error ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive" className="mt-3">
          <Text className="text-sm font-medium text-red-700 dark:text-red-300">{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        className={`mt-4 flex-row items-center justify-center rounded-xl py-3 ${canSubmit ? 'bg-red-600' : 'bg-red-300'}`}
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Trash2 size={16} color="#fff" />}
        <Text className="ml-2 font-semibold text-white">Konto endgültig löschen</Text>
      </Pressable>
      <Pressable onPress={close} disabled={busy} accessibilityRole="button" className="mt-2 items-center py-2">
        <Text className="text-sm text-red-800 dark:text-red-200">Abbrechen</Text>
      </Pressable>
    </View>
  );
}
