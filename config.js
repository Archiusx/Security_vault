// ─────────────────────────────────────────────────────────────
// VAULT — Supabase Config
// Replace these values with your own from supabase.com
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://rtftxxfkerkuihfllbqw.supabase.co';         // e.g. https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZnR4eGZrZXJrdWloZmxsYnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTA0NDQsImV4cCI6MjA4ODU2NjQ0NH0.SfiMYWHWSNteeu5tDJjCQP9cN9c6KR6kTZmje6mKwlc'; // from Project Settings > API

// Admin email — only this email gets full admin access
const ADMIN_EMAIL = 'YOUR_EMAIL@example.com';

// Storage bucket name (must match what you create in Supabase)
const BUCKET_NAME = 'vault';

// Total storage cap in bytes (1 GB)
const STORAGE_LIMIT = 1 * 1024 * 1024 * 1024;
