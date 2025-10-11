# Starting Fresh: What to Give the AI

## Context Files (Attach These)

**Essential Context (in order):**

1. **`CURRENT_STATUS.md`** ← Current state, what's done, what's next
2. **`docs/MVP_PLAN.md`** ← Simplified roadmap  
3. **`docs/stories/epic02-story03-project-file-models.md`** ← Next story to implement

**Optional (if AI needs more context):**
4. `docs/API_ENDPOINTS_REFERENCE.md` ← API specs
5. `server/app/config.py` ← Current configuration
6. `server/app/database.py` ← Database setup

---

## Prompt to Give AI

```
I'm building EasyTuner, an ECU firmware analysis platform.

Current Status:
- ✅ Epic 01 complete: Project setup, Docker, FastAPI + React running
- 🔄 Epic 02 in progress: Database models (User model done)
- Tech: FastAPI (Python) + React (TypeScript) + PostgreSQL + Docker

Please read:
1. CURRENT_STATUS.md - Current state
2. docs/MVP_PLAN.md - Simplified MVP plan
3. docs/stories/epic02-story03-project-file-models.md - Next story

Then implement Epic 02, Story 03: Project and File Models
- Create SQLAlchemy models for Project and FirmwareFile
- Create Alembic migration
- Add relationship with User model
- Include soft delete support

Start implementation.
```

---

## What's Already Built

### Files That Exist
```
server/
├── app/
│   ├── main.py          ✅ FastAPI app with health endpoints
│   ├── config.py        ✅ Settings management
│   ├── database.py      ✅ Async database connection
│   ├── dependencies.py  ✅ FastAPI dependencies
│   ├── tasks/
│   │   └── __init__.py  ✅ Celery app configured
│   ├── models/          ← Add models here
│   ├── schemas/         ← Add Pydantic schemas here
│   ├── routers/         ← Add API routes here
│   ├── services/        ← Add business logic here
│   └── auth/            ← Add auth logic here
├── tests/
│   ├── conftest.py      ✅ Test fixtures
│   └── test_main.py     ✅ Basic tests
├── pyproject.toml       ✅ Dependencies configured
└── env.example          ✅ Environment template

client/
├── src/
│   ├── main.tsx         ✅ React entry point
│   ├── App.tsx          ✅ Main app with routing
│   ├── theme.ts         ✅ MUI theme
│   ├── components/      ← Add components here
│   ├── pages/           ✅ Home + 404 pages
│   ├── services/
│   │   └── api.ts       ✅ Axios client configured
│   └── store/
│       └── index.ts     ✅ Redux store configured
├── package.json         ✅ Dependencies
└── vite.config.ts       ✅ Vite configured
```

### What's Running
- Docker Compose: PostgreSQL, Redis, Server, Client
- Server: http://localhost:8000
- Client: http://localhost:3000
- Database: localhost:5432

---

## Next Stories to Implement

### Epic 02: Database (Continue)
- [x] Story 01: Alembic setup ✅
- [x] Story 02: User model ✅
- [ ] **Story 03: Project & File models** ← NEXT
- [ ] Story 04: Scan & Candidate models
- [ ] Story 05: Annotation & Audit models

### Epic 03: Authentication  
- [ ] Story 01: Password hashing
- [ ] Story 02: JWT tokens
- [ ] Story 03: Auth middleware
- [ ] Story 04: Register/Login API
- [ ] Story 05: Token refresh

### Epic 04-08: To Do
(Stories exist in docs/stories/ for Epic 05, but need to create for Epic 04, 06-08)

---

## Missing Stories (Need to Create)

**Epic 04: File Upload** (no stories yet)
- Need to create ~3-4 stories for:
  - MinIO integration
  - Upload endpoint
  - File validation
  - Metadata storage

**Epic 06: API Endpoints** (no stories yet)
- Need to create ~4-5 stories for:
  - Projects CRUD
  - Files CRUD  
  - Scans CRUD
  - Candidates API
  - Annotations API

**Epic 07: Auth UI** (no stories yet)
- Need to create ~2-3 stories for:
  - Login page
  - Register page
  - Auth context/state

**Epic 08: Main UI** (no stories yet)
- Need to create ~5-6 stories for:
  - Project dashboard
  - File upload UI
  - Scan interface
  - Results table
  - Hex viewer
  - Annotation UI

---

## Recommendation

**For next session, just implement the existing stories in order:**

1. Epic 02, Story 03 (Project/File models)
2. Epic 02, Story 04 (Scan/Candidate models)
3. Epic 02, Story 05 (Annotation/Audit models)
4. Epic 03, Stories 01-05 (Authentication)
5. Epic 05, Stories 01-05 (Detection pipeline)

**Then we can create the missing stories for Epic 04, 06-08 when we get there.**

---

## Files to Attach Next Session

**Must attach:**
1. `CURRENT_STATUS.md`
2. `docs/MVP_PLAN.md`
3. `docs/stories/epic02-story03-project-file-models.md`

**Good to have:**
4. `server/app/database.py`
5. `server/app/config.py`

**Don't need:**
- Original PRD (too complex)
- Technical Architecture (over-engineered)
- Epic files (use MVP_PLAN.md instead)

---

## Success Metric

After implementing all Epic 02-08 stories, you should be able to:
```
1. Open http://localhost:3000
2. Register a user
3. Login
4. Create a project
5. Upload a .bin file
6. Click "Scan"
7. See detected candidates
8. Click a candidate to view hex
9. Add a note
```

**If this works = MVP success!**

---

## Quick Commands for Next Session

```bash
# Check what's running
docker-compose ps

# View server logs
docker-compose logs -f server

# Access database to verify models
docker-compose exec postgres psql -U easytuner -d easytuner

# List tables
\dt

# View a table
SELECT * FROM users;
```

---

**You're set up for a clean handoff. Focus on Epic 02, Story 03 next.** 🚀

