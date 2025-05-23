import { z } from "zod";
import { notEmpty } from "./utils";

export const REQUEST_PARAM_MAX_LENGTH = 256;
export const STRING_LENGTH_REGEX = new RegExp(`^.{1,${REQUEST_PARAM_MAX_LENGTH}}$`);

// TXC and SIRI-VM use the XML NMTOKEN data type for various properties: https://www.w3.org/TR/xml/#NT-Nmtoken
export const NM_TOKEN_REGEX = new RegExp(`^[a-zA-Z0-9._:-]{1,${REQUEST_PARAM_MAX_LENGTH}}$`);
export const NM_TOKEN_ARRAY_REGEX = new RegExp(
    `^[a-zA-Z0-9._:-]{1,${REQUEST_PARAM_MAX_LENGTH}}(,[a-zA-Z0-9._:-]{1,${REQUEST_PARAM_MAX_LENGTH}})*$`,
);
export const SUBSCRIPTION_ID_ARRAY_REGEX = /^[^,]+(,[^,]+){0,4}$/;

export const NM_TOKEN_DISALLOWED_CHARS_REGEX = /[^a-zA-Z0-9.\-_:]/g;

export const SIRI_VM_POPULATED_STRING_REGEX = /^[^,\[\]\{\}\?$%\^=@#;:]+$/g;

export const SIRI_VM_POPULATED_STRING_TYPE_DISALLOWED_CHARS_REGEX = /[,\[\]\{\}\?$%\^=@#;:]/g;

export const createPopulatedStringValidation = (propertyName: string) => {
    return z.coerce
        .string()
        .trim()
        .regex(SIRI_VM_POPULATED_STRING_REGEX, {
            message: `${propertyName} must not contain the following disallowed characters as defined by the XSD: []{}?$%^=@#;:`,
        });
};

export const createStringLengthValidation = (propertyName: string) => {
    return z
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .trim()
        .regex(STRING_LENGTH_REGEX, {
            message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters`,
        });
};

export const createStringArrayValidation = (propertyName: string) => {
    return z
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .transform((value) => value.split(",").map((v) => v.trim()))
        .pipe(z.string().array());
};

export const createNmTokenSiriValidation = (propertyName: string, isRequired: boolean) => {
    return isRequired
        ? z.coerce
              .string({
                  required_error: `${propertyName} is required`,
                  invalid_type_error: `${propertyName} must be a string`,
              })
              .trim()
              .regex(NM_TOKEN_REGEX, {
                  message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
              })
        : z.coerce
              .string({ invalid_type_error: `${propertyName} must be a string` })
              .trim()
              .regex(NM_TOKEN_REGEX, {
                  message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
              })
              .nullish();
};

export const createNmTokenOrNumberSiriValidation = (propertyName: string) => {
    return z.union([
        z
            .string()
            .trim()
            .regex(NM_TOKEN_REGEX, {
                message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
            }),
        z.number(),
    ]);
};

export const createNmTokenValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .trim()
        .regex(NM_TOKEN_REGEX, {
            message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
        });
};

export const createNmTokenArrayValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .transform((value) => value.split(",").map((v) => v.trim()))
        .pipe(
            z
                .string()
                .regex(NM_TOKEN_ARRAY_REGEX, {
                    message: `${propertyName} must be comma-separated values of 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
                })
                .array()
                .max(200, {
                    message: `${propertyName} must be fewer than 200 values`,
                }),
        );
};

export const createSubscriptionIdArrayValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .regex(SUBSCRIPTION_ID_ARRAY_REGEX, {
            message: `${propertyName} must be a valid ID format or a comma-delimited array of valid ID formats up to five IDs`,
        })
        .transform((value) => value.split(",").map((v) => v.trim()))
        .pipe(
            z
                .string()
                .array()
                .max(5, {
                    message: `${propertyName} must be up to 5 IDs`,
                }),
        );
};

export const createBoundingBoxValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .trim()
        .transform((value) => value.split(",").map((v) => v.trim()))
        .pipe(
            z.coerce
                .number({
                    message: `${propertyName} must use valid numbers`,
                })
                .array()
                .length(4, {
                    message: `${propertyName} must be four comma-separated values: minLongitude, minLatitude, maxLongitude and maxLatitude`,
                }),
        );
};

export const createNumberArrayValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .trim()
        .transform((value) =>
            value
                .split(",")
                .map((v) => v.trim())
                .filter((v) => notEmpty(v) && v !== "" && !Number.isNaN(Number(v))),
        )
        .pipe(
            z.coerce
                .number({
                    message: `${propertyName} must use valid numbers`,
                })
                .array()
                .min(1, {
                    message: `${propertyName} must have at least one value`,
                }),
        );
};

export class InvalidXmlError extends Error {
    constructor(message = "Invalid XML") {
        super(message);

        Object.setPrototypeOf(this, InvalidXmlError.prototype);
    }
}

export class InvalidApiKeyError extends Error {
    constructor(message = "Invalid API key") {
        super(message);

        Object.setPrototypeOf(this, InvalidApiKeyError.prototype);
    }
}
