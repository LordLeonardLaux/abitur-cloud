
-- Add is_approved column to profiles table
ALTER TABLE profiles ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;

-- Update existing admins to be approved automatically
UPDATE profiles SET is_approved = TRUE WHERE role = 'admin' OR role = 'teacher';

-- Optional: If you want all current users to be approved
-- UPDATE profiles SET is_approved = TRUE;
