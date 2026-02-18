-- ============================================================================
-- ABITUR CLOUD – VOLLSTÄNDIGES DATENBANK-SCHEMA (v0.9.22)
-- Führe dieses Skript EINMAL im Supabase SQL Editor aus.
-- Sicher zum mehrfachen Ausführen (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================
-- TABELLEN: profiles, user_subjects, topics, topic_files, exams,
--           class_materials, messages, teacher_materials, teacher_tasks,
--           student_task_status, ai_chat_history, flashcard_sets
-- BUCKETS:  notes, exams, materials, topic-files, avatars, pdfs,
--           teacher-materials, flashcard-pdfs
-- ============================================================================


-- ============================================================================
-- 1. PROFILES (Benutzerprofile – Kerntabelle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  grade_level TEXT DEFAULT '13',
  role TEXT DEFAULT 'student',  -- 'student', 'teacher', 'admin', 'smartboard'
  subjects TEXT[],
  school TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- WICHTIG: Falls die Tabelle schon existiert, fehlende Spalten nachträglich hinzufügen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grade_level TEXT DEFAULT '13';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: Profil automatisch bei Registrierung erstellen
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = excluded.email,
      updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 2. USER SUBJECTS (Fächerwahl pro Schüler/Lehrer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  subject_type TEXT NOT NULL, -- 'LK', 'GK', 'PK'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subject_id)
);

ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own subjects" ON public.user_subjects
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "All users can read subjects" ON public.user_subjects
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 3. TOPICS (Schüler-Themen/Ordner)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  semester TEXT NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4'
  title TEXT NOT NULL DEFAULT 'Neues Thema',
  index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own topics" ON public.topics
    FOR ALL TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "All users can read topics" ON public.topics
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 4. TOPIC FILES (Dateien in einem Thema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.topic_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topic_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own topic files" ON public.topic_files
    FOR ALL TO authenticated
    USING (
      topic_id IN (SELECT id FROM public.topics WHERE owner_id = auth.uid())
    )
    WITH CHECK (
      topic_id IN (SELECT id FROM public.topics WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "All users can read topic files" ON public.topic_files
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 5. EXAMS (Klausuren-Archiv)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "All users can read exams" ON public.exams
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload exams" ON public.exams
    FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 6. CLASS MATERIALS (Smartboard-Mitschriften / Kalender-Material)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.class_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  subject_id TEXT NOT NULL,
  material_date DATE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  lesson_hour INTEGER,
  grade_level TEXT DEFAULT '13',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Falls class_materials schon existiert, fehlende Spalten nachfügen
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS lesson_hour INTEGER;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS grade_level TEXT DEFAULT '13';

ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "All users can read class materials" ON public.class_materials
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert class materials" ON public.class_materials
    FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Uploaders can update own class materials" ON public.class_materials
    FOR UPDATE TO authenticated
    USING (uploader_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Uploaders can delete own class materials" ON public.class_materials
    FOR DELETE TO authenticated
    USING (uploader_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 7. MESSAGES (Chat / Messenger mit Material-Anfragen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'material_request'
  metadata JSONB, -- Für Material-Anfragen: { subject, topic }
  material_subject TEXT,
  material_semester TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Falls messages schon existiert, fehlende Spalten nachfügen
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS material_subject TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS material_semester TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own messages" ON public.messages
    FOR SELECT TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime für Live-Chat aktivieren
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 8. TEACHER MATERIALS (Lehrmaterialien)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  semester TEXT,           -- 'Q1', 'Q2', 'Q3', 'Q4'
  grade_level TEXT NOT NULL, -- '12' oder '13'
  material_date DATE,      -- Optional: für Kalender
  lesson_hour INTEGER,     -- Optional: für Kalender
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_materials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Teachers can insert own materials" ON public.teacher_materials
    FOR INSERT TO authenticated
    WITH CHECK (teacher_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Teachers can update own materials" ON public.teacher_materials
    FOR UPDATE TO authenticated
    USING (teacher_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Teachers can delete own materials" ON public.teacher_materials
    FOR DELETE TO authenticated
    USING (teacher_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "All users can read teacher materials" ON public.teacher_materials
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 9. TEACHER TASKS (Aufgaben von Lehrern)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  subject_id TEXT NOT NULL,
  course_type TEXT,    -- 'LK', 'GK', oder NULL für alle
  grade_level TEXT,    -- '12', '13', oder NULL für alle
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Teachers can manage own tasks" ON public.teacher_tasks
    FOR ALL TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "All users can read tasks" ON public.teacher_tasks
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 10. STUDENT TASK STATUS (Aufgaben-Fortschritt pro Schüler)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_task_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.teacher_tasks(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  seen_at TIMESTAMPTZ,      -- NULL = "NEU" (ungesehen)
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, student_id)
);

ALTER TABLE public.student_task_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Students can manage own task status" ON public.student_task_status
    FOR ALL TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Teachers can read status of own tasks" ON public.student_task_status
    FOR SELECT TO authenticated
    USING (
      task_id IN (
        SELECT id FROM public.teacher_tasks WHERE teacher_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 11. AI CHAT HISTORY (KI-Chat Verlauf pro PDF/Thema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  teacher_material_id UUID REFERENCES public.teacher_materials(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_topic UNIQUE (user_id, topic_id),
  CONSTRAINT unique_user_material UNIQUE (user_id, teacher_material_id),
  CONSTRAINT check_one_source CHECK (
    (topic_id IS NOT NULL AND teacher_material_id IS NULL) OR
    (topic_id IS NULL AND teacher_material_id IS NOT NULL)
  )
);

ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own chat history" ON public.ai_chat_history
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-Update updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ai_chat_history_updated_at ON public.ai_chat_history;
CREATE TRIGGER update_ai_chat_history_updated_at
    BEFORE UPDATE ON public.ai_chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 12. FLASHCARD SETS (Karteikarten)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  source_topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  source_material_id UUID REFERENCES public.teacher_materials(id) ON DELETE SET NULL,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own flashcard sets" ON public.flashcard_sets
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 13. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('notes', 'notes', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('exams', 'exams', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('topic-files', 'topic-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-materials', 'teacher-materials', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('flashcard-pdfs', 'flashcard-pdfs', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Uploads und Lesen erlauben
DO $$ BEGIN
  CREATE POLICY "Authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public reads" ON storage.objects
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owner deletes" ON storage.objects
    FOR DELETE TO authenticated
    USING (auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owner updates" ON storage.objects
    FOR UPDATE TO authenticated
    USING (auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- FERTIG! ✅
-- ============================================================================
-- 12 Tabellen: profiles, user_subjects, topics, topic_files, exams,
--              class_materials, messages, teacher_materials, teacher_tasks,
--              student_task_status, ai_chat_history, flashcard_sets
-- 8 Buckets:   notes, exams, materials, topic-files, avatars, pdfs,
--              teacher-materials, flashcard-pdfs
-- ============================================================================
