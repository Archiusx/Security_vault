// ─────────────────────────────────────────────────────────────
// VAULT — Supabase Config
// Replace these values with your own from supabase.com
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = 'YOUR_SUPABASE_URL';         // e.g. https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // from Project Settings > API

// Admin email — only this email gets full admin access
const ADMIN_EMAIL = 'YOUR_EMAIL@example.com';

// Storage bucket name (must match what you create in Supabase)
const BUCKET_NAME = 'vault';

// Total storage cap in bytes (1 GB)
const STORAGE_LIMIT = 1 * 1024 * 1024 * 1024;
