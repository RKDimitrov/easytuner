# EasyTuner - ECU Map Recognition Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)

**EasyTuner** is a browser-based analysis platform that enables automotive researchers, reverse engineers, and educational institutions to explore and understand ECU (Engine Control Unit) firmware structures through automated pattern recognition and visualization.

## ⚠️ Important Legal Notice

This platform is designed for **research and educational purposes only**. 

- ✅ Authorized research, education, and motorsport (off-road) applications
- ❌ NO modification of production vehicle ECUs without manufacturer authorization
- ❌ NO tampering with emissions systems (violates EPA Clean Air Act in US, EU regulations)
- ❌ NO analysis of firmware obtained through unauthorized access

**Users assume all responsibility for compliance with local laws and regulations.**

---

## 🚀 Features

### Core Functionality

#### 🔐 Authentication & User Management
- **User Registration & Login**: Secure account creation with email/password
- **JWT Authentication**: Access and refresh token-based authentication
- **Session Management**: Multi-device session tracking with IP and user agent logging
- **User Profiles**: Manage account settings, security preferences, and data privacy options
- **Password Security**: Bcrypt hashing with strength validation

#### 📁 Project Management
- **Create & Organize Projects**: Organize firmware files into projects
- **Private/Public Projects**: Control access to your projects
- **Project Metadata**: Add descriptions and track file counts
- **Project Dashboard**: View all projects with file statistics
- **Soft Delete**: Safely remove projects while maintaining data integrity

#### 📤 File Management
- **Firmware Upload**: Upload ECU firmware files up to 16 MB
- **File Validation**: Automatic SHA-256 hash calculation and duplicate detection
- **File Metadata**: Track file size, upload date, and checksums
- **File Download**: Secure file retrieval with access control
- **File Versioning**: Create new file versions when making edits
- **Supported Formats**: Binary files (.bin) and other firmware formats

#### 🔍 Automated Detection & Analysis
- **Map Detection**: Identify 1D/2D/3D calibration tables and scalar constants
- **Configurable Scans**: Customize detection parameters:
  - Data types: u8, u16, u32, s16, s32, float32
  - Endianness: little-endian, big-endian
  - Window size and stride for analysis
  - Minimum confidence thresholds
- **Statistical Analysis**: Advanced feature extraction:
  - Gradient smoothness analysis
  - Entropy calculation
  - Autocorrelation detection
  - Value coherence scoring
- **Confidence Scoring**: 0.0-1.0 confidence score for each detected candidate
- **Candidate Ranking**: Automatic ranking by detection quality
- **Scan History**: Track all scan jobs and their results

#### ✏️ Firmware Editing
- **Read/Write Operations**: Read and modify values at specific offsets
- **Batch Edits**: Apply multiple edits in a single operation
- **Data Type Support**: Edit u8, u16, u32, s16, s32, float32 values
- **Version Management**: Create new file versions when editing (preserves originals)
- **Edit History**: Track all modifications with timestamps
- **Automatic Checksum Updates**: Optionally update checksums after edits

#### 🔢 Checksum Operations
- **Multiple Algorithms**: Support for various checksum algorithms:
  - Simple Sum
  - CRC16
  - CRC32
  - XOR
  - Two's Complement
  - Modular checksums
- **Checksum Validation**: Verify checksum integrity in firmware files
- **Checksum Updates**: Calculate and update checksums after modifications
- **Configurable Ranges**: Specify checksum calculation ranges and exclude regions
- **Endianness Support**: Little-endian and big-endian checksum handling

#### 🏷️ Annotation System
- **Label Detection Results**: Add human-readable labels to detected structures
- **Markdown Notes**: Detailed documentation with Markdown support
- **Tagging System**: Categorize annotations with custom tags
- **Validation Status**: Track verification status (verified, rejected, uncertain)
- **Search & Filter**: Find annotations by tags, labels, or status

#### 📊 Visualization & Analysis
- **Interactive Hex Viewer**: Color-coded binary data visualization with virtualized rendering
- **2D Heatmaps**: Visual representation of calibration maps
- **3D Surface Plots**: Three-dimensional visualization of map data
- **Confidence Gauges**: Visual indicators for detection confidence
- **Results Table**: Sortable, filterable table of detection results

#### 📤 Export Capabilities
- **Multiple Formats**: Export results in JSON, PDF, and CSV formats
- **Legal Attestation**: SHA-256 hash verification for export integrity
- **Export Tracking**: Monitor export generation and download history
- **Automatic Expiration**: Configurable expiration dates for exports
- **Complete Reports**: Include all annotations, metadata, and scan results

#### 📋 Audit & Compliance
- **Complete Audit Trail**: Track all user actions with timestamps
- **IP & User Agent Logging**: Record client information for security
- **Action Metadata**: Detailed JSON metadata for each action
- **Chain of Custody**: Full compliance tracking for research and legal requirements
- **Immutable Logs**: Audit logs cannot be modified or deleted

---

## 🏗️ Architecture

```
┌─────────────┐
│  React SPA  │  TypeScript, Zustand, Material-UI
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────┐
│  FastAPI    │  Python 3.11+, Async I/O
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│ PostgreSQL │ Redis │ File   │  Data, Cache, Object Storage
│            │       │ Storage │  (Local filesystem or MinIO)
└─────────────────────────────┘
```

**Technology Stack:**
- **Server**: FastAPI, SQLAlchemy, Alembic, NumPy, SciPy
- **Client**: React 18, TypeScript, Zustand, Material-UI
- **Database**: PostgreSQL 15+ (primary data store)
- **Cache**: Redis 7+ (session management, future task queue)
- **Storage**: Local filesystem (MinIO support available)
- **Infrastructure**: Docker, Docker Compose

**Note**: Currently, scans are processed synchronously. Asynchronous processing with Celery workers is planned for future releases (see Roadmap).

---

## 📋 Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18 or higher
- **Docker**: 24.0 or higher
- **Docker Compose**: 2.x
- **Poetry**: 1.6+ (Python dependency management)
- **npm**: 9+ (Node.js package manager)
- **PostgreSQL**: 15+ (included in Docker setup)
- **Redis**: 7+ (included in Docker setup)

---

## 🛠️ Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/easytuner.git
cd easytuner
```

### 2. Set Up Backend Environment

```bash
# Navigate to server directory
cd server

# Copy environment file
cp env.example .env

# Edit .env with your configuration (optional for development)
# The docker-compose.yml provides defaults for development
```

### 3. Start Backend Services (Docker)

```bash
# From project root, start all services
docker-compose up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
# - Backend API on port 8000

# View logs
docker-compose logs -f server
```


### 4. Set Up Frontend (Local)

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Copy environment file (if it exists)
# cp env.example .env

# Start development server
npm run dev
```

The frontend will be available at **http://localhost:5173** (Vite default) or **http://localhost:3000** (if configured)

### 5. Access the Application

- **Client UI**: http://localhost:5173 (or http://localhost:3000)
- **Server API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc

---

## 🔧 Development Setup

### Backend (Running in Docker)

The backend runs in Docker with hot-reload enabled. Code changes in `server/` are automatically reflected.

**Useful Commands:**
```bash
# View backend logs
docker-compose logs -f server

# View all service logs
docker-compose logs -f

# Restart backend
docker-compose restart server

# Access database shell
docker-compose exec postgres psql -U easytuner -d easytuner

# Run database migrations
docker-compose exec server poetry run alembic upgrade head

# Create new migration
docker-compose exec server poetry run alembic revision --autogenerate -m "description"

# Access backend shell
docker-compose exec server bash

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### Frontend (Running Locally)

The frontend runs locally with npm for easier development.

**Useful Commands:**
```bash
cd client

# Start dev server
npm run dev

# Build for production
npm run build

```

### Environment Configuration

**Backend** (`server/.env`):
```env
# Database
DATABASE_URL=postgresql+asyncpg://easytuner:password@postgres:5432/easytuner
DATABASE_POOL_SIZE=5

# Redis
REDIS_URL=redis://redis:6379/0

# Authentication
JWT_SECRET_KEY=your-secret-key-here-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
CORS_ALLOW_CREDENTIALS=true

# File Upload
MAX_UPLOAD_SIZE_MB=16
ALLOWED_FILE_EXTENSIONS=[".bin", ".hex", ".s19"]

# Environment
ENVIRONMENT=development
DEBUG=true
```

**Frontend** (`client/.env`):
```env
VITE_API_URL=http://localhost:8000
VITE_ENV=development
```

**Note**: For Docker development, most settings are configured in `docker-compose.yml`. The `.env` file is used when running the server locally outside Docker.
---

## 📚 Project Structure

```
easytuner/
├── client/                    # React frontend application
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── ui/          # Reusable UI components
│   │   │   └── settings/    # Settings page components
│   │   ├── pages/            # Page components
│   │   ├── services/        # API clients
│   │   ├── store/           # Zustand state management
│   │   ├── types/           # TypeScript types
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utility functions
│   └── package.json
├── server/                    # FastAPI backend
│   ├── app/
│   │   ├── routers/         # API route handlers
│   │   │   ├── auth.py      # Authentication endpoints
│   │   │   ├── projects.py  # Project management
│   │   │   ├── files.py      # File upload/download
│   │   │   ├── scan.py      # Scan execution
│   │   │   ├── edits.py     # Firmware editing
│   │   │   └── checksum.py  # Checksum operations
│   │   ├── models/          # SQLAlchemy database models
│   │   │   ├── user.py      # User model
│   │   │   ├── project.py   # Project model
│   │   │   ├── firmware_file.py
│   │   │   ├── scan_job.py  # Scan job tracking
│   │   │   ├── candidate.py # Detection candidates
│   │   │   ├── annotation.py # User annotations
│   │   │   ├── export.py    # Export tracking
│   │   │   ├── audit_log.py # Audit logging
│   │   │   └── session.py   # Session management
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/        # Business logic services
│   │   ├── auth/             # Authentication utilities
│   │   ├── detection/       # Map detection algorithms
│   │   └── main.py          # FastAPI application
│   ├── ecumap/              # ECU map detection library
│   │   ├── segmentation.py  # Data segmentation
│   │   ├── hypothesis.py    # Hypothesis generation
│   │   ├── interpret.py     # Data type interpretation
│   │   ├── metrics.py       # Statistical metrics
│   │   └── scorer.py        # Candidate scoring
│   ├── alembic/             # Database migrations
│   ├── tests/               # Test suite
│   │   ├── unit/            # Unit tests
│   │   └── integration/     # Integration tests
│   └── pyproject.toml       # Poetry configuration
├── docker-compose.yml        # Docker services configuration
├── docker-compose.full.yml  # Full stack with MinIO
├── docker-compose.minimal.yml # Minimal setup
└── README.md
```

---

## 🔐 Security

- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Password Security**: Bcrypt hashing with configurable rounds
- **Session Management**: Secure session tracking with expiration
- **CORS Protection**: Configurable cross-origin resource sharing
- **Audit Logging**: Comprehensive logging of all user actions
- **Access Control**: Project and file-level access restrictions
- **Input Validation**: Pydantic schemas for request validation
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **File Upload Security**: File size limits, extension validation, and hash verification

**Report security vulnerabilities**: Create a GitHub issue with the `security` label

## 📡 API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user account
- `POST /login` - Authenticate and receive tokens
- `POST /refresh` - Refresh access token
- `POST /logout` - Invalidate session
- `GET /me` - Get current user information

### Projects (`/api/v1/projects`)
- `GET /` - List user's projects
- `POST /` - Create new project
- `GET /{project_id}` - Get project details
- `PATCH /{project_id}` - Update project
- `DELETE /{project_id}` - Delete project
- `GET /{project_id}/files` - List project files

### Files (`/api/v1/files`)
- `POST /upload` - Upload firmware file
- `GET /{file_id}` - Download file
- `GET /{file_id}/metadata` - Get file metadata
- `DELETE /{file_id}` - Delete file

### Scans (`/api/v1/scans`)
- `POST /` - Create and execute scan
- `GET /{scan_id}` - Get scan job status
- `GET /{scan_id}/candidates` - Get detected candidates
- `GET /{scan_id}/results` - Get complete scan results

### Editing (`/api/v1/files/{file_id}/edits`)
- `POST /edits` - Apply batch edits to file
- `GET /read-value` - Read value at offset

### Checksums (`/api/v1/files/{file_id}/checksum`)
- `POST /validate` - Validate checksum
- `POST /update` - Update checksum

**Full API Documentation**: Available at `/docs` (Swagger UI) when running the server

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- **Documentation**: 
  - Main README: This file
  - Server README: `server/README.md`
  - Client README: `client/README.md` (if available)
- **API Documentation**: Available at `http://localhost:8000/docs` when server is running
- **Issues**: [GitHub Issues](https://github.com/your-org/easytuner/issues)
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines

## 🚧 Roadmap

### Current Version (1.0)
- ✅ User authentication and session management
- ✅ Project and file management
- ✅ Automated map detection with configurable parameters
- ✅ Firmware editing and checksum operations
- ✅ Annotation system
- ✅ Export capabilities
- ✅ Audit logging

### Future Enhancements
- [ ] Asynchronous scan processing with Celery workers
- [ ] Advanced visualization tools
- [ ] Collaborative features (shared projects)
- [ ] API rate limiting
- [ ] WebSocket support for real-time updates
- [ ] Advanced search and filtering
- [ ] Plugin system for custom detection algorithms

