import { ZodRawShape, z } from "zod";

export const REQUEST_PARAM_MAX_LENGTH = 256;
export const STRING_LENGTH_REGEX = new RegExp(`^.{1,${REQUEST_PARAM_MAX_LENGTH}}$`);
export const BOUNDING_BOX_REGEX = /^-?[0-9]+(\.[0-9]+)?(,-?[0-9]+(\.[0-9]+)?)*$/;

// TXC and SIRI-VM use the XML NMTOKEN data type for various properties: https://www.w3.org/TR/xml/#NT-Nmtoken
export const NM_TOKEN_REGEX = new RegExp(`^[a-zA-Z0-9.\-_:]{1,${REQUEST_PARAM_MAX_LENGTH}}$`);
export const NM_TOKEN_ARRAY_REGEX = new RegExp(
    `^[a-zA-Z0-9.\-_:]{1,100}(,[a-zA-Z0-9.\-_:]{1,${REQUEST_PARAM_MAX_LENGTH}})*$`,
);

export const createRequestParamsSchema = (shape: ZodRawShape) => z.preprocess(Object, z.object(shape));

export const createStringLengthValidation = (propertyName: string) => {
    return z
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .regex(STRING_LENGTH_REGEX, {
            message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters`,
        });
};

export const createNmTokenValidation = (propertyName: string) => {
    return z.coerce
        .string({
            required_error: `${propertyName} is required`,
            invalid_type_error: `${propertyName} must be a string`,
        })
        .regex(NM_TOKEN_REGEX, {
            message: `${propertyName} must be 1-${REQUEST_PARAM_MAX_LENGTH} characters and only contain letters, numbers, periods, hyphens, underscores and colons`,
        })
        .optional();
};
