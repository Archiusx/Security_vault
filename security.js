// ─────────────────────────────────────────────────────────────
// VAULT — Security Helpers (security.js)
// Loaded on guest page for lockdown
// ─────────────────────────────────────────────────────────────

// Block right click everywhere
document.addEventListener('contextmenu', e => e.preventDefault());

// Block drag of any element
document.addEventListener('dragstart', e => e.preventDefault());

// Block keyboard shortcuts
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  const blocked =
    (ctrl && ['s','p','c','u','a','j'].includes(e.key.toLowerCase())) ||
    e.key === 'PrintScreen' ||
    e.key === 'F12';

  if (blocked) {
    e.preventDefault();
    e.stopPropagation();
    showSecurityWarning();
    return false;
  }
});

// Block print
window.addEventListener('beforeprint', e => {
  e.preventDefault();
  showSecurityWarning();
  return false;
});

// Disable text selection via CSS injection
const style = document.createElement('style');
style.textContent = `
  * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    user-select: none !important;
  }
  img, video {
    pointer-events: none !important;
    -webkit-user-drag: none !important;
  }
`;
document.head.appendChild(style);

// Flash warning overlay
function showSecurityWarning() {
  // Don't stack warnings
  if (document.getElementById('sec-warning')) return;

  const div = document.createElement('div');
  div.id = 'sec-warning';
  div.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(255, 74, 107, 0.12);
    border: 2px solid #ff4a6b;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    animation: sec-flash 1.2s ease forwards;
  `;
  div.innerHTML = `
    <div style="
      font-family: 'Syne', sans-serif;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 5px;
      color: #ff4a6b;
      text-align: center;
      padding: 20px 40px;
      border: 1px solid rgba(255,74,107,0.3);
      border-radius: 10px;
      background: rgba(10,10,12,0.9);
    ">⛔ ACTION NOT PERMITTED</div>
  `;

  const keyframes = document.createElement('style');
  keyframes.textContent = `
    @keyframes sec-flash {
      0%   { opacity: 0; }
      15%  { opacity: 1; }
      70%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(keyframes);
  document.body.appendChild(div);
  setTimeout(() => { div.remove(); keyframes.remove(); }, 1300);
}
