import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Bug } from "lucide-react-native";
import { fetchMyBugReports, getBugReportStatusLabel, type BugReportListItem } from "@/utils/bug-reporting";

interface MyBugReportsSectionProps {
  enabled: boolean;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MyBugReportsSection({ enabled }: MyBugReportsSectionProps) {
  const [reports, setReports] = useState<BugReportListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!enabled) {
      setReports([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const next = await fetchMyBugReports();
      setReports(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Meldungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [enabled]);

  return (
    <View className="bg-white dark:bg-espresso-800 rounded-2xl shadow-sm border border-warm-200 dark:border-warm-700 p-5 mb-4">
      <View className="flex-row items-center mb-2">
        <Bug size={18} color="#8B7355" />
        <Text className="text-base font-semibold text-warm-800 dark:text-warm-100 ml-2">Meine Meldungen</Text>
      </View>
      <Text className="text-sm text-warm-500 dark:text-warm-400 mb-4">
        Eigene Bug-Reports und ihr aktueller Bearbeitungsstatus.
      </Text>

      {!enabled ? (
        <Text className="text-sm text-warm-600 dark:text-warm-300">
          Melde dich an, um eigene Reports zu sehen und neue Meldungen mit deinem Konto zu verknüpfen.
        </Text>
      ) : loading ? (
        <ActivityIndicator size="small" color="#C84B31" />
      ) : error ? (
        <View className="bg-red-50 border border-red-200 rounded-xl p-3">
          <Text className="text-sm text-red-700 mb-3">{error}</Text>
          <Pressable onPress={() => void load()} className="bg-white rounded-lg py-2 items-center border border-red-200">
            <Text className="text-sm text-red-700 font-semibold">Erneut laden</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View className="bg-warm-50 dark:bg-espresso-900 rounded-xl p-4 border border-warm-200 dark:border-warm-700">
          <Text className="text-sm text-warm-600 dark:text-warm-300">
            Noch keine Meldungen vorhanden.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {reports.map((report) => (
            <View key={report.id} className="rounded-xl border border-warm-200 dark:border-warm-700 p-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-blue-100 rounded-full px-2 py-1">
                  <Text className="text-xs font-semibold text-blue-700">{getBugReportStatusLabel(report.status)}</Text>
                </View>
                <Text className="ml-auto text-xs text-warm-500 dark:text-warm-400">{formatTimestamp(report.createdAt)}</Text>
              </View>
              <Text className="text-sm text-warm-800 dark:text-warm-100 mb-2">{report.description}</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400">
                {report.route ?? report.sourceArea}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
