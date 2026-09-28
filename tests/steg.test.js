import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { move } from '../js/simulator2048.js';
import { FORMAT, decodeBoards, encodeMessage } from '../js/steg.js';
import { candidateTransitions, validateTrajectory } from '../js/trajectory.js';
import { normalizeLanguage, resolveInitialLanguage, t } from '../js/i18n.js';

test('classic 2048 merge', () => {
  const result = move([2, 2, 2, 2, 0,0,0,0, 0,0,0,0, 0,0,0,0], 'left');
  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.equal(result.gained, 8);
});

test('transition alphabet is deterministic', () => {
  const board = [2, 4, 8, 16, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  assert.deepEqual(candidateTransitions(board, 12), candidateTransitions(board, 12));
});

test('ASCII round trip', async () => {
  const encoded = await encodeMessage('hello steg2048', 'password-123');
  const decoded = await decodeBoards(encoded.boards, 'password-123');
  assert.equal(decoded.message, 'hello steg2048');
  assert.equal(validateTrajectory(encoded.boards).valid, true);
});

test('Unicode round trip', async () => {
  const message = 'Salut 👾 — été à Paris';
  const encoded = await encodeMessage(message, 'mot-de-passe-solide');
  const decoded = await decodeBoards(encoded.boards, 'mot-de-passe-solide');
  assert.equal(decoded.message, message);
});

test('wrong password is rejected with a stable error code', async () => {
  const encoded = await encodeMessage('secret', 'correct-password');
  await assert.rejects(
    () => decodeBoards(encoded.boards, 'wrong-password'),
    error => error?.code === 'AUTH_FAILED',
  );
});

test('two encodings of the same message differ', async () => {
  const first = await encodeMessage('same text', 'same-password');
  const second = await encodeMessage('same text', 'same-password');
  assert.notDeepEqual(first.boards, second.boards);
});

test('public format identifier is stable', () => {
  assert.equal(FORMAT, 'steg2048-web-v1');
});

test('a modified trajectory is rejected', async () => {
  const encoded = await encodeMessage('integrity check', 'password-123');
  const tampered = encoded.boards.map(board => [...board]);
  const event = encoded.trajectory.events[0];
  tampered[1][event.spawn_index] = event.spawn_value === 2 ? 4 : 2;
  await assert.rejects(
    () => decodeBoards(tampered, 'password-123'),
    error => ['TRANSITION_INVALID', 'TRANSITION_IMPOSSIBLE', 'SIGNATURE_MISSING', 'AUTH_FAILED'].includes(error?.code),
  );
});

test('messages over 96 bytes are rejected', async () => {
  await assert.rejects(
    () => encodeMessage('x'.repeat(97), 'password-123'),
    error => error?.code === 'MESSAGE_TOO_LONG',
  );
});

test('language detection uses French only for fr locales', () => {
  assert.equal(normalizeLanguage('fr-FR'), 'fr');
  assert.equal(normalizeLanguage('fr-CA'), 'fr');
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('de-DE'), 'en');
  assert.equal(normalizeLanguage('ja-JP'), 'en');
});

test('stored manual language overrides browser language', () => {
  assert.equal(resolveInitialLanguage({ storedLanguage: 'en', browserLanguage: 'fr-FR' }), 'en');
  assert.equal(resolveInitialLanguage({ storedLanguage: 'fr', browserLanguage: 'en-US' }), 'fr');
  assert.equal(resolveInitialLanguage({ storedLanguage: null, browserLanguage: 'fr-BE' }), 'fr');
});

test('English and French UI translations are available', () => {
  assert.equal(t('en', 'encode.generate'), 'Generate game');
  assert.equal(t('fr', 'encode.generate'), 'Générer la partie');
  assert.match(t('en', 'errors.PASSWORD_TOO_SHORT', { min: 8 }), /8/);
  assert.match(t('fr', 'errors.PASSWORD_TOO_SHORT', { min: 8 }), /8/);
});

test('decoded output uses an iOS-safe readonly textarea', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(html, /<textarea[^>]+id="decoded"[^>]+readonly/);
  assert.match(app, /renderDecodedMessage\(data\.message\)/);
  assert.doesNotMatch(app, /\$\('decoded'\)\.textContent\s*=\s*data\.message/);
});

test('UI prevents encode/decode crypto operations from overlapping', () => {
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /let operationInProgress = false/);
  assert.match(app, /if \(operationInProgress\) return false/);
  assert.match(app, /\['encodeBtn', 'decodeBtn', 'loadFileBtn'\]/);
});

test('decoder snapshots JSON and password before asynchronous crypto', () => {
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /const jsonSnapshot = \$\('jsonBox'\)\.value/);
  assert.match(app, /const passwordSnapshot = \$\('decodePassword'\)\.value/);
  assert.match(app, /decodeBoards\(parsed\.boards, passwordSnapshot\)/);
});

