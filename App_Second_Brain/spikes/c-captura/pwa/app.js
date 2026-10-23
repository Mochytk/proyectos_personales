// Spike C: what can a home-screen web app do on this iPhone? Throwaway code, never merged.
// Nothing leaves the device: no fetch calls, only local storage (IndexedDB) and the clipboard on request.

const TYPES = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/wav'];
const PREFERRED = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
const DB_NAME = 'sb-spike-c';
const MAX_RANDOM_CHUNK = 65_536;

const $ = (id) => document.getElementById(id);
const results = { spike: 'C', version: 1, attempts: [] };
const context = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true ? 'pantalla-de-inicio' : 'safari';

// ---------- IndexedDB ----------

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys');
      request.result.createObjectStore('queue', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(store, mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = run(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------- keys: a non-extractable CryptoKey stored in IndexedDB ----------

async function loadOrCreateKey() {
  const saved = await tx('keys', 'readonly', (store) => store.get('k_enc'));
  if (saved) return { ...saved, fromPreviousVisit: true };
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const record = { key, createdIn: context, createdAt: new Date().toISOString() };
  await tx('keys', 'readwrite', (store) => store.put(record, 'k_enc'));
  return { ...record, fromPreviousVisit: false };
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += MAX_RANDOM_CHUNK) {
    crypto.getRandomValues(out.subarray(offset, Math.min(length, offset + MAX_RANDOM_CHUNK)));
  }
  return out;
}

async function encryptRoundTrip(key, bytes) {
  const started = performance.now();
  const iv = randomBytes(12);
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  const opened = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed));
  const same = opened.length === bytes.length && opened.every((value, i) => value === bytes[i]);
  return { ok: same, ms: Math.round(performance.now() - started), sealedBytes: sealed.byteLength };
}

// ---------- diagnosis ----------

async function microphoneState() {
  try {
    return (await navigator.permissions.query({ name: 'microphone' })).state;
  } catch {
    return 'sin-api';
  }
}

async function diagnose() {
  results.context = context;
  results.userAgent = navigator.userAgent;
  results.online = navigator.onLine;
  results.serviceWorker = Boolean(navigator.serviceWorker?.controller);
  results.mediaRecorder = 'MediaRecorder' in window;
  results.types = Object.fromEntries(TYPES.map((type) => [type, Boolean(window.MediaRecorder?.isTypeSupported?.(type))]));
  results.microphonePermission = await microphoneState();
  results.persisted = (await navigator.storage?.persisted?.()) ?? 'sin-api';
  const estimate = await navigator.storage?.estimate?.();
  results.storageMB = estimate ? { quota: Math.round(estimate.quota / 2 ** 20), usage: Math.round(estimate.usage / 2 ** 20) } : 'sin-api';
  try {
    crypto.getRandomValues(new Uint8Array(MAX_RANDOM_CHUNK + 1));
    results.randomOver64KiB = 'permitido';
  } catch (error) {
    results.randomOver64KiB = `rechazado (${error.name})`;
  }
  const key = await loadOrCreateKey();
  results.key = {
    fromPreviousVisit: key.fromPreviousVisit,
    createdIn: key.createdIn,
    extractable: key.key.extractable,
    algorithm: key.key.algorithm.name,
  };
  results.queue = await tx('queue', 'readonly', (store) => store.count());
  render();
  return key.key;
}

function render() {
  $('resultados').textContent = JSON.stringify(results, null, 2);
}

// ---------- recording ----------

let recorder = null;
let chunks = [];
let attempt = null;

function mediaDuration(url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 10) / 10 : null);
    audio.onerror = () => resolve(null);
    audio.src = url;
  });
}

async function start(key) {
  attempt = { tappedAt: performance.now(), sinceOpenMs: Math.round(performance.now()) };
  $('rec-estado').textContent = 'Pidiendo el micrófono…';
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    attempt.error = error.name;
    results.attempts.push(attempt);
    $('rec-estado').textContent = `No se pudo usar el micrófono (${error.name}).`;
    render();
    return;
  }
  attempt.micReadyMs = Math.round(performance.now() - attempt.tappedAt);
  const mimeType = PREFERRED.find((type) => MediaRecorder.isTypeSupported(type));
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
  recorder.onstop = () => finish(key, stream);
  recorder.start(1000);
  attempt.startedAt = performance.now();
  $('rec').textContent = 'Detener';
  $('rec-estado').textContent = 'Grabando… (prueba también bloquear la pantalla unos segundos)';
}

async function finish(key, stream) {
  stream.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const url = URL.createObjectURL(blob);
  attempt.mimeType = recorder.mimeType;
  attempt.wallSeconds = Math.round((performance.now() - attempt.startedAt) / 100) / 10;
  attempt.mediaSeconds = await mediaDuration(url);
  attempt.bytes = blob.size;
  attempt.kbps = attempt.mediaSeconds ? Math.round((blob.size * 8) / 1000 / attempt.mediaSeconds) : null;
  attempt.promptShown = document.querySelector('input[name="aviso"]:checked')?.value ?? 'sin-responder';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  attempt.encryption = await encryptRoundTrip(key, bytes);
  await tx('queue', 'readwrite', (store) =>
    store.put({ id: crypto.randomUUID(), mimeType: blob.type, bytes: blob.size, createdAt: new Date().toISOString(), blob }),
  );
  delete attempt.tappedAt;
  delete attempt.startedAt;
  results.attempts.push(attempt);
  results.queue = await tx('queue', 'readonly', (store) => store.count());
  $('reproductor').src = url;
  $('reproductor').hidden = false;
  $('rec').textContent = 'Grabar';
  $('rec-estado').textContent = `Listo: ${attempt.mediaSeconds ?? '?'} s, ${Math.round(blob.size / 1024)} KB (${attempt.mimeType}).`;
  recorder = null;
  render();
}

// ---------- wiring ----------

async function main() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const key = await diagnose();
  $('rec').addEventListener('click', () => (recorder ? recorder.stop() : start(key)));
  $('persistir').addEventListener('click', async () => {
    results.persistRequest = (await navigator.storage?.persist?.()) ?? 'sin-api';
    results.persisted = (await navigator.storage?.persisted?.()) ?? 'sin-api';
    render();
  });
  $('copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
      $('copiar-estado').textContent = 'Copiado. Pégamelo en el chat.';
    } catch {
      $('copiar-estado').textContent = 'No se pudo copiar; selecciona el texto de abajo y cópialo a mano.';
    }
  });
}

main().catch((error) => {
  $('resultados').textContent = `Error: ${error.name}`;
});
