export class DuplicateRouteError extends Error {
    constructor() {
        super("Duplicate route");

        Object.setPrototypeOf(this, DuplicateRouteError.prototype);
    }
}

export class ServiceExpiredError extends Error {
    constructor() {
        super();

        Object.setPrototypeOf(this, ServiceExpiredError.prototype);
    }
}
