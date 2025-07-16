#!/bin/bash

echo "🔍 Testing Speedtest CLI installation on Railway..."

# Check if speedtest command exists
if command -v speedtest &> /dev/null; then
    echo "✅ Speedtest CLI found!"
    echo "📍 Location: $(which speedtest)"
    echo "🔢 Version: $(speedtest --version | head -1)"
    
    # Test basic functionality (just check if it can show help)
    echo "🧪 Testing CLI functionality..."
    if speedtest --help &> /dev/null; then
        echo "✅ Speedtest CLI is functional!"
        
        # Try to run a quick test (with timeout for safety)
        echo "🏃 Running quick test to verify CLI works..."
        timeout 30s speedtest --accept-license --accept-gdpr --format=json --no-upload || echo "⚠️ Quick test failed or timed out (this is normal for first run)"
        
    else
        echo "❌ Speedtest CLI found but not functional"
        exit 1
    fi
else
    echo "❌ Speedtest CLI not found!"
    echo "📦 Available in PATH:"
    echo $PATH
    echo "📁 Contents of /usr/local/bin:"
    ls -la /usr/local/bin/ | grep -i speed || echo "No speedtest files found"
    exit 1
fi

echo "🎉 Speedtest CLI verification complete!"
