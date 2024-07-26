const errorDetails: { [key: string]: string } = {
    Bearing: "",
    BlockRef:
        "Mandatory elements missing in 'BlockRef' field. BlockRef is mandatory to provide. Please make sure that the value provided here matches the corresponding Block element in your timetables data.",
    DestinationRef:
        "Mandatory elements missing in 'DestinationRef' field. DestinationRef is mandatory to provide. This shall be a valid ATCOCode from the NaPTAN database. Please make sure the value provided here matches the corresponding DestinationRef element in your timetables data.",
    DirectionRef:
        "Mandatory elements missing in 'DirectionRef' field. DirectionRef is mandatory to provide. This usually provides the direction of the trip (inbound/outbound). Please make sure the value provided here matches the corresponding element in your timetables data.",
    LineRef:
        "Mandatory elements missing in 'LineRef' field. LineRef is mandatory to provide. This usually contains the name or number by which the line is known to public. Please make sure the value provided here matches the corresponding element in your timetables data.",
    "Monitored-VehicleJourney": "",
    OperatorRef: "",
    OriginName:
        "Mandatory elements missing in 'OriginName' field. OriginName is mandatory to provide. This is the name of the origin of the journey; used to help identify the vehicle to the public. This shall be the same as the corresponding object in the timetables data.",
    OriginRef:
        "Mandatory elements missing in 'OriginRef' field. OriginRef is mandatory to provide. This is the identifier of the origin of the journey; used to help identify the vehicle journey on arrival boards.This shall be a valid ATCOCode from the NaPTAN database, and same as the ID to the corresponding object in the timetables data.",
    ProducerRef: "",
    PublishedLineName:
        "Mandatory elements missing in 'PublishedLineName' field. PublishedLineName is mandatory to provide. This is the name or number by which the Line is known to the public. This must be the same ID as the corresponding object in the timetables data in BODS.",
    RecordedAtTime: "",
    ResponseTimestamp: "",
    ValidUntilTime: "",
    VehicleJourneyRef:
        "Mandatory elements missing in 'VehicleJourneyRef' field. VehicleJourneyRef is mandatory to provide. This shall be the same as the corresponding object in the timetables data and should be a globally unique identifier",
    VehicleLocation: "",
    VehicleMonitoringDelivery: "",
};

export const getErrorDetail = (field: string) => errorDetails[field] ?? "";
