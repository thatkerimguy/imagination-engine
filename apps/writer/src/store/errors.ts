export class ValidationError extends Error {
  constructor(
    readonly what: string,
    readonly errors: string[],
  ) {
    super(`${what} is invalid:\n${errors.join('\n')}`);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} was not found`);
    this.name = 'NotFoundError';
  }
}
