-- v0.9.15 Migration: AI Chat, Flashcards, Teacher Tasks
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- 1. AI Chat History - Persistent chat per PDF/Topic
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  teacher_material_id UUID REFERENCES public.teacher_materials(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Nur einer von topic_id oder teacher_material_id kann gesetzt sein
  CONSTRAINT unique_user_topic UNIQUE (user_id, topic_id),
  CONSTRAINT unique_user_material UNIQUE (user_id, teacher_material_id),
  CONSTRAINT check_one_source CHECK (
    (topic_id IS NOT NULL AND teacher_material_id IS NULL) OR
    (topic_id IS NULL AND teacher_material_id IS NOT NULL)
  )
);

ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat history" ON public.ai_chat_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_chat_history_updated_at
    BEFORE UPDATE ON public.ai_chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Flashcard Sets - Stored flashcards linked to source PDF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  source_topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  source_material_id UUID REFERENCES public.teacher_materials(id) ON DELETE SET NULL,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path TEXT, -- Path to generated PDF in storage
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flashcard sets" ON public.flashcard_sets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. Teacher Tasks - Tasks assigned by teachers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  subject_id TEXT NOT NULL,
  course_type TEXT, -- 'LK', 'GK', or NULL for both
  grade_level TEXT, -- '12', '13', or NULL for both
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_tasks ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own tasks
CREATE POLICY "Teachers can manage own tasks" ON public.teacher_tasks
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- All authenticated users can read tasks (filtering done in app)
CREATE POLICY "All users can read tasks" ON public.teacher_tasks
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- 4. Student Task Status - Track completion per student
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_task_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.teacher_tasks(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  seen_at TIMESTAMPTZ, -- NULL means "NEW" (ungesehen)
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, student_id)
);

ALTER TABLE public.student_task_status ENABLE ROW LEVEL SECURITY;

-- Students can manage their own task status
CREATE POLICY "Students can manage own task status" ON public.student_task_status
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can read status of their tasks
CREATE POLICY "Teachers can read status of own tasks" ON public.student_task_status
  FOR SELECT TO authenticated
  USING (
    task_id IN (
      SELECT id FROM public.teacher_tasks WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Create storage bucket for flashcard PDFs (optional)
-- ============================================================================
-- Run in Dashboard > Storage: Create bucket 'flashcard-pdfs' (private)

-- Done!
