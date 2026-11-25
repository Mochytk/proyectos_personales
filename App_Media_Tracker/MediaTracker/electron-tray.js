// Menu bar icon: what its menu shows, how the page's data is cleaned before use, and when closing
// the window should only hide it. Everything here is pure so it can be tested without Electron.

const MAX_ENTRIES = 8;
const MAX_TEXT = 80;
const MAX_ID = 100;

/** Cuts text to `max` characters, ending in "…", without splitting an emoji or an accented letter. */
function truncate(text, max) {
  const parts = typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (p) => p.segment)
    : Array.from(text);
  return parts.length <= max ? text : `${parts.slice(0, max - 1).join('')}…`;
}

/**
 * The page sends the menu's text; the main process does not trust its shape. Anything that is not
 * a snapshot becomes an empty one, bad entries are dropped, and every text is capped.
 */
function sanitizeSnapshot(raw) {
  const empty = { entries: [], hasMore: false };
  if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.entries)) return empty;
  const entries = [];
  for (const e of raw.entries) {
    if (typeof e !== 'object' || e === null) continue;
    if (typeof e.id !== 'string' || !e.id || typeof e.title !== 'string' || typeof e.label !== 'string') continue;
    entries.push({
      id: e.id.slice(0, MAX_ID),
      title: truncate(e.title, MAX_TEXT),
      label: truncate(e.label, MAX_TEXT),
      ...(typeof e.advanceLabel === 'string' && e.advanceLabel ? { advanceLabel: truncate(e.advanceLabel, MAX_TEXT) } : {}),
    });
    if (entries.length === MAX_ENTRIES) break;
  }
  return { entries, hasMore: raw.hasMore === true };
}

/** Menu template for the icon. `handlers`: onAdvance(id), onOpen(id), onOpenEnjoying(), onShow(), onQuit(). */
function buildTrayTemplate(snapshot, handlers) {
  const items = [{ label: 'Disfrutando', enabled: false }];

  if (snapshot.entries.length === 0) {
    items.push({ label: 'Nada en curso', enabled: false });
  } else {
    for (const entry of snapshot.entries) {
      const submenu = [];
      if (entry.advanceLabel) submenu.push({ label: entry.advanceLabel, click: () => handlers.onAdvance(entry.id) });
      submenu.push({ label: 'Abrir detalle', click: () => handlers.onOpen(entry.id) });
      items.push({ label: `${entry.title} — ${entry.label}`, submenu });
    }
  }
  if (snapshot.hasMore) items.push({ label: 'Ver todo…', click: () => handlers.onOpenEnjoying() });

  items.push(
    { type: 'separator' },
    { label: 'Abrir Media Tracker', click: () => handlers.onShow() },
    { label: 'Salir de Media Tracker', click: () => handlers.onQuit() },
  );
  return items;
}

/** On macOS closing the window hides it so the app (and this icon) keeps working; quitting is real. */
function shouldHideOnClose({ platform, quitting }) {
  return platform === 'darwin' && !quitting;
}

module.exports = { buildTrayTemplate, sanitizeSnapshot, shouldHideOnClose, MAX_ENTRIES, MAX_TEXT };
