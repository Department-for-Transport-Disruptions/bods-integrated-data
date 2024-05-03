export class DuplicateRouteError extends Error {
    constructor() {
        super("Duplicate route");

        Object.setPrototypeOf(this, DuplicateRouteError.prototype);
    }
}

export class InvalidOperatorError extends Error {
    constructor() {
        super("Invalid operator");

        Object.setPrototypeOf(this, InvalidOperatorError.prototype);
    }
}

export class ServiceExpiredError extends Error {
    constructor() {
        super("Service expired");

        Object.setPrototypeOf(this, ServiceExpiredError.prototype);
    }
}
