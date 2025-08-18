#!/bin/bash
# =============================================================================
# Deploy Queue Health Check System
# =============================================================================
# Following pattern from your existing deployment scripts

set -e

echo "🏥 Deploying Queue Health Check System..."
echo "========================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Apply database schema
print_status "Creating database tables..."
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f scripts/add-queue-health-check-tables.sql
    print_success "Database schema applied successfully"
else
    print_error "DATABASE_URL environment variable not set"
    print_warning "Please run: psql YOUR_DATABASE_URL -f scripts/add-queue-health-check-tables.sql"
fi

# Step 2: Run TypeScript check
print_status "Checking TypeScript compilation..."
if npx tsc --noEmit; then
    print_success "TypeScript compilation check passed"
else
    print_error "TypeScript compilation errors found. Please fix before deploying."
    exit 1
fi

# Step 3: Run build to ensure everything compiles
print_status "Building application..."
if npm run build; then
    print_success "Application build successful"
else
    print_error "Build failed. Please check the errors above."
    exit 1
fi

# Step 4: Test the new endpoints (if local)
if [ "$1" = "--test-local" ]; then
    print_status "Testing local endpoints..."
    
    # Wait a moment for the server to be ready
    sleep 2
    
    # Test dry run first
    print_status "Testing dry run..."
    if curl -f -s "http://localhost:3000/api/health/queue-check?maxUsers=10&dryRun=true" > /dev/null; then
        print_success "Dry run test passed"
    else
        print_warning "Dry run test failed (server may not be running)"
    fi
    
    # Test history endpoint
    print_status "Testing history endpoint..."
    if curl -f -s "http://localhost:3000/api/health/queue-check/history?days=1" > /dev/null; then
        print_success "History endpoint test passed"
    else
        print_warning "History endpoint test failed"
    fi
fi

# Step 5: Deploy to Vercel (if vercel CLI is available)
if command -v vercel &> /dev/null; then
    if [ "$1" = "--deploy-prod" ]; then
        print_status "Deploying to Vercel production..."
        vercel --prod
        print_success "Deployed to production"
        
        # Test production endpoints
        print_status "Testing production deployment..."
        VERCEL_URL=$(vercel ls | grep -E "https://.*\.vercel\.app" | head -1 | awk '{print $2}')
        if [ -n "$VERCEL_URL" ]; then
            if curl -f -s "${VERCEL_URL}/api/health/queue-check?maxUsers=5&dryRun=true" > /dev/null; then
                print_success "Production endpoint test passed"
            else
                print_warning "Production endpoint test failed"
            fi
        fi
    else
        print_warning "Skipping Vercel deployment. Use --deploy-prod flag to deploy."
    fi
else
    print_warning "Vercel CLI not found. Skipping deployment."
fi

echo ""
print_success "Queue Health Check System deployment completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Apply database schema: psql \$DATABASE_URL -f scripts/add-queue-health-check-tables.sql"
echo "2. Test dry run: curl \"YOUR_URL/api/health/queue-check?maxUsers=10&dryRun=true\""
echo "3. Run first health check: curl \"YOUR_URL/api/health/queue-check?batchSize=200\""
echo "4. View history: curl \"YOUR_URL/api/health/queue-check/history?days=7\""
echo ""
echo "🔗 API Endpoints:"
echo "• Health Check: /api/health/queue-check"
echo "• History: /api/health/queue-check/history"
echo ""
echo "📊 Usage Examples:"
echo "• Dry run: ?maxUsers=100&dryRun=true"
echo "• Resume: ?offset=25000&batchSize=200"
echo "• History: ?days=7&limit=20&details=true"
