# Railway Environment Variable Setup

## Critical: Set Server Timezone to Manila

To fix the time validation issues, you need to set the following environment variable in your Railway project:

### Steps:
1. Go to your Railway dashboard
2. Open your Speed Monitoring System project
3. Go to Variables tab
4. Add this environment variable:

```
Variable Name: TZ
Variable Value: Asia/Manila
```

### Alternative variable (if TZ doesn't work):
```
Variable Name: TIMEZONE  
Variable Value: Asia/Manila
```

### What this does:
- Sets the entire Node.js server to run in Manila timezone (UTC+8)
- Eliminates conflicts between server UTC time and Philippines local time
- Makes all time validation use Manila time consistently
- No more "outside testing hours" errors during valid Philippines time slots

### After setting the variable:
1. Redeploy your Railway service
2. The server will restart with Manila timezone
3. Time validation will work correctly with Philippines time
4. You can test during normal hours (6AM-12PM, 12PM-1PM, 1PM-6PM Manila time)

### Verification:
- Check the Time Status component - it should show server time matching Philippines time
- Speed tests should work during Philippines business hours
- API logs will show "Using server timezone (Asia/Manila)"
