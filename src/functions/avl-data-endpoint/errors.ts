export class ClientError extends Error {
    constructor() {
        super();

        Object.setPrototypeOf(this, ClientError.prototype);
    }
}
