# Session Learnings - 2026-03-29

## Mistakes to Avoid

### 1. GitHub Actions Workflow Conditional Logic Bug
- **What went wrong**: Workflow had `if: ${{ github.event.workflow_run.conclusion == 'success' }}` which only evaluates to true when triggered via `workflow_run` trigger, NOT when pushed directly
- **Result**: Multiple commits didn't trigger Docker builds, causing deployment issues
- **How to prevent**: Use proper conditional logic:
  ```yaml
  if: |
    github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' ||
    github.event_name == 'push'
  ```

### 2. Build Artifacts in Git
- **What went wrong**: `public/assets/` (Vite build output) were tracked in git
- **Result**: Confusion between old/new build files, unnecessary git noise
- **How to prevent**: Always add build output to `.gitignore`:
  ```
  public/assets/
  frontend/dist/
  ```

### 3. Deployment Not Updating
- **What went wrong**: Docker image was pushed to hub but Northflank cached old version
- **Result**: User saw old version despite successful push
- **How to prevent**: Always trigger "Redeploy/Rollout Restart" on deployment platform after pushing new image

## Patterns Discovered

### Pattern: Multi-Trigger GitHub Actions Workflow
- **Context**: When you want a workflow to run on both workflow_dispatch and push triggers
- **Implementation**: Use YAML multi-line conditional
- **Example**:
  ```yaml
  on:
    workflow_dispatch:
    push:
      branches: [main]
  
  jobs:
    build:
      if: github.event_name == 'workflow_dispatch' || github.event_name == 'push'
  ```

### Pattern: Flexbox Footer Layout
- **Context**: When footer gets cut off on mobile with virtual keyboard or browser chrome
- **Implementation**: Use flex column layout with flex-1 on main content
- **Example**:
  ```jsx
  <div className="min-h-screen flex flex-col">
    <nav className="flex-shrink-0">...</nav>
    <main className="flex-1">...</main>
    <footer className="flex-shrink-0">...</footer>
  </div>
  ```

### Pattern: Better Camera Error Messages
- **Context**: When camera/getUserMedia fails and generic error isn't helpful
- **Implementation**: Catch specific error types
- **Example**:
  ```typescript
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      setQrError('Kamera-Zugriff verweigert. Bitte Berechtigung erteilen.')
    } else if (err.name === 'NotFoundError') {
      setQrError('Keine Kamera gefunden.')
    } else if (err.name === 'NotReadableError') {
      setQrError('Kamera wird bereits von einer anderen App verwendet.')
    }
  }
  ```

## Best Practices Applied

1. **Verify Deployment After Push**
   - Always check the deployed app matches expected changes
   - If not, check deployment platform (Northflank, Vercel, etc.) for cached versions

2. **Test Locally First**
   - Use `npm run dev` and `npm run build:react` to verify changes work before pushing

3. **Clean Git History**
   - Don't commit build artifacts - they're regenerated each build
   - Use `.gitignore` for generated files

## Instinct Triggers

```json
{
  "trigger": "GitHub workflow not running on push",
  "action": "Check if condition only evaluates for workflow_run trigger - fix with proper conditional logic",
  "confidence": 0.9,
  "source": "session-extraction",
  "timestamp": "2026-03-29T17:30:00Z"
}
```

```json
{
  "trigger": "Deployment shows old version after push",
  "action": "Check deployment platform for cached images - trigger redeploy/rollout restart",
  "confidence": 0.8,
  "source": "session-extraction",
  "timestamp": "2026-03-29T17:30:00Z"
}
```
