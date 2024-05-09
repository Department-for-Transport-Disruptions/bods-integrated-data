export class TooManyRetriesError extends Error {
    constructor() {
        super("Too many retries");

        Object.setPrototypeOf(this, TooManyRetriesError.prototype);
    }
}
