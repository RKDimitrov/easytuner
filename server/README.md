# EasyTuner Server

FastAPI-based backend server for the EasyTuner ECU Map Recognition Platform.

## Prerequisites

- Python 3.11 or higher
- Poetry 1.6+
- PostgreSQL 15+
- Redis 7+
- MinIO (or S3-compatible storage)

## Quick Start

### 1. Install Dependencies

```bash
# Install Poetry if not already installed
pip install poetry

# Install project dependencies
poetry install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env with your configuration
# Update database credentials, JWT secret, etc.
```

### 3. Set Up Database

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE easytuner;
CREATE USER easytuner WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE easytuner TO easytuner;
```

### 4. Run Database Migrations

```bash
# Run migrations (after implementing Alembic in next story)
poetry run alembic upgrade head
```

### 5. Start the Server

```bash
# Development mode with auto-reload
poetry run uvicorn app.main:app --reload

# Or using the main.py directly
poetry run python -m app.main
```

The server will be available at:
- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 6. Verify Installation

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","service":"easytuner-server","version":"0.1.0"}
```

## Project Structure

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application and endpoints
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection and session
│   ├── dependencies.py      # FastAPI dependencies
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── routers/             # API route handlers
│   ├── services/            # Business logic
│   ├── auth/                # Authentication & authorization
│   └── tasks/               # Celery tasks
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── conftest.py          # Pytest fixtures
├── alembic/                 # Database migrations
├── pyproject.toml           # Poetry configuration & dependencies
├── env.example              # Example environment variables
└── README.md                # This file
```

## Development

### Running Tests

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app --cov-report=html

# Run specific test file
poetry run pytest tests/unit/test_config.py

# Run with verbose output
poetry run pytest -v
```

### Code Quality

```bash
# Format code with Black
poetry run black app/ tests/

# Lint with Ruff
poetry run ruff check app/ tests/

# Fix linting issues automatically
poetry run ruff check --fix app/ tests/

# Type check with mypy
poetry run mypy app/
```

### Running Celery Worker

```bash
# Start Celery worker
poetry run celery -A app.tasks worker --loglevel=info

# With auto-reload for development
poetry run watchfiles "celery -A app.tasks worker --loglevel=info"
```

## API Endpoints

### Core Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /ready` - Readiness check (for Kubernetes)
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

### API v1 (Coming in next stories)

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/projects` - Create project
- `POST /api/v1/files` - Upload firmware file
- `POST /api/v1/scans` - Initiate scan
- ... (see API documentation for full list)

## Configuration

All configuration is managed through environment variables (see `env.example`).

### Key Configuration Options

**Database:**
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_POOL_SIZE`: Connection pool size (default: 5)

**Redis:**
- `REDIS_URL`: Redis connection string

**Authentication:**
- `JWT_SECRET_KEY`: Secret key for JWT tokens (MUST change in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token lifetime (default: 60)

**File Upload:**
- `MAX_UPLOAD_SIZE_MB`: Maximum file upload size (default: 16 MB)

**Rate Limiting:**
- `RATE_LIMIT_UPLOADS_PER_HOUR`: Upload rate limit (default: 100/hour)
- `RATE_LIMIT_SCANS_PER_HOUR`: Scan rate limit (default: 50/hour)

## Deployment

### Docker

```bash
# Build image
docker build -t easytuner-server:latest .

# Run container
docker run -p 8000:8000 --env-file .env easytuner-server:latest
```

### Production Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Generate strong `JWT_SECRET_KEY`
- [ ] Configure secure database credentials
- [ ] Set `DEBUG=false`
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Enable database backups
- [ ] Review security settings

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
poetry run python -c "from app.database import engine; import asyncio; asyncio.run(engine.connect())"
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process and restart
```

### Import Errors

```bash
# Ensure you're in the virtual environment
poetry shell

# Reinstall dependencies
poetry install
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the project root for development guidelines.

## License

MIT License - See [LICENSE](../LICENSE) in the project root.

## Support

- **Documentation**: [docs/](../docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/easytuner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/easytuner/discussions)

