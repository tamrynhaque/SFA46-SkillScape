# SFA46-SkillScape
Tamryn Haque, Michaela Browning, Rayyan Taib, Faheem Hussain. Week 2 core training assessment - Hackathon

## Running it
The app is plain HTML/CSS/JS backed by Supabase. Serve the folder over HTTP (the course API uses `fetch()`, which browsers block on `file://`):

- **VS Code:** install the *Live Server* extension, right-click `login.html` -> *Open with Live Server*
- **Java 18+:** `jwebserver -p 8000` then open http://localhost:8000/login.html

Seeded accounts use password `1234` (e.g. `callum.stewart@scalefactory.com`; admin: `michaela.browning@scalefactory.com`).

## Features
| Requirement | Where |
|---|---|
| Role selection | `roles.html` -> `role-detail.html?id=<role>` ("Make this my role") |
| Skills matrix (Level 1-3) | `role-detail.html` - skills grouped by Foundational / Intermediate / Expert |
| Progress tracking (persists) | Checkboxes save to Supabase `user_skills` + a localStorage mirror |
| SMART Targeter | "Generate SMART goal" on any gap -> modal -> saved to `smart_targets` |
| Learning Bridge | `data/courses.json` mock course API fetched by `js/api.js` |
| Admin: users / heatmap / targets | `admin.html`, `users.html` |

## Code map
- `js/db.js` - Supabase client
- `js/common.js` - session, page guards, data access (`Store`), helpers
- `js/api.js` - mocked third-party course API (Learning Bridge)
- `js/smart.js` - SMART goal generator + modal
- `js/auth.js`, `js/app.js` (dashboard), `js/roles.js`, `js/role-detail.js`, `js/admin.js`, `js/users.js`, `js/settings.js` - one per page

## Database (Supabase)
`users` -> `roles` (users.role_id) · `roles` <-> `skills` via `role_skills` · `user_skills` (user_id, skill_id, status) · `smart_targets` (user_id, skill_id, target_text)
