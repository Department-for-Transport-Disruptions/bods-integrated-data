import { describe, expect, it, vi } from "vitest";
import { getAndParseTflData } from ".";

describe("tfl-timetable-processor", () => {
    const mockBucketName = "mock-bucket";
    const mockObjectKey = "mock-key";

    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
    }));

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    describe("getAndParseTflData", () => {
        it("should return parsed data", async () => {
            const mockXmlData = `
<?xml version="1.0" encoding="UTF-8"?>
<sp:Network_Data xmlns:sp="http://www.tfl.uk/CDII/Stop_Point" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.tfl.uk/CDII/Stop_Point ../Schema/Stop_Point.xsd">
	<Base_Version>20250412</Base_Version>
	<Stop_Point aStop_Point_Idx="1">
		<Stop_Code_LBSL>673</Stop_Code_LBSL>
		<Stop_Name>Euston Square Station</Stop_Name>
		<Location_Easting>529349</Location_Easting>
		<Location_Northing>182388</Location_Northing>
		<Location_Longitude>-0.136853</Location_Longitude>
		<Location_Latitude>51.5256</Location_Latitude>
		<Point_Letter>Q</Point_Letter>
		<NaPTAN_Code>490000078Q</NaPTAN_Code>
		<SMS_Code>59287</SMS_Code>
		<Stop_Area>8215A</Stop_Area>
		<Borough_Code>CDN</Borough_Code>
		<Heading>69</Heading>
		<Stop_Type>STBC</Stop_Type>
		<Street_Name>Euston Road</Street_Name>
		<Post_Code>NW1 2AF</Post_Code>
		<Towards>Euston Or Kings Cross</Towards>
	</Stop_Point>
	<Stop_Point aStop_Point_Idx="2">
		<Stop_Code_LBSL>2091</Stop_Code_LBSL>
		<Stop_Name>Princess May Road</Stop_Name>
		<Location_Easting>533560</Location_Easting>
		<Location_Northing>185530</Location_Northing>
		<Location_Longitude>-0.074997</Location_Longitude>
		<Location_Latitude>51.552856</Location_Latitude>
		<Point_Letter xsi:nil="true" />
		<NaPTAN_Code>490011217N</NaPTAN_Code>
		<SMS_Code>47120</SMS_Code>
		<Stop_Area>D603A</Stop_Area>
		<Borough_Code>HAC</Borough_Code>
		<Heading xsi:nil="true" />
		<Stop_Type>STBC</Stop_Type>
		<Street_Name>Stoke Newington Road</Street_Name>
		<Post_Code>N16 8AG</Post_Code>
		<Towards>Stamford Hill</Towards>
	</Stop_Point>
</sp:Network_Data>`;

            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => mockXmlData } });

            const tflData = await getAndParseTflData(mockBucketName, mockObjectKey);

            expect(tflData).toEqual({
                "sp:Network_Data": {
                    Stop_Point: [
                        {
                            "@_aStop_Point_Idx": 1,
                            Stop_Code_LBSL: "673",
                            Stop_Name: "Euston Square Station",
                            Location_Easting: 529349,
                            Location_Northing: 182388,
                            Location_Longitude: -0.136853,
                            Location_Latitude: 51.5256,
                            Point_Letter: "Q",
                            NaPTAN_Code: "490000078Q",
                            SMS_Code: "59287",
                            Stop_Area: "8215A",
                            Borough_Code: "CDN",
                            Heading: 69,
                            Stop_Type: "STBC",
                            Street_Name: "Euston Road",
                            Post_Code: "NW1 2AF",
                            Towards: "Euston Or Kings Cross",
                        },
                        {
                            "@_aStop_Point_Idx": 2,
                            Stop_Code_LBSL: "2091",
                            Stop_Name: "Princess May Road",
                            Location_Easting: 533560,
                            Location_Northing: 185530,
                            Location_Longitude: -0.074997,
                            Location_Latitude: 51.552856,
                            Point_Letter: "",
                            NaPTAN_Code: "490011217N",
                            SMS_Code: "47120",
                            Stop_Area: "D603A",
                            Borough_Code: "HAC",
                            Heading: undefined,
                            Stop_Type: "STBC",
                            Street_Name: "Stoke Newington Road",
                            Post_Code: "N16 8AG",
                            Towards: "Stamford Hill",
                        },
                    ],
                },
            });
        });
    });
});
