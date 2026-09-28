import { FORMAT, MAX_MESSAGE_BYTES, MIN_PASSWORD_CHARS, PBKDF2_ITERATIONS, decodeBoards, encodeMessage } from './steg.js';
import { LANGUAGE_STORAGE_KEY, resolveInitialLanguage, t } from './i18n.js';

let currentPayload = null;
let currentBoards = null;
let currentTrajectory = null;
let currentLanguage = resolveInitialLanguage({
  storedLanguage: readStoredLanguage(),
  browserLanguage: navigator.languages?.[0] || navigator.language || 'en',
});

const $ = id => document.getElementById(id);

function readStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The app still works when storage is unavailable (private/sandboxed contexts).
  }
}

function bytesLength(text) {
  return new TextEncoder().encode(text).length;
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(currentLanguage === 'fr' ? 'fr-FR' : 'en-US', options).format(value);
}

function fillBoard(root, board) {
  root.innerHTML = '';
  board.forEach(value => {
    const tile = document.createElement('div');
    tile.className = `tile ${value ? `tile-${Math.min(value, 2048)}` : 'tile-empty'}`;
    tile.textContent = value || '';
    root.appendChild(tile);
  });
}

function formatError(error, fallbackKey) {
  if (error?.code) {
    const key = `errors.${error.code}`;
    const translated = t(currentLanguage, key, error.params || {});
    if (translated !== key) return translated;
  }
  return t(currentLanguage, fallbackKey);
}

function updateStaticTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t(currentLanguage, 'meta.title');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t(currentLanguage, 'meta.description'));

  const header = document.querySelector('header');
  if (header) header.dataset.localLabel = t(currentLanguage, 'header.localLab');

  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(currentLanguage, element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    element.innerHTML = t(currentLanguage, element.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.setAttribute('placeholder', t(currentLanguage, element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', t(currentLanguage, element.dataset.i18nAriaLabel));
  });

  const languageToggle = $('languageToggle');
  const targetLanguage = currentLanguage === 'fr' ? 'en' : 'fr';
  const switchKey = targetLanguage === 'fr' ? 'language.switchToFrench' : 'language.switchToEnglish';
  languageToggle.textContent = `🌐 ${targetLanguage.toUpperCase()}`;
  languageToggle.setAttribute('aria-label', t(currentLanguage, switchKey));
  languageToggle.setAttribute('title', t(currentLanguage, switchKey));

  $('messageLimit').textContent = formatNumber(MAX_MESSAGE_BYTES);

  // These elements are recreated by translated HTML strings, so populate them after translation.
  const passwordMinimum = $('passwordMinimum');
  if (passwordMinimum) passwordMinimum.textContent = formatNumber(MIN_PASSWORD_CHARS);
  const pbkdfIterations = $('pbkdfIterations');
  if (pbkdfIterations) pbkdfIterations.textContent = formatNumber(PBKDF2_ITERATIONS);
  const formatName = $('formatName');
  if (formatName) formatName.textContent = FORMAT;

  refreshPasswordButtons();
  refreshDynamicViews();
}

function setLanguage(language, persist = true) {
  currentLanguage = language === 'fr' ? 'fr' : 'en';
  if (persist) storeLanguage(currentLanguage);
  updateStaticTranslations();
}

function renderTrajectory(boards, trajectory, stepIndex = 0) {
  currentBoards = boards;
  currentTrajectory = trajectory;
  $('trajectorySummary').innerHTML = `
    <div><strong>${formatNumber(trajectory.transitions)}</strong><span>${t(currentLanguage, 'trajectory.transitions')}</span></div>
    <div><strong>${formatNumber(trajectory.average_bits_per_transition, { maximumFractionDigits: 3 })}</strong><span>${t(currentLanguage, 'trajectory.bitsPerMove')}</span></div>
    <div><strong>${formatNumber(trajectory.max_tile)}</strong><span>${t(currentLanguage, 'trajectory.maxTile')}</span></div>`;

  const range = $('stepRange');
  range.min = 0;
  range.max = Math.max(0, boards.length - 1);
  range.value = Math.max(0, Math.min(Number(stepIndex), boards.length - 1));
  showStep(range.value);
  $('trajectorySection').classList.remove('hidden');
}

function showStep(index) {
  if (!currentBoards?.length) return;
  index = Math.max(0, Math.min(Number(index), currentBoards.length - 1));
  $('stepRange').value = index;
  fillBoard($('playerBoard'), currentBoards[index]);
  $('stepCounter').textContent = `${formatNumber(index + 1)} / ${formatNumber(currentBoards.length)}`;
  $('stepTitle').textContent = index === 0
    ? t(currentLanguage, 'trajectory.initialBoard')
    : t(currentLanguage, 'trajectory.afterMove', { index: formatNumber(index) });

  const event = index > 0 ? currentTrajectory?.events?.[index - 1] : null;
  $('stepEvent').innerHTML = event
    ? t(currentLanguage, 'trajectory.event', {
      direction: t(currentLanguage, `direction.${event.direction}`),
      spawnValue: event.spawn_value,
      cell: formatNumber(event.spawn_index + 1),
      bits: formatNumber(event.bits),
    })
    : t(currentLanguage, 'trajectory.initialEvent');
}

function refreshPasswordButtons() {
  document.querySelectorAll('[data-toggle]').forEach(button => {
    const input = $(button.dataset.toggle);
    button.textContent = t(currentLanguage, input?.type === 'text' ? 'common.hide' : 'common.show');
  });
}

function refreshDynamicViews() {
  if (currentBoards && currentTrajectory) {
    const currentStep = Number($('stepRange').value || 0);
    renderTrajectory(currentBoards, currentTrajectory, currentStep);
  } else {
    $('stepTitle').textContent = t(currentLanguage, 'trajectory.initialBoard');
    $('stepEvent').textContent = t(currentLanguage, 'trajectory.initialEvent');
  }
}

function setBusy(button, busy, busyKey, idleKey) {
  button.disabled = busy;
  button.textContent = t(currentLanguage, busy ? busyKey : idleKey);
  document.body.classList.toggle('busy', busy);
}

async function encode() {
  const button = $('encodeBtn');
  $('encodeError').textContent = '';
  const message = $('message').value;
  const password = $('password').value;
  if (bytesLength(message) > MAX_MESSAGE_BYTES) {
    $('encodeError').textContent = t(currentLanguage, 'errors.MESSAGE_TOO_LONG', { max: MAX_MESSAGE_BYTES });
    return;
  }
  setBusy(button, true, 'encode.generating', 'encode.generate');
  try {
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    const data = await encodeMessage(message, password);
    currentPayload = { format: FORMAT, boards: data.boards };
    $('jsonBox').value = JSON.stringify(currentPayload, null, 2);
    $('downloadBtn').disabled = false;
    renderTrajectory(data.boards, data.trajectory);
  } catch (error) {
    $('encodeError').textContent = formatError(error, 'errors.ENCODE_GENERIC');
  } finally {
    setBusy(button, false, 'encode.generating', 'encode.generate');
  }
}

async function decode() {
  const button = $('decodeBtn');
  $('decodeError').textContent = '';
  setBusy(button, true, 'decode.decrypting', 'decode.decrypt');
  try {
    const parsed = JSON.parse($('jsonBox').value);
    if (!parsed || parsed.format !== FORMAT || !Array.isArray(parsed.boards)) {
      $('decodeError').textContent = t(currentLanguage, 'errors.JSON_FORMAT_INVALID', { format: FORMAT });
      return;
    }
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    const data = await decodeBoards(parsed.boards, $('decodePassword').value);
    $('decoded').textContent = data.message;
    renderTrajectory(parsed.boards, data.trajectory);
  } catch (error) {
    $('decodeError').textContent = error instanceof SyntaxError
      ? t(currentLanguage, 'errors.JSON_INVALID')
      : formatError(error, 'errors.DECODE_GENERIC');
  } finally {
    setBusy(button, false, 'decode.decrypting', 'decode.decrypt');
  }
}

function downloadJson() {
  if (!currentPayload) return;
  const blob = new Blob([JSON.stringify(currentPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'steg2048.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function activateTab(name, updateHash = true) {
  const about = name === 'about';
  $('toolView').classList.toggle('hidden', about);
  $('aboutView').classList.toggle('hidden', !about);
  document.querySelectorAll('[data-tab]').forEach(button => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  if (updateHash) history.replaceState(null, '', about ? '#about' : '#tool');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('message').addEventListener('input', event => {
  const count = bytesLength(event.target.value);
  $('messageBytes').textContent = formatNumber(count);
  $('messageBytes').classList.toggle('over-limit', count > MAX_MESSAGE_BYTES);
});
$('encodeBtn').addEventListener('click', encode);
$('decodeBtn').addEventListener('click', decode);
$('downloadBtn').addEventListener('click', downloadJson);
$('stepRange').addEventListener('input', event => showStep(event.target.value));
$('prevBtn').addEventListener('click', () => showStep(Number($('stepRange').value) - 1));
$('nextBtn').addEventListener('click', () => showStep(Number($('stepRange').value) + 1));
$('loadFileBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (file) $('jsonBox').value = await file.text();
});

$('languageToggle').addEventListener('click', () => {
  setLanguage(currentLanguage === 'fr' ? 'en' : 'fr', true);
});

document.querySelectorAll('[data-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    input.type = input.type === 'text' ? 'password' : 'text';
    refreshPasswordButtons();
  });
});

document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});
window.addEventListener('hashchange', () => activateTab(location.hash === '#about' ? 'about' : 'tool', false));

setLanguage(currentLanguage, false);
activateTab(location.hash === '#about' ? 'about' : 'tool', false);
