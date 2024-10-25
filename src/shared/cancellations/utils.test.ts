import MockDate from "mockdate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as cloudwatch from "../cloudwatch";
import { Situation } from "../database";
import { getDate } from "../dates";
import { MiscellaneousReason, Progress, SourceType } from "../schema/siri-sx/enums";
import { createSiriSx } from "./utils";

describe("cancelllations utils", () => {
    vi.mock("../cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    const putMetricDataSpy = vi.spyOn(cloudwatch, "putMetricData");

    beforeAll(() => {
        MockDate.set("2024-03-11T15:20:02.093Z");
    });

    afterAll(() => {
        MockDate.reset();
    });

    describe("createSiriSx", () => {
        it("creates valid siri-sx xml, even when the Route tag has no nested properties", () => {
            const timestamp = getDate();

            const situation: Situation = {
                id: "id-1",
                subscription_id: "sub-1",
                response_time_stamp: timestamp.toISOString(),
                producer_ref: "p-1",
                situation_number: "s-1",
                version: 1,
                situation: {
                    CreationTime: timestamp.toISOString(),
                    ParticipantRef: "par-1",
                    SituationNumber: "s-1",
                    Source: {
                        SourceType: SourceType.other,
                    },
                    VersionedAtTime: timestamp.toISOString(),
                    Progress: Progress.closed,
                    ValidityPeriod: [],
                    MiscellaneousReason: MiscellaneousReason.accident,
                    Affects: {
                        VehicleJourneys: {
                            AffectedVehicleJourney: [
                                {
                                    VehicleJourneyRef: "vj-1",
                                    Route: {},
                                },
                            ],
                        },
                    },
                },
                end_time: timestamp.add(10, "years").toISOString(),
            };

            const siriSxXml = `<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd"><ServiceDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><ProducerRef>DepartmentForTransport</ProducerRef><ResponseMessageIdentifier>ref</ResponseMessageIdentifier><SituationExchangeDelivery><ResponseTimestamp>2024-03-11T15:20:02.093+00:00</ResponseTimestamp><Situations><PtSituationElement><CreationTime>2024-03-11T15:20:02.093Z</CreationTime><ParticipantRef>par-1</ParticipantRef><SituationNumber>s-1</SituationNumber><Source><SourceType>other</SourceType></Source><VersionedAtTime>2024-03-11T15:20:02.093Z</VersionedAtTime><Progress>closed</Progress><MiscellaneousReason>accident</MiscellaneousReason><Affects><VehicleJourneys><AffectedVehicleJourney><VehicleJourneyRef>vj-1</VehicleJourneyRef><Route></Route></AffectedVehicleJourney></VehicleJourneys></Affects></PtSituationElement></Situations></SituationExchangeDelivery></ServiceDelivery></Siri>`;

            const result = createSiriSx([situation], "ref", timestamp);
            expect(putMetricDataSpy).not.toHaveBeenCalled();
            expect(result).toEqual(siriSxXml);
        });
    });
});
