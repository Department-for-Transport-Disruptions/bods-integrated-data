/**
 * credit: https://github.com/llozano/lambda-stream-response
 */

import { Writable } from "node:stream";
import { APIGatewayEvent, Context, Handler } from "aws-lambda";

global {
    declare namespace awslambda {
        export namespace HttpResponseStream {
            function from<T>(writable: Writable, metadata: T): Writable;
        }

        export type StreamifyHandler<T> = (
            event: APIGatewayEvent,
            responseStream: Writable,
            context: Context,
        ) => Promise<T>;

        export function streamifyResponse<U>(handler: StreamifyHandler<T>): Handler<U, T>;
    }
}
