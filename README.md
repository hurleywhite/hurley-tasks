# ✨ Hurley's Tasks

A real-time collaborative task manager for the ArcticBlue AI team.

## Features

- 🔄 **Real-time sync** — Changes appear instantly for everyone
- 👥 **Team collaboration** — See who added what
- 📦 **Project archiving** — Keep old projects for reference
- 📝 **Task notes** — Add context to any task
- 🎨 **Status colors** — Green (done), Red (priority), Grey (awaiting review)
- ✏️ **Rename projects** — Double-click or use the pencil icon

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**
3. Name it `hurleys-tasks`
4. Set a database password and save it
5. Wait ~2 minutes for setup

### 2. Set Up the Database

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste the contents of `database-setup.sql`
4. Click **Run**

### 3. Get Your Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon public key** (`eyJ...`)

### 4. Configure the App

Edit `config.js` and replace:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 5. Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings** → **Pages**
3. Set source to **main branch**
4. Your app will be live at `https://yourusername.github.io/repo-name`

## Usage

- **Add project**: Type name and click "+ Project"
- **Add task**: Click "+ Add task" under any project
- **Change status**: Click the status button (cycles through To Do → Priority → Review → Done)
- **Rename project**: Double-click the name or click ✏️
- **Archive project**: Click 📦
- **View notes**: Click any task to open the notes panel
- **Switch user**: Click "Switch User" in the header

## Team Members

- Hurley (owner)
- Verma (reviewer)
- Thor (reviewer)  
- Jerome (reviewer)

---

Built for ArcticBlue AI 🧊
