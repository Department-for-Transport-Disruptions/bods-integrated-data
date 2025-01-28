import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import MockDate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("txc-analysis-cleardown", () => {
    const deleteTableMock = vi.spyOn(dynamo, "deleteTable");
    const createTableMock = vi.spyOn(dynamo, "createTable");
    const waitUntilTableExistsMock = vi.spyOn(dynamo, "waitUntilTableExists");
    const waitUntilTableNotExistsMock = vi.spyOn(dynamo, "waitUntilTableNotExists");

    beforeAll(() => {
        MockDate.set("2025-01-07T00:00:00.000Z");
    });

    afterAll(() => {
        MockDate.reset();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TXC_OBSERVATION_TABLE_NAME = "test-table";

        waitUntilTableExistsMock.mockResolvedValue({ state: "SUCCESS" } as Awaited<
            ReturnType<typeof dynamo.waitUntilTableExists>
        >);
        waitUntilTableNotExistsMock.mockResolvedValue({ state: "SUCCESS" } as Awaited<
            ReturnType<typeof dynamo.waitUntilTableNotExists>
        >);
    });

    it("throws an error when the required env vars are missing", async () => {
        process.env.TXC_OBSERVATION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - TXC_OBSERVATION_TABLE_NAME must be set",
        );
    });

    it("deletes and recreates the dynamo table", async () => {
        deleteTableMock.mockResolvedValueOnce({ $metadata: {} });
        createTableMock.mockResolvedValueOnce({ $metadata: {} });

        const response = await handler(mockEvent, mockContext, mockCallback);

        expect(deleteTableMock).toHaveBeenCalled();
        expect(waitUntilTableNotExistsMock).toHaveBeenCalled();
        expect(createTableMock).toHaveBeenCalled();
        expect(waitUntilTableExistsMock).toHaveBeenCalled();
        expect(response).toEqual({ date: "20250107" });
    });

    it("doesn't throw an error when deleting a non-existent table that returns a not found exception", async () => {
        deleteTableMock.mockRejectedValueOnce({ name: "ResourceNotFoundException" });
        createTableMock.mockResolvedValueOnce({ $metadata: {} });

        await handler(mockEvent, mockContext, mockCallback);

        expect(createTableMock).toHaveBeenCalled();
    });

    it("throws an error when deleting a non-existent table that returns an exception other than a not found exception", async () => {
        deleteTableMock.mockRejectedValueOnce(new Error("Some other exception"));
        createTableMock.mockResolvedValueOnce({ $metadata: {} });

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow("Some other exception");

        expect(waitUntilTableNotExistsMock).not.toHaveBeenCalled();
        expect(createTableMock).not.toHaveBeenCalled();
    });
});
