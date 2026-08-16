// DiscordDrive — Client Controller & Chunked Uploader
(function() {
  'use strict';

  const CHUNK_SIZE = 24 * 1024 * 1024; // 24 MB chunks

  const state = {
    user: null,
    files: [],
    activeFilter: 'all',
    searchQuery: ''
  };

  // DOM Elements
  const el = {
    userAvatarImg: document.getElementById('userAvatarImg'),
    userAvatarFallback: document.getElementById('userAvatarFallback'),
    usernameDisplay: document.getElementById('usernameDisplay'),
    storageCounter: document.getElementById('storageCounter'),
    refreshBtn: document.getElementById('refreshBtn'),
    filePickerInput: document.getElementById('filePickerInput'),
    dropzoneCard: document.getElementById('dropzoneCard'),
    selectFilesBtn: document.getElementById('selectFilesBtn'),
    uploadProgressCard: document.getElementById('uploadProgressCard'),
    uploadFileName: document.getElementById('uploadFileName'),
    uploadPct: document.getElementById('uploadPct'),
    uploadProgressFill: document.getElementById('uploadProgressFill'),
    chunkStatusText: document.getElementById('chunkStatusText'),
    uploadSpeedText: document.getElementById('uploadSpeedText'),
    searchInput: document.getElementById('searchInput'),
    filterPills: document.querySelectorAll('.filter-pill'),
    filesGrid: document.getElementById('filesGrid'),
    fileCountBadge: document.getElementById('fileCountBadge'),
    emptyStatePlaceholder: document.getElementById('emptyStatePlaceholder'),
    mediaModal: document.getElementById('mediaModal'),
    closeMediaModalBtn: document.getElementById('closeMediaModalBtn'),
    mediaModalTitle: document.getElementById('mediaModalTitle'),
    mediaStreamWrap: document.getElementById('mediaStreamWrap'),
    modalDownloadBtn: document.getElementById('modalDownloadBtn'),
    shareModal: document.getElementById('shareModal'),
    closeShareModalBtn: document.getElementById('closeShareModalBtn'),
    shareUrlInput: document.getElementById('shareUrlInput'),
    copyShareBtn: document.getElementById('copyShareBtn'),
    toastHub: document.getElementById('toastHub')
  };

  function haptic() {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch(e){}
  }

  function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showToast(msg) {
    if (!el.toastHub) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    el.toastHub.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2400);
  }

  // ==========================================================================
  // FETCH USER STATS & FILES
  // ==========================================================================
  async function loadUserData() {
    try {
      const res = await fetch('/api/user');
      if (res.status === 401) {
        showToast('🔒 Session expired. Run /upload in Discord.');
        return;
      }
      const data = await res.json();
      state.user = data.user;

      if (el.usernameDisplay) el.usernameDisplay.textContent = data.user.username;
      if (el.storageCounter) el.storageCounter.textContent = `${data.stats.formattedBytes} / Unlimited ♾️`;

      if (data.user.avatar && el.userAvatarImg) {
        el.userAvatarImg.src = data.user.avatar;
        el.userAvatarImg.style.display = 'block';
        if (el.userAvatarFallback) el.userAvatarFallback.style.display = 'none';
      } else if (el.userAvatarFallback) {
        el.userAvatarFallback.textContent = (data.user.username || '?').charAt(0).toUpperCase();
      }
    } catch (e) {}
  }

  async function loadFiles() {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        state.files = data.files || [];
        renderFiles();
      }
    } catch (e) {}
  }

  // ==========================================================================
  // RENDER FILES & FILTERS
  // ==========================================================================
  function matchesFilter(f) {
    const q = state.searchQuery.toLowerCase();
    if (q && !f.filename.toLowerCase().includes(q)) return false;

    const mime = (f.mimeType || '').toLowerCase();
    const ext = f.filename.toLowerCase();

    if (state.activeFilter === 'video') return mime.startsWith('video/') || /\.(mp4|mkv|webm|avi|mov)$/i.test(ext);
    if (state.activeFilter === 'audio') return mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a)$/i.test(ext);
    if (state.activeFilter === 'image') return mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(ext);
    if (state.activeFilter === 'doc') return /\.(pdf|doc|docx|txt|md|csv|xlsx|pptx)$/i.test(ext) || mime.includes('pdf') || mime.includes('text');
    if (state.activeFilter === 'archive') return /\.(zip|rar|7z|tar|gz|apk)$/i.test(ext);
    return true;
  }

  function getFileCategoryIcon(filename, mimeType) {
    const mime = (mimeType || '').toLowerCase();
    const ext = filename.toLowerCase();

    if (mime.startsWith('video/') || /\.(mp4|mkv|webm|avi|mov)$/i.test(ext)) {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    }
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a)$/i.test(ext)) {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
    if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(ext)) {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }
    if (/\.(zip|rar|7z|tar|gz|apk)$/i.test(ext)) {
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
  }

  function renderFiles() {
    if (!el.filesGrid) return;
    const filtered = state.files.filter(matchesFilter);

    if (el.fileCountBadge) el.fileCountBadge.textContent = `${filtered.length} files`;

    if (filtered.length === 0) {
      el.filesGrid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>No files found. Drop files above to store them forever on Discord!</p>
        </div>
      `;
      return;
    }

    el.filesGrid.innerHTML = filtered.map(f => {
      const isMedia = (f.mimeType || '').startsWith('video/') || (f.mimeType || '').startsWith('audio/');
      return `
        <div class="file-card" data-id="${f.id}">
          <div class="file-meta-col">
            <div class="file-icon-box">
              ${getFileCategoryIcon(f.filename, f.mimeType)}
            </div>
            <div class="file-title-wrap">
              <span class="file-name-text" title="${escapeHTML(f.filename)}">${escapeHTML(f.filename)}</span>
              <span class="file-subtext">${f.formattedSize} • ${f.chunksTotal} chunk${f.chunksTotal > 1 ? 's' : ''} • ${formatTime(f.createdAt)}</span>
            </div>
          </div>

          <div class="file-actions-row">
            ${isMedia ? `<button type="button" class="icon-action-btn stream-btn" title="Stream media" data-id="${f.id}" data-name="${escapeHTML(f.filename)}" data-mime="${f.mimeType}" data-url="${f.shareUrl}"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>` : ''}
            <a href="${f.shareUrl}" download="${escapeHTML(f.filename)}" class="icon-action-btn" title="Download reassembled file" target="_blank">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </a>
            <button type="button" class="icon-action-btn share-btn" title="Share link" data-url="${f.shareUrl}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button type="button" class="icon-action-btn delete delete-btn" title="Delete file" data-id="${f.id}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // CHUNKED UPLOADER (SUPPORTS GIGABYTE FILES WITH FLOW CONTROL)
  // ==========================================================================
  async function uploadFiles(files) {
    for (const file of files) {
      await uploadSingleFile(file);
    }
    loadUserData();
    loadFiles();
  }

  async function uploadSingleFile(file) {
    const fileId = 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    if (el.uploadProgressCard) {
      el.uploadProgressCard.style.display = 'flex';
      if (el.uploadFileName) el.uploadFileName.textContent = file.name;
      if (el.uploadPct) el.uploadPct.textContent = '0%';
      if (el.uploadProgressFill) el.uploadProgressFill.style.width = '0%';
      if (el.chunkStatusText) el.chunkStatusText.textContent = `Preparing ${totalChunks} chunk${totalChunks > 1 ? 's' : ''}...`;
    }

    let offset = 0;
    let chunkIndex = 0;
    const startTime = Date.now();

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const chunkNumber = chunkIndex + 1;

      if (el.chunkStatusText) {
        el.chunkStatusText.textContent = `Uploading chunk ${chunkNumber}/${totalChunks} (24MB slice) to Discord CDN...`;
      }

      const chunkBuffer = await slice.arrayBuffer();

      const res = await fetch('/api/upload_chunk', {
        method: 'POST',
        headers: {
          'X-File-Id': fileId,
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Size': file.size.toString(),
          'X-Chunk-Index': chunkIndex.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'Content-Type': 'application/octet-stream'
        },
        body: chunkBuffer
      });

      if (!res.ok) {
        showToast(`❌ Chunk ${chunkNumber} failed: ${res.statusText}`);
        if (el.uploadProgressCard) el.uploadProgressCard.style.display = 'none';
        return;
      }

      offset += CHUNK_SIZE;
      chunkIndex++;

      const uploadedBytes = Math.min(offset, file.size);
      const pct = Math.round((uploadedBytes / file.size) * 100);

      const elapsed = (Date.now() - startTime) / 1000;
      const speed = formatBytes(uploadedBytes / Math.max(elapsed, 0.1)) + '/s';

      if (el.uploadPct) el.uploadPct.textContent = `${pct}%`;
      if (el.uploadProgressFill) el.uploadProgressFill.style.width = `${pct}%`;
      if (el.uploadSpeedText) el.uploadSpeedText.textContent = speed;
    }

    setTimeout(() => {
      if (el.uploadProgressCard) el.uploadProgressCard.style.display = 'none';
    }, 600);

    showToast(`✓ Stored ${file.name} on Discord`);
    haptic();
  }

  // ==========================================================================
  // EVENT LISTENERS & MODALS
  // ==========================================================================
  if (el.selectFilesBtn && el.filePickerInput) el.selectFilesBtn.addEventListener('click', () => el.filePickerInput.click());
  if (el.filePickerInput) {
    el.filePickerInput.addEventListener('change', () => {
      if (el.filePickerInput.files.length > 0) {
        uploadFiles(Array.from(el.filePickerInput.files));
        el.filePickerInput.value = '';
      }
    });
  }

  // Drag and Drop
  if (el.dropzoneCard) {
    ['dragenter', 'dragover'].forEach(n => {
      el.dropzoneCard.addEventListener(n, (e) => {
        e.preventDefault();
        el.dropzoneCard.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(n => {
      el.dropzoneCard.addEventListener(n, (e) => {
        e.preventDefault();
        el.dropzoneCard.classList.remove('dragover');
      });
    });

    el.dropzoneCard.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  // Search & Filter Pills
  if (el.searchInput) {
    el.searchInput.addEventListener('input', () => {
      state.searchQuery = el.searchInput.value.trim();
      renderFiles();
    });
  }

  el.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      el.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.dataset.filter;
      renderFiles();
      haptic();
    });
  });

  if (el.refreshBtn) {
    el.refreshBtn.addEventListener('click', () => {
      loadUserData();
      loadFiles();
      showToast('✓ Refreshed');
      haptic();
    });
  }

  // Action Buttons (Stream, Share, Delete)
  document.addEventListener('click', async (e) => {
    // Stream media
    const streamBtn = e.target.closest('.stream-btn');
    if (streamBtn) {
      const id = streamBtn.dataset.id;
      const name = streamBtn.dataset.name;
      const mime = streamBtn.dataset.mime;
      const url = streamBtn.dataset.url;

      if (el.mediaModalTitle) el.mediaModalTitle.textContent = name;
      if (el.modalDownloadBtn) el.modalDownloadBtn.href = url;

      if (el.mediaStreamWrap) {
        if (mime.startsWith('video/')) {
          el.mediaStreamWrap.innerHTML = `<video src="/api/stream/${id}" controls autoplay playsinline></video>`;
        } else {
          el.mediaStreamWrap.innerHTML = `<audio src="/api/stream/${id}" controls autoplay style="padding: 20px;"></audio>`;
        }
      }

      if (el.mediaModal) el.mediaModal.style.display = 'flex';
      haptic();
      return;
    }

    // Share link
    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      const url = shareBtn.dataset.url;
      if (el.shareUrlInput) el.shareUrlInput.value = url;
      if (el.shareModal) el.shareModal.style.display = 'flex';
      haptic();
      return;
    }

    // Delete file
    const delBtn = e.target.closest('.delete-btn');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Are you sure you want to delete this file from Discord storage?')) {
        const res = await fetch(`/api/file/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('✓ File deleted from Discord');
          loadUserData();
          loadFiles();
          haptic();
        } else {
          showToast('Delete failed');
        }
      }
      return;
    }
  });

  // Modal Closers
  if (el.closeMediaModalBtn && el.mediaModal) {
    el.closeMediaModalBtn.addEventListener('click', () => {
      if (el.mediaStreamWrap) el.mediaStreamWrap.innerHTML = '';
      el.mediaModal.style.display = 'none';
    });
  }

  if (el.closeShareModalBtn && el.shareModal) {
    el.closeShareModalBtn.addEventListener('click', () => el.shareModal.style.display = 'none');
  }

  if (el.copyShareBtn && el.shareUrlInput) {
    el.copyShareBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(el.shareUrlInput.value);
        else {
          el.shareUrlInput.select();
          document.execCommand('copy');
        }
        showToast('✓ Share link copied');
        haptic();
      } catch (e) {}
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  // Initial Boot
  loadUserData();
  loadFiles();

})();
