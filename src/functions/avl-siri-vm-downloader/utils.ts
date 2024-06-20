import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export const createResponseStream = (responseStream: Writable, response: APIGatewayProxyStructuredResultV2) => {
    const metadata: APIGatewayProxyStructuredResultV2 = {
        statusCode: response.statusCode,
        headers: {
            "Content-Type": "application/json",
            ...response.headers,
        },
    };

    const responseBody = typeof response.body === "object" ? JSON.stringify(response.body) : response.body || "";
    const requestStream = Readable.from(Buffer.from(responseBody));
    const modifiedResponseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    return pipeline(requestStream, modifiedResponseStream);
};

export const streamifyResponse = awslambda.streamifyResponse;
