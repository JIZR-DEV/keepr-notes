/*
 * Keepr Notes — lógica del side panel / sidebar.
 * Construye el DOM con createElement/textContent (sin innerHTML) y habla con
 * el content script vía mensajes (kpApi) para contexto y seek.
 */
(function () {
  'use strict';

  const t = (k, s) => (self.KeeprI18n ? self.KeeprI18n.t(k, s) : k);
  const $ = (sel) => document.querySelector(sel);

  // Paleta de colores para las notas (compartida desde KeeprNotes; datos libres).
  const PALETTE = KeeprNotes.PALETTE;

  const els = {
    title: $('#video-title'),
    add: $('#btn-add'),
    exportMd: $('#btn-export-md'),
    searchNotes: $('#search-notes'),
    sortNotes: $('#sort-notes'),
    notesList: $('#notes-list'),
    notesEmpty: $('#notes-empty'),
    searchLib: $('#search-lib'),
    libList: $('#library-list'),
    libEmpty: $('#library-empty'),
    backup: $('#btn-backup'),
    restore: $('#btn-restore'),
    fileRestore: $('#file-restore'),
    options: $('#btn-options'),
    viewVideo: $('#view-video'),
    viewLibrary: $('#view-library'),
    status: $('#kp-status'),
    tabs: document.querySelectorAll('.kp-tab'),
  };

  const state = {
    tabId: null,
    videoId: null,
    title: '',
    view: 'video',
    noteFilter: '',
    libFilter: '',
    sort: 'time',
  };

  // ---- utilidades -------------------------------------------------------

  let statusTimer = null;
  function status(msg) {
    els.status.textContent = msg;
    els.status.classList.add('kp-status--show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => els.status.classList.remove('kp-status--show'), 1800);
  }

  function sanitizeFilename(name) {
    return (name || 'keepr-notes').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80).trim() || 'keepr-notes';
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function applyTheme() {
    let th = 'auto'; // coincide con DEFAULT_SETTINGS
    try {
      th = (await KeeprNotes.getSettings()).theme || 'auto';
    } catch {
      th = 'auto';
    }
    if (th === 'auto') {
      th = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = th;
  }

  async function sendToTab(message) {
    if (state.tabId == null) return null;
    try {
      return await kpApi.tabs.sendMessage(state.tabId, message);
    } catch {
      return null; // no hay content script en esa pestaña
    }
  }

  function sortNotes(notes) {
    const arr = notes.slice();
    if (state.sort === 'created') arr.sort((a, b) => (b.created || 0) - (a.created || 0));
    else if (state.sort === 'updated') arr.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    else arr.sort((a, b) => a.t - b.t);
    return arr;
  }

  // ---- resolución de la pestaña/video activos ---------------------------

  async function resolveActiveTab() {
    let tab;
    try {
      // currentWindow ancla a la ventana del panel/sidebar (la sidebar es por-ventana).
      [tab] = await kpApi.tabs.query({ active: true, currentWindow: true });
    } catch {
      tab = null;
    }
    state.tabId = tab && tab.id != null ? tab.id : null;

    const ctx = await sendToTab({ type: 'KEEPR_GET_CONTEXT' });
    if (ctx && ctx.videoId) {
      state.videoId = ctx.videoId;
      state.title = ctx.title || ctx.videoId;
    } else {
      state.videoId = null;
      state.title = '';
    }
    if (state.view === 'video') renderVideoView();
  }

  // ---- vista: notas del video actual ------------------------------------

  function setVideoControlsEnabled(on) {
    els.add.disabled = !on;
    els.exportMd.disabled = !on;
    els.searchNotes.disabled = !on;
    els.sortNotes.disabled = !on;
  }

  function makeIconButton(label, glyph, onClick) {
    const b = document.createElement('button');
    b.className = 'kp-icon';
    b.type = 'button';
    b.textContent = glyph;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function makeNoteEl(note) {
    const li = document.createElement('li');
    li.className = 'kp-note';
    if (note.color) li.style.borderLeftColor = note.color;
    li.classList.toggle('kp-note--flagged', !!note.color);

    const top = document.createElement('div');
    top.className = 'kp-note-top';

    const ts = document.createElement('button');
    ts.className = 'kp-ts';
    ts.type = 'button';
    ts.textContent = KeeprNotes.fmtTime(note.t);
    ts.title = t('jump');
    ts.setAttribute('aria-label', `${t('jump')} ${KeeprNotes.fmtTime(note.t)}`);
    ts.addEventListener('click', async () => {
      const r = await sendToTab({ type: 'KEEPR_SEEK', t: note.t });
      if (!r) status(t('openVideoToJump'));
    });

    const actions = document.createElement('div');
    actions.className = 'kp-note-actions';

    // Ciclo de color
    const colorBtn = makeIconButton(t('colorTitle'), '●', async () => {
      const idx = PALETTE.indexOf(note.color || '');
      const next = PALETTE[(idx + 1) % PALETTE.length];
      note.color = next;
      await KeeprNotes.updateNote(state.videoId, note.id, { color: next });
      li.style.borderLeftColor = next || '';
      li.classList.toggle('kp-note--flagged', !!next);
      colorBtn.style.color = next || 'var(--text-dim)';
      colorBtn.setAttribute('aria-pressed', String(!!next));
    });
    colorBtn.style.color = note.color || 'var(--text-dim)';
    colorBtn.setAttribute('aria-pressed', String(!!note.color));

    // Copiar enlace al timestamp
    const copyBtn = makeIconButton(t('copyLink'), '🔗', async () => {
      const ok = await copyText(KeeprNotes.urlAt(state.videoId, note.t));
      status(ok ? t('linkCopied') : t('copyFailed'));
    });

    const del = makeIconButton(t('deleteNote'), '🗑', async () => {
      await KeeprNotes.deleteNote(state.videoId, note.id);
      li.remove();
      status(t('noteDeleted'));
      maybeToggleNotesEmpty();
    });

    actions.append(colorBtn, copyBtn, del);
    top.append(ts, actions);

    const ta = document.createElement('textarea');
    ta.className = 'kp-note-text';
    ta.placeholder = t('notePlaceholder');
    ta.value = note.text || '';
    ta.rows = 2;
    let saveTimer = null;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        KeeprNotes.updateNote(state.videoId, note.id, { text: ta.value });
      }, 350);
    });

    li.append(top, ta);
    return li;
  }

  function maybeToggleNotesEmpty() {
    const has = els.notesList.children.length > 0;
    els.notesEmpty.style.display = has ? 'none' : 'block';
  }

  async function renderVideoView() {
    els.notesList.replaceChildren();

    if (!state.videoId) {
      els.title.textContent = t('videoPlaceholder');
      setVideoControlsEnabled(false);
      els.notesEmpty.style.display = 'none';
      return;
    }

    els.title.textContent = state.title || state.videoId;
    setVideoControlsEnabled(true);

    const rec = await KeeprNotes.getVideo(state.videoId);
    let notes = rec ? sortNotes(rec.notes) : [];

    const q = state.noteFilter.trim().toLowerCase();
    if (q) notes = notes.filter((n) => (n.text || '').toLowerCase().includes(q));

    for (const n of notes) els.notesList.appendChild(makeNoteEl(n));

    const emptyP = els.notesEmpty.querySelector('p');
    if (notes.length === 0) {
      if (emptyP) emptyP.textContent = q ? t('noMatch') : t('emptyNotes');
      els.notesEmpty.style.display = 'block';
    } else {
      els.notesEmpty.style.display = 'none';
    }
  }

  // ---- vista: biblioteca (lista + búsqueda global) ----------------------

  function makeLibVideoItem(rec) {
    const li = document.createElement('li');
    li.className = 'kp-lib-item';

    const main = document.createElement('div');
    main.className = 'kp-lib-main';

    const title = document.createElement('a');
    title.className = 'kp-lib-title';
    title.textContent = rec.title || rec.videoId;
    title.href = KeeprNotes.safeHttpUrl(rec.url, KeeprNotes.urlAt(rec.videoId, 0));
    title.target = '_blank';
    title.rel = 'noreferrer';

    const meta = document.createElement('div');
    meta.className = 'kp-lib-meta';
    const n = rec.notes.length;
    meta.textContent = `${n} ${n === 1 ? t('noteSingular') : t('notePlural')}`;

    main.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'kp-lib-actions';
    const exp = makeIconButton(t('exportThis'), '.md', () => {
      download(
        sanitizeFilename(rec.title || rec.videoId) + '.md',
        KeeprNotes.toMarkdown(rec),
        'text/markdown;charset=utf-8'
      );
      status(t('mdExported'));
    });
    actions.appendChild(exp);

    li.append(main, actions);
    return li;
  }

  function makeSearchHitItem(hit) {
    const li = document.createElement('li');
    li.className = 'kp-lib-item kp-hit';
    if (hit.note.color) li.style.borderLeftColor = hit.note.color;

    const main = document.createElement('div');
    main.className = 'kp-lib-main';

    const title = document.createElement('div');
    title.className = 'kp-lib-title';
    title.textContent = hit.title;

    const snippet = document.createElement('div');
    snippet.className = 'kp-hit-snippet';
    snippet.textContent = hit.note.text || '—';

    main.append(title, snippet);

    const open = document.createElement('button');
    open.className = 'kp-ts';
    open.type = 'button';
    open.textContent = KeeprNotes.fmtTime(hit.note.t);
    open.title = t('openAt');
    open.setAttribute('aria-label', `${t('openAt')} ${KeeprNotes.fmtTime(hit.note.t)}`);
    open.addEventListener('click', () => {
      kpApi.tabs.create({ url: KeeprNotes.urlAt(hit.videoId, hit.note.t) });
    });

    li.append(main, open);
    return li;
  }

  async function renderLibrary() {
    els.libList.replaceChildren();
    const q = state.libFilter.trim();
    const emptyP = els.libEmpty.querySelector('p');

    if (q) {
      const hits = await KeeprNotes.searchAll(q);
      els.libEmpty.style.display = hits.length ? 'none' : 'block';
      if (emptyP && !hits.length) emptyP.textContent = t('noMatch');
      for (const h of hits) els.libList.appendChild(makeSearchHitItem(h));
      return;
    }

    const recs = await KeeprNotes.getAll();
    els.libEmpty.style.display = recs.length ? 'none' : 'block';
    if (emptyP && !recs.length) emptyP.textContent = t('emptyLib');
    for (const r of recs) els.libList.appendChild(makeLibVideoItem(r));
  }

  // ---- navegación de pestañas del panel ---------------------------------

  function switchView(view) {
    state.view = view;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('kp-tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1; // roving tabindex (patrón WAI-ARIA tablist)
    });
    els.viewVideo.classList.toggle('kp-hidden', view !== 'video');
    els.viewLibrary.classList.toggle('kp-hidden', view !== 'library');
    if (view === 'library') renderLibrary();
    else renderVideoView();
  }

  // ---- eventos ----------------------------------------------------------

  els.tabs.forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));

  // Navegación por teclado entre pestañas (flechas + Home/End) con roving tabindex.
  els.tabs.forEach((tab, i) => {
    tab.addEventListener('keydown', (e) => {
      const arr = Array.from(els.tabs);
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % arr.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + arr.length) % arr.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = arr.length - 1;
      else return;
      e.preventDefault();
      switchView(arr[next].dataset.view);
      arr[next].focus();
    });
  });

  els.options.addEventListener('click', async () => {
    try {
      if (kpApi.runtime.openOptionsPage) {
        await kpApi.runtime.openOptionsPage();
        return;
      }
      throw new Error('openOptionsPage no disponible');
    } catch {
      // Fallback universal: abrir la página de opciones en una pestaña.
      try {
        await kpApi.tabs.create({ url: kpApi.runtime.getURL('options/options.html') });
      } catch {
        status(t('optionsTitle'));
      }
    }
  });

  els.add.addEventListener('click', async () => {
    const r = await sendToTab({ type: 'KEEPR_ADD_NOTE' });
    status(r && r.ok ? t('noteAdded') : t('openVideoToAdd'));
  });

  els.exportMd.addEventListener('click', async () => {
    const rec = await KeeprNotes.getVideo(state.videoId);
    if (!rec || !rec.notes.length) return status(t('nothingToExport'));
    download(
      sanitizeFilename(rec.title || rec.videoId) + '.md',
      KeeprNotes.toMarkdown(rec),
      'text/markdown;charset=utf-8'
    );
    status(t('mdExported'));
  });

  els.searchNotes.addEventListener('input', () => {
    state.noteFilter = els.searchNotes.value;
    renderVideoView();
  });

  els.sortNotes.addEventListener('change', () => {
    state.sort = els.sortNotes.value;
    renderVideoView();
  });

  els.searchLib.addEventListener('input', () => {
    state.libFilter = els.searchLib.value;
    renderLibrary();
  });

  els.backup.addEventListener('click', async () => {
    const data = await KeeprNotes.exportAll();
    if (!data.videos.length) return status(t('nothingToBackup'));
    const stamp = new Date().toISOString().slice(0, 10);
    download(`keepr-notes-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    status(t('backupDownloaded'));
  });

  els.restore.addEventListener('click', () => els.fileRestore.click());

  els.fileRestore.addEventListener('change', async () => {
    const file = els.fileRestore.files && els.fileRestore.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const added = await KeeprNotes.importAll(data, 'merge');
      status(`${t('restoredPrefix')} ${added} ${t('notePlural')}`);
      if (state.view === 'library') renderLibrary();
      else renderVideoView();
    } catch (err) {
      status(t('invalidBackup'));
    } finally {
      els.fileRestore.value = '';
    }
  });

  // Re-render en vivo al cambiar los datos (p. ej. nota añadida desde el player),
  // salvo que el usuario esté editando una nota (no le pisamos el foco).
  kpApi.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[KeeprNotes.SETTINGS_KEY]) applyTheme();
    const editing =
      document.activeElement && document.activeElement.classList.contains('kp-note-text');
    if (editing) return;
    if (state.view === 'library') renderLibrary();
    else renderVideoView();
  });

  // El video activo puede cambiar de pestaña o de URL mientras el panel está abierto.
  kpApi.tabs.onActivated.addListener(() => resolveActiveTab());
  kpApi.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId === state.tabId && (info.url || info.status === 'complete')) resolveActiveTab();
  });

  // ---- arranque ---------------------------------------------------------
  applyTheme();
  resolveActiveTab();
})();
