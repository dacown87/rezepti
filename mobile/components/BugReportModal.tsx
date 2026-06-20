import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { X } from "lucide-react-native";
import { fetchAuthMe } from "@/utils/admin";
import {
  createBugReport,
  type BugReportSourceArea,
  type BugReportType,
  type OpenBugReportIntent,
} from "@/utils/bug-reporting";

interface BugReportModalProps {
  visible: boolean;
  intent: OpenBugReportIntent | null;
  onClose: () => void;
}

export default function BugReportModal({ visible, intent, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDescription(intent?.initialDescription ?? "");
    setError(null);
    setSuccess(false);
    setSending(false);
  }, [visible, intent]);

  async function handleSubmit() {
    const trimmed = description.trim();
    if (!trimmed || !intent) return;

    setSending(true);
    setError(null);
    try {
      const viewport = Dimensions.get("window");
      let activeHouseholdId: string | null = null;

      try {
        const me = await fetchAuthMe();
        activeHouseholdId = me.activeHouseholdId ?? null;
      } catch {
        activeHouseholdId = null;
      }

      const metadata: Record<string, unknown> = {
        appVersion: Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? "unknown",
        platform: Platform.OS,
        osVersion: String(Platform.Version ?? "unknown"),
        viewport: {
          width: viewport.width,
          height: viewport.height,
          scale: viewport.scale,
        },
        timestamp: new Date().toISOString(),
        ...(typeof navigator !== "undefined" && navigator.userAgent ? { userAgent: navigator.userAgent } : {}),
        ...(activeHouseholdId ? { activeHouseholdId } : {}),
        ...(intent.metadata ?? {}),
      };

      await createBugReport({
        reportType: intent.reportType as BugReportType,
        sourceArea: intent.sourceArea as BugReportSourceArea,
        description: trimmed,
        route: intent.route ?? null,
        metadata,
      });

      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Bug-Report konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-espresso-900">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-warm-200 dark:border-warm-700">
          <View>
            <Text className="text-xl font-bold text-warm-900 dark:text-warm-50">Problem melden</Text>
            <Text className="text-xs text-warm-500 dark:text-warm-400 mt-1">
              Technische Kontextdaten werden automatisch mitgesendet.
            </Text>
          </View>
          <Pressable onPress={onClose} className="rounded-full p-2">
            <X size={18} color="#8B7355" />
          </Pressable>
        </View>

        <View className="flex-1 px-5 py-4">
          {success ? (
            <View className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <Text className="text-green-800 font-semibold">Meldung gesendet</Text>
              <Text className="text-green-700 text-sm mt-2">
                Danke. Der Report ist eingegangen und erscheint auch unter `Meine Meldungen`.
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-sm text-warm-700 dark:text-warm-200 mb-2">Was ist schiefgelaufen?</Text>
              <TextInput
                className="border border-warm-200 dark:border-warm-700 rounded-2xl px-4 py-4 text-base text-warm-900 dark:text-warm-50"
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Beschreibe kurz den Fehler, das erwartete Verhalten und was stattdessen passiert ist."
                placeholderTextColor="#9E8878"
                style={{ minHeight: 180, textAlignVertical: "top" }}
                editable={!sending}
              />
              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                  <Text className="text-red-700 text-sm">{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View className="px-5 pb-5 pt-3 border-t border-warm-200 dark:border-warm-700 flex-row gap-3">
          <Pressable
            onPress={onClose}
            className="flex-1 rounded-xl border border-warm-200 dark:border-warm-700 py-3 items-center bg-white dark:bg-espresso-800"
          >
            <Text className="text-warm-700 dark:text-warm-200 font-semibold">
              {success ? "Schließen" : "Abbrechen"}
            </Text>
          </Pressable>
          {!success ? (
            <Pressable
              onPress={handleSubmit}
              disabled={sending || description.trim().length === 0}
              className={`flex-1 rounded-xl py-3 items-center ${
                sending || description.trim().length === 0 ? "bg-primary-200" : "bg-primary-500"
              }`}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Senden</Text>}
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
