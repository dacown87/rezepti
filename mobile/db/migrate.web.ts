// Web-Stub: expo-sqlite ist nur auf Native verfügbar.
// Auf Web läuft die App API-backed — kein lokales SQLite nötig.

// Minimal-Stub der gleichen API damit Screens auf Web compilieren.
const webDbStub = {
  getAllAsync: async <T>(_sql: string, ..._args: unknown[]): Promise<T[]> => [],
  getFirstAsync: async <T>(_sql: string, ..._args: unknown[]): Promise<T | null> => null,
  runAsync: async (_sql: string, ..._args: unknown[]) => ({ changes: 0, lastInsertRowId: 0 }),
  execAsync: async (_sql: string) => {},
};

export async function initDB() {
  // Kein-Op auf Web
  return webDbStub as never;
}

export function getDB() {
  return webDbStub as never;
}
