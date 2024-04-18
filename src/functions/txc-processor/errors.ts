export class DuplicateRouteError extends Error {
    constructor() {
        super("Duplicate route");

        Object.setPrototypeOf(this, ServiceExpiredError.prototype);
    }
}

export class ServiceExpiredError extends Error {
    constructor() {
        super();

        Object.setPrototypeOf(this, ServiceExpiredError.prototype);
    }
}
