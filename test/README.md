# Rezepti React E2E Test Suite

Comprehensive end-to-end test suite for the Rezepti React migration project, including React API endpoints, BYOK support, database migration, and Docker deployment.

## Test Structure

```
test/
├── e2e/                    # E2E test suites
│   ├── react-api.test.ts   # Main React API E2E tests
│   └── docker.test.ts      # Docker environment tests
├── fixtures/               # Test data fixtures
│   └── test-data.ts       # Sample recipes, URLs, API keys
├── scripts/               # Test execution scripts
│   ├── test-local.sh      # Local environment test runner
│   └── test-docker.sh     # Docker environment test runner
├── unit/                  # Unit tests
│   └── key-manager.test.ts
├── utils/                 # Test utilities
│   ├── test-helpers.ts    # Common test utilities
│   └── performance-test.ts # Performance testing
├── setup.ts              # Test environment setup
└── README.md             # This file
```

## Test Categories

### 1. Unit Tests
- **Location**: `test/unit/`
- **Purpose**: Test individual functions and modules in isolation
- **Current Tests**: KeyManager interface tests
- **Run Command**: `npm run test:unit`

### 2. E2E Tests (React API)
- **Location**: `test/e2e/react-api.test.ts`
- **Purpose**: Test complete React API workflows
- **Test Coverage**:
  - Health endpoints (legacy and React)
  - BYOK key validation and management
  - Job creation and polling
  - Database operations (CRUD)
  - Error handling and edge cases
  - Performance testing
- **Run Command**: `npm run test:e2e`

### 3. Docker Environment Tests
- **Location**: `test/e2e/docker.test.ts`
- **Purpose**: Test functionality in Docker containers
- **Test Coverage**:
  - Container health and connectivity
  - Docker-specific database operations
  - Multi-container deployment
  - Volume persistence
  - Resource usage and performance
- **Run Command**: `npm run test:docker`

### 4. Performance Tests
- **Location**: `test/utils/performance-test.ts`
- **Purpose**: Measure system performance and scalability
- **Test Coverage**:
  - Response time benchmarks
  - Throughput testing
  - Concurrent request handling
  - Stress testing
- **Run Command**: `npm run test:performance`

## Test Data

### Sample Recipes
The test suite includes sample recipes for testing database operations:
- Klassische Tomatensuppe (website)
- Spaghetti Carbonara (YouTube)
- Avocado Toast mit Ei (Instagram)

### Test URLs
Categorized test URLs for extraction testing:
- **Website URLs**: Allrecipes, Chefkoch, BBC Good Food, Epicurious
- **YouTube URLs**: Regular videos, shorts, youtu.be links
- **Instagram URLs**: Posts, reels, TV
- **TikTok URLs**: Videos, share URLs
- **Edge Cases**: Long URLs, invalid formats, special characters

### API Keys
Test Groq API keys for BYOK validation:
- Valid format keys
- Invalid format keys
- Empty keys
- Edge cases

## Running Tests

### Quick Start

```bash
# Run all tests
npm run test:all

# Run E2E tests only
npm run test:e2e

# Run Docker tests only
npm run test:docker

# Run performance tests only
npm run test:performance
```

### Local Environment Tests

```bash
# Using npm scripts
npm run test:local

# Using bash script directly
./test/scripts/test-local.sh [test_type]

# Available test types:
#   e2e        - Run E2E tests (default)
#   unit       - Run unit tests
#   docker     - Run Docker tests
#   performance - Run performance tests
#   all        - Run all tests
```

### Docker Environment Tests

```bash
# Using npm scripts
npm run test:docker-full

# Using bash script directly
./test/scripts/test-docker.sh [test_type] [profile]

# Available test types:
#   e2e          - Run E2E tests against Docker (default)
#   container    - Run tests inside container
#   resources    - Test container resources
#   persistence  - Test volume persistence
#   all          - Run all Docker tests

# Available profiles:
#   react        - React profile (default)
#   legacy       - Legacy profile
#   all          - All profiles
```

### Performance Testing

```bash
# Run comprehensive performance suite
npm run test:performance

# Run specific performance test via TypeScript
npx tsx test/utils/performance-test.ts
```

## Test Configuration

### Environment Variables
The test suite uses the following environment variables:

```bash
# API Configuration
API_BASE=http://localhost:3000

# Database Paths
REACT_DB=data/rezepti-react.db
LEGACY_DB=data/rezepti.sqlite

# Timeouts
TEST_TIMEOUT=60000
POLL_TIMEOUT=30000
```

### Database Management
The test suite includes automatic database management:
- **Backup/Restore**: Original databases are backed up before tests and restored after
- **Test Data Seeding**: Sample recipes are inserted for testing
- **Cleanup**: Test data is cleared between test runs

## Test Reports

### Console Output
Tests provide detailed console output including:
- Test names and descriptions
- Request/response details
- Performance metrics
- Success/failure summaries

### Generated Reports
Test scripts can generate markdown reports:
- **Test Reports**: `test/test-report_YYYYMMDD_HHMMSS.md`
- **Docker Reports**: `test/docker-report_YYYYMMDD_HHMMSS.md`

## Test Coverage

### API Endpoints Tested
- ✅ `GET /api/health` - Legacy health check
- ✅ `GET /api/v1/health` - React health check
- ✅ `POST /api/v1/keys/validate` - BYOK validation
- ✅ `POST /api/v1/extract/react` - Job creation
- ✅ `GET /api/v1/extract/react/:jobId` - Job polling
- ✅ `GET /api/v1/recipes` - List recipes
- ✅ `GET /api/v1/recipes/:id` - Get recipe by ID
- ✅ `PUT /api/v1/recipes/:id` - Update recipe
- ✅ `DELETE /api/v1/recipes/:id` - Delete recipe
- ✅ `GET /api/v1/extract/jobs` - List recent jobs

### Error Cases Tested
- ❌ Invalid API keys
- ❌ Malformed URLs
- ❌ Missing required parameters
- ❌ Non-existent resources
- ❌ Concurrent requests
- ❌ Large payloads
- ❌ Network timeouts

### Performance Metrics Collected
- Response times (avg, min, max)
- Percentiles (p50, p90, p95, p99)
- Throughput (requests/second)
- Success/failure rates
- Memory usage (Docker)
- CPU usage (Docker)

## Best Practices

### Writing New Tests
1. **Follow existing patterns**: Use the test utilities and helpers
2. **Test both success and failure cases**
3. **Include performance considerations**
4. **Clean up test data** after each test
5. **Use descriptive test names** that indicate what is being tested

### Test Data Management
1. **Use fixtures** for consistent test data
2. **Don't hardcode sensitive information**
3. **Clean up** after tests to avoid side effects
4. **Backup databases** before destructive operations

### Running Tests in CI/CD
1. **Isolate test environments** using Docker
2. **Set appropriate timeouts** for CI environments
3. **Generate test reports** for analysis
4. **Fail fast** on critical errors

## Troubleshooting

### Common Issues

1. **Server not running**: Ensure the development server is started before running tests
   ```bash
   npm run dev
   ```

2. **Database errors**: Check database file permissions and paths
   ```bash
   ls -la data/
   ```

3. **Docker not available**: Install Docker and ensure the daemon is running
   ```bash
   docker --version
   docker info
   ```

4. **Timeout errors**: Increase timeouts in test configuration
   ```bash
   export TEST_TIMEOUT=120000
   ```

### Debugging Tips

1. **Verbose output**: Use the verbose reporter for detailed logs
   ```bash
   npx vitest run --reporter=verbose
   ```

2. **Isolate failing tests**: Run specific test files
   ```bash
   npx vitest run test/e2e/react-api.test.ts
   ```

3. **Check database state**: Use SQLite CLI to inspect database
   ```bash
   sqlite3 data/rezepti-react.db "SELECT * FROM recipes;"
   ```

4. **Monitor Docker containers**: Check container logs and status
   ```bash
   docker ps
   docker logs rezepti-react
   ```

## Contributing

When adding new tests:

1. **Add test data** to the appropriate fixture file
2. **Update test coverage** documentation
3. **Test both local and Docker** environments
4. **Include performance benchmarks** for new endpoints
5. **Update package.json scripts** if adding new test categories

## License

Part of the Rezepti project. See main project repository for license information.