import {
    TflBlock,
    TflBlockCalendarDay,
    TflDestination,
    TflGarage,
    TflJourney,
    TflJourneyDriveTime,
    TflJourneyWaitTime,
    TflLine,
    TflOperator,
    TflPattern,
    TflRouteGeometry,
    TflStopInPattern,
    TflStopPoint,
    TflVehicle,
} from "@bods-integrated-data/shared/database";
import {
    TflBlockCalendarDaySchema,
    TflBlockSchema,
    TflDestinationSchema,
    TflGarageSchema,
    TflJourneyDriveTimeSchema,
    TflJourneySchema,
    TflJourneyWaitTimeSchema,
    TflLineSchema,
    TflOperatorSchema,
    TflPatternSchema,
    TflRouteGeometrySchema,
    TflStopInPatternSchema,
    TflStopPointSchema,
    TflVehicleSchema,
} from "@bods-integrated-data/shared/schema";

export const mapTflVehicles = (vehicleData: TflVehicleSchema): TflVehicle[] => {
    return vehicleData.Vehicle.map((vehicle) => ({
        id: vehicle["@_aVehicleId"],
        registration_number: vehicle.Registration_Number,
        bonnet_no: vehicle.Bonnet_No,
        operator_agency: vehicle.Operator_Agency,
    }));
};

export const mapTflOperators = (operatorData: TflOperatorSchema): TflOperator[] => {
    return operatorData.Operator.map((operator) => ({
        id: operator["@_aOperator_Code"],
        operator_name: operator.Operator_Name || null,
        operator_agency: operator.Operator_Agency,
    }));
};

export const mapTflGarages = (garageData: TflGarageSchema): TflGarage[] => {
    return garageData.Garage.map((garage) => ({
        id: garage["@_aGarage_No"],
        operator_code: garage["@_aOperator_Code"],
        garage_code: garage.Garage_Code,
        garage_name: garage.Garage_Name,
    }));
};

export const mapTflBlocks = (blockData: TflBlockSchema): TflBlock[] => {
    return blockData.Block.map((block) => ({
        id: block["@_aBlock_Idx"],
        operator_code: block["@_aOperator_Code"],
        block_no: block.Block_No,
        running_no: block.Running_No,
        garage_no: block.Garage_No || null,
    }));
};

export const mapTflBlockCalendarDays = (blockCalendarDayData: TflBlockCalendarDaySchema): TflBlockCalendarDay[] => {
    return blockCalendarDayData.Block_CalendarDay.map((blockCalendarDay) => {
        const block_id = blockCalendarDay["@_aBlock_Idx"];
        const calendar_day = blockCalendarDay["@_aCalendar_Day"];
        const id = `${calendar_day}-${block_id}`;

        return {
            id,
            block_id,
            calendar_day,
            block_runs_on_day: blockCalendarDay.Block_Runs_On_Day,
        };
    });
};

export const mapTflStopPoints = (stopPointData: TflStopPointSchema): TflStopPoint[] => {
    return stopPointData.Stop_Point.map((stopPoint) => ({
        id: stopPoint["@_aStop_Point_Idx"],
        stop_code_lbsl: stopPoint.Stop_Code_LBSL || null,
        stop_name: stopPoint.Stop_Name,
        location_easting: stopPoint.Location_Easting || null,
        location_northing: stopPoint.Location_Northing || null,
        location_longitude: stopPoint.Location_Longitude,
        location_latitude: stopPoint.Location_Latitude,
        point_letter: stopPoint.Point_Letter || null,
        naptan_code: stopPoint.NaPTAN_Code || null,
        sms_code: stopPoint.SMS_Code || null,
        stop_area: stopPoint.Stop_Area,
        borough_code: stopPoint.Borough_Code || null,
        heading: stopPoint.Heading || null,
        stop_type: stopPoint.Stop_Type,
        street_name: stopPoint.Street_Name || null,
        post_code: stopPoint.Post_Code || null,
        towards: stopPoint.Towards,
    }));
};

export const mapTflDestinations = (destinationData: TflDestinationSchema): TflDestination[] => {
    return destinationData.Destination.map((destination) => ({
        id: destination["@_aDestination_Idx"],
        long_destination_name: destination.Long_Destination_Name,
        short_destination_name: destination.Short_Destination_Name || null,
    }));
};

export const mapTflRouteGeometries = (routeGeometryData: TflRouteGeometrySchema): TflRouteGeometry[] => {
    return routeGeometryData.Route_Geometry.map((routeGeometry) => {
        const contract_line_no = routeGeometry["@_aContract_Line_No"];
        const lbsl_run_no = routeGeometry["@_aLBSL_Run_No"];
        const sequence_no = routeGeometry["@_aSequence_No"];
        const id = `${contract_line_no}-${lbsl_run_no}-${sequence_no}`;

        return {
            id,
            contract_line_no,
            lbsl_run_no,
            sequence_no,
            direction: routeGeometry.Direction,
            location_easting: routeGeometry.Location_Easting,
            location_northing: routeGeometry.Location_Northing,
            location_longitude: routeGeometry.Location_Longitude,
            location_latitude: routeGeometry.Location_Latitude,
        };
    });
};

export const mapTflLines = (lineData: TflLineSchema): TflLine[] => {
    return lineData.Line.map((line) => ({
        id: line["@_aContract_Line_No"],
        service_line_no: line.Service_Line_No,
        logical_line_no: line.Logical_Line_No,
    }));
};

export const mapTflPatterns = (patternData: TflPatternSchema): TflPattern[] => {
    return patternData.Pattern.map((pattern) => ({
        id: pattern["@_aPattern_Idx"],
        contract_line_no: pattern["@_aContract_Line_No"],
        direction: pattern.Direction,
        type: pattern.Type,
    }));
};

export const mapTflStopInPatterns = (stopInPatternData: TflStopInPatternSchema): TflStopInPattern[] => {
    return stopInPatternData.Stop_In_Pattern.map((stopInPattern) => ({
        id: stopInPattern["@_aStop_In_Pattern_Idx"],
        pattern_id: stopInPattern["@_aPattern_Idx"],
        destination_id: stopInPattern["@_aDestination_Idx"] || null,
        stop_point_id: stopInPattern["@_aStop_Point_Idx"],
        sequence_no: stopInPattern.Sequence_No,
        timing_point_code: stopInPattern.Timing_Point_Code,
    }));
};

export const mapTflJourneys = (journeyData: TflJourneySchema): TflJourney[] => {
    return journeyData.Journey.map((journey) => ({
        id: journey["@_aJourney_Idx"],
        pattern_id: journey["@_aPattern_Idx"],
        block_id: journey["@_aBlock_Idx"],
        trip_no_lbsl: journey.Trip_No_LBSL,
        type: journey.Type,
        start_time: journey.Start_Time,
    }));
};

export const mapTflJourneyWaitTimes = (journeyWaitTimeData: TflJourneyWaitTimeSchema): TflJourneyWaitTime[] => {
    return journeyWaitTimeData.Journey_Wait_Time.map((journeyWaitTime) => {
        const journey_id = journeyWaitTime["@_aJourney_Idx"];
        const stop_in_pattern_id = journeyWaitTime["@_aStop_In_Pattern_Idx"];
        const id = `${journey_id}-${stop_in_pattern_id}`;

        return {
            id,
            journey_id,
            stop_in_pattern_id,
            wait_time: journeyWaitTime.Wait_Time,
        };
    });
};

export const mapTflJourneyDriveTimes = (journeyDriveTimeData: TflJourneyDriveTimeSchema): TflJourneyDriveTime[] => {
    return journeyDriveTimeData.Journey_Drive_Time.map((journeyDriveTime) => {
        const journey_id = journeyDriveTime["@_aJourney_Idx"];
        const stop_in_pattern_from_id = journeyDriveTime["@_aStop_In_Pattern_From_Idx"];
        const stop_in_pattern_to_id = journeyDriveTime["@_aStop_In_Pattern_To_Idx"];
        const id = `${journey_id}-${stop_in_pattern_from_id}-${stop_in_pattern_to_id}`;

        return {
            id,
            journey_id,
            stop_in_pattern_from_id,
            stop_in_pattern_to_id,
            drive_time: journeyDriveTime.Drive_Time,
        };
    });
};
