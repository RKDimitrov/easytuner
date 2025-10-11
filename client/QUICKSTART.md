# Quick Start Guide - ECU Map Recognition Platform

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

### Installation

```bash
cd client
npm install
```

### Development Server

```bash
npm run dev
```

The application will be available at **http://localhost:3000**

### Production Build

```bash
npm run build
npm run preview
```

---

## 📖 Using the Application

### Step 1: Upload File

1. Navigate to **http://localhost:3000**
2. **Accept TOS/Legal Attestation** (required on first use)
   - Check both boxes:
     - ☑️ Terms of Service
     - ☑️ Legal Attestation
   - Click "Accept & Continue"

3. **Upload a firmware file:**
   - Drag and drop a binary file (`.bin`, `.hex`, `.ecu`, `.dat`)
   - **OR** click to browse
   - **OR** click "Generate Demo" for synthetic test data

**File Requirements:**
- Max size: 16 MB
- Binary format recommended

---

### Step 2: Analyze File

After upload, you'll be automatically redirected to the Analysis page:

1. **Start Scan**
   - Click the "Start Scan" button
   - Watch real-time progress bar
   - Wait for scan completion (~3-5 seconds with mock data)

2. **View Results**
   - **Results Table** (left panel):
     - Shows detected ECU map candidates
     - Filter by type (1D/2D/3D)
     - Adjust confidence range slider
     - Click rows to select candidates
   
   - **Hex Viewer** (right panel):
     - Displays raw binary data in hex format
     - 16 bytes per row
     - ASCII representation on the right
     - Color-coded regions:
       - 🔵 **Blue:** Selected candidate
       - 🔴 **Red:** Bookmarks
       - 🟢 **Green:** Annotations

---

## 🎨 Features to Try

### Filter Results
1. Click the **Filter** icon in Results Table
2. Toggle map types (1D/2D/3D)
3. Adjust confidence range (0-100%)
4. Click "Reset Filters" to clear

### Navigate Hex Viewer
1. Click any candidate row in Results Table
2. Hex Viewer automatically scrolls to that offset
3. Selected candidate is highlighted in blue
4. Hover over bytes to see offset and value

### Generate Demo Data
1. On Upload page, click "Generate Demo"
2. Creates 64KB synthetic firmware with patterns:
   - 16×16 2D map at `0x1000`
   - 8×8 2D map at `0x2000`
   - 1D table at `0x3000`
3. Perfect for testing without real firmware files

---

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run type-check` | Run TypeScript compiler check |
| `npm run format` | Format code with Prettier |

---

## 🧪 Testing the Application

### Manual Test Checklist

- [ ] Upload a file via drag-and-drop
- [ ] Upload a file via file browser
- [ ] Generate demo firmware
- [ ] Accept TOS modal (both checkboxes)
- [ ] Start a scan
- [ ] Wait for scan completion
- [ ] Filter results by type
- [ ] Adjust confidence slider
- [ ] Click a candidate row
- [ ] Verify hex viewer scrolls to offset
- [ ] Check color coding in hex viewer
- [ ] Try rescan button

---

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
# Kill the process using port 3000
npx kill-port 3000

# Or change port in vite.config.ts
server: {
  port: 3001,  // Change this
}
```

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Fails
```bash
# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint
```

### Styles Not Loading
```bash
# Ensure Tailwind is processing correctly
# Check tailwind.config.js content paths
# Verify postcss.config.js exists
```

---

## 🔗 Backend Integration

### Current State
The application runs with **mock data**. All API calls in `src/services/api.ts` return simulated responses.

### To Connect to Real Backend

1. **Set API URL:**
   Create `.env` file in `client/` directory:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```

2. **Update API Service:**
   Edit `src/services/api.ts` and uncomment the real API calls.

3. **Start Backend:**
   Ensure backend server is running on `http://localhost:8000`

4. **Test Integration:**
   ```bash
   npm run dev
   ```

---

## 📁 Project Structure Quick Reference

```
client/src/
├── components/       # Reusable UI components
│   ├── ui/          # Base Shadcn components
│   └── *.tsx        # Feature components
├── pages/           # Page components (Upload, Analysis)
├── store/           # Zustand state management
├── services/        # API integration layer
├── hooks/           # Custom React hooks
├── lib/             # Utility functions
└── types/           # TypeScript definitions
```

---

## 💡 Tips

### Performance
- The hex viewer and results table use virtualization
- Large files (16MB) should render smoothly
- If you notice lag, check browser dev tools for errors

### Data Persistence
- Currently, state is **not persisted** on page refresh
- File data stays in memory until you navigate away
- To implement persistence, add backend integration

### Accessibility
- All components are keyboard navigable
- Use `Tab` to move between elements
- Use `Enter` or `Space` to activate buttons
- Use arrow keys in sliders

---

## 🎯 Common Workflows

### Quick Test with Demo Data
```
1. Open http://localhost:3000
2. Click "Generate Demo" (skip TOS if already accepted)
3. Click "Start Scan"
4. Click any candidate row
5. View hex viewer highlighting
```

### Upload Real Firmware
```
1. Open http://localhost:3000
2. Drag firmware file to drop zone
3. Accept TOS if prompted
4. Click "Start Scan" on Analysis page
5. Explore results
```

### Filter and Export
```
1. Complete a scan
2. Click filter icon in Results Table
3. Toggle desired map types
4. Adjust confidence slider
5. Click "Export" button (coming soon)
```

---

## 📞 Support

- **Linter Issues:** Run `npm run lint:fix`
- **Type Errors:** Check `npm run type-check`
- **Build Errors:** Delete `dist/` and rebuild
- **Style Issues:** Clear browser cache

---

## ✅ Verification

After starting the dev server, verify:

1. ✅ Application loads at http://localhost:3000
2. ✅ No console errors in browser dev tools
3. ✅ TOS modal appears on first upload attempt
4. ✅ Demo data generation works
5. ✅ Scan progress bar animates
6. ✅ Results table populates
7. ✅ Hex viewer displays data
8. ✅ Clicking candidates highlights hex viewer

---

**🎉 You're ready to use the ECU Map Recognition Platform!**

For detailed technical documentation, see `FRONTEND_REBUILD_COMPLETE.md`

