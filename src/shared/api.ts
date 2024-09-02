import { APIGatewayProxyEventHeaders, APIGatewayProxyResult } from "aws-lambda";
import { getSecret } from "./secretsManager";
import { InvalidApiKeyError } from "./validation";

export const createSuccessResponse = (body?: string): APIGatewayProxyResult => {
    return {
        statusCode: 200,
        body: body ?? "",
    };
};

export const createValidationErrorResponse = (errors: string[]): APIGatewayProxyResult => {
    return {
        statusCode: 400,
        body: JSON.stringify({ errors }),
    };
};

export const createUnauthorizedErrorResponse = (error?: string): APIGatewayProxyResult => {
    return {
        statusCode: 401,
        body: JSON.stringify({ errors: [error || "Unauthorized"] }),
    };
};

export const createNotFoundErrorResponse = (error: string): APIGatewayProxyResult => {
    return {
        statusCode: 404,
        body: JSON.stringify({ errors: [error] }),
    };
};

export const createConflictErrorResponse = (error: string): APIGatewayProxyResult => {
    return {
        statusCode: 409,
        body: JSON.stringify({ errors: [error] }),
    };
};

export const createServerErrorResponse = (error?: string): APIGatewayProxyResult => {
    throw new Error(error || "An unexpected error occurred");
};

export const validateApiKey = async (secretArn: string, headers: APIGatewayProxyEventHeaders) => {
    const requestApiKey = headers["x-api-key"];

    if (!requestApiKey) {
        throw new InvalidApiKeyError();
    }

    const storedApiKey = await getSecret<string>({ SecretId: secretArn });

    if (requestApiKey !== storedApiKey) {
        throw new InvalidApiKeyError();
    }
};
