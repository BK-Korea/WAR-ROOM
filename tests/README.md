# WAR-ROOM Integration Tests

## Helena → Dorothy Data Flow Test

Tests the complete workflow of SEC data ingestion and financial analysis.

### Quick Test (Recommended)

Run the standalone test script:

```bash
npm run test:integration
```

This will:
1. ✅ Clean test data
2. ✅ Helena fetches SEC data for AAPL
3. ✅ Verify database populated
4. ✅ Dorothy analyzes the data
5. ✅ Test idempotency (no duplicates)

**Expected Output:**
```
═══════════════════════════════════════════════════
🧪 Helena → Dorothy Integration Test
═══════════════════════════════════════════════════

🧹 Step 1: Cleaning up test data...
✅ Test data cleaned

📊 Step 2: Helena - Fetching SEC data...
✅ Helena success: 2100 metrics extracted

🔍 Step 3: Verifying database...
   company_financials: 2100 rows
   company_metadata: 2100 metrics
✅ Database verified

💼 Step 4: Dorothy - Analyzing data...
✅ Dorothy success: 1500 chars response

🔄 Step 5: Testing idempotency...
   Before re-run: 2100 rows
   After re-run: 2100 rows
✅ Idempotent (no duplicates)

═══════════════════════════════════════════════════
✅ ALL TESTS PASSED
═══════════════════════════════════════════════════
```

### Full Test Suite (Vitest)

Run with vitest (includes all assertions):

```bash
npm run test:integration:watch
```

Or run all tests:

```bash
npm test
```

## What the Test Verifies

### ✅ Helena
- Fetches data from SEC Company Facts API
- Stores metrics in `company_financials`
- Updates `company_metadata`
- Handles duplicates correctly (idempotent)
- No PostgreSQL errors

### ✅ Dorothy
- Finds data in database
- Returns financial analysis
- No "data not found" errors
- Response contains actual analysis

### ✅ Data Integrity
- Correct data structure
- UNIQUE constraint satisfied (no duplicate keys)
- Deterministic filing_accession
- Proper fiscal year/quarter extraction

## Troubleshooting

### Test Fails: "No data in company_financials"

**Cause:** Helena failed to save data

**Check:**
1. Supabase credentials in `.env`
2. Network access to SEC API
3. Helena logs for errors

### Test Fails: "Dorothy returned error message"

**Cause:** Dorothy can't find data

**Check:**
1. `company_metadata` table populated
2. `checkHelenaDataAvailability()` fallback working
3. Dorothy logs for SQL errors

### Test Fails: "Duplicates created"

**Cause:** Idempotent processing broken

**Check:**
1. `filing_accession` is deterministic
2. Deduplication logic working
3. Database UNIQUE constraint active

## Environment Variables

Required in `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

## Manual Testing

Test via web interface after Vercel deploy:

```
@Helena AAPL 데이터 준비해줘
@Dorothy 24년 애플 재무 분석해줘
```

Expected:
- Helena completes in 3-5 seconds
- Dorothy provides financial analysis
- No error messages
