import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = join(tmpdir(), "rezepti");

export function createTempDir(): string {
  if (!existsSync(BASE)) {
    mkdirSync(BASE, { recursive: true });
  }
  return mkdtempSync(join(BASE, "job-"));
}

export function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
