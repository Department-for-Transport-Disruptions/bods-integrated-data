import * as dynamo from "@bods-integrated-data/shared/dynamo";
import { mockCallback, mockContext, mockEvent } from "@bods-integrated-data/shared/mockHandlerArgs";
import { CancellationsSubscription } from "@bods-integrated-data/shared/schema";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import axios, { AxiosResponse } from "axios";
import * as MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

const mockAvlSubscriptions: AvlSubscription[] = [
    {
        PK: "subscription-avl-1",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-1",
        apiKey: "mock-api-key-1",
    },
    {
        PK: "subscription-avl-2",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        publisherId: "test-publisher-id-2",
        apiKey: "mock-api-key-2",
    },
    {
        PK: "subscription-avl-3",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "inactive",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-3",
        apiKey: "mock-api-key-3",
    },
    {
        PK: "subscription-avl-4",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "error",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-4",
        apiKey: "mock-api-key-4",
    },
];

const mockCancellationsSubscriptions: CancellationsSubscription[] = [
    {
        PK: "subscription-cancellations-1",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-1",
        apiKey: "mock-api-key-1",
    },
    {
        PK: "subscription-cancellations-2",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "live",
        publisherId: "test-publisher-id-2",
        apiKey: "mock-api-key-2",
    },
    {
        PK: "subscription-cancellations-3",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "inactive",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-3",
        apiKey: "mock-api-key-3",
    },
    {
        PK: "subscription-cancellations-4",
        url: "https://www.mock-data-producer.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "error",
        requestorRef: "BODS_MOCK_PRODUCER",
        publisherId: "test-publisher-id-4",
        apiKey: "mock-api-key-4",
    },
];

const expectedAVLDataForSubscription = (subscriptionId: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2024-03-11T15:20:02.093+00:00</RecordedAtTime>
                <ValidUntilTime>2024-03-11T15:25:02.093+00:00</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>TestOperator</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-04</DataFrameRef>
                        <DatedVehicleJourneyRef>${subscriptionId}:ServiceJourney:00600039</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>-1.5464885</Longitude>
                        <Latitude>53.7954833</Latitude>
                    </VehicleLocation>
                    <BlockRef>1234</BlockRef>
                    <OriginRef>Leeds</OriginRef>
                    <DestinationRef>Sheffield</DestinationRef>
                    <PublishedLineName>60</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2024-03-11T15:20:02.093+00:00</RecordedAtTime>
                <ValidUntilTime>2024-03-11T15:25:02.093+00:00</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:11</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>DummyOperator</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-04</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600039</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>123456</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>-0.1410151</Longitude>
                        <Latitude>50.8288519</Latitude>
                    </VehicleLocation>
                    <BlockRef>6502</BlockRef>
                    <OriginRef>London</OriginRef>
                    <DestinationRef>Brighton</DestinationRef>
                    <PublishedLineName>11</PublishedLineName>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>123</TicketMachineServiceCode>
                                <JourneyCode>VJ_123</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>Vehicle_123</VehicleUniqueId>
                        <DriverRef>123456</DriverRef>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>`;

describe("mock-data-producer-send-data", () => {
    MockDate.set("2024-03-11T15:20:02.093Z");

    vi.mock("axios");
    const mockedAxios = vi.mocked(axios, true);
    const axiosSpy = vi.spyOn(mockedAxios, "post");

    beforeEach(() => {
        process.env.STAGE = "dev";
        process.env.AVL_DATA_ENDPOINT = "https://www.avl-data-endpoint.com";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-dev";
        process.env.CANCELLATIONS_DATA_ENDPOINT = "https://www.cancelllations-data-endpoint.com";
        process.env.CANCELLATIONS_TABLE_NAME = "integrated-data-cancellations-subscription-table-dev";

        vi.resetAllMocks();
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValueOnce(mockAvlSubscriptions);
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValueOnce(mockCancellationsSubscriptions);
    });

    afterAll(() => {
        MockDate.reset();
    });

    it("should return and send no data if no subscriptions are returned from dynamo", async () => {
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValue([]);
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should return and send no data if no mock data producers are active", async () => {
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValueOnce([...mockAvlSubscriptions.slice(1)]);
        vi.spyOn(dynamo, "recursiveScan").mockResolvedValueOnce([...mockCancellationsSubscriptions.slice(1)]);
        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).not.toBeCalled();
    });

    it("should send mock data with the subscriptionId in the query string parameters if the stage is local", async () => {
        process.env.STAGE = "local";
        process.env.AVL_TABLE_NAME = "integrated-data-avl-subscription-table-local";
        process.env.CANCELLATIONS_TABLE_NAME = "integrated-data-cancellations-subscription-table-local";

        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com?subscriptionId=subscription-avl-1&apiKey=mock-api-key-1",
            expectedAVLDataForSubscription("subscription-avl-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.test-data-endpoint.com?subscriptionId=subscription-cancellations-1&apiKey=mock-api-key-1",
            expectedAVLDataForSubscription("subscription-cancellations-2"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });
    it("should send mock data with the subscriptionId in the path parameters if the stage not local", async () => {
        axiosSpy.mockResolvedValue({
            status: 200,
        } as AxiosResponse);

        await handler(mockEvent, mockContext, mockCallback);
        expect(axiosSpy).toHaveBeenCalledTimes(2);
        expect(axiosSpy).toHaveBeenNthCalledWith(
            1,
            "https://www.avl-data-endpoint.com/subscription-avl-1?apiKey=mock-api-key-1",
            expectedAVLDataForSubscription("subscription-avl-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );

        expect(axiosSpy).toHaveBeenNthCalledWith(
            2,
            "https://www.avl-data-endpoint.com/subscription-cancellations-1?apiKey=mock-api-key-1",
            expectedAVLDataForSubscription("subscription-cancellations-1"),
            {
                headers: {
                    "Content-Type": "text/xml",
                },
            },
        );
    });
});
