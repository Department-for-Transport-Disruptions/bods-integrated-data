import * as utilFunctions from "@bods-integrated-data/shared/avl/utils";
import { Avl } from "@bods-integrated-data/shared/database";
import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { logger } from "@bods-integrated-data/shared/logger";
import { mockCallback, mockContext } from "@bods-integrated-data/shared/mockHandlerArgs";
import { AvlConsumerSubscription } from "@bods-integrated-data/shared/schema";
import { SQSEvent } from "aws-lambda";
import axios, { AxiosError } from "axios";
import MockDate from "mockdate";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { handler } from ".";

const mockConsumerSubscriptionTable = "mock-consumer-subscription-table-name";

const mockAvl: Avl = {
    id: 1234,
    response_time_stamp: "2024-02-26T14:37:04.665673+00:00",
    producer_ref: "DfT",
    recorded_at_time: "2024-02-26T14:36:11+00:00",
    item_id: "56d177b9-2be9-49bb-852f-21e5a2400ea6",
    valid_until_time: "2024-02-26 14:42:12",
    line_ref: "784",
    direction_ref: "OUT",
    operator_ref: "NATX",
    data_frame_ref: "",
    dated_vehicle_journey_ref: "784105",
    vehicle_ref: "191D44717",
    longitude: -6.238029,
    latitude: 53.42605,
    bearing: 119,
    published_line_name: "784",
    origin_ref: "98010",
    destination_ref: "98045",
    block_ref: "784105",
    occupancy: "full",
    origin_aimed_departure_time: "2024-02-26T14:36:18+00:00",
    geom: null,
    vehicle_name: null,
    monitored: null,
    load: null,
    passenger_count: null,
    odometer: null,
    headway_deviation: null,
    schedule_deviation: null,
    vehicle_state: null,
    next_stop_point_id: null,
    next_stop_point_name: null,
    previous_stop_point_id: null,
    previous_stop_point_name: null,
    origin_name: null,
    destination_name: null,
    vehicle_journey_ref: null,
    route_id: null,
    trip_id: null,
    vehicle_monitoring_ref: null,
    destination_aimed_arrival_time: null,
    ticket_machine_service_code: null,
    journey_code: null,
    vehicle_unique_id: null,
    subscription_id: "3",
    onward_calls: null,
    driver_ref: null,
};

const expectedSiriVmBody = `<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\"><ServiceDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><ProducerRef>DepartmentForTransport</ProducerRef><VehicleMonitoringDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><RequestMessageRef>4026f53d-3548-4999-a6b6-2e6893175894</RequestMessageRef><ValidUntil>2024-03-11T15:25:02.093+00:00</ValidUntil><ShortestPossibleCycle>PT5S</ShortestPossibleCycle><VehicleActivity><RecordedAtTime>2024-02-26T14:36:11+00:00</RecordedAtTime><ItemIdentifier>56d177b9-2be9-49bb-852f-21e5a2400ea6</ItemIdentifier><ValidUntilTime>2024-03-11T15:25:02.093+00:00</ValidUntilTime><MonitoredVehicleJourney><LineRef>784</LineRef><DirectionRef>outbound</DirectionRef><PublishedLineName>784</PublishedLineName><OperatorRef>NATX</OperatorRef><OriginRef>98010</OriginRef><DestinationRef>98045</DestinationRef><OriginAimedDepartureTime>2024-02-26T14:36:18+00:00</OriginAimedDepartureTime><VehicleLocation><Longitude>-6.238029</Longitude><Latitude>53.42605</Latitude></VehicleLocation><Bearing>119</Bearing><Occupancy>full</Occupancy><BlockRef>784105</BlockRef><VehicleRef>191D44717</VehicleRef></MonitoredVehicleJourney></VehicleActivity></VehicleMonitoringDelivery></ServiceDelivery></Siri>`;

const consumerSubscription: AvlConsumerSubscription = {
    PK: "123",
    SK: "mock-user-id",
    subscriptionId: "mock-consumer-subscription-id",
    status: "live",
    url: "https://example.com",
    requestorRef: "123",
    heartbeatInterval: "PT30S",
    initialTerminationTime: "2024-03-11T15:20:02.093Z",
    requestTimestamp: "2024-03-11T15:20:02.093Z",
    producerSubscriptionIds: "1,2,3",
    heartbeatAttempts: 0,
    lastRetrievedAvlId: 5,
    queueUrl: "",
    eventSourceMappingUuid: "",
    scheduleName: "",
};

describe("avl-consumer-subscriber", () => {
    const mocks = vi.hoisted(() => {
        return {
            mockDbClient: {
                destroy: vi.fn(),
            },
        };
    });

    vi.mock("@bods-integrated-data/shared/logger", () => ({
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        withLambdaRequestTracker: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/dynamo", () => ({
        getDynamoItem: vi.fn(),
        putDynamoItem: vi.fn(),
    }));

    vi.mock("node:crypto", () => ({
        randomUUID: () => "4026f53d-3548-4999-a6b6-2e6893175894",
    }));

    vi.mock("@bods-integrated-data/shared/database", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/database")>()),
        getDatabaseClient: vi.fn().mockReturnValue(mocks.mockDbClient),
    }));

    const getDynamoItemSpy = vi.spyOn(dynamo, "getDynamoItem");
    const putDynamoItemSpy = vi.spyOn(dynamo, "putDynamoItem");
    const getAvlDataForSiriVmSpy = vi.spyOn(utilFunctions, "getAvlDataForSiriVm");
    const mockedAxios = vi.mocked(axios, true);
    const axiosSpy = vi.spyOn(mockedAxios, "post");

    let mockEvent: SQSEvent;

    beforeAll(() => {
        MockDate.set("2024-03-11T15:20:02.093Z");
    });

    beforeEach(() => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = mockConsumerSubscriptionTable;

        mockEvent = {
            Records: [
                {
                    body: JSON.stringify({ subscriptionPK: consumerSubscription.PK }),
                },
            ],
        } as SQSEvent;

        getDynamoItemSpy.mockResolvedValue(consumerSubscription);
        getAvlDataForSiriVmSpy.mockResolvedValue([mockAvl]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("throws an error when the required env var AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME is missing", async () => {
        process.env.AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = "";

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            "Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set",
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it.each([{ subscriptionPK: "" }, {}])("throws an error when the sqs message is invalid: %o", async (input) => {
        mockEvent = { Records: [{ body: JSON.stringify(input) }] } as SQSEvent;

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(ZodError);

        expect(logger.error).toHaveBeenCalledWith(
            expect.anything(),
            "There was a problem with the avl-consumer-data-sender endpoint",
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("throws an error when the subscription cannot be found", async () => {
        getDynamoItemSpy.mockResolvedValue(null);

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            `Subscription PK: ${consumerSubscription.PK} not found in DynamoDB`,
        );

        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("throws an error when the subscription is not live", async () => {
        const inactiveConsumerSubscription: AvlConsumerSubscription = {
            ...consumerSubscription,
            status: "inactive",
        };

        getDynamoItemSpy.mockResolvedValue(inactiveConsumerSubscription);

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(
            `Subscription PK: ${inactiveConsumerSubscription.PK} no longer live`,
        );
        expect(getAvlDataForSiriVmSpy).not.toHaveBeenCalled();
    });

    it("sends data to the consumer", async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });

        await handler(mockEvent, mockContext, mockCallback);

        expect(getAvlDataForSiriVmSpy).toHaveBeenCalledWith(
            mocks.mockDbClient,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            ["1", "2", "3"],
            consumerSubscription.lastRetrievedAvlId,
        );

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toHaveBeenCalledWith(consumerSubscription.url, expectedSiriVmBody, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        expect(logger.error).not.toHaveBeenCalled();

        const expectedUpdatedSubscription: AvlConsumerSubscription = {
            ...consumerSubscription,
            lastRetrievedAvlId: mockAvl.id,
        };

        expect(putDynamoItemSpy).toHaveBeenCalledWith(
            mockConsumerSubscriptionTable,
            consumerSubscription.PK,
            consumerSubscription.SK,
            expectedUpdatedSubscription,
        );
    });

    it("throws an error when the consumer endpoint returns an unsuccesful response", async () => {
        mockedAxios.post.mockRejectedValue(new AxiosError("Request failed", "500"));

        await expect(handler(mockEvent, mockContext, mockCallback)).rejects.toThrow(AxiosError);

        expect(getAvlDataForSiriVmSpy).toHaveBeenCalledWith(
            mocks.mockDbClient,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            ["1", "2", "3"],
            consumerSubscription.lastRetrievedAvlId,
        );

        expect(axiosSpy).toHaveBeenCalledTimes(1);
        expect(axiosSpy).toHaveBeenCalledWith(consumerSubscription.url, expectedSiriVmBody, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            "Unsuccessful response from consumer subscription",
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            "There was a problem with the avl-consumer-data-sender endpoint",
        );

        expect(putDynamoItemSpy).not.toHaveBeenCalled();
    });
});