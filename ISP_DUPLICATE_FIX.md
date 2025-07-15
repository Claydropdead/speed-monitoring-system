# ISP Duplicate Names Fix

## Problem
When adding multiple ISPs with the same name (e.g., "PLDT" and "PLDT"), the speed test system couldn't distinguish between them, causing tests to run on the wrong ISP connection.

## Solution
We've implemented a unique ISP identification system that allows multiple ISPs with the same name to coexist by adding descriptions.

### Changes Made

1. **Enhanced ISP Data Structure**
   - Added `ISPProvider` interface with unique IDs and descriptions
   - Each ISP now has: `id`, `name`, `description`, and optional `section`

2. **Updated Office Management**
   - ISP input fields now include description fields
   - Automatic validation prevents duplicate ISP names without descriptions
   - Unique ISP identifiers are generated automatically

3. **Updated Speed Test System**
   - ISPs are now identified by unique IDs instead of names
   - Speed test API resolves ISP IDs to actual names for execution
   - Test results are stored with descriptive ISP names for clarity

4. **Backward Compatibility**
   - Existing ISP data is automatically parsed and handled
   - Legacy single ISP format is supported
   - Migration script available for existing duplicate ISPs

### Usage

#### Adding ISPs with Descriptions
When adding a new office:
1. Enter the ISP name (e.g., "PLDT")
2. Add a description (e.g., "Main Office", "Backup Line", "Floor 2")
3. If you have multiple ISPs with the same name, the descriptions make them unique

#### Running Speed Tests
- The ISP selector now shows descriptive names (e.g., "PLDT - Main Office")
- Each ISP connection is tested independently
- Results are properly attributed to the correct ISP connection

### Migration
For existing offices with duplicate ISP names, run:
```bash
npx ts-node scripts/migrate-duplicate-isps.ts
```

This will automatically add descriptions like "Primary" and "Connection 2" to duplicate ISPs.

### Technical Details

#### ISP ID Generation
- IDs are generated from ISP names: "PLDT" → "pldt"
- Duplicates get numbered suffixes: "pldt-2", "pldt-3"
- Section-specific ISPs include section: "pldt-it-section"

#### Display Names
- Simple ISPs: "PLDT"
- ISPs with descriptions: "PLDT - Main Office"
- Section-specific ISPs: "PLDT (IT Section)"

#### Database Storage
- ISPs are stored as JSON arrays in the `isps` field
- Display names (with descriptions) are stored for unique identification
- Backward compatibility maintained with existing `isp` field

### Files Modified
- `src/types/index.ts` - Added ISPProvider interface
- `src/lib/isp-utils.ts` - Enhanced ISP utilities with ID management
- `src/app/admin/offices/page.tsx` - Updated office management UI
- `src/app/api/speedtest/available-isps/route.ts` - Updated ISP parsing
- `src/app/api/speedtest/route.ts` - Added ISP ID resolution
- `src/app/tests/page.tsx` - Updated ISP selection with IDs
- `scripts/migrate-duplicate-isps.ts` - Migration utility
