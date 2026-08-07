import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Bug } from "lucide-react-native";
import { fetchAuthMe } from "@/utils/admin";
import {
  fetchAdminBugReportDetail,
  fetchAdminBugReports,
  getBugReportStatusLabel,
  updateAdminBugReport,
  type BugReportDetail,
  BUG_REPORT_STATUSES,
  type BugReportListItem,
  type BugReportStatus,
} from "@/utils/bug-reporting";
import { ApiRequestError } from "@/utils/api";

const STATUS_OPTIONS: readonly BugReportStatus[] = BUG_REPORT_STATUSES;

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminBugReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<BugReportListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BugReportDetail | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<BugReportStatus>("new");

  async function loadDetail(id: string) {
    const next = await fetchAdminBugReportDetail(id);
    setDetail(next);
    setStatusDraft(next.status);
    setAdminNotesDraft(next.adminNotes ?? "");
  }

  async function load() {
    setLoading(true);
    try {
      const me = await fetchAuthMe();
      if (me.appRole !== "admin") {
        setError("Diese Fläche ist nur für Admins freigeschaltet.");
        setReports([]);
        setDetail(null);
        return;
      }

      const nextReports = await fetchAdminBugReports({ limit: 50 });
      setReports(nextReports);
      setError(null);

      const targetId = selectedId && nextReports.some((report) => report.id === selectedId)
        ? selectedId
        : (nextReports[0]?.id ?? null);
      setSelectedId(targetId);
      if (targetId) {
        await loadDetail(targetId);
      } else {
        setDetail(null);
      }
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && loadError.code === "admin_required") {
        setError("Diese Fläche ist nur für Admins freigeschaltet.");
      } else {
        setError(loadError instanceof Error ? loadError.message : "Bug-Reports konnten nicht geladen werden.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function selectReport(id: string) {
    setSelectedId(id);
    try {
      await loadDetail(id);
      setError(null);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Detail konnte nicht geladen werden.");
    }
  }

  async function saveDetail() {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await updateAdminBugReport({
        id: detail.id,
        status: statusDraft,
        adminNotes: adminNotesDraft,
      });
      setDetail(updated);
      setReports((current) => current.map((report) => (
        report.id === updated.id
          ? { ...report, status: updated.status, updatedAt: updated.updatedAt }
          : report
      )));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Bug-Report konnte nicht aktualisiert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 pb-10">
      <View className="mb-6">
        <View className="flex-row items-center mb-2">
          <Bug size={20} color="#8B7355" />
          <Text className="text-2xl font-bold text-warm-900 dark:text-warm-50 ml-2">Bug Reports</Text>
        </View>
        <Text className="text-warm-500 dark:text-warm-400">
          Admin-Triage für eingehende Reports, Diagnosekontext und Statuspflege.
        </Text>
      </View>

      {loading ? (
        <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-5">
          <ActivityIndicator size="small" color="#C84B31" />
        </View>
      ) : error ? (
        <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-red-200 p-5 mb-4">
          <Text className="text-sm text-red-700 mb-3">{error}</Text>
          <Pressable onPress={() => void load()} className="bg-white rounded-xl py-3 items-center border border-red-200">
            <Text className="text-sm text-red-700 font-semibold">Erneut laden</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4 mb-4">
            <Text className="text-sm font-semibold text-warm-800 dark:text-warm-100 mb-3">Liste</Text>
            {reports.length === 0 ? (
              <Text className="text-sm text-warm-600 dark:text-warm-300">Keine Reports vorhanden.</Text>
            ) : (
              <View className="gap-3">
                {reports.map((report) => (
                  <Pressable
                    key={report.id}
                    onPress={() => void selectReport(report.id)}
                    className={`rounded-xl border p-4 ${
                      selectedId === report.id
                        ? "border-primary-500 bg-primary-50 dark:bg-espresso-900"
                        : "border-warm-200 dark:border-warm-700"
                    }`}
                  >
                    <View className="flex-row items-center mb-2">
                      <View className="bg-blue-100 rounded-full px-2 py-1">
                        <Text className="text-xs font-semibold text-blue-700">{getBugReportStatusLabel(report.status)}</Text>
                      </View>
                      <Text className="ml-auto text-xs text-warm-500 dark:text-warm-400">{formatTimestamp(report.createdAt)}</Text>
                    </View>
                    <Text className="text-sm text-warm-800 dark:text-warm-100 mb-2">{report.description}</Text>
                    <Text className="text-xs text-warm-500 dark:text-warm-400">{report.route ?? report.sourceArea}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {detail ? (
            <View className="bg-white dark:bg-espresso-800 rounded-2xl border border-warm-200 dark:border-warm-700 p-4">
              <Text className="text-sm font-semibold text-warm-800 dark:text-warm-100 mb-2">Detail</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-1">Report-ID</Text>
              <Text className="text-sm text-warm-800 dark:text-warm-100 mb-3">{detail.id}</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-1">Beschreibung</Text>
              <Text className="text-sm text-warm-800 dark:text-warm-100 mb-3">{detail.description}</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-1">Route / Quelle</Text>
              <Text className="text-sm text-warm-800 dark:text-warm-100 mb-3">{detail.route ?? detail.sourceArea}</Text>
              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-1">Diagnosekontext</Text>
              <View className="bg-warm-50 dark:bg-espresso-900 rounded-xl p-3 mb-4 border border-warm-200 dark:border-warm-700">
                <Text className="text-xs text-warm-700 dark:text-warm-200">
                  {JSON.stringify(detail.metadata, null, 2)}
                </Text>
              </View>

              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-2">Status</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => setStatusDraft(status)}
                    className={`rounded-full px-3 py-2 border ${
                      statusDraft === status ? "border-primary-500 bg-primary-50" : "border-warm-200 dark:border-warm-700"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${statusDraft === status ? "text-primary-600" : "text-warm-600 dark:text-warm-300"}`}>
                      {getBugReportStatusLabel(status)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-xs text-warm-500 dark:text-warm-400 mb-2">Admin-Notizen</Text>
              <TextInput
                className="border border-warm-200 dark:border-warm-700 rounded-xl px-4 py-3 text-sm text-warm-900 dark:text-warm-50 mb-4"
                multiline
                style={{ minHeight: 120, textAlignVertical: "top" }}
                value={adminNotesDraft}
                onChangeText={setAdminNotesDraft}
                placeholder="Interne Diagnose- oder Triage-Notizen"
                placeholderTextColor="#9E8878"
              />

              <Pressable
                onPress={() => void saveDetail()}
                disabled={saving}
                className={`rounded-xl py-3 items-center ${saving ? "bg-primary-200" : "bg-primary-500"}`}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Status speichern</Text>}
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
