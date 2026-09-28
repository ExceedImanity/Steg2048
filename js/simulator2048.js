import { fail } from './errors.js';

export const BOARD_SIZE = 4;
export const BOARD_CELLS = 16;
export const DIRECTIONS = ['left', 'right', 'up', 'down'];

function mergeLine(line) {
  const values = line.filter(Boolean);
  const out = [];
  let gained = 0;
  let index = 0;
  while (index < values.length) {
    if (index + 1 < values.length && values[index] === values[index + 1]) {
      const merged = values[index] * 2;
      out.push(merged);
      gained += merged;
      index += 2;
    } else {
      out.push(values[index]);
      index += 1;
    }
  }
  while (out.length < BOARD_SIZE) out.push(0);
  return { line: out, gained };
}

function rows(board) {
  if (!Array.isArray(board) || board.length !== BOARD_CELLS) {
    fail('GAME_BOARD_SIZE_INVALID');
  }
  return [0, 4, 8, 12].map(i => board.slice(i, i + 4));
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map(row => row[column]));
}

export function move(board, direction) {
  if (!DIRECTIONS.includes(direction)) fail('DIRECTION_UNKNOWN', { direction });

  const sourceRows = rows([...board]);
  const transposed = direction === 'up' || direction === 'down';
  const reversedLines = direction === 'right' || direction === 'down';
  const work = transposed ? transpose(sourceRows) : sourceRows;

  let gained = 0;
  let result = work.map(line => {
    const source = reversedLines ? [...line].reverse() : [...line];
    const merged = mergeLine(source);
    gained += merged.gained;
    return reversedLines ? merged.line.reverse() : merged.line;
  });

  if (transposed) result = transpose(result);
  const flat = result.flat();
  const changed = flat.some((value, i) => value !== board[i]);
  return { board: flat, changed, gained };
}

function exponents(board) {
  return board.map(value => value === 0 ? 0 : Math.log2(value));
}

function smoothness(board) {
  const exp = exponents(board);
  let penalty = 0;
  let edges = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const here = exp[row * 4 + col];
      if (!here) continue;
      if (col < 3) {
        const other = exp[row * 4 + col + 1];
        if (other) { penalty += Math.abs(here - other); edges += 1; }
      }
      if (row < 3) {
        const other = exp[(row + 1) * 4 + col];
        if (other) { penalty += Math.abs(here - other); edges += 1; }
      }
    }
  }
  return penalty / Math.max(1, edges);
}

function monotonicity(board) {
  const exp = exponents(board);
  const lines = [];
  for (let row = 0; row < 4; row += 1) lines.push(exp.slice(row * 4, row * 4 + 4));
  for (let col = 0; col < 4; col += 1) lines.push([0, 1, 2, 3].map(row => exp[row * 4 + col]));

  let score = 0;
  for (const line of lines) {
    let increasing = 0;
    let decreasing = 0;
    for (let i = 0; i < 3; i += 1) {
      increasing += Math.max(0, line[i + 1] - line[i]);
      decreasing += Math.max(0, line[i] - line[i + 1]);
    }
    score -= Math.min(increasing, decreasing);
  }
  return score;
}

function cornerBonus(board) {
  const maximum = Math.max(...board);
  if (!maximum) return 0;
  return [0, 3, 12, 15].some(index => board[index] === maximum) ? Math.log2(maximum) : 0;
}

export function evaluateBoard(board) {
  const empties = board.filter(value => value === 0).length;
  let mergePairs = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const value = board[row * 4 + col];
      if (!value) continue;
      if (col < 3 && value === board[row * 4 + col + 1]) mergePairs += 1;
      if (row < 3 && value === board[(row + 1) * 4 + col]) mergePairs += 1;
    }
  }
  return 3.1 * empties + 1.15 * cornerBonus(board) + 0.7 * mergePairs + 0.42 * monotonicity(board) - 0.62 * smoothness(board);
}
