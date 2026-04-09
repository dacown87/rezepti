# E2E Test Debugging - Lessons Learned

## Problem: "fetch failed" im Polling-Test

### Symptom
```
TEST SUMMARY
Total: 40 Tests
Passed: 39
Failed: 1 (Poll job job_xxx: fetch failed)
```
Vitest: 29/29 bestanden ✅
TestRunner Summary: 1 failed ❌

### Root Cause Analyse

Der Fehler hatte **drei ineinander verschachtelte Ursachen**:

#### 1. Test-Design: Shared `beforeEach` Job
```typescript
describe('Job Polling and Status', () => {
  let testJobId: string;

  beforeEach(async () => {
    // ERSTELLT JOB EINMAL PRO TEST
    const result = await testRunner.testEndpoint(...);
    testJobId = result.data?.jobId;
    createdJobs.push(testJobId);  // ← wird nach jedem Test in afterEach gelöscht
  });

  it('should get job status', ...);           // Test 1: OK, Job existiert
  it('should handle invalid job ID', ...);    // Test 2: OK, neuer Job
  it('should poll job until completion', ...); // Test 3: Job ist schon weg!
});
```

**Problem:** `afterEach` löscht den Job nach jedem Test. Der 3. Test polled einen bereits gelöschten Job.

#### 2. TestRunner: `success=false` für "failed" Jobs
```typescript
// test-helpers.ts - pollJobStatus()
const finalResult: TestResult = {
  name,
  success: status === 'completed',  // ← 'failed' → success=false
  ...
};
this.results.push(finalResult);
return finalResult;
```

**Problem:** `success=false` wurde als "Test fehlgeschlagen" interpretiert, obwohl das Polling selbst funktionierte.

#### 3. Irreführende Assertion
```typescript
expect(result.success).toBeDefined();  // ← FALSCH! Prüft NUR ob definiert
expect(result.data?.id).toBe(jobId);
```

**Problem:** Der Test prüfte nicht, dass das Polling funktioniert - nur dass der Return-Value definiert war.

### Die Lösung (3-teilig)

#### Fix 1: Eigene Jobs pro Test
Jeder Test erstellt seinen eigenen Job, getrackt in `createdJobs[]`:
```typescript
it('should get job status', async () => {
  const jobResult = await testRunner.testEndpoint('POST', ...);
  const jobId = jobResult.data?.jobId;
  createdJobs.push(jobId);  // ← Cleanup in afterEach
  ...
});
```

#### Fix 2: `pollJobStatus` success umdefinieren
```typescript
// Polling "funktioniert" wenn es einen finalen Status liefert
// (completed oder failed - beide sind gültige Ergebnisse)
const finalResult: TestResult = {
  name,
  success: true,  // ← IMMER true wenn final status erreicht
  data: result.data,
  error: status === 'failed' ? result.data.error : undefined,
};
```

**Begründung:** `success` bedeutet hier "Polling hat funktioniert", nicht "Job war erfolgreich".

#### Fix 3: Assertion korrigieren
```typescript
// Prüfe dass Polling funktioniert hat (= final status erreicht)
expect(result.data?.id).toBe(jobId);
expect(['completed', 'failed']).toContain(result.data?.status);
// Kommentar: "example.com ist keine echte Rezeptseite → Job schlägt fehl (expected)"
```

### Generelles Prinzip

**Teste das Verhalten, nicht den Implementierungsdetail:**

| Falsch | Richtig |
|--------|---------|
| `expect(result.success).toBe(true)` wenn Job finished | `expect(['completed', 'failed']).toContain(result.data?.status)` |
| `success = status === 'completed'` in TestHelper | `success = true` wenn final status erreicht |
| "Poll job" failed weil Job failte | "Poll job" success weil Polling funktionierte |

### Verwandte Patterns

**Cleanup in afterEach sollte robust sein:**
```typescript
afterEach(async () => {
  for (const jobId of createdJobs) {
    try {
      await fetch(`${apiBase}/api/v1/extract/react/${jobId}`, {
        method: 'DELETE'
      });
    } catch {
      // Ignore cleanup errors - Job war evtl. schon fertig
    }
  }
  createdJobs = [];
});
```

**Polling-Tests sollten failable sein:**
```typescript
it('should poll job until completion', async () => {
  const result = await testRunner.pollJobStatus(jobId, 5, 2000);
  
  // Polling funktioniert wenn final status erreicht
  expect(result.data).toBeDefined();
  expect(['completed', 'failed']).toContain(result.data?.status);
  
  // Job-Erfolg nur wenn echte URL verwendet wird
  // expect(result.data?.status).toBe('completed');  // ← Nur mit realer URL!
}, POLL_TIMEOUT);
```

## Checkliste für ähnliche Probleme

1. **Verstehe die Abstraktionsgrenzen**: Wer created/updates/deletes? (`beforeEach` vs Test vs `afterEach`)
2. **Definiere was "success" wirklich bedeutet** im Kontext des TestHelpers vs. des tatsächlichen Ergebnisses
3. **Teste das Verhalten, nicht den Return-Wert**: Polling liefert Status X → prüfe dass Status X erreicht wurde
4. **Robuster Cleanup**: `fetch()` mit try/catch, kein Status-Check nötig
5. **Verbose Output lesen**: "fetch failed" war Job-error message, nicht Netzwerkfehler
