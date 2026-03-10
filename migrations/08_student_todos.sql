-- ============================================================================
-- SQL MIGRATION: 08_student_todos.sql
-- PURPOSE: Create table for personal student to-do lists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE public.student_todos ENABLE ROW LEVEL SECURITY;

-- Police: Studenten können nur IHRE EIGENEN To-Dos lesen
DO $$ BEGIN
  CREATE POLICY "Students can read own todos" ON public.student_todos
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Police: Studenten können nur IHRE EIGENEN To-Dos erstellen
DO $$ BEGIN
  CREATE POLICY "Students can insert own todos" ON public.student_todos
    FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Police: Studenten können nur IHRE EIGENEN To-Dos aktualisieren
DO $$ BEGIN
  CREATE POLICY "Students can update own todos" ON public.student_todos
    FOR UPDATE TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Police: Studenten können nur IHRE EIGENEN To-Dos löschen
DO $$ BEGIN
  CREATE POLICY "Students can delete own todos" ON public.student_todos
    FOR DELETE TO authenticated
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
