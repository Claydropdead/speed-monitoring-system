#!/bin/bash

echo "🚀 Railway Production Speedtest CLI Test"
echo "========================================"

# Check if we're running in Railway
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
    echo "✅ Running in Railway environment: $RAILWAY_ENVIRONMENT"
else
    echo "⚠️ Not in Railway environment (this is normal for local testing)"
fi

echo ""
echo "🔍 System Information:"
echo "Platform: $(uname -a)"
echo "Node.js: $(node --version)"
echo "Working Directory: $(pwd)"
echo "User: $(whoami)"

echo ""
echo "🔍 PATH Information:"
echo "PATH: $PATH"

echo ""
echo "🔍 Looking for Speedtest CLI..."

# Check each possible location
LOCATIONS=(
    "/usr/local/bin/speedtest"
    "/usr/bin/speedtest" 
    "/bin/speedtest"
    "speedtest"
)

FOUND_CLI=""

for location in "${LOCATIONS[@]}"; do
    echo "Checking: $location"
    if command -v "$location" &> /dev/null; then
        echo "  ✅ Found at: $location"
        if [ -z "$FOUND_CLI" ]; then
            FOUND_CLI="$location"
        fi
    else
        echo "  ❌ Not found: $location"
    fi
done

if [ -n "$FOUND_CLI" ]; then
    echo ""
    echo "🎉 Speedtest CLI found at: $FOUND_CLI"
    
    echo ""
    echo "🔍 CLI Information:"
    $FOUND_CLI --version
    
    echo ""
    echo "🏃 Testing CLI functionality..."
    echo "Running: $FOUND_CLI --accept-license --accept-gdpr --help"
    
    if timeout 30s $FOUND_CLI --accept-license --accept-gdpr --help > /dev/null 2>&1; then
        echo "✅ CLI is functional!"
        
        echo ""
        echo "🌐 Testing server connectivity (quick test)..."
        echo "Running: timeout 60s $FOUND_CLI --accept-license --accept-gdpr --format=json --no-upload"
        
        if timeout 60s $FOUND_CLI --accept-license --accept-gdpr --format=json --no-upload > /dev/null 2>&1; then
            echo "✅ Server connectivity test passed!"
        else
            echo "⚠️ Server connectivity test failed (this might be normal depending on network)"
        fi
        
    else
        echo "❌ CLI found but not functional"
        exit 1
    fi
    
else
    echo ""
    echo "❌ Speedtest CLI not found in any expected location!"
    echo ""
    echo "🔍 Debug Information:"
    echo "Contents of /usr/local/bin:"
    ls -la /usr/local/bin/ | head -10
    echo ""
    echo "Contents of /usr/bin (speedtest related):"
    ls -la /usr/bin/ | grep -i speed || echo "No speedtest files found"
    echo ""
    echo "Available commands containing 'speed':"
    compgen -c | grep -i speed || echo "None found"
    
    exit 1
fi

echo ""
echo "🎉 All tests completed successfully!"
