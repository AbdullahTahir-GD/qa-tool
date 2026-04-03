# QAFlow — Setup Guide

## 1. Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

---

## 2. Supabase Setup

### Create Project
1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose a name, database password, and region
4. Wait for provisioning (~2 min)

### Run Database Schema
1. In your Supabase project, go to **SQL Editor**
2. Copy the entire contents of `docs/SCHEMA.sql`
3. Paste and click **Run**

### Get API Keys
1. Go to **Settings → API**
2. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Enable Realtime
Realtime is enabled in the schema via `ALTER PUBLICATION` statements.
Verify in **Database → Replication** that `test_results`, `test_runs`,
`test_items`, and `projects` tables are listed.

---

## 3. Local Development

```bash
# Clone and install
git clone <your-repo>
cd qaflow
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# Run development server
npm run dev
```

Open http://localhost:3000

---

## 4. First-time Setup

1. **Sign up** at `/login` — the first user created in your Supabase project
2. **Promote to admin** — in Supabase SQL Editor, run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'your@email.com';
   ```
3. **Create a project** at `/projects`
4. **Build a test plan** inside the project
5. **Start a test run** and invite your team

---

## 5. Inviting Team Members

Email invites require a server-side Supabase Admin call. Two options:

### Option A: Supabase Dashboard (simplest)
1. Go to **Authentication → Users**
2. Click **Invite User**
3. Enter their email — they'll get a magic link

### Option B: Edge Function (production)
Create a Supabase Edge Function that calls `supabase.auth.admin.inviteUserByEmail()`.
Use your `SUPABASE_SERVICE_ROLE_KEY` there (never in the browser).

---

## 6. Customizing Branding

| What to change | File to edit |
|---|---|
| App name & logo | `components/layout/sidebar.tsx` (line 1: `<span>QAFlow</span>`) |
| Brand colors | `app/globals.css` (CSS variables at top) |
| Accent color | Change `--accent: #6366f1` to any hex |
| Dark/Light theme | Change `--bg-base`, `--bg-surface`, `--bg-elevated` |
| Typography | `app/globals.css` — edit the Google Fonts import URL |
| Status colors | `lib/utils.ts` — `statusColor()` function |
| Priority colors | `lib/utils.ts` — `priorityColor()` function |
| Tailwind config | `tailwind.config.ts` — extend colors and shadows |

---

## 7. Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Or connect your GitHub repo in the Vercel dashboard for auto-deploys.

---

## 8. Role System

| Role | Create Projects | Edit Test Plans | Execute Runs | Manage Team |
|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Tester** | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ |

Roles are enforced both in the UI (buttons hidden) and at the database level via Supabase Row Level Security policies.

---

## 9. Realtime Collaboration

QAFlow uses Supabase Realtime for live updates. When one tester marks a result as Pass/Fail, all other users on the same run page see the update instantly — no refresh needed. The **Live** indicator in the top navigation confirms the WebSocket connection is active.

---

## 10. Database Tables Reference

| Table | Purpose |
|---|---|
| `profiles` | User accounts with roles |
| `projects` | QA projects |
| `project_members` | Who has access to which project + their role |
| `test_plans` | Named test plan within a project |
| `test_items` | Individual test cases (supports nesting via `parent_id`) |
| `test_runs` | A test execution against a build |
| `test_results` | Pass/Fail/Blocked/Not Run result per item per run |
| `attachments` | File attachments linked to results |
