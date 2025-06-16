# Speed Test Monitoring System - Setup Script
# This script installs Ookla Speedtest CLI and configures the system

Write-Host "=== Speed Test Monitoring System Setup ===" -ForegroundColor Green
Write-Host "Installing Ookla Speedtest CLI..." -ForegroundColor Yellow

# Check if WinGet is available
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Using WinGet to install Speedtest CLI..." -ForegroundColor Blue
    winget install Ookla.Speedtest.CLI
} elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "Using Chocolatey to install Speedtest CLI..." -ForegroundColor Blue
    choco install speedtest -y
} else {
    Write-Host "Neither WinGet nor Chocolatey found." -ForegroundColor Red
    Write-Host "Please install manually from: https://www.speedtest.net/apps/cli" -ForegroundColor Yellow
    exit 1
}

# Verify installation
Write-Host "Verifying installation..." -ForegroundColor Yellow
if (Get-Command speedtest -ErrorAction SilentlyContinue) {
    $version = speedtest --version
    Write-Host "✅ Speedtest CLI installed successfully!" -ForegroundColor Green
    Write-Host "Version: $version" -ForegroundColor Cyan
    
    # Accept license
    Write-Host "Accepting license agreement..." -ForegroundColor Yellow
    speedtest --accept-license --accept-gdpr > $null
    
    Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
    Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "❌ Installation failed. Please install manually." -ForegroundColor Red
    Write-Host "See SPEEDTEST_SETUP.md for detailed instructions." -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
