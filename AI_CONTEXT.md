# HotelTask — Project Context & Memory

> This file is the single source of truth for Amazon Q. Updated after every coding session.
> Last updated: Session 8 — Soft Delete feature complete.

---

## Project Overview

**Name:** HotelTask — Hotel Internal Task Management System
**Purpose:** Replaces WhatsApp-based communication between hotel departments. Reception assigns tasks → departments receive them in real-time with sound → departments update status → reception sees it live.
**Type:** React.js SPA + Node.js/Express/MongoDB backend
**Status:** ✅ Fully functional, production build verified

---

## Folder Layout

```
f:\karamveer\all projects\hotelwhatsapp\
├── backend/                        ← Node.js + Express + Socket.io + MongoDB
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.js             ← username, password (bcrypt), role
│   │   │   ├── Task.js             ← full task schema (see below)
│   │   │   └── Staff.js            ← name, department
│   │   ├── controllers/
│   │   │   ├── authController.js   ← login(), register()
│   │   │   ├── taskController.js   ← getTasks, createTask, updateTask, reassignTask, deleteTask, getDeletedTasks, exportCSV, getAnalytics
│   │   │   └── staffController.js  ← getStaff, addStaff, deleteStaff
│   │   ├── routes/
│   │   │   ├── auth.js             ← POST /login, POST /register
│   │   │   ├── tasks.js            ← all task routes
│   │   │   └── staff.js            ← GET/POST/DELETE /staff
│   │   ├── middleware/
│   │   │   └── auth.js             ← protect (JWT), allow(...roles)
│   │   ├── db.js                   ← mongoose.connect()
│   │   ├── seed.js                 ← creates default users
│   │   └── server.js               ← Express + Socket.io entry point
│   ├── .env
│   └── package.json
├── public/
│   ├── index.html
│   └── notification.mp3            ← User's custom sound file
├── src/
│   ├── components/
│   │   ├── TaskCard.js             ← Reusable card with all modals
│   │   ├── Sidebar.js              ← Role-aware sidebar + logout
│   │   └── Navbar.js               ← Topbar with hamburger
│   ├── pages/
│   │   ├── Login.js                ← Auth + demo mode fallback
│   │   ├── ReceptionDashboard.js   ← Create tasks + view + delete
│   │   ├── DepartmentDashboard.js  ← Dept tasks + sound + actions
│   │   └── AdminDashboard.js       ← Full admin panel (4 tabs)
│   ├── services/
│   │   ├── api.js                  ← Axios instance + all API calls
│   │   └── socket.js               ← Socket.io singleton
│   ├── styles/
│   │   └── main.css                ← Full CSS design system + dark mode
│   ├── App.js                      ← Router + PrivateRoute + PublicRoute
│   └── index.js
├── AI_CONTEXT.md                   ← This file
└── package.json
```

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React.js | ^19.2.5 | UI (functional components + hooks) |
| React Router DOM | v6 | Client-side routing |
| Axios | latest | HTTP API calls |
| Socket.io-client | latest | Real-time events |
| React Toastify | latest | Toast notifications |
| Recharts | latest | Bar chart in admin analytics |
| CSS custom | — | Pure CSS variables, no Tailwind |
| Node.js + Express | latest | REST API server |
| Socket.io | ^4.7.5 | Real-time server |
| Mongoose | ^8.3.4 | MongoDB ODM |
| bcryptjs | ^2.4.3 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT auth |

---

## Routes & Role Mapping

| Role | Route | Dashboard |
|---|---|---|
| `reception` | `/reception` | ReceptionDashboard |
| `housekeeping` | `/department` | DepartmentDashboard |
| `kitchen` | `/department` | DepartmentDashboard |
| `maintenance` | `/department` | DepartmentDashboard |
| `admin` | `/admin` | AdminDashboard |

- `PrivateRoute` — redirects to `/login` if no token
- `PublicRoute` — redirects logged-in users to their role route
- Catch-all `*` → `/login`

---

## localStorage Keys

| Key | Value |
|---|---|
| `token` | JWT string or `"demo-token"` |
| `role` | reception / housekeeping / kitchen / maintenance / admin |
| `username` | display name |
| `darkMode` | `"true"` / `"false"` |

---

## MongoDB Models

### User.js
```js
{ username, password (bcrypt hashed), role: enum[reception,housekeeping,kitchen,maintenance,admin] }
```
- `matchPassword(plain)` — bcrypt compare method
- JWT includes `{ id, username }` payload

### Task.js
```js
{
  roomNumber: String,
  description: String,
  department: enum[housekeeping, kitchen, maintenance],
  priority: enum[low, medium, high],  default: medium
  status: enum[pending, in-progress, done],  default: pending
  createdBy: ObjectId ref User,
  updatedBy: ObjectId ref User,
  doneBy: String,       // staff name who completed
  doneAt: Date,
  isDeleted: Boolean,   // soft delete flag, default false
  deletedBy: String,    // username who deleted
  deletedAt: Date,
  history: [{ status, changedBy, changedAt, note }]  // audit log
}
// Indexes: { department, status }, { createdAt }, { roomNumber }
```

### Staff.js
```js
{ name: String, department: enum[housekeeping, kitchen, maintenance] }
```

---

## All API Endpoints

### Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/login` | Public | Login, returns JWT + role + username |
| POST | `/register` | Public | Create user |

### Tasks
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/tasks` | All auth | Get tasks (dept users see only their dept, `isDeleted:false`) |
| GET | `/tasks/deleted` | Admin | Get soft-deleted tasks |
| GET | `/tasks/export` | Admin | Download CSV of all tasks |
| GET | `/tasks/analytics` | Admin | 7-day chart data + staff performance |
| POST | `/create-task` | Reception, Admin | Create task, emits `newTask` socket |
| PUT | `/update-task/:id` | Dept, Admin | Update status + doneBy, emits `taskUpdated` |
| PUT | `/reassign-task/:id` | Admin | Move task to different dept, emits `taskReassigned` + `newTask` |
| DELETE | `/delete-task/:id` | Reception, Admin | Soft delete, emits `taskDeleted` |

### Staff
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/staff` | All auth | Get staff (dept users see only their dept) |
| POST | `/staff` | Admin | Add staff member |
| DELETE | `/staff/:id` | Admin | Remove staff member |

### Query Params for GET /tasks & GET /tasks/deleted
- `?search=101` — partial room number match
- `?from=2024-01-01&to=2024-01-31` — date range
- `?department=housekeeping` — filter by dept (admin only)
- `?status=pending` — filter by status

---

## Socket.io Events

| Direction | Event | Payload | Who listens |
|---|---|---|---|
| Client → Server | `joinDepartment` | role string | — |
| Server → Client | `newTask` | full task object | dept, reception, admin |
| Server → Client | `taskUpdated` | `{ id, status, doneBy, doneAt, history, department? }` | dept, reception, admin |
| Server → Client | `taskDeleted` | `{ id }` | dept, reception, admin |
| Server → Client | `taskReassigned` | `{ id, newDepartment }` | old dept |

---

## Frontend API Service (`src/services/api.js`)

```js
loginUser(data)              // POST /login
createTask(data)             // POST /create-task
getTasks(params)             // GET /tasks?...
getDeletedTasks(params)      // GET /tasks/deleted?...
updateTask(id, data)         // PUT /update-task/:id
reassignTask(id, data)       // PUT /reassign-task/:id
deleteTask(id)               // DELETE /delete-task/:id
exportCSV()                  // GET /tasks/export (blob)
getAnalytics()               // GET /tasks/analytics
getStaff(department?)        // GET /staff?department=...
addStaff(data)               // POST /staff
deleteStaff(id)              // DELETE /staff/:id
```

- Auth interceptor: attaches `Authorization: Bearer <token>`
- Response interceptor: auto-logout + redirect to `/login` on 401

---

## Component Details

### `TaskCard.js`
Props: `task`, `onUpdate`, `onDelete`, `showActions`, `staffList`, `showReassign`, `showDelete`

Internal modals (controlled by `modal` state):
- `'done'` — DoneByModal: dropdown of staff names to pick who completed
- `'history'` — HistoryModal: full audit log timeline
- `'reassign'` — ReassignModal: pick new department (admin only)
- `'confirmDelete'` — confirm before soft-deleting (reception only)

Features:
- **Optimistic UI** — status updates instantly, reverts on API failure
- **TaskAge** sub-component — live timer, turns red ⚠️ after 30 mins if still pending
- **doneBy tag** — shows `👤 Done by Raju · 2 Jan 10:30` on completed tasks
- Color-coded left border: yellow (pending), blue (in-progress), green (done), red (deleted)

### `Sidebar.js`
- Role-aware nav items from `NAV_ITEMS` object
- Logout: `disconnectSocket()` + `localStorage.clear()` + navigate to `/login`
- Mobile: `.open` class toggles slide-in, overlay backdrop closes it

### `Navbar.js`
- Props: `title`, `onMenuClick`, `children`
- Hamburger hidden on desktop via CSS

---

## Page Details

### `Login.js`
- Fields: username, password, role (select)
- Demo mode: on network error / 5xx → sets `demo-token`, skips backend

### `ReceptionDashboard.js`
- Create task form (roomNumber, department, description, priority)
- Search by room number (debounced 400ms)
- Date range filter (from/to)
- Status filter dropdown
- **Unread badge** on tab title: `(3) HotelTask` when window not focused
- **Pull-to-refresh**: swipe down 80px on mobile triggers re-fetch
- Socket: `newTask` (deduplicated), `taskUpdated`, `taskDeleted`
- TaskCard props: `showDelete` — shows 🗑️ button, `onDelete` removes from list

### `DepartmentDashboard.js`
- Fetches tasks filtered by `department === role`
- Fetches staff list for that department separately (independent try/catch)
- **Sound**: pre-decodes `notification.mp3` into AudioBuffer on mount for zero-latency playback
- AudioContext resumed on first user interaction (browser autoplay policy)
- Filter buttons: All / Pending / In Progress / Done
- Socket: `newTask` (plays sound + toast), `taskUpdated`, `taskDeleted` (removes card + toast)
- TaskCard props: `showActions`, `staffList`

### `AdminDashboard.js`
4 tabs: **📋 Tasks | 📊 Analytics | 👥 Staff | 🗑️ Deleted**

**Tasks tab:**
- Search + date range + dept filter + status filter (all debounced)
- TaskCard with `showReassign` prop

**Analytics tab:**
- Recharts `BarChart` — tasks per dept per day (last 7 days)
- Staff performance leaderboard with progress bars (🥇🥈🥉)
- Fetched only when tab is opened

**Staff tab:**
- Add staff form (name + department)
- List grouped by department with delete button

**Deleted tab:**
- Shows all soft-deleted tasks
- Each card shows: room, description, dept, `deletedBy`, `deletedAt` (full date+time), original status, created date
- Search by room + date range filter (filters by `deletedAt`)
- Real-time: `taskDeleted` socket removes from active list, deleted tab refreshes on open

**Navbar buttons:** 🌙/☀️ dark mode toggle | 📥 CSV export | 🔄 refresh

---

## CSS Design System (`src/styles/main.css`)

### CSS Variables
```css
--primary: #2563eb        /* Blue */
--primary-dark: #1d4ed8
--sidebar-bg: #1e293b     /* Dark slate */
--bg: #f1f5f9             /* Page background */
--card-bg: #ffffff
--text: #1e293b
--text-muted: #64748b
--border: #e2e8f0
--pending: #f59e0b        /* Yellow */
--pending-bg: #fef3c7
--inprogress: #3b82f6     /* Blue */
--inprogress-bg: #dbeafe
--done: #10b981           /* Green */
--done-bg: #d1fae5
--danger: #ef4444         /* Red */
```

### Dark Mode
- Toggled via `body.dark` class
- Persisted in `localStorage.darkMode`
- Overrides all CSS variables for dark theme
- Toggle button in Admin navbar (🌙/☀️)

### Key CSS Classes
- `.app-layout` — flex row: sidebar + main
- `.sidebar` — fixed 240px, transforms off-screen on mobile
- `.task-card.pending/in-progress/done/deleted-task` — left border colors
- `.status-badge.pending/in-progress/done/deleted-badge` — pill badges
- `.modal-overlay` + `.modal-card` — centered modal system
- `.history-list` + `.history-item` — audit log timeline
- `.tab-bar` + `.tab-btn.active` — tab navigation
- `.analytics-panel` + `.chart-card` — analytics layout
- `.perf-list` + `.perf-item` + `.perf-bar` — staff leaderboard
- `.staff-list` + `.staff-item` — staff management
- `.done-by-tag` — green tag showing who completed
- `.task-age` + `.task-age-old` — age indicator (red after 30 min)
- `.search-input` — search box
- `.deleted-task` + `.deleted-badge` — red-tinted deleted cards

### Responsive
- `≤768px`: sidebar hidden, hamburger shown, single-column layout
- `≤400px`: single-column stats

---

## Default Users (seeded via `node src/seed.js`)

| Role | Username | Password |
|---|---|---|
| reception | reception1 | pass123 |
| housekeeping | housekeeping1 | pass123 |
| kitchen | kitchen1 | pass123 |
| maintenance | maintenance1 | pass123 |
| admin | admin | admin123 |

---

## Run Commands

```bash
# Backend
cd "f:\karamveer\all projects\hotelwhatsapp\backend"
npm run dev          # nodemon auto-restart
npm start            # production
node src/seed.js     # seed default users

# Frontend
cd "f:\karamveer\all projects\hotelwhatsapp"
npm start            # dev server → http://localhost:3000
npm run build        # production build → /build
```

## Environment Files

**Backend** `backend/.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/hotelwhatsapp
JWT_SECRET=hotelwhatsapp_super_secret_key_2024
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

**Frontend** `.env` (create if missing):
```
REACT_APP_API_URL=http://localhost:5000
```

---

## Known Behaviors & Edge Cases

1. **Demo mode** — Login + ReceptionDashboard work without backend. Tasks stored in React state only (lost on refresh).
2. **Sound** — `notification.mp3` pre-decoded into AudioBuffer on DepartmentDashboard mount. AudioContext resumed on first user click/keydown. Zero-latency playback.
3. **Task ID** — Backend returns `_id` (MongoDB). All components handle both `task._id || task.id`.
4. **Socket singleton** — `socket.js` module-level variable. `connectSocket()` safe to call multiple times.
5. **Duplicate prevention** — Reception `newTask` socket handler checks `exists` before adding (prevents double-entry since we removed local state update on submit).
6. **Staff fetch independence** — DepartmentDashboard fetches tasks and staff in separate try/catch blocks so one failure doesn't block the other.
7. **Soft delete** — `isDeleted: true` tasks are excluded from all normal `GET /tasks` queries. Only `GET /tasks/deleted` (admin) returns them.
8. **Role mismatch** — `PrivateRoute` redirects to correct role route if user tries wrong URL.
9. **Auto-logout** — Axios response interceptor clears localStorage + redirects to `/login` on any 401 response.
10. **Dark mode persistence** — Stored in `localStorage.darkMode`, applied via `body.dark` class on AdminDashboard mount.

---

## Feature Checklist (All Completed ✅)

- [x] Role-based login (reception, housekeeping, kitchen, maintenance, admin)
- [x] Create task (reception)
- [x] Real-time task delivery via Socket.io
- [x] Sound notification (pre-decoded AudioBuffer, zero latency)
- [x] Start / Done task actions (department)
- [x] Done-by name picker (dropdown modal, no typing)
- [x] Staff management (admin adds/removes names per dept)
- [x] Task audit log / history (every status change recorded)
- [x] Task age indicator (⚠️ red after 30 min)
- [x] Optimistic UI (instant update, reverts on failure)
- [x] Search by room number (debounced)
- [x] Date range filter
- [x] Task reassign (admin moves to different dept)
- [x] Soft delete (reception deletes → dept sees it disappear → admin keeps log)
- [x] Deleted tasks tab (admin, with deletedBy + deletedAt)
- [x] Analytics bar chart (recharts, last 7 days per dept)
- [x] Staff performance leaderboard (this week)
- [x] CSV export (admin)
- [x] Dark mode toggle (admin, persisted)
- [x] Unread badge on browser tab
- [x] Pull-to-refresh (mobile swipe)
- [x] Duplicate task prevention (socket deduplication)
- [x] Auto-logout on 401
- [x] MongoDB indexes for performance
- [x] Role-based API access control

---

## Pending / Future Ideas

- [ ] Rate limiting on `/login` (express-rate-limit)
- [ ] Helmet.js security headers
- [ ] Push notifications (PWA / service worker)
- [ ] Task comments / notes
- [ ] Shift-based view (morning/evening/night)
- [ ] Password visibility toggle on login
- [ ] Restore deleted task (admin)
