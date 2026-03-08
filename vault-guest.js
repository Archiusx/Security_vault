// ─────────────────────────────────────────────────────────────
// VAULT — Guest View (vault-guest.js)
// View only. No downloads, no interaction.
// ─────────────────────────────────────────────────────────────

let allFiles = [];
let currentFilter = 'all';
let currentSearch = '';
let previewFile = null;
let session = null;

window.addEventListener('DOMContentLoaded', async () => {
  session = requireAuth('guest');
  if (!session) return;

  // Set watermark with guest email
  document.getElementById('sidebarEmail').textContent = session.email;
  const wm = document.getElementById('watermark');
  if (wm) wm.setAttribute('data-email', session.email);

  await loadFiles();
  applyGuestSecurity();
});

// ── Load files ────────────────────────────────────────────────
async function loadFiles() {
  const { data, error } = await _supabase
    .from('vault_files')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  allFiles = data || [];
  document.getElementById('fileCount').textContent = `${allFiles.length} file${allFiles.length !== 1 ? 's' : ''}`;
  renderFiles();
}

function renderFiles() {
  const grid = document.getElementById('filesGrid');
  const empty = document.getElementById('filesEmpty');

  let filtered = allFiles.filter(f => {
    const matchFilter = currentFilter === 'all' || getFileCategory(f.type) === currentFilter;
    const matchSearch = !currentSearch || f.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  Array.from(grid.querySelectorAll('.file-card')).forEach(c => c.remove());

  if (filtered.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(file => {
    const card = buildGuestCard(file);
    grid.appendChild(card);
  });
}

function buildGuestCard(file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.onclick = () => openPreview(file);

  const category = getFileCategory(file.type);
  const thumb = document.createElement('div');
  thumb.className = 'file-thumb';

  const tag = document.createElement('div');
  tag.className = 'file-type-tag';
  tag.textContent = file.type ? file.type.split('/')[1]?.toUpperCase() || 'FILE' : 'FILE';
  thumb.appendChild(tag);

  if (category === 'image') {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = file.name;
    img.setAttribute('draggable', 'false');
    img.oncontextmenu = () => false;
    getSignedUrl(file.storage_path).then(url => { if (url) img.src = url; });
    thumb.appendChild(img);
  } else {
    const icon = document.createElement('div');
    icon.className = 'file-icon';
    icon.textContent = getFileIcon(category);
    thumb.appendChild(icon);
  }

  const info = document.createElement('div');
  info.className = 'file-info';
  info.innerHTML = `
    <div class="file-name" title="${file.name}">${file.name}</div>
    <div class="file-size">${formatBytes(file.size || 0)}</div>
  `;

  card.appendChild(thumb);
  card.appendChild(info);
  return card;
}

// ── Preview (view only) ───────────────────────────────────────
async function openPreview(file) {
  previewFile = file;
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewModal').classList.remove('hidden');

  const content = document.getElementById('previewContent');
  content.innerHTML = '<div class="spinner" style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></div>';

  const url = await getSignedUrl(file.storage_path, 300); // short TTL for guests
  if (!url) { content.innerHTML = '<div class="preview-unsupported">Could not load file.</div>'; return; }

  const category = getFileCategory(file.type);
  if (category === 'image') {
    // Load via fetch + blob URL to prevent direct URL access
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      content.innerHTML = `<img src="${blobUrl}" alt="${file.name}" draggable="false" oncontextmenu="return false" />`;
    } catch {
      content.innerHTML = `<img src="${url}" alt="${file.name}" draggable="false" oncontextmenu="return false" />`;
    }
  } else if (category === 'video') {
    // No download, no controls save
    content.innerHTML = `<video autoplay controls controlsList="nodownload nofullscreen noremoteplayback" oncontextmenu="return false" disablePictureInPicture><source src="${url}" type="${file.type}" /></video>`;
  } else if (file.type === 'application/pdf') {
    content.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0&scrollbar=0" title="${file.name}"></iframe>`;
  } else {
    content.innerHTML = `<div class="preview-unsupported">
      <div style="font-size:48px;margin-bottom:12px">${getFileIcon(category)}</div>
      <p style="margin-bottom:8px">${file.name}</p>
      <p style="font-size:10px;color:var(--text-muted)">Preview not available for this file type.</p>
    </div>`;
  }
}

function closePreview(event) {
  if (event.target === document.getElementById('previewModal')) closePreviewModal();
}
function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
  document.getElementById('previewContent').innerHTML = '';
  previewFile = null;
}

// ── Guest Security Layer ──────────────────────────────────────
function applyGuestSecurity() {
  // No right click
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Block keyboard shortcuts for saving, printing, copying
  document.addEventListener('keydown', e => {
    const blocked = (
      (e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u', 'a', 'f12'].includes(e.key.toLowerCase()) ||
      e.key === 'PrintScreen' ||
      e.key === 'F12'
    );
    if (blocked) {
      e.preventDefault();
      flashWarning();
    }
  });

  // Block drag
  document.addEventListener('dragstart', e => e.preventDefault());

  // Detect visibility change (tab switch = possible screenshot tool)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Blur content while away
    }
  });

  // Disable print
  window.addEventListener('beforeprint', e => {
    e.preventDefault();
    flashWarning();
    return false;
  });
}

function flashWarning() {
  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;inset:0;background:rgba(255,74,107,0.15);
    border:2px solid var(--danger);z-index:99999;
    display:flex;align-items:center;justify-content:center;
    font-family:var(--font-display);font-size:18px;letter-spacing:4px;
    color:var(--danger);pointer-events:none;
  `;
  div.textContent = 'ACTION NOT PERMITTED';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1500);
}

// ── Filtering ─────────────────────────────────────────────────
function filterFiles(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFiles();
}

function searchFiles(query) {
  currentSearch = query;
  renderFiles();
}

// ── Helpers ───────────────────────────────────────────────────
async function getSignedUrl(path, expiry = 60) {
  const { data } = await _supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiry);
  return data?.signedUrl || null;
}

function getFileCategory(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType.includes('text')) return 'pdf';
  return 'other';
}

function getFileIcon(category) {
  const icons = { image: '🖼️', video: '🎬', pdf: '📄', other: '📦' };
  return icons[category] || '📦';
}
