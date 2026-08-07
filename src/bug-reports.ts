export const BUG_REPORT_TYPES = ["general", "import_failure"] as const;
export const BUG_REPORT_STATUSES = ["new", "triaging", "in_progress", "resolved", "closed"] as const;
export const BUG_REPORT_SOURCE_AREAS = ["global_button", "import_error"] as const;

export type BugReportType = typeof BUG_REPORT_TYPES[number];
export type BugReportStatus = typeof BUG_REPORT_STATUSES[number];
export type BugReportSourceArea = typeof BUG_REPORT_SOURCE_AREAS[number];

export interface BugReportAdminPatchInput {
  status?: BugReportStatus;
  adminNotes?: string | null;
}

export interface BugReportFilters {
  status?: BugReportStatus;
  reportType?: BugReportType;
  sourceArea?: BugReportSourceArea;
  limit?: number;
  offset?: number;
}

// Nur modulintern verwendet — die Grenzwerte wirken ueber die normalize*/clamp*
// Helfer unten, nicht ueber direkten Zugriff von aussen.
const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 4000;
const BUG_REPORT_ROUTE_MAX_LENGTH = 300;
const BUG_REPORT_METADATA_STRING_MAX_LENGTH = 500;
const BUG_REPORT_ADMIN_NOTES_MAX_LENGTH = 4000;
const BUG_REPORT_LIST_MAX_LIMIT = 100;

export const BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES = 60;
export const BUG_REPORT_RATE_LIMIT_MAX_REQUESTS = 5;
export const BUG_REPORT_LIST_DEFAULT_LIMIT = 20;

const TOP_LEVEL_ALLOWED_KEYS = new Set([
  "appVersion",
  "route",
  "platform",
  "osVersion",
  "viewport",
  "timestamp",
  "userAgent",
  "lastClientError",
  "lastApiError",
  "activeHouseholdId",
  "importMode",
  "sourceType",
  "sourceUrl",
  "jobId",
  "jobStatus",
  "currentStage",
  "errorMessage",
  "errorHint",
  "qualityWarnings",
  "lastFailureSnapshot",
]);

const SENSITIVE_KEY_PATTERN = /(token|cookie|password|secret|authorization|api[_-]?key|groq|byok|session)/i;

function truncateString(value: string, maxLength = BUG_REPORT_METADATA_STRING_MAX_LENGTH) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeViewport(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const width = typeof source.width === "number" && Number.isFinite(source.width) ? Math.round(source.width) : undefined;
  const height = typeof source.height === "number" && Number.isFinite(source.height) ? Math.round(source.height) : undefined;
  const scale = typeof source.scale === "number" && Number.isFinite(source.scale) ? Number(source.scale) : undefined;
  if (width === undefined && height === undefined && scale === undefined) return undefined;
  return {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(scale !== undefined ? { scale } : {}),
  };
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => truncateString(entry))
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
  return cleaned.length > 0 ? cleaned : undefined;
}

function sanitizeFailureSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const snapshot: Record<string, unknown> = {};

  if (typeof source.mode === "string") snapshot.mode = truncateString(source.mode, 32);
  if (typeof source.submittedUrl === "string") snapshot.submittedUrl = truncateString(source.submittedUrl);
  if (typeof source.textHint === "string") snapshot.textHint = truncateString(source.textHint);
  if (typeof source.photoHint === "string") snapshot.photoHint = truncateString(source.photoHint);
  if (typeof source.jobId === "string") snapshot.jobId = truncateString(source.jobId, 100);
  if (typeof source.jobStatus === "string") snapshot.jobStatus = truncateString(source.jobStatus, 50);
  if (typeof source.currentStage === "string") snapshot.currentStage = truncateString(source.currentStage, 50);
  if (typeof source.errorMessage === "string") snapshot.errorMessage = truncateString(source.errorMessage);
  if (typeof source.errorHint === "string") snapshot.errorHint = truncateString(source.errorHint);
  if (typeof source.timestamp === "string") snapshot.timestamp = truncateString(source.timestamp, 100);

  const qualityWarnings = sanitizeStringArray(source.qualityWarnings);
  if (qualityWarnings) snapshot.qualityWarnings = qualityWarnings;

  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

export function isBugReportType(value: unknown): value is BugReportType {
  return typeof value === "string" && BUG_REPORT_TYPES.includes(value as BugReportType);
}

export function isBugReportStatus(value: unknown): value is BugReportStatus {
  return typeof value === "string" && BUG_REPORT_STATUSES.includes(value as BugReportStatus);
}

export function isBugReportSourceArea(value: unknown): value is BugReportSourceArea {
  return typeof value === "string" && BUG_REPORT_SOURCE_AREAS.includes(value as BugReportSourceArea);
}

export function clampBugReportListLimit(value: unknown, fallback = BUG_REPORT_LIST_DEFAULT_LIMIT) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, BUG_REPORT_LIST_MAX_LIMIT);
}

export function clampOffset(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

export function normalizeBugReportDescription(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > BUG_REPORT_DESCRIPTION_MAX_LENGTH
    ? trimmed.slice(0, BUG_REPORT_DESCRIPTION_MAX_LENGTH)
    : trimmed;
}

export function normalizeBugReportRoute(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > BUG_REPORT_ROUTE_MAX_LENGTH
    ? trimmed.slice(0, BUG_REPORT_ROUTE_MAX_LENGTH)
    : trimmed;
}

export function normalizeAdminNotes(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > BUG_REPORT_ADMIN_NOTES_MAX_LENGTH
    ? trimmed.slice(0, BUG_REPORT_ADMIN_NOTES_MAX_LENGTH)
    : trimmed;
}

export function sanitizeBugReportMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!TOP_LEVEL_ALLOWED_KEYS.has(key)) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) sanitized[key] = truncateString(trimmed);
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    if (key === "viewport") {
      const viewport = sanitizeViewport(value);
      if (viewport) sanitized[key] = viewport;
      continue;
    }

    if (key === "qualityWarnings") {
      const warnings = sanitizeStringArray(value);
      if (warnings) sanitized[key] = warnings;
      continue;
    }

    if (key === "lastFailureSnapshot") {
      const snapshot = sanitizeFailureSnapshot(value);
      if (snapshot) sanitized[key] = snapshot;
    }
  }

  return sanitized;
}

export function deriveResolvedAt(status: BugReportStatus, now = new Date()) {
  return status === "resolved" || status === "closed" ? now : null;
}
