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
│  React SPA  │  TypeScript, Redux Toolkit, Material-UI
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
- **Client**: React 18, TypeScript, Redux Toolkit, MUI
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

### 2. Start Infrastructure Services

```bash
# Start minimal setup (PostgreSQL + Redis + Server + Client)
docker-compose up -d

# This is enough for authentication, database, and API development
# See DOCKER_SETUP.md for full setup with MinIO, Celery, monitoring
```

### 3. Access the Application

**That's it!** Docker Compose handles everything.

- **Client UI**: http://localhost:3000
- **Server API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. For Local Development (Optional)

If you want to run outside Docker:

```bash
# Server
cd server
pip install poetry
poetry install
poetry run uvicorn app.main:app --reload

# Client
cd client
npm install
npm run dev
```

---

## 📚 Documentation

**Quick Start:**
- **[Current Status](./CURRENT_STATUS.md)**: Where we are now ← START HERE
- **[MVP Plan](./docs/MVP_PLAN.md)**: Simplified roadmap
- **[Docker Setup](./DOCKER_SETUP.md)**: How to run locally

**Reference:**
- **[API Endpoints](./docs/API_ENDPOINTS_REFERENCE.md)**: API specification
- **[Stories](./docs/stories/)**: Implementation tasks
- **[Contributing](./CONTRIBUTING.md)**: How to contribute

**Original Specs (Reference Only):**
- [PRD](./docs/PRD.md), [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md)

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

### End-to-End Tests
```bash
npm run playwright test
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development workflow
- Coding standards
- Commit conventions
- Pull request process
- Testing requirements

---

## 📊 Project Status

**Current Version:** 0.1.0 (Early Development)  
**MVP Target:** Working demo in ~10 days

### Epic Progress
- ✅ Epic 01: Project Setup (Complete)
- 🔄 Epic 02: Database Models (In Progress - Story 03)
- ⏳ Epic 03: Authentication
- ⏳ Epic 04: File Upload
- ⏳ Epic 05: Detection Pipeline
- ⏳ Epic 06-08: API & UI

See [CURRENT_STATUS.md](./CURRENT_STATUS.md) for what's next.

---

## 🔐 Security

- JWT-based authentication with bcrypt password hashing
- Audit logging for user actions

**Report security vulnerabilities**: Create a GitHub issue

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Contributors

See [GitHub Contributors](https://github.com/your-org/easytuner/graphs/contributors)

---

## 📞 Support

- **Documentation**: [docs/](./docs/)
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

