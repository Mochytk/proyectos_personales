const fs = require('fs');

const DEFAULT_SIZE = { width: 1200, height: 800 };
const MIN_SIZE = { width: 480, height: 480 };
// How much of the window must be on a screen for the saved position to be trusted.
const MIN_VISIBLE = 100;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function overlaps(bounds, area) {
  const w = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  const h = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
  return w >= MIN_VISIBLE && h >= MIN_VISIBLE;
}

/**
 * Decides the bounds for a new window from the saved state. The size is always kept (within
 * limits); the position is dropped when it would put the window off every connected display
 * (e.g. an external monitor that is no longer plugged in), so the OS centers it instead.
 */
function restoreBounds(saved, workAreas) {
  const bounds = { ...DEFAULT_SIZE };
  if (!saved || !isNum(saved.width) || !isNum(saved.height)) return bounds;

  bounds.width = Math.max(MIN_SIZE.width, Math.round(saved.width));
  bounds.height = Math.max(MIN_SIZE.height, Math.round(saved.height));

  if (isNum(saved.x) && isNum(saved.y)) {
    const candidate = { x: Math.round(saved.x), y: Math.round(saved.y), width: bounds.width, height: bounds.height };
    if (workAreas.some((area) => overlaps(candidate, area))) {
      bounds.x = candidate.x;
      bounds.y = candidate.y;
    }
  }
  return bounds;
}

function loadWindowState(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...data, isMaximized: data.isMaximized === true };
  } catch {
    return null;
  }
}

function saveWindowState(file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state));
  } catch {
    // Losing the window position is not worth interrupting the user.
  }
}

module.exports = { restoreBounds, loadWindowState, saveWindowState, DEFAULT_SIZE, MIN_SIZE };
