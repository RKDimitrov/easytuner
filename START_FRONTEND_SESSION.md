# 🚀 Quick Start: Frontend Development Session

**Copy this entire file to your next AI prompt to continue frontend development.**

---

## Context

I'm continuing development on **EasyTuner** - an ECU firmware analysis web application.

**Current Status:**
- ✅ Backend: Database (10 tables) + Authentication API complete (main branch)
- ✅ Frontend: Basic structure with Upload + Analysis pages (v2.0)
- ❌ Frontend: Missing all auth UI, settings, project management, etc.

**My Task:** Implement the frontend user experience (7 epics, 30+ stories)

---

## What I Need

I need to build the complete frontend following the detailed stories in `docs/frontendstories/`.

**Tech Stack:**
- React 18 + TypeScript + Vite
- React Router v6
- Zustand (state management)
- Tailwind CSS + shadcn/ui
- Axios (HTTP client)

**Starting Point:** Epic 07 - Authentication UI

---

## Important Files to Read

**Required Reading (in order):**
1. `docs/frontendstories/README.md` - Overview of all frontend work
2. `docs/FRONTEND_PRD_CONDENSED.md` - Complete requirements
3. `FRONTEND_NEXT_SESSION_PROMPT.md` - Detailed handoff document
4. `docs/frontendstories/epic07-authentication-ui/story02-register-page.md` - First story

**Backend API Reference:**
- `docs/API_ENDPOINTS_REFERENCE.md` - API contracts
- Available auth endpoints (if on main branch):
  - POST /api/v1/auth/register
  - POST /api/v1/auth/login
  - POST /api/v1/auth/refresh
  - GET /api/v1/auth/me
  - POST /api/v1/auth/logout

---

## Directory Structure

```
client/src/
├── components/          # UI components
│   ├── ui/             # shadcn/ui components (Button, Dialog, etc.)
│   ├── HexViewer.tsx
│   └── ResultsTable.tsx
├── pages/              # Route pages
│   ├── Upload.tsx
│   ├── Analysis.tsx
│   └── NotFoundPage.tsx
├── services/           # API layer
│   └── api.ts          # Currently mocks
├── store/              # Zustand stores
│   └── analysisStore.ts
├── hooks/              # Custom hooks
├── types/              # TypeScript types
└── App.tsx             # Main app + routing
```

---

## What I Need to Build

### Epic 07: Authentication UI (Week 1) - START HERE
- [ ] Story 01: Login Page
- [ ] Story 02: Register Page  
- [ ] Story 03: Password Reset Flow
- [ ] Story 04: Auth State Management (Zustand)
- [ ] Story 05: Protected Routes

### Epic 08: Project Management UI (Week 2)
- [ ] Project Dashboard
- [ ] Create/Edit Project
- [ ] Project Detail Page
- [ ] Project Search & Filter
- [ ] Integration with upload flow

### Epic 09: Settings Page (Week 1-2)
- [ ] Settings Foundation
- [ ] Profile Tab
- [ ] Appearance Tab (dark mode!)
- [ ] Security Tab (change password)
- [ ] Data & Privacy Tab

### Epic 10-13: File Management, Scan Config, Annotations, Export
(See `docs/frontendstories/README.md` for details)

---

## Quick Start Commands

```bash
# 1. Start everything
docker-compose up -d

# 2. Verify backend
curl http://localhost:8000/health
curl http://localhost:8000/docs  # Check auth endpoints

# 3. Verify frontend
# Open: http://localhost:3000

# 4. Development
cd client
npm install
npm run dev          # Start dev server
npm run lint         # Check code quality
npm run type-check   # TypeScript validation
```

---

## First Implementation: Login Page

**File:** `client/src/pages/Login.tsx`

**Requirements:**
- Email + password form
- Form validation (React Hook Form + Zod)
- Connect to POST /api/v1/auth/login
- Store tokens in localStorage
- Redirect to intended page after login
- Show loading state during API call
- Display errors with toast
- Link to register page
- "Forgot password" link

**API Integration:**
```typescript
// POST /api/v1/auth/login
interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
```

---

## Implementation Pattern

For each feature:

1. **Read the story** - Understand requirements
2. **Create types** - TypeScript interfaces
3. **Build UI** - Components + forms
4. **Connect API** - Axios calls
5. **Add state** - Zustand store
6. **Handle errors** - Toast notifications
7. **Add loading** - Loading states
8. **Test manually** - All scenarios
9. **Check quality** - Lint + type-check

---

## Available Components (Already Built)

**shadcn/ui** (`client/src/components/ui/`):
- `Button` - All variants
- `Dialog` - Modals
- `Input` - Text inputs
- `Checkbox` - Checkboxes
- `Toast` - Notifications
- `Progress` - Progress bars
- `Slider` - Sliders

**Custom**:
- `HexViewer` - Virtualized hex viewer
- `ResultsTable` - Data table
- `ConfidenceGauge` - Score visualization
- `TOSModal` - Terms of service

---

## Help Me Start

I'm ready to begin! Please help me:

1. **Verify current state:**
   - Check if backend auth endpoints are available
   - Check current frontend structure
   - Identify what exists vs. what's needed

2. **Implement first story:**
   - Guide me through building the Login page
   - Show me the complete code
   - Help me connect to the backend API
   - Add proper error handling

3. **Set up foundations:**
   - Create auth service layer
   - Set up auth Zustand store
   - Configure Axios interceptors
   - Set up protected routes

Let's start with **Epic 07, Story 01: Login Page**.

---

**Additional Context Files Available:**
- `FRONTEND_NEXT_SESSION_PROMPT.md` - Detailed handoff (1200+ lines)
- `docs/frontendstories/README.md` - All 7 epics overview
- `docs/FRONTEND_PRD_CONDENSED.md` - Complete requirements
- `client/README.md` - Frontend architecture

**Ready to code!** 🚀

