import { APIGatewayProxyResult } from "aws-lambda";

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
    return {
        statusCode: 500,
        body: JSON.stringify({ errors: [error || "An unexpected error occurred"] }),
    };
};
