import * as SQLite from 'expo-sqlite';
import { DB_NAME, DB_VERSION, CREATE_TABLES_SQL } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Öffnet die DB und führt Migrations aus.
 * Wirft einen Fehler wenn die Initialisierung fehlschlägt — kein stiller Fehler!
 */
export async function initDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL-Mode für Performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Tabellen anlegen
  await db.execAsync(CREATE_TABLES_SQL);

  // Version tracken
  const versionRow = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM db_version LIMIT 1'
  );

  if (!versionRow) {
    await db.runAsync('INSERT INTO db_version (version) VALUES (?)', DB_VERSION);
  } else if (versionRow.version < DB_VERSION) {
    await runMigrations(db, versionRow.version, DB_VERSION);
    await db.runAsync('UPDATE db_version SET version = ?', DB_VERSION);
  }

  _db = db;
  return db;
}

/**
 * Gibt die bereits initialisierte DB zurück.
 * Wirft wenn initDB() noch nicht aufgerufen wurde.
 */
export function getDB(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error(
      'DB nicht initialisiert. initDB() muss vor getDB() aufgerufen werden.'
    );
  }
  return _db;
}

/**
 * Migrations-Runner — hier künftige Schema-Änderungen eintragen.
 */
async function runMigrations(
  db: SQLite.SQLiteDatabase,
  fromVersion: number,
  toVersion: number
): Promise<void> {
  if (fromVersion < 2) {
    await db.execAsync('ALTER TABLE recipes ADD COLUMN equipment TEXT;');
  }

  console.log(`DB migration: v${fromVersion} → v${toVersion}`);
}
