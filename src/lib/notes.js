/*
 * Keepr Notes — capa de datos compartida (content script + side panel).
 *
 * Filosofía: local-first. Todo vive en kpApi.storage.local, sin servidor.
 * Esquema por video:
 *   key  = "keepr_v_<videoId>"
 *   value = {
 *     videoId: string,
 *     title:   string,        // título del video al momento de la 1ª nota
 *     url:     string,        // watch URL canónica
 *     updated: number,        // epoch ms de la última modificación
 *     notes:   Note[]
 *   }
 *   Note = { id, t, text, created, updated }   // t = segundos (float)
 *
 * Sin sintaxis de módulos ES para poder cargarse como content script clásico
 * y como <script> en el side panel. Expone el namespace global KeeprNotes.
 * Usa kpApi (definido en compat.js) para funcionar en Chrome y Firefox.
 */
(function (global) {
  'use strict';

  const PREFIX = 'keepr_v_';
  const keyFor = (videoId) => PREFIX + videoId;

  // Paleta de colores compartida (panel + ajustes). '' = sin color.
  const PALETTE = ['', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];

  /** Solo devuelve la url si es http(s); si no, el fallback. Evita javascript: y otros esquemas. */
  function safeHttpUrl(url, fallback) {
    return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : fallback;
  }

  function uid() {
    return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** Segundos -> "h:mm:ss" o "m:ss". */
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  /** URL del video saltando al segundo exacto. */
  function urlAt(videoId, t) {
    return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(t || 0)}s`;
  }

  async function getVideo(videoId) {
    if (!videoId) return null;
    const k = keyFor(videoId);
    const out = await kpApi.storage.local.get(k);
    return out[k] || null;
  }

  async function getAll() {
    const all = await kpApi.storage.local.get(null);
    const records = [];
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(PREFIX) && v && Array.isArray(v.notes)) records.push(v);
    }
    records.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return records;
  }

  async function saveVideo(rec, { touch = true } = {}) {
    if (touch || !rec.updated) rec.updated = Date.now();
    await kpApi.storage.local.set({ [keyFor(rec.videoId)]: rec });
    return rec;
  }

  async function addNote(videoId, { t, text, title, url, color }) {
    const rec = (await getVideo(videoId)) || {
      videoId,
      title: title || '',
      url: url || urlAt(videoId, 0),
      notes: [],
    };
    if (title && !rec.title) rec.title = title;
    if (url) rec.url = url;
    const now = Date.now();
    const note = {
      id: uid(),
      t: Math.max(0, t || 0),
      text: text || '',
      color: color || '',
      tags: [],
      created: now,
      updated: now,
    };
    rec.notes.push(note);
    await saveVideo(rec);
    return note;
  }

  async function updateNote(videoId, noteId, patch) {
    const rec = await getVideo(videoId);
    if (!rec) return null;
    const note = rec.notes.find((n) => n.id === noteId);
    if (!note) return null;
    if (typeof patch.text === 'string') note.text = patch.text;
    if (typeof patch.t === 'number') note.t = Math.max(0, patch.t);
    if (typeof patch.color === 'string') note.color = patch.color;
    if (Array.isArray(patch.tags)) note.tags = patch.tags;
    note.updated = Date.now();
    await saveVideo(rec);
    return note;
  }

  /**
   * Busca texto en las notas de TODOS los videos.
   * Devuelve [{ videoId, title, url, note }] ordenado por relevancia simple.
   */
  async function searchAll(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const recs = await getAll();
    const hits = [];
    for (const rec of recs) {
      for (const n of rec.notes) {
        const inText = (n.text || '').toLowerCase().includes(q);
        const inTags = (n.tags || []).some((tg) => tg.toLowerCase().includes(q));
        if (inText || inTags) {
          hits.push({ videoId: rec.videoId, title: rec.title || rec.videoId, url: rec.url, note: n });
        }
      }
    }
    return hits;
  }

  async function deleteNote(videoId, noteId) {
    const rec = await getVideo(videoId);
    if (!rec) return false;
    const before = rec.notes.length;
    rec.notes = rec.notes.filter((n) => n.id !== noteId);
    if (rec.notes.length === before) return false;
    if (rec.notes.length === 0) {
      await kpApi.storage.local.remove(keyFor(videoId));
    } else {
      await saveVideo(rec);
    }
    return true;
  }

  /** Markdown de un video con timestamps clicables. */
  function toMarkdown(rec) {
    const lines = [];
    lines.push(`# ${rec.title || rec.videoId}`);
    lines.push('');
    lines.push(`Fuente: ${rec.url || urlAt(rec.videoId, 0)}`);
    lines.push('');
    const sorted = rec.notes.slice().sort((a, b) => a.t - b.t);
    for (const n of sorted) {
      const text = (n.text || '').replace(/\n+/g, ' ').trim();
      lines.push(`- [${fmtTime(n.t)}](${urlAt(rec.videoId, n.t)}) ${text}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  /** Backup completo: { schema, exportedAt, videos: [...] }. */
  async function exportAll() {
    return {
      schema: 'keepr-notes/v1',
      exportedAt: new Date().toISOString(),
      videos: await getAll(),
    };
  }

  /**
   * Restaura un backup. mode "merge" conserva lo existente y une notas por id;
   * mode "replace" sobrescribe cada video presente en el backup.
   */
  async function importAll(data, mode = 'merge') {
    if (!data || !Array.isArray(data.videos)) throw new Error('Backup inválido');
    let added = 0;
    for (const inc of data.videos) {
      if (!inc || !inc.videoId || !Array.isArray(inc.notes)) continue;
      if (mode === 'replace') {
        const clean = { ...inc, url: safeHttpUrl(inc.url, urlAt(inc.videoId, 0)) };
        await saveVideo(clean, { touch: false }); // conserva el orden cronológico original
        added += inc.notes.length;
        continue;
      }
      const cur = (await getVideo(inc.videoId)) || {
        videoId: inc.videoId,
        title: inc.title,
        url: safeHttpUrl(inc.url, urlAt(inc.videoId, 0)),
        notes: [],
      };
      const seen = new Set(cur.notes.map((n) => n.id));
      for (const n of inc.notes) {
        if (!seen.has(n.id)) {
          cur.notes.push(n);
          seen.add(n.id);
          added++;
        }
      }
      if (inc.title && !cur.title) cur.title = inc.title;
      if (inc.url && !cur.url) cur.url = inc.url;
      cur.url = safeHttpUrl(cur.url, urlAt(inc.videoId, 0));
      cur.updated = Math.max(cur.updated || 0, inc.updated || 0) || undefined;
      await saveVideo(cur, { touch: false }); // no reordena la biblioteca al restaurar
    }
    return added;
  }

  // ---- Preferencias del usuario (no son notas) --------------------------
  const SETTINGS_KEY = 'keepr_settings';
  const DEFAULT_SETTINGS = { theme: 'auto', defaultColor: '' };

  async function getSettings() {
    const out = await kpApi.storage.local.get(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, out[SETTINGS_KEY] || {});
  }

  async function setSettings(patch) {
    const next = Object.assign(await getSettings(), patch);
    await kpApi.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  }

  global.KeeprNotes = {
    PREFIX,
    SETTINGS_KEY,
    PALETTE,
    keyFor,
    fmtTime,
    urlAt,
    safeHttpUrl,
    getVideo,
    getAll,
    addNote,
    updateNote,
    deleteNote,
    searchAll,
    toMarkdown,
    exportAll,
    importAll,
    getSettings,
    setSettings,
  };
})(self);
