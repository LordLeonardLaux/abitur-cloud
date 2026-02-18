-- ============================================================================
-- ADMIN SETUP – Dich selbst zum Admin machen
-- ============================================================================
-- SCHRITT 1: Führe zuerst full_schema.sql aus (fügt email-Spalte hinzu)
-- SCHRITT 2: Dann dieses Skript hier ausführen
-- ============================================================================

-- Erst sicherstellen, dass email-Spalte befüllt wird (aus auth.users kopieren)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Dich selbst zum Admin machen (über auth.users lookup, da email dort IMMER existiert)
UPDATE public.profiles
SET role = 'admin', is_approved = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'leonard.laux.berlin@icloud.com'
);

-- Kontrollabfrage (zeigt deinen aktualisierten Eintrag):
SELECT p.id, u.email, p.full_name, p.role, p.is_approved, p.grade_level
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'leonard.laux.berlin@icloud.com';
