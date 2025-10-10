# EasyTuner - Simplified MVP Setup

## What Was Removed

### ❌ Removed (Not Needed for MVP)
- Prometheus - Monitoring (production feature)
- Grafana - Dashboards (production feature)  
- Kubernetes configs - Deployment (way too early)
- Complex CI/CD - Over-engineering
- Pre-commit hooks - Unnecessary overhead
- Multiple shell scripts - Complexity

### ✅ Kept (Essential for MVP)
- PostgreSQL - Database
- Redis - Cache/sessions
- FastAPI Server - Your API
- React Client - Your UI
- MinIO - File storage (optional, in docker-compose.full.yml)
- Celery Worker - Background jobs (optional, in docker-compose.full.yml)

---

## Current Structure

```
easytuner/
├── client/          # React app
├── server/          # FastAPI app
├── docs/            # Documentation
├── docker-compose.yml       # Minimal (PostgreSQL + Redis + Server + Client)
├── docker-compose.full.yml  # Full (+ MinIO + Celery Worker)
└── README.md
```

**Clean. Simple. Works.**

---

## Development Workflow

### 1. Start Development

```bash
# Start just what you need
docker-compose up -d

# See logs
docker-compose logs -f
```

### 2. Work on Code

**Server:** Edit files in `server/` → auto-reloads  
**Client:** Edit files in `client/` → hot reload (HMR)

### 3. Test

```bash
# Server health
curl http://localhost:8000/health

# Open client
http://localhost:3000
```

### 4. Stop

```bash
docker-compose down
```

---

## When to Use Full Setup

```bash
# Use docker-compose.full.yml when you start working on:
docker-compose -f docker-compose.full.yml up -d

# Epic 04: File Upload Service → needs MinIO
# Epic 05: Detection Pipeline → needs Celery Worker
```

---

## Focus on Building the Product

**Epic Order:**
1. ✅ Epic 01: Project Setup (DONE)
2. → Epic 02: Database Models
3. → Epic 03: Authentication  
4. → Epic 04: File Upload (add MinIO then)
5. → Epic 05: Detection Pipeline (add Celery then)

Keep it simple. Add complexity only when you need it.

---

## Port Summary

**Minimal Setup:**
- Client: 3000
- Server: 8000
- PostgreSQL: 5432 (internal)
- Redis: 6379 (internal)

**Full Setup (adds):**
- MinIO: 9000 (API), 9001 (Console)

That's it. No more port conflicts.

---

**Keep building. Keep it simple.** 🚀

