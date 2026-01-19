-- =============================================
-- HURLEY'S TASKS - SUPABASE DATABASE SETUP
-- =============================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- Create projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  expanded BOOLEAN DEFAULT true,
  archived BOOLEAN DEFAULT false,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'priority', 'review', 'done')),
  notes TEXT DEFAULT '',
  reviewer TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (open access for team)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Allow all operations (team-wide access)
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime sync
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- =============================================
-- OPTIONAL: Starter data (delete if you want to start fresh)
-- =============================================

INSERT INTO projects (name, expanded, archived, added_by) VALUES
  ('Black Spectacles Lead Scoring', true, false, 'Hurley'),
  ('Medical Survey Analysis', false, false, 'Hurley');

DO $$
DECLARE
  proj1_id UUID;
  proj2_id UUID;
BEGIN
  SELECT id INTO proj1_id FROM projects WHERE name = 'Black Spectacles Lead Scoring';
  SELECT id INTO proj2_id FROM projects WHERE name = 'Medical Survey Analysis';

  INSERT INTO tasks (project_id, text, status, notes, reviewer, added_by) VALUES
    (proj1_id, 'Finalize scoring rubric weights', 'done', 'Approved by Thor - using 40/30/30 split', NULL, 'Hurley'),
    (proj1_id, 'Build LinkedIn scraper function', 'active', 'Testing with 10 firms first', NULL, 'Hurley'),
    (proj1_id, 'HubSpot pipeline integration', 'priority', 'Need API keys from client', NULL, 'Hurley'),
    (proj1_id, 'Documentation for handoff', 'review', '', 'Verma', 'Hurley'),
    (proj2_id, 'Clean preference ranking data', 'done', '', NULL, 'Hurley'),
    (proj2_id, 'Compare auto-injector vs pre-filled results', 'active', '', NULL, 'Hurley');
END $$;

-- =============================================
-- ✅ Done! Your database is ready.
-- =============================================
