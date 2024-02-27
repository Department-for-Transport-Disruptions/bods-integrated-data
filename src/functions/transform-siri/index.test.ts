import { describe, expect, it } from "vitest";
import { mockInvalidSiri, mockSiri } from "./test/mockSiriVm";
import { transformXmlToCsv } from "./index";

describe("transformXmlToCsv", () => {
    it("should transform valid SIRI-VM to CSV format", () => {
        const result = `responseTimeStamp,producerRef,recordedAtTime,validUntilTime,lineRef,directionRef,operatorRef,datedVehicleJourneyRef,vehicleRef,dataSource,longitude,latitude,bearing,delay,isCompleteStopSequence,publishedLineName,originRef,destinationRef,blockRef
2018-08-17T15:14:21.432,ATB,2018-08-17T15:13:20,2018-08-17T16:13:29,ATB:Line:60,2,placeholder,ATB:ServiceJourney:00600027,200141,ATB,10.40261,63.43613,0,PT0S,false,1,originRef,destinationRef,blockRef`;

        expect(transformXmlToCsv(mockSiri)).toEqual(result);
    });
    it("should return null if invalid SIRI-VM is attempted to be transformed", () => {
        expect(transformXmlToCsv(mockInvalidSiri)).toEqual(null);
    });
    it("should return null if invalid string is passed", () => {
        expect(transformXmlToCsv("hello world")).toEqual(null);
    });
});
