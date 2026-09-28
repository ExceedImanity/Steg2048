import { BOARD_CELLS, DIRECTIONS, evaluateBoard, move } from './simulator2048.js';
import { fail } from './errors.js';

export const MAX_CANDIDATES = 8;
export const MAX_TRANSITIONS = 2200;

function randomInt(max) {
  if (!Number.isInteger(max) || max <= 0) fail('RANDOM_BOUND_INVALID');
  const limit = Math.floor(0x100000000 / max) * max;
  const array = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);
  return value % max;
}

export function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_CELLS) {
    fail('BOARD_SIZE_INVALID');
  }
  for (const tile of board) {
    if (!Number.isInteger(tile) || tile < 0) fail('TILE_INVALID', { tile });
    if (tile === 0) continue;
    if (tile < 2 || tile > 65536 || (tile & (tile - 1)) !== 0) {
      fail('TILE_2048_INVALID', { tile });
    }
  }
}

function boardExponents(board) {
  return board.map(value => value === 0 ? 0 : Math.log2(value));
}

// FNV-1a 32-bit. This is only a deterministic cover-game selector, not a cryptographic primitive.
function stableHash(board, stepIndex, spawnIndex, label) {
  let hash = 0x811c9dc5;
  const feed = value => {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const exponent of boardExponents(board)) feed(exponent);
  feed(stepIndex); feed(stepIndex >>> 8); feed(stepIndex >>> 16); feed(stepIndex >>> 24);
  feed(spawnIndex);
  for (let i = 0; i < label.length; i += 1) feed(label.charCodeAt(i));
  return hash >>> 0;
}

export function newCoverGame() {
  const board = Array(BOARD_CELLS).fill(0);
  for (let i = 0; i < 2; i += 1) {
    const empties = board.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0);
    const index = empties[randomInt(empties.length)];
    board[index] = randomInt(10) === 0 ? 4 : 2;
  }
  return board;
}

function bestMove(board) {
  const candidates = [];
  DIRECTIONS.forEach((direction, rank) => {
    const moved = move(board, direction);
    if (moved.changed) {
      candidates.push({
        score: evaluateBoard(moved.board) + 0.002 * moved.gained,
        rank,
        direction,
        board: moved.board,
        gained: moved.gained,
      });
    }
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.rank - b.rank);
  return candidates[0];
}

function powerOfTwoAtMost(value) {
  if (value < 1) return 0;
  let out = 1;
  while (out * 2 <= value) out *= 2;
  return out;
}

function spawnValue(board, stepIndex, spawnIndex) {
  return stableHash(board, stepIndex, spawnIndex, 'spawn-value') % 10 === 0 ? 4 : 2;
}

export function candidateTransitions(board, stepIndex) {
  validateBoard(board);
  const best = bestMove(board);
  if (!best) return [];

  const empties = best.board.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0);
  if (!empties.length) return [];

  const count = Math.max(1, powerOfTwoAtMost(Math.min(MAX_CANDIDATES, empties.length)));
  const selectedPositions = [...empties]
    .sort((a, b) => stableHash(board, stepIndex, a, 'spawn-position') - stableHash(board, stepIndex, b, 'spawn-position') || a - b)
    .slice(0, count);

  return selectedPositions.map(index => {
    const value = spawnValue(board, stepIndex, index);
    const nextBoard = [...best.board];
    nextBoard[index] = value;
    return {
      direction: best.direction,
      spawnIndex: index,
      spawnValue: value,
      board: nextBoard,
      score: evaluateBoard(nextBoard) + 0.002 * best.gained,
      gained: best.gained,
    };
  });
}

function bytesToBits(data) {
  let bits = '';
  for (const byte of data) bits += byte.toString(2).padStart(8, '0');
  return bits;
}

function bitsToBytes(bits) {
  const usable = bits.length - (bits.length % 8);
  const out = new Uint8Array(usable / 8);
  for (let i = 0; i < usable; i += 8) out[i / 8] = Number.parseInt(bits.slice(i, i + 8), 2);
  return out;
}

export function encodePacket(packet, { maxAttempts = 32 } = {}) {
  if (!(packet instanceof Uint8Array) || packet.length === 0) fail('PACKET_EMPTY');
  const bits = bytesToBits(packet);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let board = newCoverGame();
    const boards = [[...board]];
    const events = [];
    let bitOffset = 0;
    let stepIndex = 0;

    while (bitOffset < bits.length && stepIndex < MAX_TRANSITIONS) {
      const candidates = candidateTransitions(board, stepIndex);
      if (candidates.length < 2) break;
      const width = Math.log2(candidates.length);
      let chunk = bits.slice(bitOffset, bitOffset + width);
      if (chunk.length < width) chunk = chunk.padEnd(width, '0');
      const symbol = Number.parseInt(chunk, 2);
      const selected = candidates[symbol];
      board = [...selected.board];
      boards.push(board);
      events.push({
        step: stepIndex + 1,
        direction: selected.direction,
        spawn_index: selected.spawnIndex,
        spawn_value: selected.spawnValue,
        bits: width,
      });
      bitOffset += width;
      stepIndex += 1;
    }

    if (bitOffset >= bits.length) return { boards, events };
  }
  fail('ENCODE_CAPACITY_FAILED');
}

export function decodeBitstream(boards) {
  if (!Array.isArray(boards) || boards.length < 2) fail('TRAJECTORY_TOO_SHORT');
  boards.forEach(validateBoard);

  const chunks = [];
  const events = [];
  for (let stepIndex = 0; stepIndex < boards.length - 1; stepIndex += 1) {
    const current = boards[stepIndex];
    const target = boards[stepIndex + 1];
    const candidates = candidateTransitions(current, stepIndex);
    if (candidates.length < 2) fail('TRANSITION_IMPOSSIBLE', { step: stepIndex + 1 });
    const matches = candidates.map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.board.every((value, i) => value === target[i]));
    if (matches.length !== 1) fail('TRANSITION_INVALID', { step: stepIndex + 1 });

    const { candidate, index } = matches[0];
    const width = Math.log2(candidates.length);
    chunks.push(index.toString(2).padStart(width, '0'));
    events.push({
      step: stepIndex + 1,
      direction: candidate.direction,
      spawn_index: candidate.spawnIndex,
      spawn_value: candidate.spawnValue,
      bits: width,
    });
  }
  return { bits: chunks.join(''), events };
}

export function decodePacket(boards, { headerBytes, expectedMagic, lengthOffset, lengthBytes }) {
  const decoded = decodeBitstream(boards);
  if (decoded.bits.length < headerBytes * 8) fail('HEADER_TOO_SHORT');
  const raw = bitsToBytes(decoded.bits);
  for (let i = 0; i < expectedMagic.length; i += 1) {
    if (raw[i] !== expectedMagic[i]) fail('SIGNATURE_MISSING');
  }
  if (raw.length < lengthOffset + lengthBytes) fail('HEADER_INCOMPLETE');
  let ciphertextLen = 0;
  for (let i = 0; i < lengthBytes; i += 1) ciphertextLen = (ciphertextLen << 8) | raw[lengthOffset + i];
  const totalBytes = headerBytes + ciphertextLen;
  if (decoded.bits.length < totalBytes * 8) fail('TRAJECTORY_INCOMPLETE');
  return { raw: bitsToBytes(decoded.bits.slice(0, totalBytes * 8)), events: decoded.events };
}

export function validateTrajectory(boards) {
  const decoded = decodeBitstream(boards);
  const moveCounts = Object.fromEntries(DIRECTIONS.map(direction => [direction, 0]));
  const spawnCounts = { 2: 0, 4: 0 };
  let payloadBits = 0;
  for (const event of decoded.events) {
    moveCounts[event.direction] += 1;
    spawnCounts[event.spawn_value] += 1;
    payloadBits += event.bits;
  }
  const transitions = decoded.events.length;
  return {
    valid: true,
    boards: boards.length,
    transitions,
    payload_bits: payloadBits,
    average_bits_per_transition: transitions ? Number((payloadBits / transitions).toFixed(3)) : 0,
    moves: moveCounts,
    spawns: { '2': spawnCounts[2], '4': spawnCounts[4] },
    spawn_4_ratio: transitions ? Number((spawnCounts[4] / transitions).toFixed(4)) : 0,
    max_tile: Math.max(...boards.flat()),
    events: decoded.events,
  };
}
