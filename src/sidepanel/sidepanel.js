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
    back: $('#btn-back'),
    noteCount: $('#note-count'),
    browsingNote: $('#browsing-note'),
    libCount: $('#lib-count'),
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
    videoId: null, // video de la pestaña activa
    title: '',
    pinned: null, // { videoId, title } al navegar un video desde la Biblioteca
    notesVideoId: null, // video cuyas notas se muestran ahora (activo o fijado)
    focusNewest: false, // enfocar la nota recién creada tras el próximo render
    pendingRerender: false, // re-render diferido si el usuario estaba editando
    view: 'video',
    noteFilter: '',
    libFilter: '',
    sort: 'time',
  };

  // ---- utilidades -------------------------------------------------------

  let statusTimer = null;
  function statusAction(msg, actionLabel, onAction) {
    els.status.replaceChildren();
    const span = document.createElement('span');
    span.textContent = msg;
    els.status.appendChild(span);
    if (actionLabel) {
      const b = document.createElement('button');
      b.className = 'kp-undo';
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', () => {
        els.status.classList.remove('kp-status--show');
        onAction();
      });
      els.status.appendChild(b);
    }
    els.status.classList.add('kp-status--show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(
      () => els.status.classList.remove('kp-status--show'),
      actionLabel ? 5000 : 1800
    );
  }
  function status(msg) {
    statusAction(msg, null, null);
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

  // Coincidencia de búsqueda: texto, tags o marca de tiempo escrita (p. ej. "1:05").
  function matchNote(n, q) {
    if ((n.text || '').toLowerCase().includes(q)) return true;
    if ((n.tags || []).some((tg) => tg.toLowerCase().includes(q))) return true;
    return KeeprNotes.fmtTime(n.t).includes(q);
  }

  function firstNoteUrl(rec) {
    const sorted = rec.notes.slice().sort((a, b) => a.t - b.t);
    return KeeprNotes.urlAt(rec.videoId, sorted.length ? sorted[0].t : 0);
  }

  // Abre las notas de un video de la Biblioteca dentro del panel (sin reabrir YouTube).
  function openVideoFromLibrary(rec) {
    state.pinned = { videoId: rec.videoId, title: rec.title || rec.videoId };
    state.noteFilter = '';
    els.searchNotes.value = '';
    switchView('video');
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
    li.dataset.noteId = note.id;
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
      // Si el video no está en la pestaña activa, lo abrimos en ese momento.
      if (!r) kpApi.tabs.create({ url: KeeprNotes.urlAt(state.notesVideoId, note.t) });
    });

    // Ajuste fino del timestamp (±5s)
    const adjust = (delta) => async () => {
      note.t = Math.max(0, (note.t || 0) + delta);
      await KeeprNotes.updateNote(state.notesVideoId, note.id, { t: note.t });
      ts.textContent = KeeprNotes.fmtTime(note.t);
      ts.setAttribute('aria-label', `${t('jump')} ${KeeprNotes.fmtTime(note.t)}`);
    };
    const minus = makeIconButton(t('adjustEarlier'), '−', adjust(-5));
    const plus = makeIconButton(t('adjustLater'), '+', adjust(5));
    minus.classList.add('kp-step');
    plus.classList.add('kp-step');

    const timeGroup = document.createElement('div');
    timeGroup.className = 'kp-timegroup';
    timeGroup.append(minus, ts, plus);

    const actions = document.createElement('div');
    actions.className = 'kp-note-actions';

    // Ciclo de color
    const colorBtn = makeIconButton(t('colorTitle'), '●', async () => {
      const idx = PALETTE.indexOf(note.color || '');
      const next = PALETTE[(idx + 1) % PALETTE.length];
      note.color = next;
      await KeeprNotes.updateNote(state.notesVideoId, note.id, { color: next });
      li.style.borderLeftColor = next || '';
      li.classList.toggle('kp-note--flagged', !!next);
      colorBtn.style.color = next || 'var(--text-dim)';
      colorBtn.setAttribute('aria-pressed', String(!!next));
    });
    colorBtn.style.color = note.color || 'var(--text-dim)';
    colorBtn.setAttribute('aria-pressed', String(!!note.color));

    // Copiar enlace al timestamp
    const copyBtn = makeIconButton(t('copyLink'), '🔗', async () => {
      const ok = await copyText(KeeprNotes.urlAt(state.notesVideoId, note.t));
      status(ok ? t('linkCopied') : t('copyFailed'));
    });

    // Borrado con deshacer: la nota se elimina del storage tras 5s salvo undo.
    const del = makeIconButton(t('deleteNote'), '🗑', () => {
      const vid = state.notesVideoId;
      li.remove();
      setNoteCount(Math.max(0, currentNoteTotal() - 1));
      maybeToggleNotesEmpty();
      let undone = false;
      const timer = setTimeout(() => {
        if (!undone) KeeprNotes.deleteNote(vid, note.id);
      }, 5000);
      statusAction(t('noteDeleted'), t('undo'), () => {
        undone = true;
        clearTimeout(timer);
        if (state.view === 'video') renderVideoView();
        else renderLibrary();
      });
    });

    actions.append(colorBtn, copyBtn, del);
    top.append(timeGroup, actions);

    const ta = document.createElement('textarea');
    ta.className = 'kp-note-text';
    ta.placeholder = t('notePlaceholder');
    ta.value = note.text || '';
    ta.rows = 2;
    let saveTimer = null;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        KeeprNotes.updateNote(state.notesVideoId, note.id, { text: ta.value });
      }, 350);
    });
    // Re-render diferido: al perder el foco, si hubo cambios externos mientras
    // editabas, refrescamos para no quedar obsoletos.
    ta.addEventListener('blur', () => {
      if (state.pendingRerender) {
        state.pendingRerender = false;
        if (state.view === 'library') renderLibrary();
        else renderVideoView();
      }
    });

    li.append(top, ta);
    return li;
  }

  function maybeToggleNotesEmpty() {
    const has = els.notesList.children.length > 0;
    els.notesEmpty.style.display = has ? 'none' : 'block';
  }

  function setNoteCount(n) {
    els.noteCount.textContent = n > 0 ? String(n) : '';
  }
  function currentNoteTotal() {
    return parseInt(els.noteCount.textContent, 10) || 0;
  }

  // Video cuyas notas se muestran: el fijado desde la Biblioteca o el activo.
  function effectiveVideo() {
    if (state.pinned) return { id: state.pinned.videoId, title: state.pinned.title, pinned: true };
    return { id: state.videoId, title: state.title, pinned: false };
  }

  async function renderVideoView() {
    els.notesList.replaceChildren();
    const ev = effectiveVideo();
    state.notesVideoId = ev.id;
    els.back.classList.toggle('kp-hidden', !ev.pinned);
    els.browsingNote.classList.toggle('kp-hidden', !(ev.pinned && ev.id !== state.videoId));

    if (!ev.id) {
      els.title.textContent = t('videoPlaceholder');
      setNoteCount(0);
      setVideoControlsEnabled(false);
      els.notesEmpty.style.display = 'none';
      return;
    }

    els.title.textContent = ev.title || ev.id;
    setVideoControlsEnabled(true);
    // Añadir nota requiere el content script: solo si es el video de la pestaña activa.
    els.add.disabled = ev.id !== state.videoId;

    const rec = await KeeprNotes.getVideo(ev.id);
    const total = rec ? rec.notes.length : 0;
    setNoteCount(total);
    let notes = rec ? sortNotes(rec.notes) : [];

    const q = state.noteFilter.trim().toLowerCase();
    if (q) notes = notes.filter((n) => matchNote(n, q));

    for (const n of notes) els.notesList.appendChild(makeNoteEl(n));

    const emptyP = els.notesEmpty.querySelector('p');
    if (notes.length === 0) {
      if (emptyP) emptyP.textContent = q ? t('noMatch') : t('emptyNotes');
      els.notesEmpty.style.display = 'block';
    } else {
      els.notesEmpty.style.display = 'none';
    }

    // Enfocar la nota recién capturada (botón del player / Alt+N / botón +).
    if (state.focusNewest && total) {
      state.focusNewest = false;
      const newest = notes.reduce((a, b) => ((b.created || 0) > (a.created || 0) ? b : a), notes[0]);
      const elNew = els.notesList.querySelector(`[data-note-id="${newest.id}"] .kp-note-text`);
      if (elNew) {
        elNew.focus();
        elNew.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // ---- vista: biblioteca (lista + búsqueda global) ----------------------

  function makeLibVideoItem(rec) {
    const li = document.createElement('li');
    li.className = 'kp-lib-item';

    const n = rec.notes.length;
    const metaText = `${n} ${n === 1 ? t('noteSingular') : t('notePlural')}`;

    // El cuerpo es un botón: abre las notas de este video dentro del panel.
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'kp-lib-main kp-lib-open';
    main.setAttribute('aria-label', `${rec.title || rec.videoId} — ${metaText}`);

    const title = document.createElement('div');
    title.className = 'kp-lib-title';
    title.textContent = rec.title || rec.videoId;

    const meta = document.createElement('div');
    meta.className = 'kp-lib-meta';
    meta.textContent = metaText;

    main.append(title, meta);
    main.addEventListener('click', () => openVideoFromLibrary(rec));

    const actions = document.createElement('div');
    actions.className = 'kp-lib-actions';

    // Abrir en YouTube en la primera nota (no en t=0).
    const open = document.createElement('a');
    open.className = 'kp-icon';
    open.textContent = '↗';
    open.href = firstNoteUrl(rec);
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.title = t('openVideo');
    open.setAttribute('aria-label', t('openVideo'));

    const copyMd = makeIconButton(t('copyMd'), '⧉', async () => {
      const ok = await copyText(KeeprNotes.toMarkdown(rec));
      status(ok ? t('mdCopied') : t('copyFailed'));
    });

    const exp = makeIconButton(t('exportThis'), '.md', () => {
      download(
        sanitizeFilename(rec.title || rec.videoId) + '.md',
        KeeprNotes.toMarkdown(rec),
        'text/markdown;charset=utf-8'
      );
      status(t('mdExported'));
    });

    actions.append(open, copyMd, exp);
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

  // Ir a una pestaña; al elegir "Este video" se descarta el video fijado.
  function goToTab(view) {
    if (view === 'video') state.pinned = null;
    switchView(view);
  }

  els.tabs.forEach((tab) => tab.addEventListener('click', () => goToTab(tab.dataset.view)));

  els.back.addEventListener('click', () => {
    state.pinned = null;
    switchView('library');
  });

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
      goToTab(arr[next].dataset.view);
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
  kpApi.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    const setChange = changes[KeeprNotes.SETTINGS_KEY];
    if (setChange) {
      applyTheme();
      const oldLang = setChange.oldValue && setChange.oldValue.lang;
      const newLang = setChange.newValue && setChange.newValue.lang;
      if (newLang !== oldLang && self.KeeprI18n) {
        await self.KeeprI18n.init(); // recarga el diccionario del nuevo idioma
        self.KeeprI18n.apply(document);
      }
    }

    // ¿Se añadió una nota al video que estamos viendo? → enfocar la nueva al renderizar.
    if (state.view === 'video' && state.notesVideoId) {
      const vc = changes[KeeprNotes.keyFor(state.notesVideoId)];
      if (vc) {
        const before = (vc.oldValue && vc.oldValue.notes && vc.oldValue.notes.length) || 0;
        const after = (vc.newValue && vc.newValue.notes && vc.newValue.notes.length) || 0;
        if (after > before) state.focusNewest = true;
      }
    }

    refreshCounts();

    const editing =
      document.activeElement && document.activeElement.classList.contains('kp-note-text');
    if (editing) {
      state.pendingRerender = true; // se aplicará al perder el foco (ver makeNoteEl)
      return;
    }
    if (state.view === 'library') renderLibrary();
    else renderVideoView();
  });

  // El video activo puede cambiar de pestaña o de URL mientras el panel está abierto.
  kpApi.tabs.onActivated.addListener(() => resolveActiveTab());
  kpApi.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId === state.tabId && (info.url || info.status === 'complete')) resolveActiveTab();
  });

  // Badge con el número de videos guardados en la pestaña Biblioteca.
  async function refreshCounts() {
    try {
      const recs = await KeeprNotes.getAll();
      els.libCount.textContent = recs.length ? String(recs.length) : '';
    } catch {
      els.libCount.textContent = '';
    }
  }

  // ---- arranque ---------------------------------------------------------
  (async () => {
    if (self.KeeprI18n) await self.KeeprI18n.ready; // primer render ya con el idioma resuelto
    applyTheme();
    refreshCounts();
    resolveActiveTab();
  })();
})();
