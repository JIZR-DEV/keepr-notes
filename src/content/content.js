/*
 * Keepr Notes — content script.
 * Inyecta el botón "Nota" en los controles del player, captura el segundo
 * exacto y responde a las órdenes del side panel (contexto / hora / seek).
 *
 * Diseñado para sobrevivir a los rediseños de YouTube:
 *  - selectores con fallback,
 *  - re-inyección vía MutationObserver,
 *  - re-detección del video en navegación SPA (yt-navigate-finish + URL polling).
 */
(function () {
  'use strict';

  const BTN_ID = 'keepr-add-note-btn';
  const SVGNS = 'http://www.w3.org/2000/svg';
  let currentVideoId = null;

  const t = (k, s) => {
    try {
      return (kpApi.i18n && kpApi.i18n.getMessage(k, s)) || k;
    } catch {
      return k;
    }
  };

  // ---- helpers de página -------------------------------------------------

  function parseVideoId() {
    try {
      const u = new URL(location.href);
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null;
      }
      return u.searchParams.get('v');
    } catch {
      return null;
    }
  }

  function getVideoEl() {
    return (
      document.querySelector('video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('video')
    );
  }

  function getTitle() {
    const el =
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('h1.title yt-formatted-string') ||
      document.querySelector('#title h1');
    const t = el && el.textContent && el.textContent.trim();
    if (t) return t;
    return document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
  }

  function getContext() {
    const v = getVideoEl();
    const vid = parseVideoId(); // fresco: evita desincronía con currentVideoId tras nav SPA
    return {
      videoId: vid,
      title: getTitle(),
      url: vid ? KeeprNotes.urlAt(vid, v ? v.currentTime : 0) : location.href,
      currentTime: v ? v.currentTime : 0,
      hasVideo: !!v,
    };
  }

  // ---- toast de confirmación --------------------------------------------

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('keepr-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'keepr-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('keepr-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('keepr-toast--show'), 1800);
  }

  // ---- acción: añadir nota ----------------------------------------------

  let lastAdd = 0;
  async function addNoteNow() {
    const now = Date.now();
    if (now - lastAdd < 400) return null; // evita dobles (commands + keydown)
    lastAdd = now;
    const ctx = getContext();
    if (!ctx.videoId || !ctx.hasVideo) {
      toast(t('noVideoActive'));
      return null;
    }
    currentVideoId = ctx.videoId;
    let defaultColor = '';
    try {
      defaultColor = (await KeeprNotes.getSettings()).defaultColor || '';
    } catch {
      /* settings opcionales */
    }
    const note = await KeeprNotes.addNote(ctx.videoId, {
      t: ctx.currentTime,
      text: '',
      title: ctx.title,
      url: KeeprNotes.urlAt(ctx.videoId, 0),
      color: defaultColor,
    });
    toast(`📌 ${t('noteSavedAt')} ${KeeprNotes.fmtTime(note.t)}`);
    return note;
  }

  // ---- inyección del botón en el player ---------------------------------

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function buildButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'ytp-button keepr-add-btn';
    btn.title = t('addNoteTooltip');
    btn.setAttribute('aria-label', t('addNoteTooltip'));

    const svg = svgEl('svg', { viewBox: '0 0 36 36', width: '100%', height: '100%', 'aria-hidden': 'true' });
    svg.appendChild(
      svgEl('path', {
        d: 'M11 8h11l4 4v16a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
        fill: 'none',
        stroke: '#fff',
        'stroke-width': '1.6',
      })
    );
    svg.appendChild(
      svgEl('path', {
        d: 'M18 15v8M14 19h8',
        stroke: '#fff',
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
      })
    );
    btn.appendChild(svg);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addNoteNow();
    });
    return btn;
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls) return;
    controls.insertBefore(buildButton(), controls.firstChild);
  }

  // ---- observadores: re-inyección + SPA nav -----------------------------

  function refresh() {
    currentVideoId = parseVideoId();
    injectButton();
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) injectButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('yt-navigate-finish', refresh, true);

  // Respaldo: YouTube no siempre dispara el evento; vigila cambios de URL.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      refresh();
    }
  }, 800);

  // Atajo en página Alt+N (fallback instantáneo). El comando configurable de
  // la commands API usa Alt+Shift+N por defecto; el cooldown de addNoteNow
  // evita dobles si el usuario los reasigna a la misma tecla.
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      addNoteNow();
    }
  });

  // ---- canal de mensajes con el side panel ------------------------------

  kpApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Defensa en profundidad: solo aceptar mensajes de la propia extensión.
    if (sender && sender.id && kpApi.runtime && kpApi.runtime.id && sender.id !== kpApi.runtime.id) return;
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'KEEPR_GET_CONTEXT':
        sendResponse(getContext());
        return;
      case 'KEEPR_ADD_NOTE':
        addNoteNow().then((note) => sendResponse({ ok: !!note }));
        return true; // respuesta asíncrona
      case 'KEEPR_SEEK': {
        const v = getVideoEl();
        if (v && typeof msg.t === 'number') {
          v.currentTime = Math.max(0, msg.t);
          if (v.play) v.play().catch(() => {});
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false });
        }
        return;
      }
      default:
        return;
    }
  });

  // ---- arranque ----------------------------------------------------------
  refresh();
})();
