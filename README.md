# 🔐 VAULT — Secure Personal File Storage

A private, PIN-protected file vault with admin + guest access, one-device-per-account locking, and strict view-only guest restrictions. Built with plain HTML/JS + Supabase + Netlify.

---

## COMPLETE SETUP GUIDE

### ──────────────────────────────────────────
### STEP 1 — Configure Your Credentials
### ──────────────────────────────────────────

Open `js/config.js` and fill in:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const ADMIN_EMAIL = 'your@email.com';
```

> You'll get these values in Steps 2-3 below.

---

### ──────────────────────────────────────────
### STEP 2 — Create Your Supabase Project
### ──────────────────────────────────────────

1. Go to **https://supabase.com** → Sign up / Log in
2. Click **New Project**
3. Fill in:
   - **Name**: vault (or anything)
   - **Database Password**: save this somewhere safe
   - **Region**: pick closest to you
4. Wait ~1 minute for project to initialize
5. Go to **Project Settings → API**
6. Copy:
   - **Project URL** → paste into `SUPABASE_URL` in config.js
   - **anon / public key** → paste into `SUPABASE_ANON_KEY` in config.js

---

### ──────────────────────────────────────────
### STEP 3 — Run the SQL Setup
### ──────────────────────────────────────────

1. In Supabase, go to **SQL Editor** → **New Query**
2. Open `supabase-setup.sql` from this project
3. **Replace** `YOUR_EMAIL@example.com` with your actual email
4. Click **Run** (green button)
5. You should see "Success. No rows returned."

---

### ──────────────────────────────────────────
### STEP 4 — Create Storage Bucket
### ──────────────────────────────────────────

1. In Supabase, go to **Storage** → **New Bucket**
2. Set:
   - **Name**: `vault` ← must be exactly this
   - **Public bucket**: OFF (toggle off)
   - **File size limit**: 104857600 (100 MB)
3. Click **Save**
4. Click on the `vault` bucket → **Policies** tab
5. Add these 3 policies (click **New Policy** → **For full customization**):

**Policy 1 — Allow uploads:**
- Policy name: `allow_upload`
- Allowed operation: INSERT
- Target roles: anon, authenticated
- USING expression: `true`
- WITH CHECK expression: `bucket_id = 'vault'`

**Policy 2 — Allow reads:**
- Policy name: `allow_read`
- Allowed operation: SELECT
- USING expression: `bucket_id = 'vault'`

**Policy 3 — Allow deletes:**
- Policy name: `allow_delete`
- Allowed operation: DELETE
- USING expression: `bucket_id = 'vault'`

---

### ──────────────────────────────────────────
### STEP 5 — Setup Email for PIN Reset
### ──────────────────────────────────────────

The PIN reset sends an email via a Supabase Edge Function.

**Option A — Simple (Supabase built-in SMTP):**
1. Go to **Authentication → Email Templates**
2. For now, you can manually send reset links from the dashboard

**Option B — Edge Function (recommended):**
1. Install Supabase CLI: `npm install -g supabase`
2. Create edge function:
```bash
supabase functions new send-reset-email
```
3. Paste this into `supabase/functions/send-reset-email/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { email, token, resetUrl } = await req.json()
  const link = `${resetUrl}?token=${token}`
  
  // Use your preferred email provider (Resend, SendGrid, etc.)
  // Example with Resend:
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'vault@yourdomain.com',
      to: email,
      subject: 'VAULT — Reset Your PIN',
      html: `<p>Click the link below to reset your vault PIN. It expires in 30 minutes.</p><p><a href="${link}">${link}</a></p>`
    })
  })
  
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
```
4. Deploy: `supabase functions deploy send-reset-email`

---

### ──────────────────────────────────────────
### STEP 6 — Push to GitHub
### ──────────────────────────────────────────

```bash
# In your project folder:
git init
git add .
git commit -m "Initial vault setup"

# Create a PRIVATE repo on github.com, then:
git remote add origin https://github.com/YOURUSERNAME/secure-vault.git
git branch -M main
git push -u origin main
```

> ⚠️ **IMPORTANT**: Make the GitHub repo **PRIVATE**. Your config.js has your Supabase keys.

---

### ──────────────────────────────────────────
### STEP 7 — Deploy on Netlify
### ──────────────────────────────────────────

1. Go to **https://netlify.com** → Sign up / Log in
2. Click **Add new site → Import an existing project**
3. Connect to **GitHub** → select your `secure-vault` repo
4. Build settings:
   - **Build command**: *(leave empty)*
   - **Publish directory**: `.` (just a dot)
5. Click **Deploy site**
6. Wait ~30 seconds for deployment
7. Your vault is live at something like `https://random-name.netlify.app`

**Optional — Custom domain:**
- In Netlify: Site settings → Domain management → Add custom domain

---

### ──────────────────────────────────────────
### STEP 8 — First Login
### ──────────────────────────────────────────

1. Visit your Netlify URL
2. Enter **your admin email** (the one in config.js)
3. You'll be prompted to **set your 4-digit PIN**
4. Enter PIN → confirm PIN
5. You're in! 🎉

**To add guest users:**
1. Login as admin
2. Go to **Users** tab → **Add User**
3. Enter guest email
4. They can now visit the vault URL, enter their email + set their own PIN
5. They'll only see files in view-only mode

---

## SECURITY NOTES

| Feature | Status |
|---------|--------|
| PIN hashed with SHA-256 + salt | ✅ |
| One device per email | ✅ |
| Guest: no right-click | ✅ |
| Guest: no keyboard shortcuts (Ctrl+S, Ctrl+P) | ✅ |
| Guest: no drag & drop | ✅ |
| Guest: no downloads | ✅ |
| Guest: email watermark | ✅ |
| Signed URLs (expire in 60s-1hr) | ✅ |
| Private Supabase storage bucket | ✅ |
| Netlify security headers | ✅ |
| No search engine indexing | ✅ |

> **Note on screenshots**: No web app can fully prevent screenshots at the OS level. The guest restrictions make it as difficult as possible (no right-click, no save shortcuts, watermark overlay) but a physical phone camera can always capture a screen. Consider this when deciding what to share with guests.

---

## FILE STRUCTURE

```
secure-vault/
├── index.html          ← Login / PIN entry
├── vault.html          ← Admin dashboard
├── guest.html          ← Guest view-only
├── reset.html          ← PIN reset page
├── css/
│   ├── main.css        ← Auth + shared styles
│   └── vault.css       ← Dashboard styles
├── js/
│   ├── config.js       ← YOUR KEYS GO HERE
│   ├── auth.js         ← PIN hashing, sessions, device tokens
│   ├── login.js        ← Login flow logic
│   ├── reset.js        ← PIN reset flow
│   ├── vault-admin.js  ← Admin dashboard
│   ├── vault-guest.js  ← Guest view + security
│   └── security.js     ← Security helpers
├── supabase-setup.sql  ← Run this in Supabase SQL Editor
├── netlify.toml        ← Netlify config + security headers
├── .gitignore
└── README.md
```
