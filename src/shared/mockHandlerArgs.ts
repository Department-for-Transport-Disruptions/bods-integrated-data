import { Handler } from "aws-lambda";

export const mockEvent: Parameters<Handler>[0] = undefined;
export const mockContext: Parameters<Handler>[1] = {} as Parameters<Handler>[1];
export const mockCallback: Parameters<Handler>[2] = () => undefined;
