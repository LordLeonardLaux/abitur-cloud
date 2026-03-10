-- ============================================
-- XP/Rang-System Migration
-- ============================================
-- Fügt XP und Rang-Sichtbarkeit zu Profilen hinzu
-- und erstellt eine Tabelle für "Nützlich"-Votes

-- 1. XP und Rang-Sichtbarkeit zum Profil hinzufügen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rank_visible BOOLEAN DEFAULT true;

-- 2. Tabelle für "Nützlich"-Votes (damit jeder nur 1x pro Material voten kann)
CREATE TABLE IF NOT EXISTS useful_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    material_id UUID NOT NULL,
    material_type TEXT NOT NULL DEFAULT 'class_material', -- 'class_material' oder 'topic_file'
    uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(voter_id, material_id) -- Jeder User kann pro Material nur 1x voten
);

-- 3. RLS Policies für useful_votes
ALTER TABLE useful_votes ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte User kann Votes sehen
CREATE POLICY "Votes sichtbar für alle" ON useful_votes
    FOR SELECT USING (true);

-- Jeder eingeloggte User kann eigene Votes erstellen
CREATE POLICY "User kann voten" ON useful_votes
    FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- User kann eigene Votes löschen
CREATE POLICY "User kann eigene Votes löschen" ON useful_votes
    FOR DELETE USING (auth.uid() = voter_id);

-- 4. Index für schnelle Vote-Abfragen
CREATE INDEX IF NOT EXISTS idx_useful_votes_material ON useful_votes(material_id);
CREATE INDEX IF NOT EXISTS idx_useful_votes_voter ON useful_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_useful_votes_uploader ON useful_votes(uploader_id);

-- 5. XP-Leaderboard Index
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp DESC);

-- 6. Avatars Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for avatars
CREATE POLICY "Avatars öffentlich lesbar" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "User kann eigenes Avatar hochladen" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own avatar
CREATE POLICY "User kann eigenes Avatar aktualisieren" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
