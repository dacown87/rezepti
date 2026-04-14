// No-op stub — lokales expo-sqlite entfernt.
// Alle Datenoperationen laufen über die Server-REST-API.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiDbStub: any = {
  getAllAsync: async <T>(_sql: string, ..._args: unknown[]): Promise<T[]> => [],
  getFirstAsync: async <T>(_sql: string, ..._args: unknown[]): Promise<T | null> => null,
  runAsync: async (_sql: string, ..._args: unknown[]) => ({ changes: 0, lastInsertRowId: 0 }),
  execAsync: async (_sql: string) => {},
};

export async function initDB(): Promise<void> {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDB(): any {
  return apiDbStub;
}
