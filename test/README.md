# Rezepti Test Suite

## Test Structure

```
test/
├── e2e/                    # E2E test suites
│   ├── react-api.test.ts   # Main React API E2E tests
│   ├── docker.test.ts      # Docker environment tests
│   ├── basic-api.test.ts   # Basic API smoke tests
│   └── smoke.test.ts       # Smoke tests
├── fixtures/               # Test data fixtures
│   └── test-data.ts        # Sample recipes, URLs, API keys
├── scripts/                # Test execution scripts
│   ├── test-local.sh       # Local environment test runner
│   └── test-docker.sh      # Docker environment test runner
├── unit/                   # Unit tests
│   ├── byok-validator.test.ts
│   ├── db-react.test.ts
│   └── job-manager.test.ts
├── utils/                  # Test utilities
│   └── test-helpers.ts     # Common test utilities
├── api/                    # API client tests
│   ├── client.test.ts
│   ├── services.test.ts
│   └── types.test.ts
├── setup.ts                # Test environment setup
└── README.md               # This file
```

## Test Categories

### Unit Tests
- **Location**: `test/unit/`
- **Run**: `npm run test:unit`

### E2E Tests
- **Location**: `test/e2e/`
- **Require**: Running server (`npm run dev`)
- **Run**: `npm run test:e2e`

### Docker Tests
- **Location**: `test/e2e/docker.test.ts`
- **Require**: Running Docker container
- **Run**: `npm run test:docker`

## Running Tests

```bash
# Unit tests only (no server needed)
npm test -- --run --exclude="test/e2e/**"

# All unit tests
npm run test:unit

# E2E tests (requires running server)
npm run test:e2e

# All tests
npm run test:all
```

### Local Script

```bash
./test/scripts/test-local.sh [test_type]
# test_type: e2e (default) | unit | docker | all
```

### Docker Script

```bash
./test/scripts/test-docker.sh [test_type] [profile]
# test_type: e2e | container | resources | persistence | all
# profile: react (default) | all
```

## Test Data

- Sample recipes (Tomatensuppe, Spaghetti Carbonara, Avocado Toast)
- Categorized test URLs (Website, YouTube, Instagram, TikTok, edge cases)
- BYOK API key test cases (valid/invalid formats)

## Troubleshooting

```bash
# Server not running
npm run dev

# Database errors
ls -la data/

# Verbose output
npx vitest run --reporter=verbose

# Isolate a test file
npx vitest run test/e2e/react-api.test.ts

# Inspect database
sqlite3 data/rezepti-react.db "SELECT * FROM recipes;"
```
