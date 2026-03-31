# Session Learnings - 2026-03-29

## Mistakes to Avoid

### 1. Gitignored Build Files in Docker
- **What went wrong**: `public/assets/` was in `.gitignore`, so Docker builds had no frontend JS bundles
- **Result**: 404 errors on all JS assets, white screen
- **How to fix**: Build frontend inside Docker with new `frontend-builder` stage

### 2. Frontend Build Not in Docker
- **What went wrong**: Frontend was built locally and committed, but files were gitignored
- **Solution**: Added `frontend-builder` stage to Dockerfile:
  ```dockerfile
  # ─── frontend-builder ─────────────────────────────────────────────────────────
  FROM base AS frontend-builder
  WORKDIR /app
  COPY .npmrc package*.json ./
  RUN npm install
  COPY frontend/ ./frontend/
  COPY vite.config.ts ./
  RUN npm run build:react
  ```

### 3. Missing Vite Config in Docker
- **What went wrong**: `vite.config.ts` stayed in root, but wasn't copied to Docker image
- **Result**: Vite couldn't find `root: 'frontend'` configuration, build failed with "Cannot resolve entry module index.html"
- **Fix**: Add `COPY vite.config.ts ./` before build step

### 4. Vite Root Resolution with Rollup
- **What went wrong**: Vite with `root: 'frontend'` needs explicit `rollupOptions.input`
- **Fix in vite.config.ts**:
  ```typescript
  build: {
    outDir: '../public',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  ```

### 5. Wrong npm Script
- **What went wrong**: Used `npm ci` in frontend-builder but no lock file existed
- **Fix**: Use `npm install` instead

### 6. Wrong Working Directory
- **What went wrong**: Tried `cd ../ && npm run build:react` from frontend dir
- **Fix**: Run from root where `package.json` with `build:react` script exists

### 7. GitHub Actions paths-ignore
- **What went wrong**: Workflow ignored all `**.md` and `docs/**` but still didn't trigger on merge commits
- **Fix**: Remove `paths-ignore` entirely

## Patterns Discovered

### Pattern: Docker Multi-Stage Frontend Build
- **Context**: When frontend dependencies are in root `package.json` but source is in subdirectory
- **Implementation**: Add dedicated build stage that copies root package.json and vite.config.ts
- **Example**:
  ```dockerfile
  FROM base AS frontend-builder
  WORKDIR /app
  COPY .npmrc package*.json ./
  RUN npm install
  COPY frontend/ ./frontend/
  COPY vite.config.ts ./
  RUN npm run build:react
  ```

### Pattern: Vite Root with Rollup Input
- **Context**: When `root: 'frontend'` is used but Vite can't find entry point in Docker
- **Implementation**: Add explicit `rollupOptions.input` pointing to `index.html`
- **Example**:
  ```typescript
  build: {
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  ```

## Instinct Triggers

```json
{
  "trigger": "Docker build fails with 'Cannot resolve entry module index.html'",
  "action": "Check if vite.config.ts is copied into Docker image - add COPY vite.config.ts ./",
  "confidence": 0.9,
  "source": "session-extraction",
  "timestamp": "2026-03-29T20:00:00Z"
}
```

```json
{
  "trigger": "White screen in production but local works",
  "action": "Check if build artifacts are gitignored and need to be built in Docker",
  "confidence": 0.9,
  "source": "session-extraction",
  "timestamp": "2026-03-29T20:00:00Z"
}
```
