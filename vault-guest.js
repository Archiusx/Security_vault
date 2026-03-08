// ─────────────────────────────────────────────────────────────
// VAULT — Guest View (vault-guest.js) — FIXED
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

  document.getElementById('sidebarEmail').textContent = session.email;
  const wm = document.getElementById('watermark');
  if (wm) wm.setAttribute('data-email', session.email);

  await loadFiles();
});

// ── Load files ────────────────────────────────────────────────
async function loadFiles() {
  const { data, error } = await _supabase
    .from('vault_files').select('*').order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  allFiles = data || [];
  document.getElementById('fileCount').textContent =
    `${allFiles.length} file${allFiles.length !== 1 ? 's' : ''}`;
  renderFiles();
}

function renderFiles() {
  const grid = document.getElementById('filesGrid');
  const empty = document.getElementById('filesEmpty');

  let filtered = allFiles.filter(f => {
    const matchFilter = currentFilter === 'all' || getFileCategory(f.type, f.name) === currentFilter;
    const matchSearch = !currentSearch || f.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  Array.from(grid.querySelectorAll('.file-card')).forEach(c => c.remove());

  if (filtered.length === 0) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  filtered.forEach(file => grid.appendChild(buildGuestCard(file)));
}

function buildGuestCard(file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.onclick = () => openPreview(file);

  const category = getFileCategory(file.type, file.name);
  const thumb = document.createElement('div');
  thumb.className = 'file-thumb';

  const tag = document.createElement('div');
  tag.className = 'file-type-tag';
  tag.textContent = getExtension(file.name);
  thumb.appendChild(tag);

  if (category === 'image') {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = file.name;
    img.setAttribute('draggable', 'false');
    img.oncontextmenu = () => false;
    getFileUrl(file.storage_path).then(url => { if (url) img.src = url; });
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
    <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
    <div class="file-size">${formatBytes(file.size || 0)}</div>
  `;
  card.appendChild(thumb);
  card.appendChild(info);
  return card;
}

// ── Preview — FIXED (view only) ───────────────────────────────
async function openPreview(file) {
  previewFile = file;
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewModal').classList.remove('hidden');

  const content = document.getElementById('previewContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-muted)">
      <div class="spinner" style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></div>
      <span style="font-size:11px;letter-spacing:1px">Loading...</span>
    </div>`;

  const url = await getFileUrl(file.storage_path, 600);

  if (!url) {
    content.innerHTML = `<div class="preview-unsupported">⚠️ Could not load preview.</div>`;
    return;
  }

  const category = getFileCategory(file.type, file.name);

  if (category === 'image') {
    // Load via blob to hide direct URL from guests
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('fetch failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = blobUrl;
      img.style.cssText = 'max-width:100%;max-height:65vh;border-radius:6px;display:block;pointer-events:none;';
      img.draggable = false;
      img.oncontextmenu = () => false;
      content.innerHTML = '';
      content.appendChild(img);
    } catch {
      content.innerHTML = `<div class="preview-unsupported">❌ Image failed to load.</div>`;
    }

  } else if (category === 'video') {
    content.innerHTML = `
      <video autoplay controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        oncontextmenu="return false"
        style="max-width:100%;max-height:65vh;border-radius:6px;pointer-events:auto;">
        <source src="${url}" type="${file.type || 'video/mp4'}">
      </video>`;

  } else if (category === 'pdf') {
    content.innerHTML = `
      <iframe
        src="${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH"
        style="width:100%;height:65vh;border:none;border-radius:6px;background:#fff;"
        title="document">
      </iframe>`;

  } else if (category === 'audio') {
    content.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:20px">🎵</div>
        <p style="margin-bottom:16px;color:var(--text-muted);font-size:12px">${escapeHtml(file.name)}</p>
        <audio controls controlsList="nodownload" style="width:100%;max-width:400px;">
          <source src="${url}" type="${file.type}">
        </audio>
      </div>`;

  } else if (category === 'text') {
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      content.innerHTML = `
        <pre style="
          width:100%;max-height:65vh;overflow:auto;
          background:var(--bg3);border-radius:6px;
          padding:20px;font-size:12px;line-height:1.7;
          color:var(--text);white-space:pre-wrap;word-break:break-word;
          border:1px solid var(--border);text-align:left;pointer-events:none;
        ">${escapeHtml(text)}</pre>`;
    } catch {
      content.innerHTML = `<div class="preview-unsupported">📝 ${escapeHtml(file.name)}<br/><small style="opacity:.5">Text preview unavailable.</small></div>`;
    }

  } else {
    content.innerHTML = `
      <div class="preview-unsupported">
        <div style="font-size:52px;margin-bottom:14px">${getFileIcon(category)}</div>
        <p style="color:var(--text);margin-bottom:6px">${escapeHtml(file.name)}</p>
        <p style="font-size:10px;color:var(--text-muted)">${formatBytes(file.size || 0)}</p>
        <p style="font-size:10px;color:var(--text-muted);margin-top:12px">Preview not available for this file type.</p>
      </div>`;
  }
}

function closePreview(event) {
  if (event.target === document.getElementById('previewModal')) closePreviewModal();
}
function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
  document.querySelectorAll('#previewContent video, #previewContent audio').forEach(m => m.pause());
  document.getElementById('previewContent').innerHTML = '';
  previewFile = null;
}

// ── Filter ────────────────────────────────────────────────────
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

// ── URL Helper ────────────────────────────────────────────────
async function getFileUrl(path, expiry = 600) {
  if (!path) return null;
  try {
    const { data, error } = await _supabase.storage
      .from(BUCKET_NAME).createSignedUrl(path, expiry);
    if (error) { console.error('URL error:', error); return null; }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('getFileUrl error:', err);
    return null;
  }
}

// ── File type helpers ─────────────────────────────────────────
function getFileCategory(mimeType, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return 'image';
    if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) return 'video';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp3','wav','ogg','m4a','flac','aac'].includes(ext)) return 'audio';
    if (['txt','md','js','ts','css','html','json','csv','xml'].includes(ext)) return 'text';
    return 'other';
  }
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'text';
  return 'other';
}

function getFileIcon(category) {
  return { image:'🖼️', video:'🎬', pdf:'📄', audio:'🎵', text:'📝', other:'📦' }[category] || '📦';
}

function getExtension(filename) {
  const ext = filename.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
