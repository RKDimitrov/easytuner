# Docker Setup - Simple Guide

## Two Configurations

### 1. Minimal (Default) - `docker-compose.yml`
**Services:** PostgreSQL, Redis, Server, Client

**Use for:** Authentication, Database, API, UI development

```bash
docker-compose up -d
```

**Ports:**
- Client: http://localhost:3000
- Server: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

### 2. Full - `docker-compose.full.yml`
**Services:** Everything + MinIO (storage) + Celery Worker (background jobs)

**Use when:** You need file uploads or detection pipeline

```bash
docker-compose -f docker-compose.full.yml up -d
```

**Additional Ports:**
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

---

## Quick Commands

```bash
# Start minimal
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f server

# Restart server after code changes
docker-compose restart server

# Access database
docker-compose exec postgres psql -U easytuner -d easytuner

# Clean everything (deletes data!)
docker-compose down -v
```

---

## That's It!

Keep it simple. Add MinIO/Celery when you actually need them (Epic 04 & 05).
