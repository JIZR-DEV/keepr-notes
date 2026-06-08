/*
 * Keepr Notes — background (service worker en Chrome, event page en Firefox).
 * Responsabilidades:
 *  - Abrir el panel/sidebar al pulsar el icono de la barra (API distinta por navegador).
 *  - Atender el atajo de teclado configurable (commands API) para añadir nota.
 * Toda la lógica de datos vive en lib/notes.js.
 */
const api = globalThis.browser || globalThis.chrome;

// --- Abrir el panel lateral según el navegador -------------------------
// Chrome/Edge: el click en el icono abre el side panel.
// Firefox: el sidebar se abre con su propio botón nativo (sidebar_action), por
// eso allí no declaramos 'action' ni enganchamos onClicked (evita el doble botón).
if (api.sidePanel && api.sidePanel.setPanelBehavior) {
  const enable = () =>
    api.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  api.runtime.onInstalled.addListener(enable);
  enable();
}

// --- Onboarding: abrir la bienvenida en la primera instalación ---------
api.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === 'install') {
    const url = api.runtime.getURL('welcome/welcome.html');
    api.tabs.create({ url }).catch(() => {});
  }
});

// --- Atajo de teclado: añadir nota en la pestaña activa ----------------
if (api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener(async (command) => {
    if (command !== 'add-note') return;
    try {
      const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && tab.id != null) {
        await api.tabs.sendMessage(tab.id, { type: 'KEEPR_ADD_NOTE' }).catch(() => {});
      }
    } catch (e) {
      console.warn('[Keepr] command add-note:', e);
    }
  });
}
