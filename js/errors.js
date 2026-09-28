export class StegError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = 'StegError';
    this.code = code;
    this.params = params;
  }
}

export function fail(code, params = {}) {
  throw new StegError(code, params);
}
