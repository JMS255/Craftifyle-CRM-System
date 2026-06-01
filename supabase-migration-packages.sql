-- Packages table — run in Supabase SQL Editor
-- Allows per-user configurable packages and add-ons for Crafty AI

CREATE TABLE IF NOT EXISTS packages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  description text,
  is_addon boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_user ON packages(user_id);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_packages" ON packages FOR ALL USING (auth.uid() = user_id);
