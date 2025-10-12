# Epic 05 Start Prompt - Detection Pipeline Foundation

Use this prompt to continue EasyTuner development in a fresh session.

---

## Copy-Paste This Prompt:

```
I'm continuing EasyTuner development (ECU firmware analysis MVP).

Context: Epics 01, 02, and 03 are COMPLETE.
Starting Epic 05: Detection Pipeline Foundation.

Read these attached files:
1. CURRENT_STATUS.md - Where we are
2. EPIC03_COMPLETE.md - What we just finished
3. docs/epics/05-detection-pipeline-foundation.md - Next epic overview
4. docs/stories/epic05-story01-celery-worker-setup.md - First task

Current Status:
- ✅ Epic 01: Docker, FastAPI, React running
- ✅ Epic 02: 10 database tables, migrations complete
- ✅ Epic 03: Complete auth system - 5 API endpoints, 175 tests passing, 82.35% coverage
- → Epic 05, Story 01: Celery worker setup for async processing

Tech Stack:
- Backend: FastAPI + SQLAlchemy + PostgreSQL (using Poetry)
- Frontend: React + TypeScript + Vite (using npm)
- Task Queue: Celery + Redis
- Storage: MinIO (S3-compatible)
- Database: 10 tables with full relationships

Authentication System (Epic 03 - COMPLETE):
- Password hashing with bcrypt
- JWT tokens (access + refresh)
- User registration and login
- Token refresh and logout
- Role-based access control (user/admin)
- 5 working API endpoints

Database Models Available:
- User, Session (auth complete)
- Project, FirmwareFile (ready for use)
- ScanJob, Candidate (ready for detection pipeline)
- Annotation, AuditLog, Export (ready for future features)

Dependencies Already Installed:
- fastapi[all], uvicorn - Web framework
- sqlalchemy[asyncio], alembic - Database
- celery[redis], redis - Task queue
- minio - Object storage
- numpy, scipy - Scientific computing
- passlib[bcrypt], python-jose[cryptography] - Auth
- pytest, pytest-asyncio, pytest-cov - Testing

Epic 05 Goals (5 stories):
1. Celery worker setup for async task processing
2. Binary file preprocessing and parsing
3. Feature extraction (gradients, entropy, patterns)
4. MinIO storage integration for files
5. Scan orchestration and job management

Current Test Status:
- 175 tests passing
- 82.35% coverage
- Zero linter errors

Begin implementation of Epic 05, Story 01: Celery worker setup.
```

---

## Files to Attach in New Prompt

When starting the new session, attach these files:

1. **CURRENT_STATUS.md** - Quick project overview
2. **EPIC03_COMPLETE.md** - What was just completed
3. **docs/epics/05-detection-pipeline-foundation.md** - Epic 05 overview
4. **docs/stories/epic05-story01-celery-worker-setup.md** - First story

---

## What Will Happen

When you use this prompt, I will:

1. ✅ Read the context files
2. ✅ Understand Epic 05 goals
3. ✅ Read Story 01 requirements
4. ✅ Create task list for Story 01
5. ✅ Implement Celery worker setup
6. ✅ Configure task queue with Redis
7. ✅ Create worker tests
8. ✅ Verify everything works

Then continue with Stories 02-05 until Epic 05 is complete!

---

## Expected Deliverables for Epic 05

By the end of Epic 05, you'll have:

- ✅ Celery worker for async processing
- ✅ Binary file upload and storage (MinIO)
- ✅ Feature extraction algorithms
- ✅ Scan job orchestration
- ✅ Background task processing
- ✅ Progress tracking
- ✅ Complete test coverage

---

## Notes for Continuity

### What's Working Now (Epic 03):
- User registration and login
- JWT authentication with refresh
- Protected API endpoints
- Session management
- 5 auth endpoints live

### What Will Be Built (Epic 05):
- File upload to MinIO
- Celery tasks for detection
- Binary preprocessing
- Feature extraction
- Scan job management
- All endpoints will use Epic 03 auth!

### Integration Points:
- Upload endpoints will use `Depends(get_current_user)`
- Files will be owned by authenticated users
- Scans will track user_id
- Admin can view all scans
- Regular users see only their scans

---

## Quick Reference

### Project Structure
```
server/
├── app/
│   ├── auth/          # Epic 03 (COMPLETE)
│   ├── models/        # Epic 02 (COMPLETE)
│   ├── routers/       # Has auth router
│   ├── schemas/       # Has auth schemas
│   ├── services/      # Has auth service
│   ├── tasks/         # Epic 05 will build here
│   ├── config.py
│   ├── database.py
│   └── main.py
└── tests/
    ├── unit/
    └── integration/
```

### Running Tests
```bash
docker-compose exec server poetry run pytest tests/ -v
```

### Viewing API
```
http://localhost:8000/docs
```

---

## Success Criteria for Epic 05

After Epic 05, you'll be able to:
- Upload binary firmware files
- Trigger detection scans
- Process files in background
- Extract calibration features
- Track scan progress
- View detected candidates

---

## Ready to Go!

Copy the prompt above and start a fresh session. I'll pick up right where we left off and complete Epic 05! 🚀


