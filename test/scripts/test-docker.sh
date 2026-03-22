#!/bin/bash

# Rezepti React E2E Test Script - Docker Environment
# Run comprehensive E2E tests on Docker containers

set -e

echo "========================================"
echo "REZEPTI REACT E2E TESTS - DOCKER ENVIRONMENT"
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
DOCKER_COMPOSE_FILE="docker-compose.yml"
API_BASE="http://localhost:3000"
TEST_TIMEOUT=120000
BACKUP_DIR="test/backups/docker"

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

# Function to check Docker availability
check_docker() {
    print_info "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        return 1
    fi
    
    print_success "Docker is available"
    return 0
}

# Function to check Docker Compose
check_docker_compose() {
    print_info "Checking Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available"
        return 1
    fi
    
    print_success "Docker Compose is available"
    return 0
}

# Function to start Docker containers
start_containers() {
    local profile=${1:-"react"}
    
    print_info "Starting Docker containers with profile: $profile..."
    
    # Check if containers are already running
    if docker ps --filter "name=rezepti" --format "{{.Names}}" | grep -q "rezepti"; then
        print_warning "Containers are already running. Stopping first..."
        stop_containers
    fi
    
    # Start containers with specified profile
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        DOCKER_COMPOSE_CMD="docker compose"
    fi
    
    if [ "$profile" = "all" ]; then
        print_info "Starting all profiles..."
        $DOCKER_COMPOSE_CMD --profile react up -d
        $DOCKER_COMPOSE_CMD --profile legacy up -d
    else
        $DOCKER_COMPOSE_CMD --profile "$profile" up -d
    fi
    
    # Wait for containers to be ready
    print_info "Waiting for containers to be ready..."
    sleep 15
    
    # Check container status
    if ! check_container_health; then
        print_error "Containers failed to start properly"
        return 1
    fi
    
    print_success "Docker containers started successfully"
    return 0
}

# Function to check container health
check_container_health() {
    print_info "Checking container health..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$API_BASE/api/v1/health" | grep -q '"status":"ok"'; then
            print_success "API is responding"
            return 0
        fi
        
        print_info "Waiting for API... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "API did not become ready within timeout"
    return 1
}

# Function to stop Docker containers
stop_containers() {
    print_info "Stopping Docker containers..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        docker compose down
    fi
    
    print_success "Docker containers stopped"
}

# Function to backup container data
backup_container_data() {
    print_info "Backing up container data..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Backup database files from volume
    if [ -d "data" ]; then
        tar -czf "$BACKUP_DIR/data_$TIMESTAMP.tar.gz" data/
        print_success "Backed up data directory"
    else
        print_warning "Data directory not found"
    fi
    
    # Backup Docker Compose configuration
    cp "$DOCKER_COMPOSE_FILE" "$BACKUP_DIR/docker-compose_$TIMESTAMP.yml"
    print_success "Backed up Docker Compose file"
}

# Function to restore container data
restore_container_data() {
    print_info "Restoring container data..."
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/data_*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
        # Remove existing data
        rm -rf data/
        
        # Restore from backup
        tar -xzf "$LATEST_BACKUP"
        print_success "Restored data from $LATEST_BACKUP"
    else
        print_warning "No data backup found"
    fi
}

# Function to run tests inside container
run_tests_in_container() {
    local test_type=$1
    
    print_info "Running $test_type tests inside container..."
    
    # Get container name
    CONTAINER_NAME=$(docker ps --filter "name=rezepti-react" --format "{{.Names}}" | head -1)
    
    if [ -z "$CONTAINER_NAME" ]; then
        print_error "React container not found"
        return 1
    fi
    
    case $test_type in
        "e2e")
            docker exec "$CONTAINER_NAME" npm test -- --run e2e
            ;;
        "unit")
            docker exec "$CONTAINER_NAME" npm test -- --run unit
            ;;
        "performance")
            docker exec "$CONTAINER_NAME" npm test -- --run performance
            ;;
        "all")
            docker exec "$CONTAINER_NAME" npm test
            ;;
        *)
            print_error "Unknown test type: $test_type"
            return 1
            ;;
    esac
    
    return $?
}

# Function to run E2E tests from host
run_e2e_from_host() {
    print_info "Running E2E tests from host against Docker containers..."
    
    # Check if test file exists
    if [ ! -f "test/e2e/docker.test.ts" ]; then
        print_error "Docker test file not found"
        return 1
    fi
    
    # Run the test using vitest
    npx vitest run test/e2e/docker.test.ts --reporter=verbose
    
    return $?
}

# Function to test container networking
test_container_networking() {
    print_info "Testing container networking..."
    
    # Test internal connectivity
    CONTAINER_NAME=$(docker ps --filter "name=rezepti-react" --format "{{.Names}}" | head -1)
    
    if [ -z "$CONTAINER_NAME" ]; then
        print_error "No container found for networking test"
        return 1
    fi
    
    print_info "Testing connectivity from container to API..."
    if docker exec "$CONTAINER_NAME" curl -s http://localhost:3000/api/v1/health | grep -q '"status":"ok"'; then
        print_success "Container can reach internal API"
    else
        print_error "Container cannot reach internal API"
        return 1
    fi
    
    print_info "Testing external connectivity from container..."
    if docker exec "$CONTAINER_NAME" curl -s --max-time 5 https://api.groq.com/v1/health | grep -q '"status"'; then
        print_success "Container has external internet access"
    else
        print_warning "Container may not have external internet access (this might be expected)"
    fi
    
    return 0
}

# Function to test container resources
test_container_resources() {
    print_info "Testing container resources..."
    
    CONTAINER_NAME=$(docker ps --filter "name=rezepti-react" --format "{{.Names}}" | head -1)
    
    if [ -z "$CONTAINER_NAME" ]; then
        print_error "No container found for resource test"
        return 1
    fi
    
    # Check container stats
    print_info "Container resource usage:"
    docker stats "$CONTAINER_NAME" --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    # Check container logs for errors
    print_info "Recent container logs (last 10 lines):"
    docker logs --tail 10 "$CONTAINER_NAME"
    
    return 0
}

# Function to test volume persistence
test_volume_persistence() {
    print_info "Testing volume persistence..."
    
    # Create a test file in volume
    TEST_FILE="data/test-persistence-$(date +%s).txt"
    echo "Test data for persistence check: $(date)" > "$TEST_FILE"
    
    print_info "Created test file: $TEST_FILE"
    
    # Restart container
    print_info "Restarting container..."
    stop_containers
    sleep 5
    start_containers "react"
    
    # Check if file still exists
    if [ -f "$TEST_FILE" ]; then
        print_success "Volume persistence verified: $TEST_FILE"
        rm "$TEST_FILE"
        return 0
    else
        print_error "Volume persistence failed: $TEST_FILE not found"
        return 1
    fi
}

# Function to generate Docker test report
generate_docker_report() {
    print_info "Generating Docker test report..."
    
    REPORT_FILE="test/docker-report_$(date +%Y%m%d_%H%M%S).md"
    
    # Get Docker information
    DOCKER_VERSION=$(docker --version)
    DOCKER_COMPOSE_VERSION=$(docker-compose --version 2>/dev/null || docker compose version 2>/dev/null || echo "Not available")
    CONTAINER_INFO=$(docker ps --filter "name=rezepti" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}")
    
    cat > "$REPORT_FILE" << EOF
# Rezepti Docker Test Report
Generated: $(date)

## Docker Environment
- Docker Version: $DOCKER_VERSION
- Docker Compose: $DOCKER_COMPOSE_VERSION
- API Base: $API_BASE

## Running Containers
\`\`\`
$CONTAINER_INFO
\`\`\`

## System Resources
\`\`\`
$(docker system df)
\`\`\`

## Volume Information
\`\`\`
$(docker volume ls | grep rezepti || echo "No rezepti volumes found")
\`\`\`

## Network Information
\`\`\`
$(docker network ls | grep rezepti || echo "No rezepti networks found")
\`\`\`

## Test Results
\`\`\`
$1
\`\`\`

## Recommendations
EOF
    
    print_success "Docker test report generated: $REPORT_FILE"
}

# Function to cleanup Docker resources
cleanup_docker() {
    print_info "Cleaning up Docker resources..."
    
    # Stop containers
    stop_containers
    
    # Remove unused containers, networks, images
    docker system prune -f
    
    # Restore data
    restore_container_data
    
    print_success "Docker cleanup completed"
}

# Main execution
main() {
    local test_type=${1:-"e2e"}
    local profile=${2:-"react"}
    
    print_info "Starting Docker $test_type test suite with profile: $profile"
    
    # Trap signals for cleanup
    trap cleanup_docker EXIT INT TERM
    
    # Check prerequisites
    if ! check_docker; then
        exit 1
    fi
    
    if ! check_docker_compose; then
        exit 1
    fi
    
    # Backup data
    backup_container_data
    
    # Start containers
    if ! start_containers "$profile"; then
        print_error "Failed to start containers"
        exit 1
    fi
    
    # Test networking
    if ! test_container_networking; then
        print_warning "Networking test had issues, continuing anyway..."
    fi
    
    # Run tests
    case $test_type in
        "e2e")
            run_e2e_from_host
            ;;
        "container")
            run_tests_in_container "e2e"
            ;;
        "resources")
            test_container_resources
            ;;
        "persistence")
            test_volume_persistence
            ;;
        "all")
            run_e2e_from_host
            test_container_resources
            test_volume_persistence
            ;;
        *)
            print_error "Unknown test type: $test_type"
            cleanup_docker
            exit 1
            ;;
    esac
    
    TEST_EXIT_CODE=$?
    
    # Test resources regardless
    test_container_resources
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        print_success "All Docker tests passed!"
    else
        print_error "Some Docker tests failed with exit code: $TEST_EXIT_CODE"
    fi
    
    # Generate report
    # generate_docker_report "$TEST_RESULTS"
    
    exit $TEST_EXIT_CODE
}

# Parse command line arguments
if [ $# -gt 0 ]; then
    case $1 in
        "help"|"-h"|"--help")
            echo "Usage: $0 [test_type] [profile]"
            echo ""
            echo "Available test types:"
            echo "  e2e          - Run E2E tests against Docker (default)"
            echo "  container    - Run tests inside container"
            echo "  resources    - Test container resources"
            echo "  persistence  - Test volume persistence"
            echo "  all          - Run all Docker tests"
            echo ""
            echo "Available profiles:"
            echo "  react        - React profile (default)"
            echo "  legacy       - Legacy profile"
            echo "  all          - All profiles"
            echo ""
            echo "Examples:"
            echo "  $0                 # Run E2E tests against React profile"
            echo "  $0 e2e legacy      # Run E2E tests against Legacy profile"
            echo "  $0 all             # Run all Docker tests"
            echo "  $0 persistence     # Test volume persistence"
            exit 0
            ;;
        *)
            if [ $# -eq 1 ]; then
                main "$1"
            else
                main "$1" "$2"
            fi
            ;;
    esac
else
    main "e2e"
fi