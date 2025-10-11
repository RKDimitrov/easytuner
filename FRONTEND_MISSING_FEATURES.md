# Frontend Missing Features - ECU Map Recognition Platform

**Date:** October 11, 2025  
**Version:** 1.0  
**Status:** Analysis Complete  
**Reference:** [PRD.md](docs/PRD.md)

---

## 📋 Overview

This document catalogs all features specified in the Product Requirements Document (PRD) that are **NOT yet implemented** in the current frontend v2.0.0. The current implementation includes the core analysis workflow (Upload → Scan → Results → Hex Viewer) but lacks many secondary features required for a complete MVP and future phases.

---

## ✅ Currently Implemented (v2.0.0)

For reference, here's what the frontend currently includes:

- ✅ File upload with drag-and-drop
- ✅ TOS/Legal attestation modal
- ✅ Demo firmware generator
- ✅ Analysis page with scan trigger
- ✅ Progress tracking (mock)
- ✅ Hex viewer with virtualization
- ✅ Results table with filtering
- ✅ Confidence gauges
- ✅ Color-coded hex highlighting
- ✅ Basic routing (/, /analysis, /404)
- ✅ Toast notifications
- ✅ Dark theme (no toggle yet)

---

## 🚫 Missing Features - By Priority

### 🔴 P0 - MVP Blockers (Required for Launch)

#### 1. Authentication & User Management

**PRD Reference:** Section 6 (Backend Features), Section 9 (Data Model - User Entity)

**Missing Components:**
- [ ] **Login Page** (`/login`)
  - Email/password form
  - "Remember me" checkbox
  - "Forgot password?" link
  - Social login buttons (Phase 2)
  - Error handling for invalid credentials
  
- [ ] **Registration Page** (`/register`)
  - Email, password, confirm password fields
  - Password strength indicator
  - Email verification workflow
  - TOS acceptance checkbox (link to full TOS)
  - CAPTCHA integration
  
- [ ] **Password Reset Flow** (`/forgot-password`, `/reset-password/:token`)
  - Email input form
  - Token-based reset page
  - New password form with confirmation
  
- [ ] **Authentication State Management**
  - JWT token storage (localStorage or httpOnly cookies)
  - Token refresh mechanism
  - Automatic logout on token expiry
  - Protected route wrapper component
  - Redirect to login for unauthenticated users

**API Integration Needed:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh-token`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

---

#### 2. Project Management System

**PRD Reference:** Section 5 (MVP Features - Project Management), Section 9 (Data Model - Project Entity)

**Missing Components:**
- [ ] **Project Dashboard** (`/projects` or `/dashboard`)
  - Grid/list view of user projects
  - Project cards with metadata:
    - Project name
    - Description preview
    - File count
    - Last modified date
    - Created date
  - "New Project" button
  - Search bar for projects
  - Sort options (date, name, file count)
  - Empty state: "No projects yet. Create your first project."
  
- [ ] **Project Creation Modal/Page**
  - Project name input (required)
  - Description textarea (optional)
  - Privacy toggle: Public/Private (default: Private)
  - "Create" and "Cancel" buttons
  
- [ ] **Project Detail Page** (`/projects/:projectId`)
  - Project header with name, description, metadata
  - Edit project button (opens edit modal)
  - Delete project button (with confirmation)
  - Files list within project
  - Upload file to project
  - Tabs: Files, Scans, Team (Phase 2)
  
- [ ] **Project Context in Current Flow**
  - Upload page needs project selector dropdown
  - Files associated with specific projects
  - Analysis page shows project breadcrumb
  
- [ ] **Project Edit Modal**
  - Edit name and description
  - Change privacy setting
  - Save/Cancel actions

**State Management Updates:**
```typescript
// Add to Zustand store or create new projectStore
interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  isLoading: boolean
  
  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectData) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (project: Project) => void
}
```

**API Integration Needed:**
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/files` - List files in project

---

#### 3. User Profile & Settings Page

**PRD Reference:** Section 5 (MVP Features), Section 11 (GDPR Compliance)

**Missing Components:**
- [ ] **Settings Page** (`/settings`)
  - Tabs: Profile, Appearance, Security, Data & Privacy
  
- [ ] **Profile Tab**
  - Display name (editable)
  - Email (display only, with "Change email" button)
  - Profile picture upload (Phase 2)
  - Account creation date
  - "Save Changes" button
  
- [ ] **Appearance Tab**
  - Dark mode toggle (currently hardcoded)
  - Theme selector (Dark, Light, System)
  - Color scheme preferences (Phase 2)
  - Font size adjustment (Phase 2)
  
- [ ] **Security Tab**
  - Change password form
  - Two-factor authentication toggle (Phase 2)
  - Active sessions list (Phase 2)
  - "Log out all devices" button
  
- [ ] **Data & Privacy Tab**
  - Download personal data (GDPR)
  - Delete account (with confirmation + password re-entry)
  - Data usage statistics
  - Cookie preferences
  - TOS acceptance history

**API Integration Needed:**
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update profile
- `POST /api/users/me/change-password`
- `POST /api/users/me/export-data` - GDPR data export
- `DELETE /api/users/me` - Account deletion

---

#### 4. Scan Configuration Interface

**PRD Reference:** Section 5 (Frontend Features - Scan Configuration Panel), Section 8 (Detection Pipeline)

**Missing Components:**
- [ ] **Scan Configuration Modal** (triggered before scan starts)
  - **Data Type Selection** (multi-select checkboxes):
    - `u8` (unsigned 8-bit)
    - `u16LE`, `u16BE` (unsigned 16-bit little/big endian)
    - `u32LE`, `u32BE` (unsigned 32-bit)
    - `s16LE`, `s16BE` (signed 16-bit)
    - `s32LE`, `s32BE` (signed 32-bit)
    - `float32LE`, `float32BE` (32-bit float)
  
  - **Endianness Hint** (radio buttons):
    - Auto-detect (default)
    - Little Endian
    - Big Endian
  
  - **Sensitivity Threshold** (slider):
    - Low (fewer candidates, high confidence)
    - Medium (default)
    - High (more candidates, lower confidence threshold)
  
  - **Advanced Options** (collapsible):
    - Max candidates limit (default: 200)
    - Minimum candidate size (bytes)
    - Search regions (offset ranges)
  
  - Tooltips explaining each option
  - "Scan with these settings" button
  - "Use defaults" link

**State Management:**
```typescript
interface ScanConfig {
  dataTypes: string[]
  endianness: 'auto' | 'little' | 'big'
  sensitivity: 'low' | 'medium' | 'high'
  maxCandidates: number
  minCandidateSize?: number
  searchRegions?: Array<{ start: number; end: number }>
}
```

---

#### 5. Export Wizard (Enhanced)

**PRD Reference:** Section 5 (Frontend Features - Export Wizard), Section 9 (API - Export Project)

**Current Status:** Export button exists but only shows toast

**Missing Components:**
- [ ] **Export Configuration Modal** (multi-step wizard)
  
  **Step 1: Select Format**
  - Radio buttons with previews:
    - ☐ JSON (raw data, machine-readable)
    - ☐ PDF Report (formatted document with visualizations)
    - ☐ CSV (candidates table only, spreadsheet-compatible)
    - ☐ XML (structured data, legacy compatibility) - Phase 2
  
  **Step 2: Configure Options**
  - Checkboxes:
    - ☑ Include candidates
    - ☑ Include annotations
    - ☐ Include bookmarks
    - ☐ Include hex regions (increases file size)
    - ☐ Include screenshots (PDF only)
  - PDF-specific fields:
    - Report title (text input)
    - Author name (pre-filled from profile)
    - Include methodology section (checkbox)
  
  **Step 3: Legal Attestation** (already implemented in TOSModal, reuse)
  - Warning box about responsible use
  - Required checkbox: "I confirm this export is for research/educational purposes only"
  - Cannot proceed without checking
  
  **Step 4: Generate & Download**
  - Progress spinner: "Generating export..."
  - Success state: "Export ready!"
  - Download button
  - Expiration notice: "Download link valid for 24 hours"
  - Copy link button

**API Integration:**
- `POST /api/projects/:id/export` (already in api.ts, needs UI)

---

### 🟡 P1 - Important for User Experience (Post-MVP)

#### 6. Map Visualization Components

**PRD Reference:** Section 5 (Frontend Features - Map Inspector), Section 4 (Use Cases)

**Missing Components:**
- [ ] **2D Heatmap Visualizer** (`/analysis/:scanId/map/:candidateId`)
  - Canvas/WebGL-based heatmap
  - Color gradient legend (cold=blue, neutral=yellow, hot=red)
  - Axis labels (manual input or auto-detected from adjacent 1D arrays)
  - Grid lines with configurable spacing
  - Hover tooltip showing coordinates + value
  - Zoom controls (+/- buttons)
  - Color scheme selector dropdown (Jet, Viridis, Grayscale, etc.)
  - Export as PNG button
  - Export data as CSV button
  
- [ ] **3D Surface Plot** (Phase 2)
  - Three.js or Plotly.js implementation
  - Rotate with mouse drag
  - Zoom with scroll wheel
  - Double-click to reset view
  - Axis labels
  - Color-coded surface by value
  
- [ ] **1D Array Line Chart**
  - X-axis: index or detected axis values (RPM, load, etc.)
  - Y-axis: value
  - Hover for precise values
  - Export as PNG/CSV

**Component Structure:**
```typescript
// New components needed
<MapVisualizer2D 
  candidate={selectedCandidate} 
  data={mapData}
  onCellClick={(x, y) => jumpToOffset(offset)}
/>

<MapVisualizer3D 
  candidate={selectedCandidate}
  data={mapData}
  colorScheme="viridis"
/>

<ArrayLineChart
  candidate={selectedCandidate}
  data={arrayData}
  axisLabel="RPM"
/>
```

**Libraries to Add:**
- `plotly.js` or `react-plotly.js` for scientific visualizations
- `d3.js` for custom charts
- `three.js` for 3D rendering (Phase 2)

---

#### 7. Enhanced Annotation System

**PRD Reference:** Section 5 (Frontend Features - Annotation Tools), Section 9 (Data Model - Annotation)

**Current Status:** State management exists but no UI

**Missing Components:**
- [ ] **Annotation Panel** (sidebar or modal in Analysis page)
  - List of all annotations for current file
  - Each annotation card shows:
    - Label
    - Offset range
    - Preview of notes (truncated)
    - Verification status badge
    - Edit/Delete buttons
  - "Add Annotation" button
  
- [ ] **Annotation Creation/Edit Form**
  - Label input (required, max 100 chars)
  - Notes textarea with **markdown support**
    - Markdown preview tab
    - Formatting toolbar (bold, italic, lists, links)
  - Tags input (multi-select or comma-separated)
    - Suggested tags from user history
    - Common tags: "fuel", "ignition", "boost", "verified", "uncertain"
  - Validation status radio buttons:
    - ☐ Verified (green badge)
    - ☐ Uncertain (yellow badge)
    - ☐ Rejected (red badge)
  - Byte range display (read-only, from selection)
  - "Save" and "Cancel" buttons
  
- [ ] **Annotation Integration in Hex Viewer**
  - Right-click context menu on hex bytes:
    - "Annotate selection"
    - "Add bookmark"
    - "Copy as hex"
    - "Copy as decimal"
  - Annotation indicator overlays (green border)
  - Hover tooltip showing annotation label
  
- [ ] **Bookmark Management**
  - Bookmark panel (similar to annotations)
  - Quick bookmark button in hex viewer
  - Color picker for bookmark (destructive/warning/success)
  - Jump to bookmark feature

**Component Example:**
```typescript
<AnnotationPanel
  annotations={annotations}
  onEdit={(id) => openAnnotationModal(id)}
  onDelete={(id) => deleteAnnotation(id)}
  onJumpTo={(offset) => scrollHexViewer(offset)}
/>

<AnnotationForm
  mode="create" | "edit"
  initialData={existingAnnotation}
  onSave={handleSave}
  onCancel={closeModal}
/>
```

---

#### 8. Diff Mode / File Comparison

**PRD Reference:** Section 4 (Use Case 2 - Motorsport Engineer), Section 6 (Phase 2 - Diff Engine)

**Missing Components:**
- [ ] **Diff Mode Toggle** (in Project/Analysis page)
  - "Compare Files" button when 2+ files in project
  - File selector dropdowns: "Base File" and "Compare File"
  - "Start Comparison" button
  
- [ ] **Diff Visualization Page** (`/projects/:id/diff`)
  - Side-by-side hex viewers
  - Byte-level difference highlighting:
    - Red: bytes removed in compare file
    - Green: bytes added in compare file
    - Yellow: bytes modified
    - Gray: unchanged
  - Synchronized scrolling
  - Jump to next/previous difference buttons
  - Difference statistics panel:
    - Total differences
    - % changed
    - Modified candidate regions
  
- [ ] **Candidate Diff View**
  - Filter: "Show only modified candidates"
  - Table comparing candidate properties:
    - Offset changes
    - Confidence score changes
    - Dimension changes
  - Side-by-side 2D map comparison (heatmaps)
  
- [ ] **Diff Export**
  - Export diff report as PDF
  - Include side-by-side screenshots
  - Highlight key differences

---

#### 9. Search & Filtering Enhancements

**PRD Reference:** Section 7 (Phase 2 - Advanced Features), Section 9 (Search Index)

**Current Status:** Basic type and confidence filtering implemented

**Missing Components:**
- [ ] **Global Search** (navbar search bar)
  - Search across:
    - Project names
    - File names
    - Annotation labels/notes
    - Candidate metadata
  - Instant results dropdown with highlights
  - Full search results page (`/search?q=...`)
  
- [ ] **Advanced Filters in Results Table**
  - Current: Type filter, confidence slider ✅
  - Missing:
    - Offset range filter (start/end hex inputs)
    - Size range filter (min/max bytes)
    - Dimension filter (e.g., "16x16 maps only")
    - Data type filter (u8/u16/u32/float)
    - Tag filter (if annotated)
    - Verification status filter (verified/uncertain/rejected)
  
- [ ] **Saved Filter Presets**
  - Save current filters as preset
  - Quick access to common filters:
    - "High confidence only" (>90%)
    - "Large 2D maps" (>256 bytes, 2D)
    - "Unverified candidates"
  - Manage saved filters in settings

---

#### 10. File Management Interface

**PRD Reference:** Section 4 (Use Case 1), Section 9 (Data Model - FirmwareFile)

**Missing Components:**
- [ ] **File Detail Page** (`/files/:fileId`)
  - File metadata card:
    - Filename
    - Size
    - SHA-256 hash (for integrity verification)
    - Upload date
    - Uploader (in team projects)
    - Endianness hint
  - Scan history for this file
  - "New Scan" button (with different config)
  - "Download original file" button
  - "Delete file" button (with confirmation)
  
- [ ] **File List in Project** (table view)
  - Columns:
    - Filename
    - Size
    - Upload Date
    - Scans Count
    - Actions (View, Scan, Delete)
  - Sort by any column
  - Multi-select for batch actions (Phase 2)
  
- [ ] **File Upload History**
  - Show all uploaded files (not just in current project)
  - Filter by date range
  - Filter by project
  - Search by filename

---

### 🟢 P2 - Nice to Have (Phase 2+)

#### 11. Team Collaboration Features

**PRD Reference:** Section 6 (Phase 2 - Team Workspaces), Section 7 (Phase 2)

**Missing Components:**
- [ ] **Team Workspace Management**
  - Create team workspace
  - Invite members via email
  - Role assignment: Owner, Admin, Editor, Viewer
  - Member list with roles
  - Remove members
  
- [ ] **Comment Threads**
  - Attach comments to byte ranges in hex viewer
  - Thread view with replies
  - @mention teammates (autocomplete)
  - Notifications for mentions
  - Mark thread as resolved
  
- [ ] **Activity Feed** (`/projects/:id/activity`)
  - Real-time activity log:
    - "User X uploaded file Y"
    - "User X added annotation Z"
    - "User X started scan"
  - Filter by user, action type, date
  
- [ ] **Real-time Collaboration**
  - WebSocket-based presence indicators
  - Show who's viewing same file
  - Live cursor positions (like Google Docs)
  - Collaborative annotations

---

#### 12. Tutorial & Onboarding System

**PRD Reference:** Section 4 (Use Case 4 - Hobbyist), Section 5 (Legal Attestation)

**Missing Components:**
- [ ] **Welcome Screen** (first-time users)
  - Interactive product tour
  - "Get Started" wizard:
    1. Upload sample file
    2. Run first scan
    3. Explore hex viewer
    4. Add first annotation
  - Skip option
  
- [ ] **Tutorial Library** (`/tutorials`)
  - Video tutorials (embedded)
  - Text guides with screenshots
  - Sample files for practice
  - Topics:
    - "Introduction to ECU Calibration Tables"
    - "Understanding Confidence Scores"
    - "Hex Viewer Basics"
    - "2D Map Visualization"
  
- [ ] **Contextual Help**
  - "?" icon next to complex UI elements
  - Tooltip on hover with explanation
  - "Learn more" links to documentation
  
- [ ] **Sample/Practice Data**
  - Pre-loaded sample projects (read-only)
  - Clearly marked as synthetic/educational
  - "Duplicate to my projects" button

---

#### 13. Advanced Export & Reporting

**PRD Reference:** Section 9 (Export Project API), Section 6 (Phase 3 - Automated Reports)

**Missing Components:**
- [ ] **PDF Report Generator** (enhanced)
  - Cover page with project info
  - Executive summary (auto-generated)
  - Table of contents
  - Candidate list with screenshots
  - 2D map visualizations (embedded images)
  - Annotation summaries
  - Methodology section
  - Footer with disclaimer
  
- [ ] **Custom Report Templates** (Phase 3)
  - Template editor
  - Select sections to include
  - Custom branding (logo, colors)
  - Save templates for reuse
  
- [ ] **Scheduled Exports** (Phase 3)
  - Auto-export on scan completion
  - Email delivery
  - Webhook integration

---

#### 14. Audit Log Viewer (User-Facing)

**PRD Reference:** Section 11 (Audit Logging & Monitoring)

**Missing Components:**
- [ ] **My Activity Page** (`/account/activity`)
  - Table of user's actions:
    - Action type (upload, scan, export, etc.)
    - Resource (file/project name)
    - Timestamp
    - IP address (partial, privacy)
    - Status (success/failed)
  - Filter by action type
  - Filter by date range
  - Export activity log (CSV)
  
- [ ] **TOS Acceptance History**
  - List of all TOS acceptances
  - Version accepted
  - Timestamp
  - IP address (hashed)

---

#### 15. Mobile Responsive Views

**PRD Reference:** Section 7 (Phase 2 - Mobile-Responsive UI)

**Current Status:** Desktop-first design, not tested on mobile

**Missing Components:**
- [ ] **Mobile Navigation**
  - Hamburger menu for navigation
  - Collapsible sidebar
  - Bottom navigation bar (Phase 2)
  
- [ ] **Tablet-Optimized Layouts**
  - Responsive hex viewer (adjust bytes per row)
  - Stacked layout for split views
  - Touch-friendly controls (larger tap targets)
  
- [ ] **Mobile-Specific Features**
  - Swipe gestures for navigation
  - Pull-to-refresh
  - Simplified visualizations
  - File upload from camera (Phase 2)

---

#### 16. Offline Mode / PWA

**PRD Reference:** Section 7 (Phase 2 - Offline Mode)

**Missing Components:**
- [ ] **Progressive Web App Setup**
  - Service worker registration
  - Offline cache strategy
  - Install prompt
  - App manifest
  
- [ ] **Offline Functionality**
  - Cache uploaded files for offline viewing
  - Queue scans to run when back online
  - Offline hex viewer
  - Sync annotations when reconnected
  
- [ ] **Data Persistence**
  - IndexedDB for local storage
  - Offline-first state management
  - Conflict resolution on sync

---

#### 17. Accessibility Enhancements

**PRD Reference:** Section 10 (UX Requirements - Accessibility)

**Current Status:** Basic Radix UI accessibility, not fully tested

**Missing Components:**
- [ ] **Keyboard Shortcuts**
  - Global shortcuts panel (`?` to open)
  - Navigation shortcuts (j/k for next/prev candidate)
  - Hex viewer shortcuts (arrow keys, home/end)
  - Action shortcuts (Ctrl+S to save annotation, etc.)
  
- [ ] **Screen Reader Optimization**
  - ARIA live regions for scan progress
  - Descriptive labels for all controls
  - Alternative text for visualizations
  - Keyboard-accessible hex viewer
  
- [ ] **High Contrast Mode**
  - System preference detection
  - Manual toggle
  - WCAG AAA compliance option
  
- [ ] **Font Size Controls**
  - Text zoom (Ctrl++ / Ctrl+-)
  - Persistent preference
  - Hex viewer font size adjustment

---

#### 18. Performance & Developer Tools

**PRD Reference:** Section 10 (Performance SLAs)

**Missing Components:**
- [ ] **Performance Monitoring Dashboard** (admin-only)
  - Page load times
  - API response times
  - Error rates
  - User metrics
  
- [ ] **Debug Mode Toggle** (dev only)
  - Show API requests/responses
  - State inspector
  - Performance profiler
  
- [ ] **Error Boundary Improvements**
  - User-friendly error pages
  - Error reporting to backend
  - Retry mechanisms

---

#### 19. Help & Documentation

**PRD Reference:** Section 13 (Documentation)

**Missing Components:**
- [ ] **Help Center** (`/help`)
  - Searchable knowledge base
  - Categories: Getting Started, Features, Troubleshooting, Legal
  - Related articles suggestions
  
- [ ] **FAQ Page** (`/faq`)
  - Expandable accordion format
  - Common questions:
    - "Is this legal?"
    - "What file formats are supported?"
    - "How accurate is the detection?"
    - "Can I modify live ECUs?"
  
- [ ] **Contact/Support Page** (`/support`)
  - Support ticket form
  - Expected response time
  - Link to community forum (Phase 2)
  - Email support option
  
- [ ] **Changelog** (`/changelog`)
  - Version history
  - What's new announcements
  - Feature releases
  - Bug fixes

---

#### 20. Community Features (Phase 2+)

**PRD Reference:** Section 6 (Phase 2 - Signature Database)

**Missing Components:**
- [ ] **Community Forum** (external or `/community`)
  - Discussion boards
  - Q&A section
  - Share projects (public only)
  - Reputation system
  
- [ ] **Signature Database** (Phase 2)
  - Community-contributed patterns
  - Browse known ECU architectures
  - Submit new signatures
  - Privacy-preserving matching
  
- [ ] **Leaderboard/Achievements**
  - Most annotations created
  - Most accurate verifications
  - Contribution badges
  - Gamification elements

---

## 📊 Feature Gap Summary

### By Component

| Component Area | Implemented | Missing | Gap % |
|----------------|-------------|---------|-------|
| **Authentication** | 0 | 5 features | 100% |
| **Project Management** | 0 | 6 features | 100% |
| **User Settings** | 0 (dark theme only) | 4 tabs | 100% |
| **Scan Configuration** | 0 (uses defaults) | 1 modal | 100% |
| **Visualization** | 0 | 3 components | 100% |
| **Annotations** | State only | Full UI | 90% |
| **Export** | Button only | 4-step wizard | 75% |
| **Diff Mode** | 0 | Complete feature | 100% |
| **Search** | Basic filters | Advanced + global | 70% |
| **Team Collaboration** | 0 | Complete feature | 100% |
| **Mobile/Responsive** | 0 | Optimization needed | 100% |

### By Priority

| Priority | Features | Implemented | Missing |
|----------|----------|-------------|---------|
| **P0 (MVP Blockers)** | ~25 | 8 | 17 |
| **P1 (Important)** | ~20 | 3 | 17 |
| **P2 (Nice to Have)** | ~30 | 0 | 30 |
| **Total** | **~75** | **11** | **64** |

**Overall Completion:** ~15% of PRD features implemented

---

## 🗺️ Implementation Roadmap

### Phase 1: Complete MVP (2-3 weeks)

**Week 1-2:**
1. Authentication system (login, register, password reset)
2. Project management (CRUD operations, dashboard)
3. User settings page (profile, appearance, security)
4. Scan configuration modal

**Week 3:**
5. Enhanced export wizard (multi-step with PDF support)
6. Annotation UI (panel, form, integration)
7. File management pages

**Estimated Effort:** 2-3 developers, 2-3 weeks

---

### Phase 2: Advanced Features (4-6 weeks)

**Weeks 4-6:**
1. 2D/3D map visualizers
2. Diff mode implementation
3. Advanced search and filtering
4. Mobile responsive optimization

**Weeks 7-9:**
5. Team collaboration features
6. Tutorial and onboarding
7. Offline mode/PWA
8. Accessibility enhancements

**Estimated Effort:** 3-4 developers, 4-6 weeks

---

### Phase 3: Enterprise & Community (8+ weeks)

**Ongoing:**
1. Community features
2. Advanced reporting
3. Plugin architecture
4. Performance optimizations
5. Integration SDKs

---

## 🔧 Technical Debt & Refactoring Needed

### Before Adding New Features

1. **Routing Structure**
   - Current: Only 3 routes (/, /analysis, /404)
   - Needed: Nested routing structure for projects, settings, etc.
   - Recommendation: Use React Router nested routes + layouts

2. **State Management**
   - Current: Single `analysisStore.ts`
   - Needed: Split into multiple stores:
     - `authStore.ts` - User authentication
     - `projectStore.ts` - Project management
     - `analysisStore.ts` - Analysis data (current)
     - `uiStore.ts` - UI preferences, modals, etc.

3. **API Service Layer**
   - Current: Single `api.ts` with mock implementations
   - Needed: Split by domain:
     - `api/auth.ts`
     - `api/projects.ts`
     - `api/files.ts`
     - `api/scans.ts`
     - `api/annotations.ts`

4. **Component Organization**
   - Consider feature-based structure:
     ```
     src/features/
       auth/
         components/
         hooks/
         store/
       projects/
       analysis/
       settings/
     ```

---

## 📦 New Dependencies Required

### For Missing Features

| Feature | Library | Purpose |
|---------|---------|---------|
| 2D/3D Visualization | `plotly.js` or `d3.js` | Charts and heatmaps |
| 3D Surface Plots | `three.js` + `react-three-fiber` | 3D rendering |
| Markdown Editor | `react-markdown-editor-lite` | Annotation notes |
| Markdown Preview | `react-markdown` + `remark-gfm` | Rendering markdown |
| Diff Viewer | `react-diff-viewer-continued` | Side-by-side comparison |
| Date/Time Picker | `react-day-picker` | Filter by date ranges |
| Multi-Select | `react-select` | Tag selection, filters |
| Code Editor (future) | `@monaco-editor/react` | Custom scan scripts |
| PDF Generation | `jspdf` or backend service | Report generation |
| Syntax Highlighting | `prismjs` or `highlight.js` | Code/hex display |
| Infinite Scroll | `react-intersection-observer` | Activity feeds |
| Tour/Onboarding | `react-joyride` | Interactive tutorials |

---

## ✅ Acceptance Criteria per Feature

### Authentication (Example)

- [ ] User can register with email + password
- [ ] Email validation prevents invalid emails
- [ ] Password must meet strength requirements (12+ chars, mixed case, numbers, symbols)
- [ ] User receives confirmation email after registration
- [ ] User can login with correct credentials
- [ ] Login fails gracefully with incorrect credentials (max 5 attempts, then lockout)
- [ ] User can reset password via email link
- [ ] JWT token stored securely (httpOnly cookie or encrypted localStorage)
- [ ] Token refresh happens automatically 5 min before expiry
- [ ] User redirected to login when token expires
- [ ] Protected routes block unauthenticated users
- [ ] All auth endpoints log to audit trail

*(Similar criteria needed for each feature)*

---

## 🚦 Launch Decision Matrix

### Can we launch MVP without these features?

| Feature | Can Skip for MVP? | Reasoning |
|---------|-------------------|-----------|
| Authentication | ❌ NO | Required for multi-user, audit, compliance |
| Project Management | ❌ NO | Core organizational feature |
| Settings Page | ⚠️ MAYBE | Can defer advanced settings, but need profile + dark mode toggle |
| Scan Config | ⚠️ MAYBE | Can use smart defaults, add config post-launch |
| 2D/3D Viz | ✅ YES | Hex viewer sufficient for MVP, add later |
| Annotations UI | ❌ NO | Core feature per PRD |
| Enhanced Export | ⚠️ MAYBE | Basic JSON export could suffice initially |
| Diff Mode | ✅ YES | Advanced feature, defer to Phase 2 |
| Team Collab | ✅ YES | Single-user mode acceptable for MVP |
| Mobile Responsive | ⚠️ MAYBE | Depends on target audience (desktop researchers OK?) |

**Minimum Viable Launch:** Authentication + Projects + Settings (basic) + Annotations + Export (JSON) = ~4 weeks additional dev

---

## 📝 Notes for Backend Team

Many missing frontend features require backend API endpoints that may also be missing:

1. **Auth endpoints** - `/api/auth/*` (register, login, refresh, etc.)
2. **Projects CRUD** - `/api/projects/*`
3. **User profile** - `/api/users/me`
4. **GDPR endpoints** - Data export, account deletion
5. **Advanced scan config** - Accept scan parameters
6. **Diff API** - Compare two files
7. **Team management** - Workspaces, invites, roles
8. **Comment threads** - Real-time collaboration

Backend implementation should run in parallel with frontend development.

---

## 🔗 Quick Links

- [Current Frontend Status](FRONTEND_REBUILD_COMPLETE.md)
- [Product Requirements Document](docs/PRD.md)
- [Frontend PRD](docs/FRONTEND_PRD.md)
- [MVP Plan](docs/MVP_PLAN.md)

---

**Last Updated:** October 11, 2025  
**Maintainer:** Product Team  
**Next Review:** After backend API v1 completion

