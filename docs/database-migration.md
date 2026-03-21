# Database Migration for React Frontend

This document describes the new database setup for the React migration of Rezepti.

## Overview

The React migration introduces a new database (`rezepti-react.db`) alongside the existing legacy database (`rezepti.db`). This allows:

1. **Backward compatibility** - Existing API endpoints continue to use the legacy database
2. **Clean migration** - New React frontend uses the new database
3. **Data migration** - Recipes can be copied from legacy to new database
4. **Mobile readiness** - Database interface abstracts platform-specific implementations

## Database Files

| Database | Path | Purpose |
|----------|------|---------|
| Legacy | `data/rezepti.db` | Original database for backward compatibility |
| React | `data/rezepti-react.db` | New database for React frontend |

## Schema

Both databases use the same schema (15 columns):

```sql
CREATE TABLE recipes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  emoji       TEXT,
  source_url  TEXT,
  image_url   TEXT,
  servings    TEXT,
  duration    TEXT,
  calories    INTEGER,
  tags        TEXT,
  ingredients TEXT NOT NULL,
  steps       TEXT NOT NULL,
  transcript  TEXT,
  tried       INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT CURRENT_TIMESTAMP
)
```

## New Files Created

### 1. `src/db-react.ts`
- React-specific database operations
- Same API as legacy `db.ts` but connects to `rezepti-react.db`
- Uses the same Drizzle ORM schema

### 2. `src/db-manager.ts`
- Unified interface for both databases
- Database type selection (`"legacy"` or `"react"`)
- Migration function to copy data between databases

### 3. `src/api-react.ts`
- React-specific API endpoints under `/api/v1/` prefix
- All endpoints use React database
- Includes migration endpoint for admin use

### 4. `scripts/migrate-to-react-db.ts`
- Standalone migration script
- Copies all recipes from legacy to React database
- Can be run via `npm run db:migrate`

### 5. `scripts/test-migration.ts`
- Test script to verify migration works
- Tests CRUD operations on both databases

### 6. `src/interfaces/database.interface.ts`
- Platform-agnostic database interface
- Prepares for mobile (expo-sqlite) compatibility

## API Endpoints

### Legacy Endpoints (use legacy database)
- `GET /api/recipes` - List all recipes
- `GET /api/recipes/:id` - Get recipe by ID
- `PATCH /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

### React Endpoints (use React database)
- `GET /api/v1/recipes` - List all recipes
- `GET /api/v1/recipes/:id` - Get recipe by ID
- `POST /api/v1/recipes` - Create recipe
- `PATCH /api/v1/recipes/:id` - Update recipe
- `DELETE /api/v1/recipes/:id` - Delete recipe
- `POST /api/v1/migrate` - Migrate data from legacy DB (admin)
- `GET /api/v1/health` - Health check for React DB

## Configuration Updates

### `src/config.ts`
Added new configuration:
```typescript
sqlite: {
  path: process.env.SQLITE_PATH || join(process.cwd(), "data", "rezepti.db"),
  reactPath: process.env.SQLITE_REACT_PATH || join(process.cwd(), "data", "rezepti-react.db"),
}
```

### `package.json`
Added new script:
```json
"db:migrate": "tsx scripts/migrate-to-react-db.ts"
```

## Usage

### 1. Initialize Databases
Both databases are automatically initialized when the server starts:
```bash
npm start
```

### 2. Migrate Data
Copy recipes from legacy to React database:
```bash
npm run db:migrate
```

Or use the API endpoint:
```bash
curl -X POST http://localhost:3000/api/v1/migrate
```

### 3. Test Migration
Run the test script to verify everything works:
```bash
npx tsx scripts/test-migration.ts
```

### 4. Use React Database
React frontend should use the new endpoints:
```javascript
// React frontend uses these endpoints
fetch('/api/v1/recipes')  // React database
fetch('/api/recipes')     // Legacy database (backward compatibility)
```

## Mobile Considerations

### Database Abstraction
The `database.interface.ts` provides a platform-agnostic interface:

```typescript
// Node.js (better-sqlite3)
const db = await DatabaseFactory.createNodeDatabase(path);

// React Native (expo-sqlite) - FUTURE
const db = await DatabaseFactory.createReactNativeDatabase(name);
```

### Schema Compatibility
The schema is compatible with both SQLite implementations:
- `INTEGER` for booleans and timestamps (both platforms support)
- `TEXT` for JSON arrays (serialized/deserialized in code)
- `CURRENT_TIMESTAMP` works on both platforms

### Migration Strategy for Mobile
When building mobile apps:
1. Use `expo-sqlite` instead of `better-sqlite3`
2. Implement `database.react-native.js` interface
3. Same schema ensures data compatibility
4. Web API can sync data between web and mobile

## Testing Strategy

### Unit Tests
- Test database operations in isolation
- Mock database connections for speed
- Test serialization/deserialization of JSON fields

### Integration Tests
- Test migration between databases
- Verify data integrity after migration
- Test API endpoints with both databases

### E2E Tests
- Full workflow: extract → save → migrate → retrieve
- Cross-database operations
- Error handling and rollback scenarios

## Error Handling

### Migration Errors
- Transaction rollback on failure
- Logging of failed migrations
- Manual recovery options

### Database Connection Errors
- Fallback to legacy database if React DB fails
- Health endpoints to monitor DB status
- Automatic schema creation on first use

## Performance Considerations

### WAL Mode
Both databases use Write-Ahead Logging (WAL) for better concurrency:
```javascript
sqlite.pragma("journal_mode = WAL");
```

### Indexing
Consider adding indexes for frequently queried fields:
```sql
CREATE INDEX idx_recipes_created_at ON recipes(created_at);
CREATE INDEX idx_recipes_tags ON recipes(tags);
```

### Migration Performance
- Batch insertion in transactions
- Progress reporting for large datasets
- Resume capability for interrupted migrations

## Future Improvements

### 1. Schema Versioning
- Add `schema_version` table
- Migration scripts for schema changes
- Version compatibility checks

### 2. Incremental Sync
- Track last modified timestamps
- Incremental migration instead of full copy
- Conflict resolution for concurrent edits

### 3. Backup/Restore
- Export/import functionality
- Database backup before migration
- Rollback capability

### 4. Monitoring
- Database size monitoring
- Performance metrics
- Alerting for migration failures