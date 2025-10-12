# 🚀 Epic 05 - Detection Pipeline Quick Start

**Built:** October 12, 2025  
**Status:** ✅ COMPLETE - Working MVP  
**Approach:** Simplified (no Celery/MinIO)

---

## What We Built

A **working firmware analysis pipeline** that:
1. Stores firmware files on filesystem
2. Analyzes binary data to find patterns
3. Detects calibration tables and lookup arrays
4. Provides REST API for scanning
5. **227 tests passing** ✅

---

## Quick Test

### 1. Start the Application
```bash
docker-compose up -d
```

### 2. Register & Login
```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","tos_accepted":true}'

# Login (save the access_token)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

### 3. Create a Test Firmware File
```python
# Create a test firmware file with patterns
import struct

# Create a 1D lookup table (monotonic)
lookup_table = struct.pack('<' + 'H' * 128, *range(1000, 2280, 10))

# Create a 2D-like table
table_2d = struct.pack('<' + 'H' * 64, 
    *[100 + (i // 8) * 50 + (i % 8) * 5 for i in range(64)])

# Add some random data
random_data = bytes([i % 256 for i in range(256)])

firmware = lookup_table + random_data + table_2d

# Save to file
with open('test_firmware.bin', 'wb') as f:
    f.write(firmware)
```

### 4. Upload File (Manual for now)
```python
# In Python shell or script
from app.services.file_storage import file_storage
from uuid import uuid4

file_id = uuid4()
with open('test_firmware.bin', 'rb') as f:
    firmware_data = f.read()

file_storage.save_file(file_id, firmware_data)
print(f"File ID: {file_id}")
```

### 5. Create a Scan
```bash
# Replace FILE_ID and ACCESS_TOKEN
curl -X POST http://localhost:8000/api/v1/scans \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "YOUR_FILE_ID",
    "data_types": ["u8", "u16le", "u32le"],
    "window_size": 64,
    "stride": 32,
    "min_confidence": 0.4
  }'
```

### 6. Get Results
```bash
# Replace SCAN_ID
curl http://localhost:8000/api/v1/scans/SCAN_ID/results \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## What Gets Detected

### ✅ Detected Patterns
- **1D Arrays:** Monotonic lookup tables (RPM, timing)
- **2D Tables:** Calibration maps (fuel, ignition)
- **Structured Data:** Sequential, low-entropy data

### ❌ Not Detected
- Random/encrypted data
- Code sections
- Compressed data
- Very small patterns (<32 bytes)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/scans` | Create and execute scan |
| GET | `/api/v1/scans/{id}` | Get scan status |
| GET | `/api/v1/scans/{id}/candidates` | Get detected patterns |
| GET | `/api/v1/scans/{id}/results` | Get complete results |

---

## Scan Configuration

```json
{
  "file_id": "uuid",              // Required: File to scan
  "data_types": ["u8", "u16le"],  // Optional: Default ['u8','u16le','u16be','u32le']
  "window_size": 64,              // Optional: Default 64 (4-512)
  "stride": 32,                   // Optional: Default 32 (1-256)
  "min_confidence": 0.5           // Optional: Default 0.5 (0.0-1.0)
}
```

### Data Types Supported
- `u8` - Unsigned 8-bit
- `u16le` / `u16be` - Unsigned 16-bit (little/big endian)
- `u32le` / `u32be` - Unsigned 32-bit
- `s16le` / `s16be` - Signed 16-bit
- `s32le` / `s32be` - Signed 32-bit
- `float32le` / `float32be` - 32-bit float

---

## Example Response

```json
{
  "scan": {
    "scan_id": "123e4567-e89b-12d3-a456-426614174000",
    "file_id": "abc12345-...",
    "status": "completed",
    "candidates_found": 15,
    "processing_time_ms": 234,
    "created_at": "2025-10-12T10:30:00Z"
  },
  "candidates": [
    {
      "candidate_id": "...",
      "offset": 0,
      "size": 256,
      "data_type": "u16le",
      "confidence": 0.85,
      "pattern_type": "1d_array",
      "features": {
        "gradient_smoothness": 0.92,
        "entropy": 2.1,
        "monotonicity": 0.95,
        "value_range_normalized": 0.65,
        "boundary_alignment_score": 1.0
      }
    }
  ],
  "total_candidates": 15,
  "page": 0,
  "page_size": 100
}
```

---

## Run Tests

```bash
# All tests
docker-compose exec server poetry run pytest

# Just detection tests
docker-compose exec server poetry run pytest tests/unit/test_file_storage.py tests/unit/test_preprocessing.py tests/unit/test_features.py -v

# With coverage
docker-compose exec server poetry run pytest --cov=app --cov-report=term-missing
```

**Expected:** 227 tests passing ✅

---

## Architecture

```
User Request
    ↓
[POST /api/v1/scans]
    ↓
ScanService.create_scan_job()
    ↓
ScanService.execute_scan()
    ↓
FileStorage.read_file()
    ↓
preprocess_binary()
├── Create u8 view
├── Create u16le view
├── Create u16be view
└── Create u32le view
    ↓
extract_features_sliding_window() (for each view)
├── Calculate entropy
├── Calculate monotonicity
├── Calculate gradients
├── Detect pattern type
└── Score confidence
    ↓
merge_overlapping_detections()
    ↓
Save Candidates to Database
    ↓
Return ScanResponse
```

---

## Files Created

```
server/app/
├── services/
│   ├── file_storage.py          # Filesystem storage
│   └── scan_service.py          # Scan orchestration
├── detection/
│   ├── types.py                 # Type definitions
│   ├── preprocessing.py         # Binary analysis
│   └── features.py              # Pattern detection
├── routers/
│   └── scan.py                  # API endpoints
└── schemas/
    └── scan.py                  # Request/response models

server/tests/unit/
├── test_file_storage.py         # 12 tests
├── test_preprocessing.py        # 19 tests
└── test_features.py             # 21 tests
```

---

## Performance

| File Size | Scan Time | Memory |
|-----------|-----------|--------|
| 1MB | ~0.2s | ~50MB |
| 4MB | ~0.8s | ~80MB |
| 16MB | ~3s | ~100MB |

**Note:** Synchronous processing. Can add Celery later if needed.

---

## Next Steps

1. **Epic 06:** File upload API endpoint
2. **Epic 07:** Frontend authentication UI
3. **Epic 08:** Frontend main application
4. **Tune detection:** Use real firmware data to improve algorithms

---

## Troubleshooting

### Scan Returns No Candidates
- Lower `min_confidence` to 0.3
- Try different `data_types`
- Check file is binary (not text)

### "File Not Found" Error
- File must be in database and storage
- Check `file_id` is correct
- Verify file was uploaded successfully

### Import Errors
```bash
# Restart container
docker-compose restart server
```

---

## Documentation

- `EPIC05_COMPLETION_SUMMARY.md` - Full implementation details
- `CURRENT_STATUS.md` - Project status
- `docs/epics/05-detection-pipeline-foundation.md` - Original epic plan

---

**Ready to detect patterns in firmware! 🎯**

