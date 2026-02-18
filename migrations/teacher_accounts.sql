-- Teacher Accounts Migration
-- Run this in your Supabase SQL Editor

-- 1. Add 'teacher' to the role column (if using enum, alter it; otherwise just update types)
-- Note: Supabase profiles role is likely just TEXT, so no ALTER needed.
-- Just update the app-side types.

-- 2. Create teacher_materials table
CREATE TABLE IF NOT EXISTS public.teacher_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  semester TEXT, -- Optional: 'Q1', 'Q2', 'Q3', 'Q4'
  grade_level TEXT NOT NULL, -- '12' or '13'
  material_date DATE, -- Optional: for calendar integration
  lesson_hour INTEGER, -- Optional: for calendar integration
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.teacher_materials ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Teachers can insert their own materials
CREATE POLICY "Teachers can insert own materials" ON public.teacher_materials
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own materials
CREATE POLICY "Teachers can update own materials" ON public.teacher_materials
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid());

-- Teachers can delete their own materials
CREATE POLICY "Teachers can delete own materials" ON public.teacher_materials
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- All authenticated users can read teacher materials
CREATE POLICY "All users can read teacher materials" ON public.teacher_materials
  FOR SELECT TO authenticated
  USING (true);

-- 5. Create storage bucket (run in SQL or via Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-materials', 'teacher-materials', false);

-- Done! Now create the bucket 'teacher-materials' in Supabase Dashboard > Storage.
