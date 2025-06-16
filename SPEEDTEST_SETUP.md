# Speed Test Monitoring System - Ookla Speedtest CLI Setup

## Overview

This system requires the **official Ookla Speedtest CLI** for accurate speed testing. The CLI must be properly installed and accessible via the system PATH.

## 🚀 Quick Installation Guide

### Method 1: WinGet (Recommended for Windows 10/11)

```powershell
# Install via WinGet (automatically adds to PATH)
winget install Ookla.Speedtest.CLI

# Verify installation
speedtest --version
```

### Method 2: Chocolatey

```powershell
# Install Chocolatey first if not installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Speedtest CLI
choco install speedtest

# Verify installation
speedtest --version
```

### Method 3: Direct Download

1. **Download from Official Site:**
   - Visit: https://www.speedtest.net/apps/cli
   - Download the Windows version
   - Run the installer

2. **Manual PATH Configuration (if needed):**
   - The installer usually adds to PATH automatically
   - If not, add the installation directory to your system PATH

## 🔧 PATH Configuration

### Checking Current Installation

```powershell
# Check if speedtest is in PATH
speedtest --version

# Find the executable location
Get-Command speedtest | Select-Object Path

# Alternative check
where speedtest
```

### Current System Status

Your system shows:
```
Location: C:\Users\patri\AppData\Local\Microsoft\WinGet\Packages\Ookla.Speedtest.CLI_Microsoft.Winget.Source_8wekyb3d8bbwe\speedtest.exe
Version: 3.8.0.0 (installed via WinGet)
```

### Manual PATH Setup (if needed)

If `speedtest` command is not found, add it manually:

1. **Find Installation Directory:**
   ```powershell
   # Common installation paths:
   # WinGet: C:\Users\[USERNAME]\AppData\Local\Microsoft\WinGet\Packages\Ookla.Speedtest.CLI_*
   # Chocolatey: C:\ProgramData\chocolatey\bin
   # Direct Install: C:\Program Files\Speedtest CLI
   ```

2. **Add to System PATH:**
   ```powershell
   # Method 1: Via PowerShell (Temporary - current session only)
   $env:PATH += ";C:\path\to\speedtest\directory"
   
   # Method 2: Via System Properties (Permanent)
   # 1. Press Win + R, type "sysdm.cpl"
   # 2. Go to Advanced tab → Environment Variables
   # 3. Add speedtest directory to PATH variable
   ```

3. **Verify PATH Update:**
   ```powershell
   # Restart PowerShell/Command Prompt, then test:
   speedtest --version
   ```

## 🛠️ Application Integration

### How the System Uses Speedtest CLI

The application executes speedtest via Node.js `spawn()`:

```typescript
// From src/lib/speedtest.ts
const speedtest = spawn('speedtest', [
  '--format=json',
  '--accept-license', 
  '--accept-gdpr',
  '--server-id=10493'
], {
  shell: true  // Important: Uses system shell to find speedtest
});
```

### Key Points:

1. **Shell Mode**: Uses `shell: true` to leverage system PATH
2. **JSON Output**: `--format=json` for structured data parsing
3. **Auto-Accept**: `--accept-license --accept-gdpr` to avoid prompts
4. **Server Selection**: `--server-id=10493` for consistent testing

## ✅ Verification & Testing

### 1. Basic Functionality Test

```powershell
# Test basic command
speedtest --version

# Expected output similar to:
# Speedtest by Ookla CLI 1.x.x
```

### 2. License Acceptance (Required on first run)

```powershell
# Accept license terms (required once)
speedtest --accept-license --accept-gdpr

# Or run a quick test that auto-accepts
speedtest --format=json --accept-license --accept-gdpr
```

### 3. JSON Output Test

```powershell
# Test JSON format (used by the application)
speedtest --format=json --accept-license --accept-gdpr

# Should return structured JSON data
```

### 4. Application Integration Test

```powershell
# Test from the project directory
cd D:\Speed-test-monitoring-system
npm run dev

# Then test speed test functionality in the web interface
```

## 🔍 Troubleshooting

### Common Issues & Solutions

#### 1. "Command not found" or "'speedtest' is not recognized"

**Cause**: Speedtest CLI not in system PATH

**Solution**: 
```powershell
# Check installation
Get-Command speedtest -ErrorAction SilentlyContinue

# If not found, reinstall with WinGet
winget install Ookla.Speedtest.CLI

# Or manually add to PATH (see PATH Configuration section above)
```

#### 2. "License agreement required"

**Cause**: First-time usage requires license acceptance

**Solution**:
```powershell
speedtest --accept-license --accept-gdpr
```

#### 3. Application shows "Mock data" instead of real results

**Cause**: Application cannot execute speedtest command

**Check**:
```powershell
# Verify from same directory as your Node.js app
cd D:\Speed-test-monitoring-system
speedtest --version
```

#### 4. Firewall/Network Issues

**Symptoms**: Speedtest fails with network errors

**Solutions**:
- Check Windows Firewall settings
- Ensure speedtest.exe is allowed through firewall
- For corporate networks: Configure proxy if needed

#### 5. Permission Issues

**Cause**: Insufficient permissions to execute speedtest

**Solution**:
```powershell
# Run PowerShell as Administrator and test
speedtest --version
```

## 🌐 Corporate/Enterprise Considerations

### Proxy Configuration

```powershell
# If behind corporate proxy, configure:
speedtest --proxy=http://proxy.company.com:8080
```

### Firewall Whitelist

Add these to firewall exceptions:
- `speedtest.exe` (the CLI executable)
- Outbound HTTPS (port 443) to `*.speedtest.net`
- Outbound HTTP (port 80) for some test servers

### Network Policy

Ensure your network policy allows:
- Speed testing applications
- Bandwidth measurement tools
- Connections to Ookla's test servers

## 📋 Production Deployment Notes

### Server Deployment

```bash
# For Windows Server environments
# 1. Install via package manager (preferred)
winget install Ookla.Speedtest.CLI

# 2. Verify system service can access
# Run as the same user account that runs your Node.js application

# 3. Test from application context
node -e "const { spawn } = require('child_process'); const test = spawn('speedtest', ['--version']); test.stdout.on('data', (data) => console.log(data.toString()));"
```

### Docker Considerations

```dockerfile
# For containerized deployments
# Add to Dockerfile:
RUN wget -O- https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash
RUN apt-get install speedtest
```

## 🎯 System Status

✅ **Current Status**: Speedtest CLI properly installed and configured
- **Location**: `C:\Users\patri\AppData\Local\Microsoft\WinGet\Packages\Ookla.Speedtest.CLI_*\speedtest.exe`
- **Version**: 3.8.0.0
- **Installation Method**: WinGet
- **PATH Status**: ✅ Available globally
- **License Status**: ✅ Ready for use

Your system is properly configured and ready for speed testing!
