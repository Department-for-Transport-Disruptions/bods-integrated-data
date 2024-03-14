export class ServiceExpiredError extends Error {
    constructor() {
        super();

        Object.setPrototypeOf(this, ServiceExpiredError.prototype);
    }
}
