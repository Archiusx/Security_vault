-- ═══════════════════════════════════════════════════════════════
-- VAULT — Supabase SQL Setup
-- Run this ENTIRE script in Supabase > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Vault Users Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  pin_hash     TEXT,                        -- SHA-256 hashed PIN (null until first login)
  role         TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('admin', 'guest')),
  device_token TEXT,                        -- locks account to one device
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Files Metadata Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  storage_path      TEXT NOT NULL UNIQUE,
  size              BIGINT DEFAULT 0,
  type              TEXT DEFAULT '',
  uploaded_by_email TEXT REFERENCES vault_users(email) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 3. PIN Reset Tokens Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pin_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Enable Row Level Security ──────────────────────────────
ALTER TABLE vault_users  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_files  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_resets   ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies ───────────────────────────────────────────
-- vault_users: each user can only read/update their own row
-- We use anon key with direct table access via JS — no auth.uid()
-- Instead we rely on application-layer session + PIN verification.
-- For simplicity, allow all reads/writes from anon (protected by PIN in app).
-- For production hardening, use Supabase Auth + JWT policies.

CREATE POLICY "anon_read_users" ON vault_users
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_users" ON vault_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_users" ON vault_users
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_users" ON vault_users
  FOR DELETE USING (true);

-- vault_files: all vault users can read; app controls who writes
CREATE POLICY "anon_read_files" ON vault_files
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_files" ON vault_files
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_delete_files" ON vault_files
  FOR DELETE USING (true);

-- pin_resets: fully open (short-lived tokens, verified in app)
CREATE POLICY "anon_all_resets" ON pin_resets
  FOR ALL USING (true);

-- ── 6. Storage Bucket ─────────────────────────────────────────
-- Run this in Supabase > Storage > New Bucket:
-- Name: vault
-- Public: OFF (private)
-- File size limit: 104857600 (100 MB per file)
-- Allowed MIME types: leave blank to allow all

-- Then add these Storage policies in Storage > vault > Policies:

-- Allow anon to upload:
-- CREATE POLICY "allow_upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'vault');

-- Allow anon to read/download:
-- CREATE POLICY "allow_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'vault');

-- Allow anon to delete:
-- CREATE POLICY "allow_delete" ON storage.objects
--   FOR DELETE USING (bucket_id = 'vault');

-- ── 7. Insert Your Admin Email ────────────────────────────────
-- Replace with your actual email before running
INSERT INTO vault_users (email, role)
VALUES ('YOUR_EMAIL@example.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ── 8. Indexes for performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vault_users_email ON vault_users(email);
CREATE INDEX IF NOT EXISTS idx_vault_files_created ON vault_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_resets_token ON pin_resets(token);

-- ═══════════════════════════════════════════════════════════════
-- DONE! Now go to Supabase > Storage and create a bucket named "vault"
-- with Public access OFF, then add the 3 storage policies above.
-- ═══════════════════════════════════════════════════════════════
