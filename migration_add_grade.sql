-- Add grade_level column to class_materials
ALTER TABLE public.class_materials 
ADD COLUMN IF NOT EXISTS grade_level text DEFAULT '13';

-- Update existing records to default to 13 (optional, but good for consistency)
UPDATE public.class_materials 
SET grade_level = '13' 
WHERE grade_level IS NULL;
