#!/bin/bash

# Rezepti React E2E Test Script - Local Environment
# Run comprehensive E2E tests on local development environment

set -e

echo "========================================"
echo "REZEPTI REACT E2E TESTS - LOCAL ENVIRONMENT"
echo "========================================"
echo "Starting at: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3000"
TEST_TIMEOUT=60000
REACT_DB="data/rezepti-react.db"
LEGACY_DB="data/rezepti.sqlite"
BACKUP_DIR="test/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if server is running
check_server() {
    print_info "Checking if server is running at $API_BASE..."
    
    if curl -s --head "$API_BASE/api/v1/health" | grep "200" > /dev/null; then
        print_success "Server is running and responding"
        return 0
    else
        print_error "Server is not responding at $API_BASE"
        print_info "Attempting to start server..."
        
        # Try to start the server
        if npm run dev > /dev/null 2>&1 &
        then
            SERVER_PID=$!
            print_info "Server started with PID: $SERVER_PID"
            
            # Wait for server to be ready
            print_info "Waiting for server to be ready..."
            sleep 10
            
            # Check again
            if curl -s --head "$API_BASE/api/v1/health" | grep "200" > /dev/null; then
                print_success "Server is now running"
                return 0
            else
                print_error "Server failed to start"
                return 1
            fi
        else
            print_error "Failed to start server"
            return 1
        fi
    fi
}

# Function to backup databases
backup_databases() {
    print_info "Backing up databases..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    if [ -f "$REACT_DB" ]; then
        cp "$REACT_DB" "$BACKUP_DIR/rezepti-react_$TIMESTAMP.db"
        print_success "Backed up React database"
    else
        print_warning "React database not found: $REACT_DB"
    fi
    
    if [ -f "$LEGACY_DB" ]; then
        cp "$LEGACY_DB" "$BACKUP_DIR/rezepti_$TIMESTAMP.db"
        print_success "Backed up legacy database"
    else
        print_warning "Legacy database not found: $LEGACY_DB"
    fi
}

# Function to restore databases
restore_databases() {
    print_info "Restoring databases from backup..."
    
    # Find latest backups
    LATEST_REACT_BACKUP=$(ls -t "$BACKUP_DIR"/rezepti-react_*.db 2>/dev/null | head -1)
    LATEST_LEGACY_BACKUP=$(ls -t "$BACKUP_DIR"/rezepti_*.db 2>/dev/null | head -1)
    
    if [ -n "$LATEST_REACT_BACKUP" ] && [ -f "$LATEST_REACT_BACKUP" ]; then
        cp "$LATEST_REACT_BACKUP" "$REACT_DB"
        print_success "Restored React database from $LATEST_REACT_BACKUP"
    else
        print_warning "No React database backup found"
    fi
    
    if [ -n "$LATEST_LEGACY_BACKUP" ] && [ -f "$LATEST_LEGACY_BACKUP" ]; then
        cp "$LATEST_LEGACY_BACKUP" "$LEGACY_DB"
        print_success "Restored legacy database from $LATEST_LEGACY_BACKUP"
    else
        print_warning "No legacy database backup found"
    fi
}

# Function to run tests
run_tests() {
    local test_type=$1
    
    print_info "Running $test_type tests..."
    
    case $test_type in
        "unit")
            npm test -- --run unit
            ;;
        "e2e")
            npm test -- --run e2e
            ;;
        "docker")
            npm test -- --run docker
            ;;
        "performance")
            npm test -- --run performance
            ;;
        "all")
            npm test -- --run
            ;;
        *)
            print_error "Unknown test type: $test_type"
            return 1
            ;;
    esac
    
    return $?
}

# Function to run E2E test directly (alternative to npm test)
run_e2e_direct() {
    print_info "Running E2E tests directly..."
    
    # Check if test file exists
    if [ ! -f "test/e2e/react-api.test.ts" ]; then
        print_error "E2E test file not found: test/e2e/react-api.test.ts"
        return 1
    fi
    
    # Run the test using vitest
    npx vitest run test/e2e/react-api.test.ts --reporter=verbose
    
    return $?
}

# Function to run performance tests
run_performance_tests() {
    print_info "Running performance tests..."
    
    # Check if performance test file exists
    if [ ! -f "test/utils/performance-test.ts" ]; then
        print_error "Performance test utilities not found"
        return 1
    fi
    
    # Run performance test suite
    npx tsx test/utils/performance-test.ts
    
    return $?
}

# Function to generate test report
generate_report() {
    local test_results=$1
    
    print_info "Generating test report..."
    
    REPORT_FILE="test/test-report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# Rezepti React E2E Test Report
Generated: $(date)

## Test Environment
- API Base: $API_BASE
- Test Time: $(date)
- Node Version: $(node --version)
- NPM Version: $(npm --version)

## Test Results
\`\`\`
$test_results
\`\`\`

## Database Status
$(sqlite3 "$REACT_DB" "SELECT COUNT(*) as recipes FROM recipes;" 2>/dev/null || echo "React DB not accessible")
$(sqlite3 "$LEGACY_DB" "SELECT COUNT(*) as recipes FROM recipes;" 2>/dev/null || echo "Legacy DB not accessible")

## System Information
\`\`\`
$(uname -a)
$(df -h .)
\`\`\`
EOF
    
    print_success "Test report generated: $REPORT_FILE"
}

# Function to cleanup
cleanup() {
    print_info "Cleaning up..."
    
    # Kill server if we started it
    if [ -n "$SERVER_PID" ]; then
        print_info "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    # Restore databases
    restore_databases
    
    print_success "Cleanup completed"
}

# Main execution
main() {
    local test_type=${1:-"e2e"}
    
    print_info "Starting $test_type test suite"
    
    # Trap signals for cleanup
    trap cleanup EXIT INT TERM
    
    # Backup databases
    backup_databases
    
    # Check and start server if needed
    if ! check_server; then
        print_error "Failed to start server. Exiting."
        exit 1
    fi
    
    # Run tests
    case $test_type in
        "e2e")
            run_e2e_direct
            ;;
        "performance")
            run_performance_tests
            ;;
        "all")
            run_tests "unit"
            run_tests "e2e"
            run_tests "docker"
            run_tests "performance"
            ;;
        *)
            run_tests "$test_type"
            ;;
    esac
    
    TEST_EXIT_CODE=$?
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        print_success "All tests passed!"
    else
        print_error "Some tests failed with exit code: $TEST_EXIT_CODE"
    fi
    
    # Generate report
    # generate_report "$(npm test -- --reporter=json 2>/dev/null || echo 'Test results unavailable')"
    
    exit $TEST_EXIT_CODE
}

# Parse command line arguments
if [ $# -gt 0 ]; then
    case $1 in
        "help"|"-h"|"--help")
            echo "Usage: $0 [test_type]"
            echo ""
            echo "Available test types:"
            echo "  e2e        - Run E2E tests (default)"
            echo "  unit       - Run unit tests"
            echo "  docker     - Run Docker tests"
            echo "  performance - Run performance tests"
            echo "  all        - Run all tests"
            echo "  help       - Show this help"
            echo ""
            echo "Examples:"
            echo "  $0           # Run E2E tests"
            echo "  $0 all       # Run all tests"
            echo "  $0 performance # Run performance tests"
            exit 0
            ;;
        *)
            main "$1"
            ;;
    esac
else
    main "e2e"
fi