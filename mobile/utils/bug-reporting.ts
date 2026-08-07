import { apiFetch, assertApiOk, readApiError } from "./api";

// Muss mit den Listen in src/bug-reports.ts uebereinstimmen — abgesichert durch
// test/unit/bug-report-enums-contract.test.ts (Root-Suite).
const BUG_REPORT_TYPES = ["general", "import_failure"] as const;
const BUG_REPORT_SOURCE_AREAS = ["global_button", "import_error"] as const;
export const BUG_REPORT_STATUSES = ["new", "triaging", "in_progress", "resolved", "closed"] as const;

export type BugReportType = (typeof BUG_REPORT_TYPES)[number];
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];
export type BugReportSourceArea = (typeof BUG_REPORT_SOURCE_AREAS)[number];

export interface BugReportListItem {
  id: string;
  reportType: BugReportType;
  status: BugReportStatus;
  description: string;
  route: string | null;
  sourceArea: BugReportSourceArea;
  createdAt: string;
  updatedAt: string;
}

export interface BugReportDetail extends BugReportListItem {
  userId: string;
  householdId: string | null;
  metadata: Record<string, unknown>;
  adminNotes: string | null;
  resolvedAt: string | null;
}

export interface OpenBugReportIntent {
  reportType: BugReportType;
  sourceArea: BugReportSourceArea;
  route?: string | null;
  initialDescription?: string;
  metadata?: Record<string, unknown>;
}

type ModalListener = (intent: OpenBugReportIntent) => void;

let modalListener: ModalListener | null = null;

export function registerBugReportModalController(listener: ModalListener) {
  modalListener = listener;
  return () => {
    if (modalListener === listener) {
      modalListener = null;
    }
  };
}

export function openBugReportModal(intent: OpenBugReportIntent) {
  modalListener?.(intent);
}

export async function createBugReport(payload: {
  reportType: BugReportType;
  sourceArea: BugReportSourceArea;
  description: string;
  route?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; status: BugReportStatus; success: true }> {
  const response = await apiFetch("/api/v1/bug-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readApiError(response, `Bug-Report konnte nicht gesendet werden (${response.status})`);
  }

  return response.json();
}

export async function fetchMyBugReports(limit = 20): Promise<BugReportListItem[]> {
  const response = await apiFetch(`/api/v1/bug-reports/me?limit=${limit}`);
  await assertApiOk(response, `Bug-Reports konnten nicht geladen werden (${response.status})`);
  const data = await response.json();
  return Array.isArray(data?.reports) ? data.reports : [];
}

export async function fetchAdminBugReports(input?: {
  status?: BugReportStatus;
  reportType?: BugReportType;
  sourceArea?: BugReportSourceArea;
  limit?: number;
  offset?: number;
}): Promise<BugReportListItem[]> {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.reportType) params.set("reportType", input.reportType);
  if (input?.sourceArea) params.set("sourceArea", input.sourceArea);
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.offset) params.set("offset", String(input.offset));

  const response = await apiFetch(`/api/v1/admin/bug-reports${params.size > 0 ? `?${params.toString()}` : ""}`);
  await assertApiOk(response, `Admin-Bug-Reports konnten nicht geladen werden (${response.status})`);
  const data = await response.json();
  return Array.isArray(data?.reports) ? data.reports : [];
}

export async function fetchAdminBugReportDetail(id: string): Promise<BugReportDetail> {
  const response = await apiFetch(`/api/v1/admin/bug-reports/${id}`);
  await assertApiOk(response, `Bug-Report konnte nicht geladen werden (${response.status})`);
  return response.json();
}

export async function updateAdminBugReport(input: {
  id: string;
  status: BugReportStatus;
  adminNotes?: string | null;
}): Promise<BugReportDetail> {
  const response = await apiFetch(`/api/v1/admin/bug-reports/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: input.status,
      adminNotes: input.adminNotes ?? null,
    }),
  });

  if (!response.ok) {
    throw await readApiError(response, `Bug-Report konnte nicht aktualisiert werden (${response.status})`);
  }

  return response.json();
}

export function getBugReportStatusLabel(status: BugReportStatus) {
  switch (status) {
    case "new":
      return "Eingegangen";
    case "triaging":
      return "In Prüfung";
    case "in_progress":
      return "In Arbeit";
    case "resolved":
      return "Gelöst";
    case "closed":
      return "Geschlossen";
    default:
      return status;
  }
}
