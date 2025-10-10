# EasyTuner Client

React + TypeScript frontend application for the EasyTuner ECU Map Recognition Platform.

## Prerequisites

- Node.js 18 or higher
- npm 9+

## Quick Start

### 1. Install Dependencies

```bash
# Install project dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env with your configuration
# Update VITE_API_URL if backend is running on different port
```

### 3. Start Development Server

```bash
# Start dev server with hot reload
npm run dev
```

The application will be available at http://localhost:3000

### 4. Build for Production

```bash
# Type check and build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
client/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Generic components (Button, Input, etc.)
│   │   └── layout/        # Layout components (Header, Footer, etc.)
│   ├── features/          # Feature-based modules
│   │   ├── auth/          # Authentication feature
│   │   ├── projects/      # Projects management
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── services/          # API clients and services
│   ├── store/             # Redux store configuration
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main App component
│   ├── main.tsx           # Application entry point
│   ├── theme.ts           # MUI theme configuration
│   └── index.css          # Global styles
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier configuration
└── README.md              # This file
```

## Development

### Running the Dev Server

```bash
# Start with hot reload
npm run dev

# Start and open in browser
npm run dev -- --open
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type check
npm run type-check
```

### Testing

```bash
# Run tests (will be added in future stories)
npm test

# Run tests with coverage
npm run test:coverage
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests (coming soon)

## Technology Stack

### Core
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server

### State Management
- **Redux Toolkit** - State management
- **React Redux** - React bindings for Redux

### UI Framework
- **Material-UI (MUI)** - Component library
- **Emotion** - CSS-in-JS styling

### Routing
- **React Router** - Client-side routing

### Data Fetching
- **Axios** - HTTP client
- **Socket.io Client** - WebSocket communication

### Visualization
- **Plotly.js** - Interactive charts and 3D visualizations
- **React Plotly.js** - React wrapper for Plotly

### Forms
- **React Hook Form** - Form state management
- **Zod** - Schema validation

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Unit testing (coming soon)

## Configuration

### Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_ENV=development
VITE_ENABLE_DEV_TOOLS=true
```

### Vite Configuration

The `vite.config.ts` includes:
- Path aliases (`@/` → `src/`)
- API proxy to backend server
- Code splitting for optimal bundle size
- Production optimizations

### TypeScript Configuration

Strict mode enabled with:
- No unused locals/parameters
- No fallthrough cases
- Path mapping for imports

## API Integration

The client communicates with the server via:

1. **REST API**: HTTP requests to `/api/v1/*` endpoints
2. **WebSocket**: Real-time updates for scan progress

API client is configured in `src/services/api.ts`.

## Styling

### Material-UI Theme

Custom theme configuration in `src/theme.ts`:
- Color palette
- Typography
- Component style overrides
- Responsive breakpoints

### Global Styles

Global CSS in `src/index.css`:
- CSS reset
- Font imports
- Custom scrollbar styles

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Troubleshooting

### Port Already in Use

```bash
# Change port in vite.config.ts or use:
npm run dev -- --port 3001
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Type Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
npm run type-check
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the project root for development guidelines.

## License

MIT License - See [LICENSE](../LICENSE) in the project root.

