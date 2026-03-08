// ─────────────────────────────────────────────────────────────
// VAULT — Auth Core (auth.js)
// PIN hashing, device management, session helpers
// ─────────────────────────────────────────────────────────────

// Init Supabase client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PIN Hashing (SHA-256 via Web Crypto API) ──────────────────
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'vault_salt_2024'); // salted
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Device Token (one device per email) ──────────────────────
function getDeviceToken() {
  let token = localStorage.getItem('vault_device_id');
  if (!token) {
    token = generateUUID();
    localStorage.setItem('vault_device_id', token);
  }
  return token;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ── Session helpers ───────────────────────────────────────────
function setSession(email, role) {
  sessionStorage.setItem('vault_email', email);
  sessionStorage.setItem('vault_role', role);
  sessionStorage.setItem('vault_ts', Date.now());
}

function getSession() {
  const email = sessionStorage.getItem('vault_email');
  const role = sessionStorage.getItem('vault_role');
  const ts = sessionStorage.getItem('vault_ts');
  if (!email || !role || !ts) return null;
  // Session expires after 8 hours of inactivity
  if (Date.now() - parseInt(ts) > 8 * 60 * 60 * 1000) {
    clearSession();
    return null;
  }
  return { email, role };
}

function refreshSession() {
  if (sessionStorage.getItem('vault_email')) {
    sessionStorage.setItem('vault_ts', Date.now());
  }
}

function clearSession() {
  sessionStorage.removeItem('vault_email');
  sessionStorage.removeItem('vault_role');
  sessionStorage.removeItem('vault_ts');
}

// ── Guard: redirect if not logged in ─────────────────────────
function requireAuth(expectedRole) {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  if (expectedRole === 'admin' && session.role !== 'admin') {
    window.location.href = 'guest.html';
    return null;
  }
  return session;
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Format bytes ─────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Show / hide loading ───────────────────────────────────────
function showLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.remove('hidden');
}
function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.add('hidden');
}

// ── Refresh session on activity ───────────────────────────────
document.addEventListener('click', refreshSession);
document.addEventListener('keydown', refreshSession);
