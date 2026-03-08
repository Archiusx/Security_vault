// ─────────────────────────────────────────────────────────────
// VAULT — PIN Reset Logic (reset.js)
// ─────────────────────────────────────────────────────────────

let resetEmail = '';
let resetToken = '';
let newPin = '';
let confirmNewPin = '';

window.addEventListener('DOMContentLoaded', async () => {
  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  resetToken = params.get('token');

  if (!resetToken) {
    showStep('step-newpin', 'step-invalid');
    return;
  }

  showLoading();
  try {
    // Validate token
    const { data, error } = await _supabase
      .from('pin_resets')
      .select('email, expires_at, used')
      .eq('token', resetToken)
      .single();

    hideLoading();

    if (error || !data) {
      showStep('step-newpin', 'step-invalid');
      return;
    }

    if (data.used || new Date(data.expires_at) < new Date()) {
      showStep('step-newpin', 'step-invalid');
      return;
    }

    resetEmail = data.email;
    // Show new PIN entry (default active step)

  } catch (err) {
    hideLoading();
    showStep('step-newpin', 'step-invalid');
  }
});

// ── New PIN ───────────────────────────────────────────────────
function newPinKey(k) {
  if (newPin.length >= 4) return;
  newPin += k;
  updateDots('pinDisplayNew', newPin.length);
  if (newPin.length === 4) setTimeout(() => showStep('step-newpin', 'step-confirmnew'), 200);
}
function newPinDel() { newPin = newPin.slice(0, -1); updateDots('pinDisplayNew', newPin.length); }
function newPinClear() { newPin = ''; updateDots('pinDisplayNew', 0); }

// ── Confirm New PIN ───────────────────────────────────────────
function confirmNewKey(k) {
  if (confirmNewPin.length >= 4) return;
  confirmNewPin += k;
  updateDots('pinDisplayConfirmNew', confirmNewPin.length);
  if (confirmNewPin.length === 4) applyNewPin();
}
function confirmNewDel() { confirmNewPin = confirmNewPin.slice(0, -1); updateDots('pinDisplayConfirmNew', confirmNewPin.length); }
function confirmNewClear() { confirmNewPin = ''; updateDots('pinDisplayConfirmNew', 0); }

async function applyNewPin() {
  if (newPin !== confirmNewPin) {
    shakePin('pinDisplayConfirmNew');
    confirmNewPin = '';
    updateDots('pinDisplayConfirmNew', 0);
    showError('confirmNewError', 'PINs do not match. Try again.');
    return;
  }

  showLoading();
  try {
    const hash = await hashPin(newPin);
    const newDeviceToken = getDeviceToken(); // re-register this device

    // Update PIN and reset device token
    const { error: updateError } = await _supabase
      .from('vault_users')
      .update({ pin_hash: hash, device_token: newDeviceToken })
      .eq('email', resetEmail);

    if (updateError) throw updateError;

    // Mark reset token as used
    await _supabase
      .from('pin_resets')
      .update({ used: true })
      .eq('token', resetToken);

    hideLoading();
    showStep('step-confirmnew', 'step-success');

    // Clean URL
    window.history.replaceState({}, '', '/reset.html');

  } catch (err) {
    hideLoading();
    showError('confirmNewError', 'Error updating PIN. Please try again.');
  }
}

// ── Helpers ───────────────────────────────────────────────────
function showStep(hide, show) {
  document.getElementById(hide).classList.remove('active');
  document.getElementById(show).classList.add('active');
}

function updateDots(containerId, count) {
  const dots = document.querySelectorAll(`#${containerId} .pin-dot`);
  dots.forEach((d, i) => {
    if (i < count) d.classList.add('filled');
    else d.classList.remove('filled');
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
