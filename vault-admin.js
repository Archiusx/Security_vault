// ─────────────────────────────────────────────────────────────
// VAULT — Admin Dashboard (vault-admin.js)
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

  // Clear existing cards
  Array.from(grid.querySelectorAll('.file-card')).forEach(c => c.remove());

  if (filtered.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(file => {
    const card = buildFileCard(file, true);
    grid.appendChild(card);
  });
}

function buildFileCard(file, isAdmin) {
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round((i / files.length) * 100);
    bar.style.width = pct + '%';
    label.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;

    const path = `${session.email}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await _supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, { upsert: false });

    if (uploadError) { console.error('Upload error:', uploadError); continue; }

    await _supabase.from('vault_files').insert({
      name: file.name,
      storage_path: path,
      size: file.size,
      type: file.type,
      uploaded_by_email: session.email
    });
  }

  bar.style.width = '100%';
  label.textContent = 'Done!';
  setTimeout(() => progress.classList.add('hidden'), 2000);

  await loadFiles();
}

// ── Preview ───────────────────────────────────────────────────
async function openPreview(file) {
  previewFile = file;
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewModal').classList.remove('hidden');

  const content = document.getElementById('previewContent');
  content.innerHTML = '<div class="spinner" style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.1);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></div>';

  const url = await getSignedUrl(file.storage_path, 3600);
  if (!url) { content.innerHTML = '<div class="preview-unsupported">Could not load file.</div>'; return; }

  const category = getFileCategory(file.type);
  if (category === 'image') {
    content.innerHTML = `<img src="${url}" alt="${file.name}" draggable="false" />`;
  } else if (category === 'video') {
    content.innerHTML = `<video controls controlsList="nodownload" oncontextmenu="return false"><source src="${url}" type="${file.type}" /></video>`;
  } else if (file.type === 'application/pdf') {
    content.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0" title="${file.name}"></iframe>`;
  } else {
    content.innerHTML = `<div class="preview-unsupported">
      <div style="font-size:48px;margin-bottom:12px">${getFileIcon(category)}</div>
      <p style="margin-bottom:8px">${file.name}</p>
      <p style="font-size:10px;color:var(--text-muted)">${formatBytes(file.size || 0)} · Click download to save</p>
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

async function downloadFile() {
  if (!previewFile) return;
  const url = await getSignedUrl(previewFile.storage_path, 300);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = previewFile.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function deleteFile() {
  if (!previewFile) return;
  if (!confirm(`Delete "${previewFile.name}"? This cannot be undone.`)) return;

  await _supabase.storage.from(BUCKET_NAME).remove([previewFile.storage_path]);
  await _supabase.from('vault_files').delete().eq('id', previewFile.id);

  closePreviewModal();
  await loadFiles();
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<div class="loading-text">Loading...</div>';

  const { data, error } = await _supabase
    .from('vault_users')
    .select('email, role, created_at')
    .order('created_at');

  if (error) { list.innerHTML = '<div class="loading-text">Error loading users.</div>'; return; }

  list.innerHTML = '';
  (data || []).forEach(user => {
    const row = document.createElement('div');
    row.className = 'user-row';
    const isYou = user.email === session.email;
    row.innerHTML = `
      <div class="user-row-email">${user.email}${isYou ? ' <span style="color:var(--text-muted);font-size:10px">(you)</span>' : ''}</div>
      <div class="user-badge ${user.role === 'admin' ? 'admin-badge' : 'guest-badge'}">${user.role.toUpperCase()}</div>
      <div class="user-row-actions">
        ${!isYou ? `<button class="user-action-btn" onclick="removeUser('${user.email}')">Remove</button>` : ''}
      </div>
    `;
    list.appendChild(row);
  });
}

function showInviteModal() {
  document.getElementById('inviteModal').classList.remove('hidden');
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteError').classList.add('hidden');
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

  const { error } = await _supabase
    .from('vault_users')
    .insert({ email, role: 'guest' });

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
  const { data } = await _supabase.from('vault_files').select('size, type');
  if (!data) return;

  let totals = { image: 0, pdf: 0, video: 0, other: 0, total: 0 };
  data.forEach(f => {
    const cat = getFileCategory(f.type);
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

  // Animate ring
  const pct = Math.min(totals.total / STORAGE_LIMIT, 1);
  const circumference = 314;
  const offset = circumference - (circumference * pct);
  document.getElementById('storageArc').style.strokeDashoffset = offset;
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
