import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, LogIn, LogOut, Mail, RefreshCcw, UserPlus } from 'lucide-react-native';

import { bootstrapAccount, type AccountBootstrapResponse } from '@/utils/account-bootstrap';
import {
  getAuthSession,
  getSupabaseClient,
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from '@/utils/auth';

type AccountMode = 'signin' | 'signup' | 'reset' | 'update-password';
type WorkspaceState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: AccountBootstrapResponse }
  | { kind: 'error'; message: string };

function normalizeMode(value: string | string[] | undefined): AccountMode {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === 'signup' || first === 'reset' || first === 'update-password') {
    return first;
  }

  return 'signin';
}

export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string; authError?: string; confirmationSuccess?: string }>();
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const initialAuthError = Array.isArray(params.authError) ? params.authError[0] : params.authError;
  const initialConfirmationSuccess = Array.isArray(params.confirmationSuccess) ? params.confirmationSuccess[0] : params.confirmationSuccess;
  const [mode, setMode] = useState<AccountMode>(() => normalizeMode(params.mode));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ kind: 'idle' });
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineInfo, setInlineInfo] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const bootstrapInFlightRef = useRef(false);
  const skipNextAutoBootstrapRef = useRef(false);

  const isSignedIn = sessionEmail !== null;

  const finishWithReturnIntent = useCallback(() => {
    if (returnTo) {
      router.replace(returnTo as never);
    }
  }, [returnTo]);

  const loadSession = useCallback(async () => {
    setAuthConfigured(getSupabaseClient() !== null);
    setAuthLoading(true);
    try {
      const session = await getAuthSession();
      setSessionEmail(session?.user.email ?? null);
      if (session?.user.email) {
        setEmail(session.user.email);
      }
    } catch {
      setSessionEmail(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const runBootstrap = useCallback(async (navigateAfterSuccess: boolean) => {
    if (bootstrapInFlightRef.current) {
      return;
    }

    bootstrapInFlightRef.current = true;
    setWorkspaceState({ kind: 'loading' });
    setInlineError(null);
    try {
      const data = await bootstrapAccount();
      setWorkspaceState({ kind: 'ready', data });
      if (navigateAfterSuccess) {
        finishWithReturnIntent();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace konnte nicht eingerichtet werden.';
      setWorkspaceState({ kind: 'error', message });
      if (!navigateAfterSuccess) {
        setInlineError(message);
      }
    } finally {
      bootstrapInFlightRef.current = false;
    }
  }, [finishWithReturnIntent]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    setMode(normalizeMode(params.mode));
  }, [params.mode]);

  useEffect(() => {
    if (initialAuthError) {
      setInlineError(initialAuthError);
    }
  }, [initialAuthError]);

  useEffect(() => {
    if (initialConfirmationSuccess) {
      setInlineInfo('E-Mail bestätigt — du bist jetzt angemeldet.');
    }
  }, [initialConfirmationSuccess]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      return undefined;
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (session?.user.email) {
        setEmail(session.user.email);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        setInlineInfo('Lege jetzt ein neues Passwort für deinen Account fest.');
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading || !isSignedIn || mode === 'update-password') {
      return;
    }

    if (skipNextAutoBootstrapRef.current) {
      skipNextAutoBootstrapRef.current = false;
      return;
    }

    void runBootstrap(false);
  }, [authLoading, isSignedIn, mode, runBootstrap]);

  const workspaceSummary = useMemo(() => {
    if (workspaceState.kind === 'ready') {
      return `Workspace: ${workspaceState.data.workspace.name}`;
    }
    if (workspaceState.kind === 'loading') {
      return 'Workspace wird eingerichtet';
    }
    if (workspaceState.kind === 'error') {
      return 'Workspace konnte nicht eingerichtet werden';
    }
    return 'Workspace-Status wird geladen';
  }, [workspaceState]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setInlineError('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setBusy(true);
    setInlineError(null);
    setInlineInfo(null);
    try {
      const session = await signInWithPassword(email.trim(), password);
      skipNextAutoBootstrapRef.current = true;
      setSessionEmail(session.user.email ?? email.trim());
      setPassword('');
      await runBootstrap(true);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Login fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setInlineError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (password !== confirmPassword) {
      setInlineError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    setInlineError(null);
    setInlineInfo(null);
    const result = await signUpWithPassword(email.trim(), password, {
      mode: 'signup',
      returnTo,
    });
    try {
      if (result.status === 'signup_failed') {
        setInlineError(result.message);
        return;
      }
      if (result.status === 'confirmation_required') {
        setConfirmationEmail(result.email);
        setInlineInfo(
          Platform.OS === 'web'
            ? 'Bestätige deine E-Mail. Du wirst nach der Bestätigung automatisch weitergeleitet.'
            : 'Bestätige deine E-Mail und öffne danach den Link erneut in der App.',
        );
        return;
      }

      skipNextAutoBootstrapRef.current = true;
      setSessionEmail(result.session.user.email ?? email.trim());
      setPassword('');
      setConfirmPassword('');
      await runBootstrap(true);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setInlineError('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }

    setBusy(true);
    setInlineError(null);
    try {
      await requestPasswordReset(email.trim(), { returnTo });
      setInlineInfo('Falls die Adresse existiert, wurde ein Passwort-Reset-Link verschickt.');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Reset-Link konnte nicht verschickt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    const resendEmail = confirmationEmail ?? email.trim();
    if (!resendEmail) {
      setInlineError('Bitte gib zuerst deine E-Mail-Adresse ein.');
      return;
    }

    setBusy(true);
    setInlineError(null);
    try {
      await resendSignupConfirmation(resendEmail, {
        mode: 'signup',
        returnTo,
      });
      setInlineInfo('Bestätigungs-E-Mail wurde erneut verschickt.');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Bestätigungs-E-Mail konnte nicht erneut verschickt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password.trim()) {
      setInlineError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (password !== confirmPassword) {
      setInlineError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    setInlineError(null);
    try {
      await updatePassword(password);
      setInlineInfo('Passwort wurde aktualisiert.');
      setPassword('');
      setConfirmPassword('');
      setMode('signin');
      finishWithReturnIntent();
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Passwort konnte nicht aktualisiert werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setInlineError(null);
    try {
      await signOut();
      setSessionEmail(null);
      setWorkspaceState({ kind: 'idle' });
      setPassword('');
      setConfirmPassword('');
      setMode('signin');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Logout fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 pb-10">
        <View className="mb-5 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 rounded-full bg-white p-2">
            <ArrowLeft size={18} color="#8B7355" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50">Account & Workspace</Text>
            <Text className="mt-1 text-sm text-warm-500 dark:text-warm-400">
              Login, Bootstrap und dein erster Workspace an einem Ort.
            </Text>
          </View>
        </View>

        <View className="mb-4 rounded-2xl border border-warm-200 bg-white p-5 dark:border-warm-700 dark:bg-espresso-800">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-semibold text-warm-900 dark:text-warm-50">Account-Status</Text>
              <Text className="mt-1 text-sm text-warm-500 dark:text-warm-400">
                {authLoading ? 'Session wird geprüft…' : isSignedIn ? sessionEmail : 'Nicht angemeldet'}
              </Text>
            </View>
            {authLoading ? (
              <ActivityIndicator size="small" color="#C84B31" />
            ) : isSignedIn ? (
              <View className="rounded-full bg-green-100 px-3 py-1">
                <Text className="text-xs font-semibold text-green-700">Aktiv</Text>
              </View>
            ) : (
              <View className="rounded-full bg-warm-100 px-3 py-1 dark:bg-espresso-700">
                <Text className="text-xs font-semibold text-warm-600 dark:text-warm-300">Ohne Session</Text>
              </View>
            )}
          </View>

          <View className="mt-4 rounded-xl bg-warm-50 px-4 py-3 dark:bg-espresso-900">
            <Text className="text-xs font-semibold uppercase tracking-wider text-warm-500 dark:text-warm-400">
              Workspace
            </Text>
            <Text className="mt-1 text-sm font-medium text-warm-800 dark:text-warm-100">{workspaceSummary}</Text>
            {workspaceState.kind === 'ready' ? (
              <View className="mt-3 flex-row items-center">
                <CheckCircle2 size={15} color="#15803d" />
                <Text className="ml-2 text-sm text-green-700">
                  {workspaceState.data.result === 'created' ? 'Neu eingerichtet' : 'Bereits bereit'}
                </Text>
              </View>
            ) : null}
            {workspaceState.kind === 'error' ? (
              <Pressable
                onPress={() => void runBootstrap(false)}
                className="mt-3 flex-row items-center self-start rounded-xl border border-warm-200 px-3 py-2 dark:border-warm-700"
              >
                <RefreshCcw size={15} color="#8B7355" />
                <Text className="ml-2 text-sm font-medium text-warm-700 dark:text-warm-200">Bootstrap erneut versuchen</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {!authConfigured ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <Text className="text-sm text-red-700">Supabase Auth ist auf diesem Client noch nicht konfiguriert.</Text>
          </View>
        ) : null}

        {inlineError ? (
          <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <Text className="text-sm text-red-700">{inlineError}</Text>
          </View>
        ) : null}

        {inlineInfo ? (
          <View className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
            <Text className="text-sm text-blue-700">{inlineInfo}</Text>
          </View>
        ) : null}

        {isSignedIn && mode !== 'update-password' ? (
          <View className="rounded-2xl border border-warm-200 bg-white p-5 dark:border-warm-700 dark:bg-espresso-800">
            <Text className="text-base font-semibold text-warm-900 dark:text-warm-50">Dein Account</Text>
            <Text className="mt-1 text-sm text-warm-500 dark:text-warm-400">
              {sessionEmail}
            </Text>
            <Pressable
              onPress={handleLogout}
              disabled={busy}
              className="mt-4 flex-row items-center justify-center rounded-xl bg-warm-100 py-3 dark:bg-espresso-700"
            >
              {busy ? <ActivityIndicator size="small" color="#8B7355" /> : <LogOut size={16} color="#8B7355" />}
              <Text className="ml-2 font-semibold text-warm-700 dark:text-warm-200">Abmelden</Text>
            </Pressable>
          </View>
        ) : (
          <View className="rounded-2xl border border-warm-200 bg-white p-5 dark:border-warm-700 dark:bg-espresso-800">
            <View className="mb-4 flex-row rounded-xl bg-warm-100 p-1 dark:bg-espresso-900">
              {([
                ['signin', 'Anmelden'],
                ['signup', 'Account erstellen'],
                ['reset', 'Passwort zurücksetzen'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setMode(value)}
                  className={`flex-1 rounded-lg px-2 py-2 ${mode === value ? 'bg-white dark:bg-espresso-800' : ''}`}
                >
                  <Text className={`text-center text-xs font-medium ${mode === value ? 'text-primary-500' : 'text-warm-500 dark:text-warm-400'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-Mail"
              placeholderTextColor="#9E8878"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="mb-3 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-warm-900 dark:border-warm-700 dark:bg-espresso-900 dark:text-warm-50"
            />

            {mode !== 'reset' ? (
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'update-password' ? 'Neues Passwort' : 'Passwort'}
                placeholderTextColor="#9E8878"
                secureTextEntry
                className="mb-3 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-warm-900 dark:border-warm-700 dark:bg-espresso-900 dark:text-warm-50"
              />
            ) : null}

            {(mode === 'signup' || mode === 'update-password') ? (
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Passwort bestätigen"
                placeholderTextColor="#9E8878"
                secureTextEntry
                className="mb-3 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-warm-900 dark:border-warm-700 dark:bg-espresso-900 dark:text-warm-50"
              />
            ) : null}

            {mode === 'signin' ? (
              <Pressable
                onPress={handleSignIn}
                disabled={busy}
                className="flex-row items-center justify-center rounded-xl bg-primary-500 py-3"
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <LogIn size={16} color="#fff" />}
                <Text className="ml-2 font-semibold text-white">Anmelden</Text>
              </Pressable>
            ) : null}

            {mode === 'signup' ? (
              <>
                <Pressable
                  onPress={handleSignUp}
                  disabled={busy}
                  className="flex-row items-center justify-center rounded-xl bg-primary-500 py-3"
                >
                  {busy ? <ActivityIndicator size="small" color="#fff" /> : <UserPlus size={16} color="#fff" />}
                  <Text className="ml-2 font-semibold text-white">Account erstellen</Text>
                </Pressable>
                <Pressable
                  onPress={handleResendConfirmation}
                  disabled={busy}
                  className="mt-3 flex-row items-center justify-center rounded-xl border border-warm-200 py-3 dark:border-warm-700"
                >
                  <Mail size={15} color="#8B7355" />
                  <Text className="ml-2 font-medium text-warm-700 dark:text-warm-200">Bestätigungs-E-Mail erneut senden</Text>
                </Pressable>
              </>
            ) : null}

            {mode === 'reset' ? (
              <Pressable
                onPress={handlePasswordReset}
                disabled={busy}
                className="flex-row items-center justify-center rounded-xl bg-primary-500 py-3"
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <Mail size={16} color="#fff" />}
                <Text className="ml-2 font-semibold text-white">Reset-Link anfordern</Text>
              </Pressable>
            ) : null}

            {mode === 'update-password' ? (
              <Pressable
                onPress={handleUpdatePassword}
                disabled={busy}
                className="flex-row items-center justify-center rounded-xl bg-primary-500 py-3"
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <CheckCircle2 size={16} color="#fff" />}
                <Text className="ml-2 font-semibold text-white">Neues Passwort speichern</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
