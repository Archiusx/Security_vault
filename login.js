// ─────────────────────────────────────────────────────────────
// VAULT — Login Logic (login.js)
// ─────────────────────────────────────────────────────────────

let currentEmail = '';
let pinBuffer = '';
let setupBuffer = '';
let confirmBuffer = '';
let isFirstTime = false;

// ── If already logged in, redirect ───────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session) {
    redirect(session.role);
  }

  // Drag/drop on body does nothing
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());
});

function redirect(role) {
  if (role === 'admin') window.location.href = 'vault.html';
  else window.location.href = 'guest.html';
}

// ── Step 1: Email ─────────────────────────────────────────────
async function submitEmail() {
  const emailEl = document.getElementById('emailInput');
  const email = emailEl.value.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('emailError', 'Please enter a valid email address.');
    return;
  }

  showLoading();

  try {
    // Look up user in vault_users table
    const { data, error } = await _supabase
      .from('vault_users')
      .select('email, pin_hash, role, device_token')
      .eq('email', email)
      .single();

    hideLoading();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      showError('emailError', 'Database error. Please try again.');
      return;
    }

    currentEmail = email;

    if (!data) {
      // Email not in allowed list
      showError('emailError', 'This email is not authorized to access the vault.');
      return;
    }

    if (!data.pin_hash) {
      // First time — need to setup PIN
      // Only admin email can do first-time setup
      if (email !== ADMIN_EMAIL.toLowerCase()) {
        showError('emailError', 'Guest account not yet activated. Contact the vault admin.');
        return;
      }
      isFirstTime = true;
      showStep('step-email', 'step-setup');
      return;
    }

    

    // Show PIN entry
    document.getElementById('pinLabel').textContent = data.role === 'admin' ? 'ENTER ADMIN PIN' : 'ENTER YOUR PIN';
    document.getElementById('pinSub').textContent = `Welcome back, ${email}`;
    showStep('step-email', 'step-pin');

  } catch (err) {
    hideLoading();
    showError('emailError', 'Connection error. Check your internet.');
  }
}

// ── Step 2: PIN Entry ─────────────────────────────────────────
function pinKey(k) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += k;
  updateDots('pinDisplay', pinBuffer.length);
  if (pinBuffer.length === 4) submitPin();
}
function pinDel() { pinBuffer = pinBuffer.slice(0, -1); updateDots('pinDisplay', pinBuffer.length); }
function pinClear() { pinBuffer = ''; updateDots('pinDisplay', 0); }

async function submitPin() {
  showLoading();
  try {
    const hash = await hashPin(pinBuffer);
    const deviceToken = getDeviceToken();

    const { data, error } = await _supabase
      .from('vault_users')
      .select('pin_hash, role, device_token')
      .eq('email', currentEmail)
      .single();

    if (error || !data) {
      hideLoading();
      shakePin('pinDisplay');
      pinBuffer = '';
      showError('pinError', 'Could not verify PIN. Try again.');
      return;
    }

    if (data.pin_hash !== hash) {
      hideLoading();
      shakePin('pinDisplay');
      pinBuffer = '';
      showError('pinError', 'Incorrect PIN. Try again.');
      return;
    }

    // PIN correct — register device if first time on this device
    

    hideLoading();
    setSession(currentEmail, data.role);
    redirect(data.role);

  } catch (err) {
    hideLoading();
    shakePin('pinDisplay');
    pinBuffer = '';
    showError('pinError', 'Error. Please try again.');
  }
}

// ── Step 3: Setup PIN (first time admin only) ─────────────────
function setupKey(k) {
  if (setupBuffer.length >= 4) return;
  setupBuffer += k;
  updateDots('pinDisplaySetup', setupBuffer.length);
  if (setupBuffer.length === 4) {
    // Move to confirm
    setTimeout(() => showStep('step-setup', 'step-confirm'), 200);
  }
}
function setupDel() { setupBuffer = setupBuffer.slice(0, -1); updateDots('pinDisplaySetup', setupBuffer.length); }
function setupClear() { setupBuffer = ''; updateDots('pinDisplaySetup', 0); }

// ── Step 4: Confirm PIN ───────────────────────────────────────
function confirmKey(k) {
  if (confirmBuffer.length >= 4) return;
  confirmBuffer += k;
  updateDots('pinDisplayConfirm', confirmBuffer.length);
  if (confirmBuffer.length === 4) confirmSetupPin();
}
function confirmDel() { confirmBuffer = confirmBuffer.slice(0, -1); updateDots('pinDisplayConfirm', confirmBuffer.length); }
function confirmClear() { confirmBuffer = ''; updateDots('pinDisplayConfirm', 0); }

async function confirmSetupPin() {
  if (setupBuffer !== confirmBuffer) {
    shakePin('pinDisplayConfirm');
    confirmBuffer = '';
    updateDots('pinDisplayConfirm', 0);
    showError('confirmError', 'PINs do not match. Try again.');
    return;
  }

  showLoading();
  try {
    const hash = await hashPin(setupBuffer);
    const deviceToken = getDeviceToken();

    // Check if admin row exists
    const { data: existing } = await _supabase
      .from('vault_users')
      .select('email')
      .eq('email', currentEmail)
      .single();

    if (existing) {
      // Update existing row
      await _supabase
        .from('vault_users')
        .update({ pin_hash: hash, device_token: deviceToken, role: 'admin' })
        .eq('email', currentEmail);
    } else {
      // Insert new admin row
      await _supabase
        .from('vault_users')
        .insert({ email: currentEmail, pin_hash: hash, device_token: deviceToken, role: 'admin' });
    }

    hideLoading();
    setSession(currentEmail, 'admin');
    redirect('admin');
  } catch (err) {
    hideLoading();
    showError('confirmError', 'Error saving PIN. Please try again.');
  }
}

// ── PIN Reset ─────────────────────────────────────────────────
async function requestPinReset() {
  if (!currentEmail) {
    alert('Please enter your email first.');
    return;
  }
  showLoading();
  try {
    // Generate a reset token
    const token = generateUUID();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    await _supabase
      .from('pin_resets')
      .insert({ email: currentEmail, token, expires_at: expires });

    // Send reset email via Supabase Edge Function
    await _supabase.functions.invoke('send-reset-email', {
      body: { email: currentEmail, token, resetUrl: window.location.origin + '/reset.html' }
    });

    hideLoading();
    alert(`Reset link sent to ${currentEmail}. Check your inbox (and spam folder).`);
  } catch (err) {
    hideLoading();
    alert('Could not send reset email. Try again later.');
  }
}

// ── UI Helpers ────────────────────────────────────────────────
function showStep(hide, show) {
  document.getElementById(hide).classList.remove('active');
  document.getElementById(show).classList.add('active');
}

function goBack(showStep, hideStep) {
  document.getElementById(hideStep).classList.remove('active');
  document.getElementById(showStep).classList.add('active');
  pinBuffer = ''; setupBuffer = ''; confirmBuffer = '';
  updateDots('pinDisplay', 0);
  hideError('pinError');
}

function updateDots(containerId, count) {
  const dots = document.querySelectorAll(`#${containerId} .pin-dot`);
  dots.forEach((dot, i) => {
    if (i < count) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

function shakePin(containerId) {
  const dots = document.querySelectorAll(`#${containerId} .pin-dot`);
  dots.forEach(d => { d.classList.add('shake'); setTimeout(() => d.classList.remove('shake'), 500); });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// Enter key on email field
document.getElementById('emailInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitEmail();
});
