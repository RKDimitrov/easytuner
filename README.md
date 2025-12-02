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

### MVP (Version 1.0)
- **Binary Upload & Analysis**: Upload ECU firmware files up to 16 MB
- **Automated Detection**: Identify 1D/2D/3D calibration tables and scalar constants
- **Interactive Hex Viewer**: Color-coded visualization of binary data with virtualized rendering
- **Annotation System**: Label and document detected structures with Markdown notes
- **Visualization Tools**: 2D heatmaps and 3D surface plots for calibration maps
- **Export Capabilities**: JSON, PDF, and CSV exports with legal attestation
- **Audit Logging**: Complete chain-of-custody for compliance

### Detection Pipeline
- Multi-endianness support (little-endian, big-endian)
- Multiple data types: u8, u16, u32, s16, s32, float32
- Statistical feature extraction (gradient smoothness, entropy, autocorrelation)
- Confidence scoring (0.0-1.0) for each detected candidate
- Configurable sensitivity thresholds

---

## 🏗️ Architecture

```
┌─────────────┐
│  React SPA  │  TypeScript, Zustand, Material-UI
└──────┬──────┘
       │
┌──────▼──────┐
│  FastAPI    │  Python 3.11+, Async I/O
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│ Celery Workers (Detection)  │  Distributed task processing
└──────┬──────────────────────┘
       │
┌──────┴──────────────────────┐
│ PostgreSQL │ Redis │ MinIO  │  Data, Cache, Object Storage
└─────────────────────────────┘
```

**Technology Stack:**
- **Server**: FastAPI, SQLAlchemy, Alembic, Celery, NumPy, SciPy
- **Client**: React 18, TypeScript, Zustand, MUI
- **Database**: PostgreSQL 15+, Redis 7+
- **Storage**: MinIO (for file uploads)
- **Infrastructure**: Docker

---

## 📋 Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18 or higher
- **Docker**: 24.0 or higher
- **Docker Compose**: 2.x
- **Poetry**: 1.6+ (Python dependency management)
- **npm**: 9+ (Node.js package manager)

---

## 🛠️ Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/easytuner.git
cd easytuner
```

### 2. Start Backend Services (Docker)

```bash
# Start PostgreSQL, Redis, and Backend Server
docker-compose up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
# - Backend API on port 8000
```

### 3. Set Up Frontend (Local)

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Start development server
npm run dev
```

The frontend will be available at **http://localhost:3000**

### 4. Access the Application

- **Client UI**: http://localhost:3000
- **Server API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 🔧 Development Setup

### Backend (Running in Docker)

The backend runs in Docker with hot-reload enabled. Code changes in `server/` are automatically reflected.

**Useful Commands:**
```bash
# View backend logs
docker-compose logs -f server

# Restart backend
docker-compose restart server

# Access database
docker-compose exec postgres psql -U easytuner -d easytuner

# Stop all services
docker-compose down
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

# Type check
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

### Environment Configuration

**Backend** (`server/.env`):
```env
DATABASE_URL=postgresql+asyncpg://easytuner:password@localhost:5432/easytuner
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-secret-key-here
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

**Frontend** (`client/.env`):
```env
VITE_API_URL=http://localhost:8000
VITE_ENV=development
```

---

## 🧪 Testing

### Server Tests
```bash
cd server
poetry run pytest --cov=app --cov-report=html
```

### Client Tests
```bash
cd client
npm test
npm run test:coverage
```

---

## 📚 Project Structure

```
easytuner/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API clients
│   │   ├── store/       # State management
│   │   └── types/       # TypeScript types
│   └── package.json
├── server/              # FastAPI backend
│   ├── app/
│   │   ├── routers/     # API routes
│   │   ├── models/      # Database models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── auth/        # Authentication
│   └── pyproject.toml
├── docker-compose.yml   # Docker services (backend only)
└── README.md
```

---

## 🔐 Security

- JWT-based authentication with bcrypt password hashing
- CORS configuration for secure cross-origin requests
- Audit logging for user actions
- Rate limiting on API endpoints

**Report security vulnerabilities**: Create a GitHub issue

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development workflow
- Coding standards
- Commit conventions
- Pull request process
- Testing requirements

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- **Documentation**: See `client/README.md` and `server/README.md` for detailed setup
- **Issues**: [GitHub Issues](https://github.com/your-org/easytuner/issues)

---

## 🙏 Acknowledgments

Inspired by professional automotive tuning tools like WinOLS, this project aims to democratize access to ECU analysis for educational and research purposes while maintaining strict ethical and legal boundaries.

**Special thanks to:**
- Open-source ECU projects (Speeduino, RusEFI) for reference implementations
- Academic institutions researching automotive embedded systems
- The reverse engineering and automotive security communities

---

**Built with ❤️ for researchers, educators, and automotive enthusiasts.**
