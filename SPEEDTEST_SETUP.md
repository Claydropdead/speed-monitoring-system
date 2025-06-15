# Speed Test Monitoring System - Ookla Speedtest CLI Setup

## Install Ookla Speedtest CLI

This system requires the official Ookla Speedtest CLI for accurate speed testing.

### Windows Installation:

1. **Download and Install:**
   - Visit: https://www.speedtest.net/apps/cli
   - Download the Windows version
   - Install following the instructions

2. **Alternative - Using Chocolatey:**
   ```powershell
   choco install speedtest
   ```

3. **Alternative - Using Winget:**
   ```powershell
   winget install Ookla.Speedtest.CLI
   ```

### Verify Installation:

After installation, verify it works by running:
```powershell
speedtest --version
```

You should see output similar to:
```
Speedtest by Ookla CLI 1.x.x
```

### Accept License (Required):

The first time you run speedtest, you need to accept the license:
```powershell
speedtest --accept-license --accept-gdpr
```

### Test Basic Functionality:

Run a basic test to ensure everything works:
```powershell
speedtest --format=json
```

### Features Used in This Application:

- **Real-time Progress**: Uses `--progress` flag for live updates
- **JSON Output**: Uses `--format=json` for structured data
- **License Acceptance**: Automatically accepts with `--accept-license --accept-gdpr`

### Troubleshooting:

1. **Command not found**: Make sure speedtest CLI is in your PATH
2. **License prompt**: Run with `--accept-license --accept-gdpr` flags
3. **Firewall issues**: Ensure your firewall allows speedtest CLI connections
4. **Corporate networks**: May need proxy configuration

### Mock Mode:

If speedtest CLI is not available, the application will fall back to mock data for development purposes.
