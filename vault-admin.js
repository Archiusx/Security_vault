// ─────────────────────────────────────────────────────────────
// VAULT — Admin Dashboard (vault-admin.js) — FIXED
// ─────────────────────────────────────────────────────────────

let allFiles = [];
let currentFilter = 'all';
let currentSearch = '';
let previewFile = null;
let session = null;

window.addEventListener('DOMContentLoaded', async () => {
  session = requireAuth('admin');
  if (!session) return;

  document.getElementById('sidebarEmail').textContent = session.email;
  setupDropZone();
  await loadFiles();
});

// ── Sections ──────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.vault-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
  if (name === 'users') loadUsers();
  if (name === 'storage') loadStorage();
}

// ── File Loading ──────────────────────────────────────────────
async function loadFiles() {
  const { data, error } = await _supabase
    .from('vault_files')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Load error:', error); return; }
  allFiles = data || [];
  document.getElementById('fileCount').textContent =
    `${allFiles.length} file${allFiles.length !== 1 ? 's' : ''}`;
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
  filtered.forEach(file => grid.appendChild(buildFileCard(file)));
}

function buildFileCard(file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.onclick = () => openPreview(file);

  const category = getFileCategory(file.type);
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
    // Use public URL for thumbnails — faster than signed
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

// ── File Upload ───────────────────────────────────────────────
function setupDropZone() {
  const zone = document.getElementById('dropZone');
  zone.addEventListener('click', () => document.getElementById('fileInput').click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    uploadFiles(e.dataTransfer.files);
  });
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  const progress = document.getElementById('uploadProgress');
  const bar = document.getElementById('uploadBar');
  const label = document.getElementById('uploadLabel');
  progress.classList.remove('hidden');

  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    bar.style.width = Math.round(((i) / files.length) * 100) + '%';
    label.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;

    // Sanitize filename — remove special chars that break storage paths
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
    const path = `files/${Date.now()}_${safeName}`;

    const { error: uploadError } = await _supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error('Upload error for', file.name, ':', uploadError);
      label.textContent = `❌ Failed: ${file.name} — ${uploadError.message}`;
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    const { error: dbError } = await _supabase.from('vault_files').insert({
      name: file.name,
      storage_path: path,
      size: file.size,
      type: file.type || guessMimeFromName(file.name),
      uploaded_by_email: session.email
    });

    if (dbError) console.error('DB insert error:', dbError);
    else successCount++;
  }

  bar.style.width = '100%';
  label.textContent = `✅ Done! ${successCount}/${files.length} uploaded`;
  setTimeout(() => {
    progress.classList.add('hidden');
    bar.style.width = '0%';
  }, 2500);

  document.getElementById('fileInput').value = '';
  await loadFiles();
}

// ── Preview — FIXED ───────────────────────────────────────────
async function openPreview(file) {
  previewFile = file;
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewModal').classList.remove('hidden');

  const content = document.getElementById('previewContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-muted)">
      <div class="spinner" style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></div>
      <span style="font-size:11px;letter-spacing:1px">Loading preview...</span>
    </div>`;

  // Get signed URL with long expiry for admin
  const url = await getFileUrl(file.storage_path, 7200);

  if (!url) {
    content.innerHTML = `
      <div class="preview-unsupported">
        <div style="font-size:36px;margin-bottom:12px">⚠️</div>
        <p style="margin-bottom:6px">Could not load preview</p>
        <p style="font-size:10px;opacity:0.5">Check Supabase storage policies</p>
      </div>`;
    return;
  }

  const category = getFileCategory(file.type, file.name);

  if (category === 'image') {
    const img = new Image();
    img.onload = () => {
      content.innerHTML = '';
      img.style.cssText = 'max-width:100%;max-height:65vh;border-radius:6px;display:block;';
      img.draggable = false;
      content.appendChild(img);
    };
    img.onerror = () => {
      content.innerHTML = `<div class="preview-unsupported">❌ Image failed to load.<br/><small style="opacity:.5">Try downloading instead.</small></div>`;
    };
    img.src = url;

  } else if (category === 'video') {
    content.innerHTML = `
      <video controls controlsList="nodownload" style="max-width:100%;max-height:65vh;border-radius:6px;" oncontextmenu="return false">
        <source src="${url}" type="${file.type}">
        Your browser does not support this video format.
      </video>`;

  } else if (category === 'pdf') {
    content.innerHTML = `
      <iframe
        src="${url}#toolbar=1&navpanes=0&view=FitH"
        style="width:100%;height:65vh;border:none;border-radius:6px;background:#fff;"
        title="${escapeHtml(file.name)}">
      </iframe>`;

  } else if (category === 'text') {
    // Fetch and display text content inline
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      content.innerHTML = `
        <pre style="
          width:100%;max-height:65vh;overflow:auto;
          background:var(--bg3);border-radius:6px;
          padding:20px;font-size:12px;line-height:1.7;
          color:var(--text);white-space:pre-wrap;word-break:break-word;
          border:1px solid var(--border);text-align:left;
        ">${escapeHtml(text)}</pre>`;
    } catch {
      content.innerHTML = unsupportedPreview(file, url);
    }

  } else if (category === 'audio') {
    content.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:20px">🎵</div>
        <p style="margin-bottom:16px;color:var(--text-muted);font-size:12px">${escapeHtml(file.name)}</p>
        <audio controls style="width:100%;max-width:400px;">
          <source src="${url}" type="${file.type}">
        </audio>
      </div>`;

  } else {
    content.innerHTML = unsupportedPreview(file, url);
  }
}

function unsupportedPreview(file, url) {
  return `
    <div class="preview-unsupported">
      <div style="font-size:52px;margin-bottom:14px">${getFileIcon(getFileCategory(file.type, file.name))}</div>
      <p style="margin-bottom:6px;color:var(--text)">${escapeHtml(file.name)}</p>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:20px">${formatBytes(file.size || 0)}</p>
      <p style="font-size:10px;color:var(--text-muted)">No preview available — click Download to open this file.</p>
    </div>`;
}

function closePreview(event) {
  if (event.target === document.getElementById('previewModal')) closePreviewModal();
}
function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
  // Stop any playing video/audio
  document.querySelectorAll('#previewContent video, #previewContent audio').forEach(m => m.pause());
  document.getElementById('previewContent').innerHTML = '';
  previewFile = null;
}

async function downloadFile() {
  if (!previewFile) return;
  const url = await getFileUrl(previewFile.storage_path, 300);
  if (!url) { alert('Could not generate download link.'); return; }
  const a = document.createElement('a');
  a.href = url;
  a.download = previewFile.name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function deleteFile() {
  if (!previewFile) return;
  if (!confirm(`Delete "${previewFile.name}"?\nThis cannot be undone.`)) return;

  const { error: storageErr } = await _supabase.storage
    .from(BUCKET_NAME).remove([previewFile.storage_path]);
  if (storageErr) console.error('Storage delete error:', storageErr);

  const { error: dbErr } = await _supabase.from('vault_files')
    .delete().eq('id', previewFile.id);
  if (dbErr) console.error('DB delete error:', dbErr);

  closePreviewModal();
  await loadFiles();
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<div class="loading-text">Loading...</div>';

  const { data, error } = await _supabase
    .from('vault_users').select('email, role, created_at').order('created_at');

  if (error) { list.innerHTML = '<div class="loading-text">Error loading users.</div>'; return; }

  list.innerHTML = '';
  (data || []).forEach(user => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const isYou = user.email === session.email;
    row.innerHTML = `
      <div class="user-row-email">${escapeHtml(user.email)}
        ${isYou ? '<span style="color:var(--text-muted);font-size:10px;margin-left:6px">(you)</span>' : ''}
      </div>
      <div class="user-badge ${user.role === 'admin' ? 'admin-badge' : 'guest-badge'}">${user.role.toUpperCase()}</div>
      <div class="user-row-actions">
        ${!isYou ? `<button class="user-action-btn" onclick="removeUser('${escapeHtml(user.email)}')">Remove</button>` : ''}
      </div>`;
    list.appendChild(row);
  });
}

function showInviteModal() {
  document.getElementById('inviteModal').classList.remove('hidden');
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteError').classList.add('hidden');
  setTimeout(() => document.getElementById('inviteEmail').focus(), 100);
}
function closeInviteModal() { document.getElementById('inviteModal').classList.add('hidden'); }
function closeInvite(e) { if (e.target === document.getElementById('inviteModal')) closeInviteModal(); }

async function inviteUser() {
  const email = document.getElementById('inviteEmail').value.trim().toLowerCase();
  const errEl = document.getElementById('inviteError');
  errEl.classList.add('hidden');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Enter a valid email.'; errEl.classList.remove('hidden'); return;
  }
  if (email === session.email) {
    errEl.textContent = 'That is your own email.'; errEl.classList.remove('hidden'); return;
  }

  const { error } = await _supabase.from('vault_users').insert({ email, role: 'guest' });
  if (error) {
    errEl.textContent = error.code === '23505' ? 'User already exists.' : 'Error adding user.';
    errEl.classList.remove('hidden');
    return;
  }
  closeInviteModal();
  loadUsers();
}

async function removeUser(email) {
  if (!confirm(`Remove ${email} from the vault?`)) return;
  await _supabase.from('vault_users').delete().eq('email', email);
  loadUsers();
}

// ── Storage Stats ─────────────────────────────────────────────
async function loadStorage() {
  const { data } = await _supabase.from('vault_files').select('size, type, name');
  if (!data) return;

  let totals = { image: 0, pdf: 0, video: 0, other: 0, total: 0 };
  data.forEach(f => {
    const cat = getFileCategory(f.type, f.name);
    const size = f.size || 0;
    totals.total += size;
    if (cat === 'image') totals.image += size;
    else if (cat === 'pdf') totals.pdf += size;
    else if (cat === 'video') totals.video += size;
    else totals.other += size;
  });

  document.getElementById('storageUsed').textContent = formatBytes(totals.total);
  document.getElementById('statImages').textContent = formatBytes(totals.image);
  document.getElementById('statDocs').textContent = formatBytes(totals.pdf);
  document.getElementById('statVideos').textContent = formatBytes(totals.video);
  document.getElementById('statOther').textContent = formatBytes(totals.other);
  document.getElementById('statTotal').textContent = data.length;

  const pct = Math.min(totals.total / STORAGE_LIMIT, 1);
  document.getElementById('storageArc').style.strokeDashoffset = 314 - (314 * pct);
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

// ── URL Helper — FIXED ────────────────────────────────────────
async function getFileUrl(path, expiry = 3600) {
  if (!path) return null;
  try {
    const { data, error } = await _supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiry);
    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('getFileUrl exception:', err);
    return null;
  }
}

// Kept for backward compat
async function getSignedUrl(path, expiry = 3600) {
  return getFileUrl(path, expiry);
}

// ── File type helpers ─────────────────────────────────────────
function getFileCategory(mimeType, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    // Fallback to extension
    if (['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext)) return 'image';
    if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) return 'video';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp3','wav','ogg','m4a','flac','aac'].includes(ext)) return 'audio';
    if (['txt','md','js','ts','css','html','json','csv','xml','py','java','c','cpp'].includes(ext)) return 'text';
    return 'other';
  }
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/') || ['application/json','application/xml'].includes(mimeType)) return 'text';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('sheet') || mimeType.includes('presentation')) return 'pdf';
  return 'other';
}

function getFileIcon(category) {
  return { image:'🖼️', video:'🎬', pdf:'📄', audio:'🎵', text:'📝', other:'📦' }[category] || '📦';
}

function getExtension(filename) {
  const ext = filename.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
}

function guessMimeFromName(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
    webp:'image/webp', svg:'image/svg+xml', mp4:'video/mp4', webm:'video/webm',
    mov:'video/quicktime', mp3:'audio/mpeg', wav:'audio/wav', pdf:'application/pdf',
    txt:'text/plain', md:'text/markdown', json:'application/json',
    csv:'text/csv', html:'text/html', js:'text/javascript'
  };
  return map[ext] || 'application/octet-stream';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
