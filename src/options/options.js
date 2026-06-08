/*
 * Keepr Notes — página de opciones.
 * Lee/escribe preferencias (tema, color por defecto) y ofrece backup/restore.
 */
(function () {
  'use strict';

  const t = (k, s) => (self.KeeprI18n ? self.KeeprI18n.t(k, s) : k);
  const $ = (s) => document.querySelector(s);
  const PALETTE = KeeprNotes.PALETTE;

  const els = {
    theme: $('#theme'),
    palette: $('#palette'),
    backup: $('#backup'),
    restore: $('#restore'),
    file: $('#file-restore'),
    version: $('#version'),
    status: $('#o-status'),
  };

  let statusTimer = null;
  function status(msg) {
    els.status.textContent = msg;
    els.status.classList.add('o-status--show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => els.status.classList.remove('o-status--show'), 1700);
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

  function renderPalette(selected) {
    els.palette.replaceChildren();
    for (const c of PALETTE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'o-swatch' + (c ? '' : ' o-swatch--none');
      if (c) b.style.background = c;
      b.classList.toggle('o-swatch--active', c === selected);
      b.setAttribute('aria-label', c || t('optColorNone'));
      b.title = c || t('optColorNone');
      b.addEventListener('click', async () => {
        await KeeprNotes.setSettings({ defaultColor: c });
        renderPalette(c);
        status(t('optSaved'));
      });
      els.palette.appendChild(b);
    }
  }

  async function init() {
    const s = await KeeprNotes.getSettings();
    els.theme.value = s.theme || 'auto';
    renderPalette(s.defaultColor || '');

    try {
      const manifest = kpApi.runtime.getManifest();
      els.version.textContent = 'v' + manifest.version;
    } catch {
      /* sin versión */
    }

    els.theme.addEventListener('change', async () => {
      await KeeprNotes.setSettings({ theme: els.theme.value });
      status(t('optSaved'));
    });

    els.backup.addEventListener('click', async () => {
      const data = await KeeprNotes.exportAll();
      if (!data.videos.length) return status(t('nothingToBackup'));
      const stamp = new Date().toISOString().slice(0, 10);
      download(`keepr-notes-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
      status(t('backupDownloaded'));
    });

    els.restore.addEventListener('click', () => els.file.click());
    els.file.addEventListener('change', async () => {
      const f = els.file.files && els.file.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const added = await KeeprNotes.importAll(data, 'merge');
        status(`${t('restoredPrefix')} ${added} ${t('notePlural')}`);
      } catch {
        status(t('invalidBackup'));
      } finally {
        els.file.value = '';
      }
    });
  }

  init();
})();
