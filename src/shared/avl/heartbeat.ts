import { XMLBuilder } from "fast-xml-parser";
import { HeartbeatNotification } from "../schema";
import { CompleteSiriObject } from "./utils";

export const generateHeartbeatNotificationXml = (subscriptionId: string, currentTimestamp: string) => {
    const subscriptionRequestJson: HeartbeatNotification = {
        Siri: {
            HeartbeatNotification: {
                RequestTimestamp: currentTimestamp,
                ProducerRef: subscriptionId,
                Status: "true",
                ServiceStartedTime: currentTimestamp,
            },
        },
    };

    const completeObject: CompleteSiriObject<HeartbeatNotification["Siri"]> = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
            ...subscriptionRequestJson.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};
