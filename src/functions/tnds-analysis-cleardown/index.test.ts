import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { DynamoDbObservation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("tnds-reporter", () => {
    const scanDynamoMock = vi.spyOn(dynamo, "scanDynamo");
    const deleteDynamoItemsMock = vi.spyOn(dynamo, "deleteDynamoItems");

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TNDS_OBSERVATION_TABLE_NAME = "test-table";
    });

    it("throws an error when the required env vars are missing", async () => {
        process.env.TNDS_OBSERVATION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - TNDS_OBSERVATION_TABLE_NAME must be set",
        );
    });

    it("clears down the dynamo table", async () => {
        const mockObservations: DynamoDbObservation[] = [
            {
                PK: "test-PK-1",
                SK: "test-SK-1",
                timeToExist: 0,
                dataSource: "test-dataSource-1",
                noc: "test-noc-1",
                region: "test-region-1",
                importance: "critical",
                category: "dataset",
                observation: "Duplicate journey",
                registrationNumber: "test-registrationNumber-1",
                service: "test-service-1",
                details: "test-details-1",
            },
            {
                PK: "test-PK-1",
                SK: "test-SK-2",
                timeToExist: 0,
                dataSource: "test-dataSource-2",
                noc: "test-noc-2",
                region: "test-region-2",
                importance: "advisory",
                category: "dataset",
                observation: "First stop is not a timing point",
                registrationNumber: "test-registrationNumber-2",
                service: "test-service-2",
                details: "test-details-2",
            },
            {
                PK: "test-PK-1",
                SK: "test-SK-3",
                timeToExist: 0,
                dataSource: "test-dataSource-2",
                noc: "test-noc-2",
                region: "test-region-2",
                importance: "advisory",
                category: "dataset",
                observation: "First stop is not a timing point",
                registrationNumber: "test-registrationNumber-2",
                service: "test-service-2",
                details: "test-details-2",
            },
        ];

        scanDynamoMock.mockResolvedValueOnce({ Items: mockObservations } as unknown as Awaited<
            ReturnType<typeof dynamo.scanDynamo>
        >);

        deleteDynamoItemsMock.mockResolvedValueOnce();

        await handler(mockEvent, mockContext, mockCallback);

        expect(deleteDynamoItemsMock).toHaveBeenCalledTimes(1);
        expect(deleteDynamoItemsMock).toHaveBeenCalledWith("test-table", mockObservations);
    });

    it("doesn't clear down the table if it has no items", async () => {
        scanDynamoMock.mockResolvedValueOnce({} as Awaited<ReturnType<typeof dynamo.scanDynamo>>);

        deleteDynamoItemsMock.mockResolvedValueOnce();

        await handler(mockEvent, mockContext, mockCallback);

        expect(deleteDynamoItemsMock).not.toHaveBeenCalled();
    });
});
